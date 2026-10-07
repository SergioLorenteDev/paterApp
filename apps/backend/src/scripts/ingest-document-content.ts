import { DocumentIngestionStatus, PrismaClient } from '@prisma/client';
import { mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const prisma = new PrismaClient();
const STORAGE_DIR = resolve(process.cwd(), 'storage/documents');
const MAX_TEXT_LENGTH = 1_000_000;

function hasPdftotext(): boolean {
  const result = spawnSync('which', ['pdftotext'], { encoding: 'utf8' });
  return result.status === 0;
}

function hasPdfToPpm(): boolean {
  const result = spawnSync('which', ['pdftoppm'], { encoding: 'utf8' });
  return result.status === 0;
}

function hasTesseract(): boolean {
  const result = spawnSync('which', ['tesseract'], { encoding: 'utf8' });
  return result.status === 0;
}

function normalizeExtension(url: string, fileFormat: string): string {
  if (fileFormat.toLowerCase() === 'html') {
    return 'html';
  }
  if (url.toLowerCase().includes('.pdf')) {
    return 'pdf';
  }
  return fileFormat.toLowerCase() || 'bin';
}

function sanitizeText(text: string): string {
  return text.replace(/\u0000/g, '').trim().slice(0, MAX_TEXT_LENGTH);
}

function isPdfBuffer(buffer: Buffer): boolean {
  return buffer.slice(0, 5).toString('utf8') === '%PDF-';
}

function extractReadableTextFromHtml(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  const withBreaks = withoutScripts
    .replace(/<\/(p|div|section|article|li|h1|h2|h3|h4|h5|h6|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');

  const text = withBreaks
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ');

  return sanitizeText(text);
}

function isHtmlResponse(contentType: string | null, buffer: Buffer): boolean {
  const header = (contentType ?? '').toLowerCase();
  if (header.includes('text/html') || header.includes('application/xhtml+xml')) {
    return true;
  }

  const probe = buffer.slice(0, 512).toString('utf8').trim().toLowerCase();
  return probe.startsWith('<!doctype html') || probe.startsWith('<html');
}

async function extractTextWithOcr(pdfPath: string, maxPages: number): Promise<string> {
  const tempBase = await mkdtemp(resolve(tmpdir(), 'paterapp-ocr-'));
  const imagePrefix = resolve(tempBase, 'page');

  try {
    const ppmResult = spawnSync(
      'pdftoppm',
      ['-png', '-f', '1', '-l', `${maxPages}`, '-r', '160', pdfPath, imagePrefix],
      { encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 },
    );

    if (ppmResult.status !== 0) {
      return '';
    }

    const files = (await readdir(tempBase))
      .filter((file) => file.endsWith('.png'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const ocrParts: string[] = [];
    for (const file of files) {
      const imagePath = resolve(tempBase, file);
      const ocrResult = spawnSync('tesseract', [imagePath, 'stdout', '-l', 'eng'], {
        encoding: 'utf8',
        maxBuffer: 30 * 1024 * 1024,
      });
      if (ocrResult.status === 0 && ocrResult.stdout.trim().length > 0) {
        ocrParts.push(ocrResult.stdout);
      }
    }

    return ocrParts.join('\n');
  } finally {
    await rm(tempBase, { recursive: true, force: true });
  }
}

async function processDocument(
  documentId: string,
  options: {
    retryFailed: boolean;
    retryDownloaded: boolean;
    canParsePdf: boolean;
    canOcrPdf: boolean;
  },
) {
  const document = await prisma.technicalDocument.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      sourceUrl: true,
      fileFormat: true,
      ingestionStatus: true,
    },
  });

  if (!document) {
    // eslint-disable-next-line no-console
    console.warn(`Documento no encontrado: ${documentId}`);
    return;
  }

  if (
    document.ingestionStatus === DocumentIngestionStatus.parsed
  ) {
    // eslint-disable-next-line no-console
    console.log(`Documento ${document.id} omitido: ya ingerido (${document.ingestionStatus}).`);
    return;
  }

  if (
    document.ingestionStatus === DocumentIngestionStatus.downloaded &&
    !options.retryDownloaded
  ) {
    // eslint-disable-next-line no-console
    console.log(`Documento ${document.id} omitido: estado downloaded y retryDownloaded desactivado.`);
    return;
  }

  if (document.ingestionStatus === DocumentIngestionStatus.failed && !options.retryFailed) {
    // eslint-disable-next-line no-console
    console.log(`Documento ${document.id} omitido: estado failed y retry desactivado.`);
    return;
  }

  try {
    const response = await fetch(document.sourceUrl, {
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      throw new Error(`Descarga fallida (${response.status})`);
    }

    const initialExtension = normalizeExtension(document.sourceUrl, document.fileFormat);
    const responseBuffer = Buffer.from(await response.arrayBuffer());
    const htmlDetected = isHtmlResponse(response.headers.get('content-type'), responseBuffer);
    const extension = htmlDetected ? 'html' : initialExtension;
    const localRelativePath = `storage/documents/${document.id}.${extension}`;
    const localAbsolutePath = resolve(process.cwd(), localRelativePath);

    await mkdir(STORAGE_DIR, { recursive: true });

    if (extension === 'html' && document.fileFormat.toLowerCase() === 'html') {
      const html = responseBuffer.toString('utf8');
      const sanitized = extractReadableTextFromHtml(html);
      const hasReadableText = sanitized.length >= 400;
      await writeFile(localAbsolutePath, html, 'utf8');

      if (!hasReadableText) {
        await prisma.technicalDocument.update({
          where: { id: document.id },
          data: {
            localFilePath: localRelativePath,
            extractedText: null,
            extractionMethod: null,
            ingestionStatus: DocumentIngestionStatus.failed,
            ingestionError:
              'HTML sin contenido técnico legible suficiente para IA. Requiere fuente más específica.',
            lastIngestedAt: new Date(),
          },
        });
        // eslint-disable-next-line no-console
        console.warn(`Documento ${document.id} fallido: HTML sin texto técnico suficiente.`);
        return;
      }

      await prisma.technicalDocument.update({
        where: { id: document.id },
        data: {
          localFilePath: localRelativePath,
          extractedText: sanitized,
          extractionMethod: 'html_text',
          ingestionStatus: DocumentIngestionStatus.parsed,
          ingestionError: null,
          lastIngestedAt: new Date(),
        },
      });

      // eslint-disable-next-line no-console
      console.log(`Documento ${document.id} parseado como HTML legible.`);
      return;
    }

    if (htmlDetected && document.fileFormat.toLowerCase() === 'pdf') {
      await prisma.technicalDocument.update({
        where: { id: document.id },
        data: {
          localFilePath: null,
          extractedText: null,
          extractionMethod: null,
          ingestionStatus: DocumentIngestionStatus.failed,
          ingestionError:
            'La URL fuente devuelve HTML de portal, no PDF directo. Actualiza sourceUrl a enlace PDF descargable.',
          lastIngestedAt: new Date(),
        },
      });
      // eslint-disable-next-line no-console
      console.warn(`Documento ${document.id} fallido: fuente HTML para documento PDF.`);
      return;
    }

    await writeFile(localAbsolutePath, responseBuffer);

    if (extension === 'pdf' && !isPdfBuffer(responseBuffer)) {
      await prisma.technicalDocument.update({
        where: { id: document.id },
        data: {
          localFilePath: localRelativePath,
          extractedText: null,
          extractionMethod: null,
          ingestionStatus: DocumentIngestionStatus.failed,
          ingestionError: 'El archivo descargado no tiene cabecera PDF valida (%PDF-).',
          lastIngestedAt: new Date(),
        },
      });
      // eslint-disable-next-line no-console
      console.warn(`Documento ${document.id} fallido: archivo no PDF valido.`);
      return;
    }

    if (extension === 'pdf' && options.canParsePdf) {
      const parseResult = spawnSync('pdftotext', ['-layout', localAbsolutePath, '-'], {
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024,
      });

      if (parseResult.status === 0 && parseResult.stdout.trim().length > 0) {
        await prisma.technicalDocument.update({
          where: { id: document.id },
          data: {
            localFilePath: localRelativePath,
            extractedText: sanitizeText(parseResult.stdout),
            extractionMethod: 'pdftotext',
            ingestionStatus: DocumentIngestionStatus.parsed,
            ingestionError: null,
            lastIngestedAt: new Date(),
          },
        });
        // eslint-disable-next-line no-console
        console.log(`Documento ${document.id} descargado y parseado con pdftotext.`);
        return;
      }
    }

    if (extension === 'pdf' && options.canOcrPdf) {
      const ocrText = await extractTextWithOcr(localAbsolutePath, 30);
      if (ocrText.trim().length > 0) {
        await prisma.technicalDocument.update({
          where: { id: document.id },
          data: {
            localFilePath: localRelativePath,
            extractedText: sanitizeText(ocrText),
            extractionMethod: 'ocr_tesseract',
            ingestionStatus: DocumentIngestionStatus.parsed,
            ingestionError: null,
            lastIngestedAt: new Date(),
          },
        });
        // eslint-disable-next-line no-console
        console.log(`Documento ${document.id} descargado y parseado con OCR.`);
        return;
      }
    }

    await prisma.technicalDocument.update({
      where: { id: document.id },
      data: {
        localFilePath: localRelativePath,
        extractionMethod: null,
        ingestionStatus: DocumentIngestionStatus.downloaded,
        ingestionError:
          options.canParsePdf || options.canOcrPdf
            ? 'Sin texto extraido con parse nativo ni OCR.'
            : 'pdftotext y OCR no disponibles.',
        lastIngestedAt: new Date(),
      },
    });
    // eslint-disable-next-line no-console
    console.log(`Documento ${document.id} descargado. Extraccion pendiente.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    await prisma.technicalDocument.update({
      where: { id: document.id },
      data: {
        ingestionStatus: DocumentIngestionStatus.failed,
        ingestionError: message,
        lastIngestedAt: new Date(),
      },
    });
    // eslint-disable-next-line no-console
    console.error(`Error en ${document.id}: ${message}`);
  }
}

async function run() {
  const retryFailed = process.argv.includes('--retry-failed');
  const retryDownloaded = process.argv.includes('--retry-downloaded');
  const onlyPending = process.argv.includes('--only-pending');
  const canParsePdf = hasPdftotext();
  const canOcrPdf = hasPdfToPpm() && hasTesseract();

  const statuses: DocumentIngestionStatus[] = [DocumentIngestionStatus.pending];
  if (retryFailed) {
    statuses.push(DocumentIngestionStatus.failed);
  }
  if (retryDownloaded) {
    statuses.push(DocumentIngestionStatus.downloaded);
  }

  const whereClause = onlyPending
    ? { ingestionStatus: DocumentIngestionStatus.pending, isActive: true }
    : { isActive: true, ingestionStatus: { in: statuses } };

  const documents = await prisma.technicalDocument.findMany({
    where: whereClause,
    orderBy: { id: 'asc' },
    select: { id: true },
  });

  // eslint-disable-next-line no-console
  console.log(
    `Iniciando ingesta de ${documents.length} documentos. pdftotext: ${canParsePdf ? 'si' : 'no'} · OCR: ${canOcrPdf ? 'si' : 'no'}.`,
  );

  for (const document of documents) {
    await processDocument(document.id, {
      retryFailed,
      retryDownloaded,
      canParsePdf,
      canOcrPdf,
    });
  }
}

run()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Error en ingesta de contenido documental:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
