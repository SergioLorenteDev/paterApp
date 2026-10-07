import { DocumentIngestionStatus, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DEFAULT_CHUNK_SIZE = 1400;
const DEFAULT_OVERLAP = 200;

function splitIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\u0000/g, '').trim();
  if (!normalized) {
    return [];
  }

  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < normalized.length) {
    let end = Math.min(cursor + chunkSize, normalized.length);

    if (end < normalized.length) {
      const nearestBreak = normalized.lastIndexOf('\n\n', end);
      if (nearestBreak > cursor + Math.floor(chunkSize * 0.55)) {
        end = nearestBreak;
      }
    }

    const fragment = normalized.slice(cursor, end).trim();
    if (fragment.length > 0) {
      chunks.push(fragment);
    }

    if (end >= normalized.length) {
      break;
    }
    cursor = Math.max(0, end - overlap);
  }

  return chunks;
}

async function run() {
  const chunkSize = Number.parseInt(process.env.CHUNK_SIZE ?? `${DEFAULT_CHUNK_SIZE}`, 10);
  const overlap = Number.parseInt(process.env.CHUNK_OVERLAP ?? `${DEFAULT_OVERLAP}`, 10);

  const documents = await prisma.technicalDocument.findMany({
    where: {
      isActive: true,
      ingestionStatus: DocumentIngestionStatus.parsed,
      extractedText: {
        not: null,
      },
    },
    select: {
      id: true,
      extractedText: true,
    },
    orderBy: {
      id: 'asc',
    },
  });

  let totalChunks = 0;

  for (const document of documents) {
    const text = document.extractedText ?? '';
    const chunks = splitIntoChunks(text, chunkSize, overlap);

    await prisma.$transaction([
      prisma.technicalDocumentChunk.deleteMany({
        where: { technicalDocumentId: document.id },
      }),
      ...chunks.map((chunk, index) =>
        prisma.technicalDocumentChunk.create({
          data: {
            id: `${document.id}-CH-${String(index + 1).padStart(4, '0')}`,
            technicalDocumentId: document.id,
            chunkIndex: index + 1,
            content: chunk,
            charCount: chunk.length,
          },
        }),
      ),
    ]);

    totalChunks += chunks.length;
    // eslint-disable-next-line no-console
    console.log(`Documento ${document.id}: ${chunks.length} chunks.`);
  }

  // eslint-disable-next-line no-console
  console.log(`Generacion completada. Documentos: ${documents.length}, chunks: ${totalChunks}.`);
}

run()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Error al construir chunks documentales:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
