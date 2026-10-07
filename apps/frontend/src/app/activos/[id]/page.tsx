import Link from "next/link";
import { AiAssistantPanel } from "./AiAssistantPanel";

type AssetContext = {
  asset: {
    id: string;
    serialNumber: string;
    model: string;
    status: string;
    location: string | null;
    installedAt: string | null;
    warrantyEndDate: string | null;
    customerId: string;
  };
  cases: Array<{
    id: string;
    severity: string;
    status: string;
    openedAt: string;
    closedAt: string | null;
  }>;
  workOrders: Array<{
    id: string;
    kind: string;
    outcome: string;
    workedHours: number | null;
    technicianId: string | null;
    createdAt: string;
  }>;
};

type AssetDocumentation = {
  asset: {
    id: string;
    serialNumber: string;
    model: string;
    machineModelId: string | null;
  };
  machineModel: {
    id: string;
    code: string;
    name: string;
    family: string | null;
    manufacturer: {
      id: string;
      name: string;
      websiteUrl: string | null;
    };
  } | null;
  documents: Array<{
    id: string;
    title: string;
    documentType: string;
    language: string;
    sourceUrl: string;
    fileFormat: string;
    revision: string | null;
    publicationDate: string | null;
    pageCount: number | null;
    accessLevel: string;
    isOfficial: boolean;
    ingestionStatus: "pending" | "downloaded" | "parsed" | "failed";
    keywords: string[];
  }>;
};

const API_BASE_URL =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000/api";
const API_TOKEN = process.env.API_TOKEN ?? process.env.NEXT_PUBLIC_API_TOKEN ?? "dev-tecnico";

function formatDate(input: string | null): string {
  if (!input) {
    return "No disponible";
  }

  const date = new Date(input);
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(date);
}

function getDocumentTypeLabel(documentType: string): string {
  const labels: Record<string, string> = {
    operator_manual: "Manual de operacion",
    service_manual: "Manual de servicio",
    parts_catalog: "Catalogo de repuestos",
    troubleshooting_guide: "Guia de diagnostico",
    safety_bulletin: "Boletin de seguridad",
    quick_guide: "Guia rapida",
    functional_safety_manual: "Manual de seguridad funcional",
    system_manual: "Manual de sistema",
    programming_manual: "Manual de programacion",
    installation_manual: "Manual de instalacion",
    programming_guide: "Guia de programacion",
    design_guide: "Guia de diseno",
    operating_guide: "Guia de operacion",
    firmware_manual: "Manual de firmware",
    manual_index: "Indice documental",
    operation_maintenance_manual: "Manual de operacion y mantenimiento",
    operation_maintenance_portal: "Portal O&M",
    service_access_policy: "Politica de acceso a servicio",
  };

  return labels[documentType] ?? documentType;
}

async function fetchAssetContext(assetId: string): Promise<AssetContext> {
  const response = await fetch(`${API_BASE_URL}/assets/${assetId}/context`, {
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("No se pudo cargar el contexto del activo.");
  }

  return response.json();
}

async function fetchAssetDocuments(assetId: string): Promise<AssetDocumentation> {
  const response = await fetch(`${API_BASE_URL}/assets/${assetId}/documents`, {
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("No se pudo cargar la documentacion tecnica del activo.");
  }

  return response.json();
}

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const [context, documentation] = await Promise.all([fetchAssetContext(id), fetchAssetDocuments(id)]);
    const parsedDocs = documentation.documents.filter((document) => document.ingestionStatus === "parsed").length;
    const documentTypes = Array.from(new Set(documentation.documents.map((document) => document.documentType)));
    const languages = Array.from(new Set(documentation.documents.map((document) => document.language)));
    const aiReadiness =
      documentation.documents.length > 0
        ? Math.round((parsedDocs / documentation.documents.length) * 100)
        : 0;

    return (
      <main>
        <article className="surface">
          <h1>Activo {context.asset.id}</h1>
          <p>
            Modelo: <strong>{context.asset.model}</strong> · Serie: {context.asset.serialNumber}
          </p>
          <p>
            Estado: <span className="status-chip">{context.asset.status}</span> · Cliente:{" "}
            {context.asset.customerId}
          </p>
          <p>
            Ubicacion: {context.asset.location ?? "No disponible"} · Garantia:{" "}
            {formatDate(context.asset.warrantyEndDate)}
          </p>
          <p>Instalacion: {formatDate(context.asset.installedAt)}</p>
        </article>

        <article className="surface">
          <h2>Contexto Del Modelo</h2>
          {documentation.machineModel ? (
            <>
              <p>
                <strong>{documentation.machineModel.name}</strong> · Codigo:{" "}
                <code>{documentation.machineModel.code}</code> · Fabricante:{" "}
                {documentation.machineModel.manufacturer.name}
              </p>
              <p>
                Familia: {documentation.machineModel.family ?? "No disponible"} · Documentacion disponible:{" "}
                <strong>{documentation.documents.length > 0 ? "Si" : "No"}</strong>
              </p>
              <div className="grid">
                <article className="asset-card">
                  <p>
                    <strong>Biblioteca Del Modelo</strong>
                  </p>
                  <p>Documentos totales: {documentation.documents.length}</p>
                  <p>Tipos documentales: {documentTypes.length}</p>
                  <p>Idiomas disponibles: {languages.join(", ") || "No disponible"}</p>
                </article>
                <article className="asset-card">
                  <p>
                    <strong>Asistente Tecnico IA</strong>
                  </p>
                  <p>
                    El asistente usara esta biblioteca del modelo para responder con contexto tecnico
                    verificable.
                  </p>
                  <p>Preparacion actual del contexto: {aiReadiness}%</p>
                  <p className="help-text">Usa el panel de asistente al final de la ficha.</p>
                </article>
              </div>
              <p>
                Manuales disponibles:{" "}
                {documentTypes.length > 0
                  ? documentTypes.map((documentType) => getDocumentTypeLabel(documentType)).join(", ")
                  : "No disponible"}
              </p>
            </>
          ) : (
            <p className="muted">
              Este activo aun no tiene contexto de modelo. Debes asignar <code>machineModelId</code>{" "}
              para activar documentacion y recomendaciones por modelo.
            </p>
          )}
        </article>

        <section className="grid">
          <article className="surface">
            <h2>Casos Relacionados</h2>
            {context.cases.length === 0 ? (
              <p className="muted">No hay casos para este activo.</p>
            ) : (
              <div className="assets-list">
                {context.cases.map((caseItem) => (
                  <article className="asset-card" key={caseItem.id}>
                    <p>
                      <strong>{caseItem.id}</strong> · {caseItem.severity} ·{" "}
                      <span className="status-chip">{caseItem.status}</span>
                    </p>
                    <p>Apertura: {formatDate(caseItem.openedAt)}</p>
                    <p>Cierre: {formatDate(caseItem.closedAt)}</p>
                    <Link className="button-link button-primary" href={`/casos/${caseItem.id}`}>
                      Abrir caso
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </article>

          <article className="surface">
            <h2>Ordenes de Trabajo</h2>
            {context.workOrders.length === 0 ? (
              <p className="muted">No hay ordenes para este activo.</p>
            ) : (
              <div className="assets-list">
                {context.workOrders.map((workOrder) => (
                  <article className="asset-card" key={workOrder.id}>
                    <p>
                      <strong>{workOrder.id}</strong> · {workOrder.kind} · {workOrder.outcome}
                    </p>
                    <p>Horas: {workOrder.workedHours ?? "No disponible"}</p>
                    <p>Tecnico: {workOrder.technicianId ?? "No asignado"}</p>
                  </article>
                ))}
              </div>
            )}
          </article>
        </section>

        <article className="surface">
          <h2>Documentacion Oficial Consultable</h2>
          {documentation.machineModel ? (
            <p>
              Modelo documental: <strong>{documentation.machineModel.name}</strong> · Fabricante:{" "}
              {documentation.machineModel.manufacturer.name}
            </p>
          ) : (
            <p className="muted">
              Este activo aun no esta vinculado a un modelo documental. Asigna <code>machineModelId</code>{" "}
              para activar la biblioteca tecnica.
            </p>
          )}
          {documentation.documents.length === 0 ? (
            <p className="muted">No hay documentos cargados para este activo.</p>
          ) : (
            <>
              <div className="assets-list">
                {documentation.documents.map((document) => (
                  <article className="asset-card" key={document.id}>
                    <p>
                      <strong>{document.title}</strong>
                    </p>
                    <p>
                      Tipo: {getDocumentTypeLabel(document.documentType)} · Idioma: {document.language}
                    </p>
                    <p>
                      Revision: {document.revision ?? "No disponible"} · Publicacion:{" "}
                      {formatDate(document.publicationDate)}
                    </p>
                    <p>
                      Acceso: {document.accessLevel} · Formato: {document.fileFormat.toUpperCase()}
                    </p>
                    <a
                      className="button-link button-primary"
                      href={`/activos/${id}/documentos/${document.id}`}
                    >
                      Ver documento
                    </a>
                    <a
                      className="button-link"
                      href={document.sourceUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Abrir fuente oficial
                    </a>
                  </article>
                ))}
              </div>
            </>
          )}
        </article>

        <AiAssistantPanel assetId={id} />

        <Link className="button-link" href="/">
          Volver al panel
        </Link>
      </main>
    );
  } catch {
    return (
      <main>
        <article className="surface">
          <h1>Ficha de Activo</h1>
          <p className="error-text">No se encontro informacion para el activo {id}.</p>
          <Link className="button-link" href="/">
            Volver al panel
          </Link>
        </article>
      </main>
    );
  }
}
