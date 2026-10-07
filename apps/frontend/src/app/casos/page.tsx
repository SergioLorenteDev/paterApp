import Link from "next/link";
import { CasesClient } from "./CasesClient";
import { CaseItem } from "./types";

const API_BASE_URL =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000/api";
const API_TOKEN = process.env.API_TOKEN ?? process.env.NEXT_PUBLIC_API_TOKEN ?? "dev-tecnico";

async function fetchCasesOnServer(): Promise<CaseItem[]> {
  const response = await fetch(`${API_BASE_URL}/cases`, {
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("No se pudieron cargar los casos en servidor.");
  }

  return response.json();
}

export default async function CasesPage() {
  try {
    const cases = await fetchCasesOnServer();

    return (
      <main>
        <CasesClient initialCases={cases} sourceLabel={`${API_BASE_URL}/cases`} />
      </main>
    );
  } catch {
    return (
      <main>
        <article className="surface">
          <h1>Casos de Postventa</h1>
          <p className="error-text">
            No se pudieron cargar los casos en este momento.
          </p>
          <Link className="button-link" href="/">
            Volver al panel
          </Link>
        </article>
      </main>
    );
  }
}
