import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class CasesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.case.findMany({
      orderBy: { openedAt: 'desc' },
      select: {
        id: true,
        assetId: true,
        severity: true,
        status: true,
        openedAt: true,
      },
    });
  }

  async getById(id: string) {
    const foundCase = await this.prisma.case.findUnique({
      where: { id },
      select: {
        id: true,
        assetId: true,
        severity: true,
        status: true,
        openedAt: true,
        closedAt: true,
        rootCause: true,
        resolution: true,
      },
    });

    if (!foundCase) {
      throw new NotFoundException(`No existe el caso ${id}`);
    }

    return foundCase;
  }

  async updateStatus(
    id: string,
    status: 'open' | 'in_progress' | 'blocked' | 'closed',
  ) {
    const foundCase = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM cases
      WHERE id = ${id}
      LIMIT 1
    `;

    if (foundCase.length === 0) {
      throw new NotFoundException(`No existe el caso ${id}`);
    }

    const updatedRows = await this.prisma.$queryRaw<Array<{ id: string; status: string }>>`
      UPDATE cases
      SET status = ${status},
          closed_at = CASE WHEN ${status} = 'closed' THEN NOW() ELSE NULL END
      WHERE id = ${id}
      RETURNING id, status
    `;

    const updated = updatedRows[0];

    return {
      ...updated,
      updatedAt: new Date().toISOString(),
    };
  }
}
