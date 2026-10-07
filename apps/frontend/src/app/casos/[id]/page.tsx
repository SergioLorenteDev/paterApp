import Link from "next/link";
import { CaseDetailClient } from "./CaseDetailClient";

type CaseDetail = {
  id: string;
  assetId: string;
  severity: string;
  status: "open" | "in_progress" | "blocked" | "closed";
  openedAt: string;
  closedAt: string | null;
  rootCause: string | null;
  resolution: string | null;
};

const INTERNAL_API_BASE_URL =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000/api";
const API_TOKEN = process.env.API_TOKEN ?? process.env.NEXT_PUBLIC_API_TOKEN ?? "dev-tecnico";

async function fetchCaseDetail(caseId: string): Promise<CaseDetail> {
  const response = await fetch(`${INTERNAL_API_BASE_URL}/cases/${caseId}`, {
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("No se pudo cargar el caso.");
  }

  return response.json();
}

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const caseDetail = await fetchCaseDetail(id);

    return (
      <main>
        <CaseDetailClient initialCase={caseDetail} />
      </main>
    );
  } catch {
    return (
      <main>
        <article className="surface">
          <h1>Detalle de Caso</h1>
          <p className="error-text">No se encontro informacion para el caso {id}.</p>
          <Link className="button-link" href="/casos">
            Volver a casos
          </Link>
        </article>
      </main>
    );
  }
}
