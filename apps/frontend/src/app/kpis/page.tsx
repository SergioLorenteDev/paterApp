import Link from "next/link";

type KpiSummary = {
  generatedAt: string;
  muestra: {
    totalAssets: number;
    totalWorkOrders: number;
    closedCases: number;
  };
  servicio: {
    openCases: number;
    slaRiskCases: number;
    overdueOpenCases: number;
    repeatFailures30d: number;
    mttrHours: number | null;
    mtbfHours: number | null;
    firstTimeFixRate: number | null;
    slaComplianceRate: number | null;
    workOrdersPerCase: number | null;
    tieneMuestraSuficiente: boolean;
  };
  documentacion: {
    totalTechnicalDocuments: number;
    totalChunks: number;
    documentsPerModelAvg: number;
    modelsWithDocumentationRate: number;
    documentedAssetsRate: number;
    byType: Array<{ label: string; count: number }>;
    byManufacturer: Array<{ label: string; count: number }>;
    byLanguage: Array<{ label: string; count: number }>;
    topModels: Array<{ label: string; count: number }>;
  };
  calidadDatos: {
    parsedCoverageRate: number;
    revisionCoverageRate: number;
    publicationDateCoverageRate: number;
  };
};

const API_BASE_URL =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000/api";
const API_TOKEN = process.env.API_TOKEN ?? process.env.NEXT_PUBLIC_API_TOKEN ?? "dev-tecnico";

async function fetchKpiSummary(): Promise<KpiSummary> {
  const response = await fetch(`${API_BASE_URL}/kpis/summary`, {
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("No se pudieron cargar los KPIs.");
  }

  return response.json();
}

function formatDate(input: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(input));
}

export default async function KpisPage() {
  try {
    const data = await fetchKpiSummary();

    return (
      <main>
        <article className="surface">
          <h1>KPIs Operativos</h1>
          <p>
            Indicadores orientados al trabajo en campo: prioridad, riesgo SLA y carga operativa.
          </p>
          <p className="help-text">
            Fuente: <code>{API_BASE_URL}/kpis/summary</code> · Actualizado: {" "}
            {formatDate(data.generatedAt)}
          </p>
        </article>

        <section className="grid">
          <article className="surface">
            <h2>Casos Abiertos</h2>
            <p className="kpi-value">{data.servicio.openCases}</p>
          </article>

          <article className="surface">
            <h2>Riesgo SLA</h2>
            <p className="kpi-value">{data.servicio.slaRiskCases}</p>
          </article>

          <article className="surface">
            <h2>Casos Vencidos SLA</h2>
            <p className="kpi-value">{data.servicio.overdueOpenCases}</p>
          </article>

          <article className="surface">
            <h2>Fallos Repetidos (30d)</h2>
            <p className="kpi-value">{data.servicio.repeatFailures30d}</p>
          </article>
        </section>

        <article className="surface">
          <h2>Indicadores De Resolucion</h2>
          {data.servicio.tieneMuestraSuficiente ? (
            <p>
              MTTR: <strong>{data.servicio.mttrHours}</strong> h · First-Time-Fix:{" "}
              <strong>{data.servicio.firstTimeFixRate}%</strong> · Cumplimiento SLA:{" "}
              <strong>{data.servicio.slaComplianceRate}%</strong> · OT/caso:{" "}
              <strong>{data.servicio.workOrdersPerCase}</strong>
            </p>
          ) : (
            <p className="muted">
              Aun no hay suficientes casos cerrados para calcular indicadores de resolucion con fiabilidad.
            </p>
          )}
        </article>

        <Link className="button-link" href="/">
          Volver al panel
        </Link>
      </main>
    );
  } catch {
    return (
      <main>
        <article className="surface">
          <h1>KPIs Operativos</h1>
          <p className="error-text">No se pudieron cargar los KPIs en este momento.</p>
          <Link className="button-link" href="/">
            Volver al panel
          </Link>
        </article>
      </main>
    );
  }
}
