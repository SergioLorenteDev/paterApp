import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { resolve } from 'node:path';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDocumentFileInfo(documentId: string) {
    const document = await this.prisma.technicalDocument.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        title: true,
        fileFormat: true,
        sourceUrl: true,
        localFilePath: true,
      },
    });

    if (!document) {
      throw new NotFoundException(`No existe el documento ${documentId}`);
    }

    const localAbsolutePath = document.localFilePath
      ? resolve(process.cwd(), document.localFilePath)
      : null;

    let localFileExists = false;
    if (localAbsolutePath) {
      try {
        await access(localAbsolutePath, fsConstants.R_OK);
        localFileExists = true;
      } catch {
        localFileExists = false;
      }
    }

    return {
      id: document.id,
      title: document.title,
      fileFormat: document.fileFormat,
      sourceUrl: document.sourceUrl,
      localAbsolutePath,
      localFileExists,
    };
  }
}
