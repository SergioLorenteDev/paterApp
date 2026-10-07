import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class WorkOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const workOrders = await this.prisma.workOrder.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        caseId: true,
        assetId: true,
        kind: true,
        outcome: true,
      },
    });

    return workOrders;
  }

  async getById(id: string) {
    const workOrder = await this.prisma.workOrder.findUnique({
      where: { id },
      select: {
        id: true,
        caseId: true,
        assetId: true,
        technicianId: true,
        workedHours: true,
        outcome: true,
      },
    });

    if (!workOrder) {
      throw new NotFoundException(`No existe la orden de trabajo ${id}`);
    }

    return {
      ...workOrder,
      workedHours: workOrder.workedHours ? Number(workOrder.workedHours) : null,
    };
  }
}
