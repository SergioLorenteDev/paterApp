import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { createReadStream } from 'node:fs';
import { Roles } from '../../common/roles/roles.decorator';
import { DocumentsService } from './documents.service';

function getContentType(fileFormat: string): string {
  const normalized = fileFormat.toLowerCase();
  if (normalized === 'pdf') {
    return 'application/pdf';
  }
  if (normalized === 'html') {
    return 'text/html; charset=utf-8';
  }
  return 'application/octet-stream';
}

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Roles('technician', 'manager', 'commercial')
  @Get(':id/file')
  async getDocumentFile(@Param('id') id: string, @Res() res: Response) {
    const document = await this.documentsService.getDocumentFileInfo(id);

    if (document.localFileExists && document.localAbsolutePath) {
      res.setHeader('Content-Type', getContentType(document.fileFormat));
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${document.id}.${document.fileFormat.toLowerCase()}"`,
      );
      createReadStream(document.localAbsolutePath).pipe(res);
      return;
    }

    if (document.sourceUrl) {
      res.redirect(document.sourceUrl);
      return;
    }

    throw new NotFoundException(`No hay archivo disponible para el documento ${id}`);
  }
}
