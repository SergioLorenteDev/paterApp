import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { DocumentType } from '@prisma/client';
import { Roles } from '../../common/roles/roles.decorator';
import { AssetsService } from './assets.service';

@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Roles('technician', 'manager', 'commercial')
  @Get()
  list() {
    return this.assetsService.list();
  }

  @Roles('technician', 'manager', 'commercial')
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.assetsService.getById(id);
  }

  @Roles('technician', 'manager', 'commercial')
  @Get(':id/context')
  getContext(@Param('id') id: string) {
    return this.assetsService.getContext(id);
  }

  @Roles('technician', 'manager', 'commercial')
  @Get(':id/documents')
  getDocumentationByAsset(
    @Param('id') id: string,
    @Query('language') language?: string,
    @Query('documentType') documentType?: string,
  ) {
    const allowedDocumentTypes = Object.values(DocumentType);

    if (documentType && !allowedDocumentTypes.includes(documentType as DocumentType)) {
      throw new BadRequestException(
        `documentType invalido. Valores permitidos: ${allowedDocumentTypes.join(', ')}`,
      );
    }

    return this.assetsService.getDocumentationByAsset(id, {
      language,
      documentType: documentType as DocumentType | undefined,
    });
  }

  @Roles('technician', 'manager', 'commercial')
  @Get(':id/ai-context')
  getAiContextByAsset(
    @Param('id') id: string,
    @Query('language') language?: string,
    @Query('documentType') documentType?: string,
    @Query('maxChunks') maxChunks?: string,
  ) {
    const allowedDocumentTypes = Object.values(DocumentType);

    if (documentType && !allowedDocumentTypes.includes(documentType as DocumentType)) {
      throw new BadRequestException(
        `documentType invalido. Valores permitidos: ${allowedDocumentTypes.join(', ')}`,
      );
    }

    const parsedMaxChunks = maxChunks ? Number.parseInt(maxChunks, 10) : undefined;
    if (maxChunks && (parsedMaxChunks === undefined || Number.isNaN(parsedMaxChunks) || parsedMaxChunks < 1)) {
      throw new BadRequestException('maxChunks debe ser un entero positivo.');
    }

    return this.assetsService.getAiContextByAsset(id, {
      language,
      documentType: documentType as DocumentType | undefined,
      maxChunks: parsedMaxChunks,
    });
  }
}
