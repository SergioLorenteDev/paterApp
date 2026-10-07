import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentIngestionStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AskAiDto } from './dto/ask-ai.dto';

type CandidateChunk = {
  technicalDocumentId: string;
  chunkIndex: number;
  content: string;
  documentTitle: string;
  sourceUrl: string;
};
type AiMode = 'strict' | 'expanded';

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async ask(dto: AskAiDto) {
    const mode: AiMode = dto.mode === 'expanded' ? 'expanded' : 'strict';
    const asset = await this.prisma.asset.findUnique({
      where: { id: dto.assetId },
      select: {
        id: true,
        model: true,
        serialNumber: true,
        machineModelId: true,
      },
    });

    if (!asset) {
      throw new NotFoundException(`No existe el activo ${dto.assetId}`);
    }

    if (!asset.machineModelId) {
      return {
        provider: 'none',
        answer:
          'Este activo no tiene modelo documental asociado. Asigna machineModelId para habilitar respuestas contextuales.',
        citations: [],
      };
    }

    const chunks = await this.prisma.technicalDocumentChunk.findMany({
      where: {
        technicalDocument: {
          machineModelId: asset.machineModelId,
          isActive: true,
          ingestionStatus: DocumentIngestionStatus.parsed,
          extractionMethod: {
            not: 'html_raw',
          },
          ...(dto.language ? { language: dto.language } : {}),
        },
      },
      orderBy: [{ technicalDocumentId: 'asc' }, { chunkIndex: 'asc' }],
      take: 1500,
      select: {
        technicalDocumentId: true,
        chunkIndex: true,
        content: true,
        technicalDocument: {
          select: {
            title: true,
            sourceUrl: true,
          },
        },
      },
    });

    const candidates: CandidateChunk[] = chunks
      .map((chunk) => ({
        technicalDocumentId: chunk.technicalDocumentId,
        chunkIndex: chunk.chunkIndex,
        content: this.normalizeChunkText(chunk.content),
        documentTitle: chunk.technicalDocument.title,
        sourceUrl: chunk.technicalDocument.sourceUrl,
      }))
      .filter((chunk) => chunk.content.trim().length > 0 && !this.isNoisyChunk(chunk.content));

    const ranked = this.rankChunks(dto.question, candidates);
    const maxCitations = dto.maxCitations ?? 6;
    const selected = ranked.slice(0, maxCitations);

    if (selected.length === 0 && mode === 'strict') {
      return {
        provider: 'none',
        answer:
          'No hay fragmentos técnicos disponibles para este modelo con los filtros aplicados. Revisa la documentación cargada.',
        citations: [],
      };
    }

    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    const openaiModel = this.configService.get<string>('OPENAI_MODEL', 'gpt-5-mini');
    const geminiKey = this.configService.get<string>('GEMINI_API_KEY');
    const geminiModel = this.configService.get<string>('GEMINI_MODEL', 'gemini-2.5-flash');
    const provider = (this.configService.get<string>('AI_PROVIDER', 'auto') ?? 'auto').toLowerCase();

    const canUseGemini = !!geminiKey && (provider === 'gemini' || provider === 'auto');
    const canUseOpenAi = !!openaiKey && (provider === 'openai' || provider === 'auto');

    if (canUseGemini) {
      try {
        const aiResponse = await this.callGemini({
          apiKey: geminiKey as string,
          model: geminiModel,
          question: dto.question,
          assetId: asset.id,
          assetModel: asset.model,
          citations: selected,
          mode,
        });

        return {
          provider: 'gemini',
          answer: aiResponse,
          citations: selected.map((chunk) => this.toCitation(chunk)),
        };
      } catch {
        // Intentamos siguiente proveedor disponible.
      }
    }

    if (canUseOpenAi) {
      try {
        const aiResponse = await this.callOpenAi({
          apiKey: openaiKey as string,
          model: openaiModel,
          question: dto.question,
          assetId: asset.id,
          assetModel: asset.model,
          citations: selected,
          mode,
        });

        return {
          provider: 'openai',
          answer: aiResponse,
          citations: selected.map((chunk) => this.toCitation(chunk)),
        };
      } catch {
        // Si falla proveedor externo, respondemos con fallback local.
      }
    }

    return {
      provider: 'local_context',
      answer: this.buildFallbackAnswer(dto.question, selected, mode),
      citations: selected.map((chunk) => this.toCitation(chunk)),
    };
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 3);
  }

  private normalizeChunkText(raw: string): string {
    const noScripts = raw
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ');
    const stripped = noScripts.replace(/<[^>]+>/g, ' ');
    return stripped.replace(/\s+/g, ' ').trim();
  }

  private isNoisyChunk(text: string): boolean {
    const lowered = text.toLowerCase();
    const cssSignals =
      (lowered.match(/--ck-color|hsl\(|var\(--|\.min\.js|launch-|adobedtm|canonicalurl/gi) ?? [])
        .length;
    const tagSignals = (lowered.match(/<!doctype html|<html|<head|<body|href=|src=/gi) ?? [])
      .length;
    const words = this.tokenize(text).length;
    return cssSignals >= 2 || tagSignals >= 2 || words < 20;
  }

  private rankChunks(question: string, chunks: CandidateChunk[]): CandidateChunk[] {
    const questionTokens = new Set(this.tokenize(question));
    const scored = chunks
      .map((chunk) => {
        const chunkTokens = this.tokenize(chunk.content);
        let score = 0;
        for (const token of chunkTokens) {
          if (questionTokens.has(token)) {
            score += 1;
          }
        }
        return { chunk, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.chunk);

    if (scored.length > 0) {
      return scored;
    }

    return chunks.slice(0, 8);
  }

  private buildFallbackAnswer(question: string, chunks: CandidateChunk[], mode: AiMode): string {
    if (chunks.length === 0 && mode === 'expanded') {
      return (
        `No hay documentación interna suficiente para responder con evidencia directa sobre: "${question}".\n\n` +
        `Diagnóstico ampliado (hipótesis no documentales):\n` +
        `1) Verifica seguridad y bloqueo energético antes de intervenir.\n` +
        `2) Valida señales básicas: alimentación, alarmas activas, presión/temperatura/torque fuera de rango.\n` +
        `3) Aísla subsistema causante (eléctrico, hidráulico, mecánico, control).\n` +
        `4) Ejecuta prueba controlada y registra mediciones para cerrar causa raíz.\n\n` +
        `Importante: confirma cualquier acción con manual OEM y protocolo de planta antes de ejecutar en campo.`
      );
    }

    const preview = chunks
      .slice(0, 3)
      .map((chunk, index) => {
        const excerpt = chunk.content.replace(/\s+/g, ' ').slice(0, 220);
        return `${index + 1}. ${excerpt}...`;
      })
      .join('\n');

    const tail =
      mode === 'expanded'
        ? 'Si faltan datos, añade contraste técnico como hipótesis y valida en manual OEM antes de actuar.'
        : 'Recomendación: valida estos pasos en el manual citado antes de actuar en campo.';

    return (
      `He revisado la documentación técnica del modelo para tu consulta: "${question}".\n\n` +
      `Fragmentos más relevantes:\n${preview}\n\n` +
      `${tail}`
    );
  }

  private toCitation(chunk: CandidateChunk) {
    return {
      documentId: chunk.technicalDocumentId,
      title: chunk.documentTitle,
      sourceUrl: chunk.sourceUrl,
      chunkIndex: chunk.chunkIndex,
      excerpt: chunk.content.replace(/\s+/g, ' ').slice(0, 260),
    };
  }

  private async callOpenAi(params: {
    apiKey: string;
    model: string;
    question: string;
    assetId: string;
    assetModel: string;
    citations: CandidateChunk[];
    mode: AiMode;
  }): Promise<string> {
    const context = params.citations
      .map(
        (chunk) =>
          `[${chunk.technicalDocumentId}#${chunk.chunkIndex}] ${chunk.documentTitle}\n${chunk.content.slice(0, 1800)}`,
      )
      .join('\n\n');

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.model,
        input: [
          {
            role: 'system',
            content:
              params.mode === 'expanded'
                ? 'Eres un asistente técnico industrial. Responde en español. Prioriza el contexto documental interno y, si es insuficiente, aporta diagnóstico técnico general como hipótesis claramente etiquetada. Nunca presentes hipótesis como hecho confirmado.'
                : 'Eres un asistente técnico industrial. Responde en español, usa solo el contexto dado y no inventes datos.',
          },
          {
            role: 'user',
            content:
              `Activo ${params.assetId} (${params.assetModel}). Pregunta: ${params.question}\n\n` +
              `Contexto documental:\n${context}\n\n` +
              (params.mode === 'expanded'
                ? 'Devuelve: 1) Evidencia interna 2) Hipótesis y contraste técnico externo 3) Verificaciones de seguridad.'
                : 'Da una respuesta práctica, breve y segura para operario.'),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI error ${response.status}`);
    }

    const json = (await response.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ text?: string }> }>;
    };

    if (json.output_text && json.output_text.trim().length > 0) {
      return json.output_text;
    }

    const text =
      json.output
        ?.flatMap((entry) => entry.content ?? [])
        .map((content) => content.text ?? '')
        .join('\n')
        .trim() ?? '';

    if (!text) {
      throw new Error('Respuesta vacía del proveedor IA');
    }

    return text;
  }

  private async callGemini(params: {
    apiKey: string;
    model: string;
    question: string;
    assetId: string;
    assetModel: string;
    citations: CandidateChunk[];
    mode: AiMode;
  }): Promise<string> {
    const context = params.citations
      .map(
        (chunk) =>
          `[${chunk.technicalDocumentId}#${chunk.chunkIndex}] ${chunk.documentTitle}\n${chunk.content.slice(0, 1800)}`,
      )
      .join('\n\n');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent?key=${params.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text:
                  params.mode === 'expanded'
                    ? 'Eres un asistente técnico industrial. Responde en español. Prioriza el contexto documental interno y, si no alcanza, agrega diagnóstico técnico general como hipótesis claramente etiquetada. No presentes hipótesis como hechos confirmados.'
                    : 'Eres un asistente técnico industrial. Responde en español, usa solo el contexto dado y no inventes datos.',
              },
            ],
          },
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text:
                    `Activo ${params.assetId} (${params.assetModel}). Pregunta: ${params.question}\n\n` +
                    `Contexto documental:\n${context}\n\n` +
                    (params.mode === 'expanded'
                      ? 'Devuelve: 1) Evidencia interna 2) Hipótesis y contraste técnico externo 3) Verificaciones de seguridad.'
                      : 'Da una respuesta práctica, breve y segura para operario.'),
                },
              ],
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Gemini error ${response.status}`);
    }

    const json = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const text =
      json.candidates
        ?.flatMap((candidate) => candidate.content?.parts ?? [])
        .map((part) => part.text ?? '')
        .join('\n')
        .trim() ?? '';

    if (!text) {
      throw new Error('Respuesta vacía de Gemini');
    }

    return text;
  }
}
