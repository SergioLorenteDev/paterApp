import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { DocumentIngestionStatus, DocumentType } from '@prisma/client';

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.asset.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        serialNumber: true,
        model: true,
        status: true,
        customerId: true,
      },
    });
  }

  async getById(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      select: {
        id: true,
        serialNumber: true,
        model: true,
        machineModelId: true,
        status: true,
        location: true,
        warrantyEndDate: true,
      },
    });

    if (!asset) {
      throw new NotFoundException(`No existe el activo ${id}`);
    }

    return asset;
  }

  async getContext(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      select: {
        id: true,
        serialNumber: true,
        model: true,
        machineModelId: true,
        status: true,
        location: true,
        installedAt: true,
        warrantyEndDate: true,
        customerId: true,
      },
    });

    if (!asset) {
      throw new NotFoundException(`No existe el activo ${id}`);
    }

    const [cases, workOrders] = await Promise.all([
      this.prisma.case.findMany({
        where: { assetId: id },
        orderBy: { openedAt: 'desc' },
        select: {
          id: true,
          severity: true,
          status: true,
          openedAt: true,
          closedAt: true,
        },
      }),
      this.prisma.workOrder.findMany({
        where: { assetId: id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          kind: true,
          outcome: true,
          workedHours: true,
          technicianId: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      asset,
      cases,
      workOrders: workOrders.map((workOrder) => ({
        ...workOrder,
        workedHours: workOrder.workedHours ? Number(workOrder.workedHours) : null,
      })),
    };
  }

  async getDocumentationByAsset(
    assetId: string,
    filters: { language?: string; documentType?: DocumentType },
  ) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        serialNumber: true,
        model: true,
        machineModelId: true,
      },
    });

    if (!asset) {
      throw new NotFoundException(`No existe el activo ${assetId}`);
    }

    if (!asset.machineModelId) {
      return {
        asset,
        machineModel: null,
        documents: [],
      };
    }

    const whereClause = {
      machineModelId: asset.machineModelId,
      isActive: true,
      ...(filters.language ? { language: filters.language } : {}),
      ...(filters.documentType ? { documentType: filters.documentType } : {}),
    };

    const [machineModel, documents] = await Promise.all([
      this.prisma.machineModel.findUnique({
        where: { id: asset.machineModelId },
        select: {
          id: true,
          code: true,
          name: true,
          family: true,
          manufacturer: {
            select: {
              id: true,
              name: true,
              websiteUrl: true,
            },
          },
        },
      }),
      this.prisma.technicalDocument.findMany({
        where: whereClause,
        orderBy: [{ documentType: 'asc' }, { title: 'asc' }],
        select: {
          id: true,
          title: true,
          documentType: true,
          language: true,
          sourceUrl: true,
          fileFormat: true,
          revision: true,
          publicationDate: true,
          pageCount: true,
          accessLevel: true,
          isOfficial: true,
          ingestionStatus: true,
          extractionMethod: true,
          localFilePath: true,
          keywords: true,
        },
      }),
    ]);

    return {
      asset,
      machineModel,
      documents,
    };
  }

  async getAiContextByAsset(
    assetId: string,
    filters: { language?: string; documentType?: DocumentType; maxChunks?: number },
  ) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        serialNumber: true,
        model: true,
        machineModelId: true,
      },
    });

    if (!asset) {
      throw new NotFoundException(`No existe el activo ${assetId}`);
    }

    if (!asset.machineModelId) {
      return {
        asset,
        machineModel: null,
        documents: [],
        chunks: [],
      };
    }

    const machineModel = await this.prisma.machineModel.findUnique({
      where: { id: asset.machineModelId },
      select: {
        id: true,
        code: true,
        name: true,
        family: true,
        manufacturer: {
          select: {
            id: true,
            name: true,
            websiteUrl: true,
          },
        },
      },
    });

    const maxChunks = Math.max(1, Math.min(filters.maxChunks ?? 20, 80));

    const documentWhere = {
      machineModelId: asset.machineModelId,
      isActive: true,
      ingestionStatus: DocumentIngestionStatus.parsed,
      ...(filters.language ? { language: filters.language } : {}),
      ...(filters.documentType ? { documentType: filters.documentType } : {}),
    };

    const documents = await this.prisma.technicalDocument.findMany({
      where: documentWhere,
      orderBy: [{ documentType: 'asc' }, { title: 'asc' }],
      select: {
        id: true,
        title: true,
        documentType: true,
        language: true,
        sourceUrl: true,
        revision: true,
        publicationDate: true,
        extractionMethod: true,
      },
    });

    const chunks = await this.prisma.technicalDocumentChunk.findMany({
      where: {
        technicalDocument: documentWhere,
      },
      orderBy: [{ technicalDocumentId: 'asc' }, { chunkIndex: 'asc' }],
      take: maxChunks,
      select: {
        id: true,
        technicalDocumentId: true,
        chunkIndex: true,
        charCount: true,
        content: true,
      },
    });

    return {
      asset,
      machineModel,
      documents,
      chunks,
    };
  }
}
