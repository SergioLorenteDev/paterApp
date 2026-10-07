import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

type Severity = 'low' | 'medium' | 'high' | 'critical';

@Injectable()
export class KpisService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [openCasesRows, slaRiskCasesRows, closedCases, recentCases, caseTimeline, openCaseDetails] =
      await Promise.all([
      this.prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int AS count
        FROM cases
        WHERE status IN ('open', 'in_progress', 'blocked')
      `,
      this.prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int AS count
        FROM cases
        WHERE status IN ('open', 'in_progress', 'blocked')
          AND severity IN ('high', 'critical')
      `,
      this.prisma.$queryRaw<
        Array<{
          id: string;
          asset_id: string;
          severity: Severity;
          opened_at: Date;
          closed_at: Date | null;
          work_order_count: number;
        }>
      >`
        SELECT c.id, c.asset_id, c.severity, c.opened_at, c.closed_at, COUNT(wo.id)::int AS work_order_count
        FROM cases c
        LEFT JOIN work_orders wo ON wo.case_id = c.id
        WHERE c.status = 'closed'
          AND c.closed_at IS NOT NULL
        GROUP BY c.id, c.asset_id, c.severity, c.opened_at, c.closed_at
      `,
      this.prisma.$queryRaw<Array<{ asset_id: string }>>`
        SELECT asset_id
        FROM cases
        WHERE opened_at >= NOW() - INTERVAL '30 days'
      `,
      this.prisma.$queryRaw<Array<{ asset_id: string; opened_at: Date }>>`
        SELECT asset_id, opened_at
        FROM cases
        ORDER BY asset_id ASC, opened_at ASC
      `,
      this.prisma.$queryRaw<Array<{ severity: Severity; opened_at: Date }>>`
        SELECT severity, opened_at
        FROM cases
        WHERE status IN ('open', 'in_progress', 'blocked')
      `,
    ]);

    const [
      totalAssetsRows,
      documentedAssetsRows,
      totalModelsRows,
      documentedModelsRows,
      totalDocsRows,
      totalWorkOrdersRows,
      totalChunksRows,
      docsByTypeRows,
      docsByManufacturerRows,
      docsByLanguageRows,
      topModelsRows,
      docsWithRevisionRows,
      docsWithPublicationDateRows,
      parsedDocsRows,
    ] = await Promise.all([
        this.prisma.$queryRaw<Array<{ count: number }>>`
          SELECT COUNT(*)::int AS count
          FROM assets
        `,
        this.prisma.$queryRaw<Array<{ count: number }>>`
          SELECT COUNT(DISTINCT a.id)::int AS count
          FROM assets a
          JOIN technical_documents td ON td.machine_model_id = a.machine_model_id
          WHERE td.is_active = true
        `,
        this.prisma.$queryRaw<Array<{ count: number }>>`
          SELECT COUNT(*)::int AS count
          FROM machine_models
        `,
        this.prisma.$queryRaw<Array<{ count: number }>>`
          SELECT COUNT(DISTINCT machine_model_id)::int AS count
          FROM technical_documents
          WHERE is_active = true
        `,
        this.prisma.$queryRaw<Array<{ count: number }>>`
          SELECT COUNT(*)::int AS count
          FROM technical_documents
          WHERE is_active = true
        `,
        this.prisma.$queryRaw<Array<{ count: number }>>`
          SELECT COUNT(*)::int AS count
          FROM work_orders
        `,
        this.prisma.$queryRaw<Array<{ count: number }>>`
          SELECT COUNT(*)::int AS count
          FROM technical_document_chunks
        `,
        this.prisma.$queryRaw<Array<{ label: string; count: number }>>`
          SELECT document_type::text AS label, COUNT(*)::int AS count
          FROM technical_documents
          WHERE is_active = true
          GROUP BY document_type
          ORDER BY count DESC, label ASC
        `,
        this.prisma.$queryRaw<Array<{ label: string; count: number }>>`
          SELECT m.name AS label, COUNT(td.id)::int AS count
          FROM technical_documents td
          JOIN machine_models mm ON mm.id = td.machine_model_id
          JOIN manufacturers m ON m.id = mm.manufacturer_id
          WHERE td.is_active = true
          GROUP BY m.name
          ORDER BY count DESC, label ASC
        `,
        this.prisma.$queryRaw<Array<{ label: string; count: number }>>`
          SELECT language AS label, COUNT(*)::int AS count
          FROM technical_documents
          WHERE is_active = true
          GROUP BY language
          ORDER BY count DESC, label ASC
        `,
        this.prisma.$queryRaw<Array<{ label: string; count: number }>>`
          SELECT mm.name AS label, COUNT(td.id)::int AS count
          FROM technical_documents td
          JOIN machine_models mm ON mm.id = td.machine_model_id
          WHERE td.is_active = true
          GROUP BY mm.name
          ORDER BY count DESC, label ASC
          LIMIT 5
        `,
        this.prisma.$queryRaw<Array<{ count: number }>>`
          SELECT COUNT(*)::int AS count
          FROM technical_documents
          WHERE is_active = true
            AND revision IS NOT NULL
            AND revision <> ''
        `,
        this.prisma.$queryRaw<Array<{ count: number }>>`
          SELECT COUNT(*)::int AS count
          FROM technical_documents
          WHERE is_active = true
            AND publication_date IS NOT NULL
        `,
        this.prisma.$queryRaw<Array<{ count: number }>>`
          SELECT COUNT(*)::int AS count
          FROM technical_documents
          WHERE is_active = true
            AND ingestion_status = 'parsed'
        `,
      ]);

    const openCases = openCasesRows[0]?.count ?? 0;
    const slaRiskCases = slaRiskCasesRows[0]?.count ?? 0;

    const mttrHours = this.computeMttrHours(closedCases);
    const firstTimeFixRate = this.computeFirstTimeFixRate(closedCases);
    const repeatFailures30d = this.computeRepeatFailures30d(recentCases);
    const mtbfHours = this.computeMtbfHours(caseTimeline);
    const slaComplianceRate = this.computeSlaComplianceRate(closedCases);
    const overdueOpenCases = this.computeOverdueOpenCases(openCaseDetails);
    const workOrdersPerCase = this.computeWorkOrdersPerCase(closedCases);

    const totalAssets = totalAssetsRows[0]?.count ?? 0;
    const documentedAssets = documentedAssetsRows[0]?.count ?? 0;
    const totalModels = totalModelsRows[0]?.count ?? 0;
    const documentedModels = documentedModelsRows[0]?.count ?? 0;
    const totalTechnicalDocuments = totalDocsRows[0]?.count ?? 0;
    const totalWorkOrders = totalWorkOrdersRows[0]?.count ?? 0;
    const totalChunks = totalChunksRows[0]?.count ?? 0;
    const docsWithRevision = docsWithRevisionRows[0]?.count ?? 0;
    const docsWithPublicationDate = docsWithPublicationDateRows[0]?.count ?? 0;
    const parsedDocuments = parsedDocsRows[0]?.count ?? 0;
    const closedCasesCount = closedCases.length;

    const documentedAssetsRate =
      totalAssets === 0 ? 0 : Number(((documentedAssets / totalAssets) * 100).toFixed(2));
    const modelsWithDocumentationRate =
      totalModels === 0 ? 0 : Number(((documentedModels / totalModels) * 100).toFixed(2));
    const documentsPerModelAvg =
      documentedModels === 0 ? 0 : Number((totalTechnicalDocuments / documentedModels).toFixed(2));
    const parsedCoverageRate =
      totalTechnicalDocuments === 0
        ? 0
        : Number(((parsedDocuments / totalTechnicalDocuments) * 100).toFixed(2));
    const revisionCoverageRate =
      totalTechnicalDocuments === 0
        ? 0
        : Number(((docsWithRevision / totalTechnicalDocuments) * 100).toFixed(2));
    const publicationDateCoverageRate =
      totalTechnicalDocuments === 0
        ? 0
        : Number(((docsWithPublicationDate / totalTechnicalDocuments) * 100).toFixed(2));

    const hasEnoughClosedCases = closedCasesCount >= 3;

    return {
      generatedAt: new Date().toISOString(),
      muestra: {
        totalAssets,
        totalWorkOrders,
        closedCases: closedCasesCount,
      },
      servicio: {
        openCases,
        slaRiskCases,
        overdueOpenCases,
        repeatFailures30d,
        mttrHours: hasEnoughClosedCases ? mttrHours : null,
        mtbfHours: hasEnoughClosedCases ? mtbfHours : null,
        firstTimeFixRate: hasEnoughClosedCases ? firstTimeFixRate : null,
        slaComplianceRate: hasEnoughClosedCases ? slaComplianceRate : null,
        workOrdersPerCase: hasEnoughClosedCases ? workOrdersPerCase : null,
        tieneMuestraSuficiente: hasEnoughClosedCases,
      },
      documentacion: {
        totalTechnicalDocuments,
        totalChunks,
        documentsPerModelAvg,
        modelsWithDocumentationRate,
        documentedAssetsRate,
        byType: docsByTypeRows,
        byManufacturer: docsByManufacturerRows,
        byLanguage: docsByLanguageRows,
        topModels: topModelsRows,
      },
      calidadDatos: {
        parsedCoverageRate,
        revisionCoverageRate,
        publicationDateCoverageRate,
      },
    };
  }

  private computeMttrHours(
    closedCases: Array<{ opened_at: Date; closed_at: Date | null }>,
  ): number {
    const durations = closedCases
      .filter((item) => item.closed_at)
      .map((item) => {
        const diffMs = (item.closed_at as Date).getTime() - item.opened_at.getTime();
        return diffMs / (1000 * 60 * 60);
      })
      .filter((value) => value >= 0);

    if (durations.length === 0) {
      return 0;
    }

    const avg = durations.reduce((sum, value) => sum + value, 0) / durations.length;
    return Number(avg.toFixed(2));
  }

  private computeFirstTimeFixRate(
    closedCases: Array<{ work_order_count: number }>,
  ): number {
    const withWorkOrders = closedCases.filter((item) => item.work_order_count > 0);

    if (withWorkOrders.length === 0) {
      return 0;
    }

    const firstTimeFixCases = withWorkOrders.filter(
      (item) => item.work_order_count === 1,
    ).length;
    const ratio = (firstTimeFixCases / withWorkOrders.length) * 100;

    return Number(ratio.toFixed(2));
  }

  private computeMtbfHours(caseTimeline: Array<{ asset_id: string; opened_at: Date }>): number {
    const byAsset = new Map<string, Date[]>();
    for (const item of caseTimeline) {
      const current = byAsset.get(item.asset_id) ?? [];
      current.push(item.opened_at);
      byAsset.set(item.asset_id, current);
    }

    const intervalsHours: number[] = [];
    for (const dates of byAsset.values()) {
      if (dates.length < 2) {
        continue;
      }
      for (let index = 1; index < dates.length; index += 1) {
        const diffMs = dates[index].getTime() - dates[index - 1].getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        if (diffHours > 0) {
          intervalsHours.push(diffHours);
        }
      }
    }

    if (intervalsHours.length === 0) {
      return 0;
    }

    const avg = intervalsHours.reduce((sum, value) => sum + value, 0) / intervalsHours.length;
    return Number(avg.toFixed(2));
  }

  private getSlaTargetHours(severity: Severity): number {
    const map: Record<Severity, number> = {
      critical: 8,
      high: 24,
      medium: 48,
      low: 72,
    };

    return map[severity];
  }

  private computeSlaComplianceRate(
    closedCases: Array<{ severity: Severity; opened_at: Date; closed_at: Date | null }>,
  ): number {
    if (closedCases.length === 0) {
      return 0;
    }

    const compliant = closedCases.filter((item) => {
      if (!item.closed_at) {
        return false;
      }
      const elapsedHours = (item.closed_at.getTime() - item.opened_at.getTime()) / (1000 * 60 * 60);
      return elapsedHours <= this.getSlaTargetHours(item.severity);
    }).length;

    return Number(((compliant / closedCases.length) * 100).toFixed(2));
  }

  private computeOverdueOpenCases(openCases: Array<{ severity: Severity; opened_at: Date }>): number {
    const now = Date.now();
    let count = 0;

    for (const item of openCases) {
      const elapsedHours = (now - item.opened_at.getTime()) / (1000 * 60 * 60);
      if (elapsedHours > this.getSlaTargetHours(item.severity)) {
        count += 1;
      }
    }

    return count;
  }

  private computeWorkOrdersPerCase(closedCases: Array<{ work_order_count: number }>): number {
    if (closedCases.length === 0) {
      return 0;
    }

    const total = closedCases.reduce((sum, item) => sum + item.work_order_count, 0);
    return Number((total / closedCases.length).toFixed(2));
  }

  private computeRepeatFailures30d(recentCases: Array<{ asset_id: string }>): number {
    const map = new Map<string, number>();

    for (const item of recentCases) {
      map.set(item.asset_id, (map.get(item.asset_id) ?? 0) + 1);
    }

    let repeatedAssets = 0;
    for (const count of map.values()) {
      if (count >= 2) {
        repeatedAssets += 1;
      }
    }

    return repeatedAssets;
  }
}
