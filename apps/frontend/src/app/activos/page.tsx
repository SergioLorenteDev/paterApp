import { Asset } from "../home-types";
import { AssetsExplorerClient } from "./AssetsExplorerClient";

const API_BASE_URL =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000/api";
const API_TOKEN = process.env.API_TOKEN ?? process.env.NEXT_PUBLIC_API_TOKEN ?? "dev-tecnico";

async function fetchAssetsOnServer(): Promise<Asset[]> {
  const response = await fetch(`${API_BASE_URL}/assets`, {
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("No se pudieron cargar los activos en servidor.");
  }

  return response.json();
}

export default async function AssetsPage() {
  try {
    const assets = await fetchAssetsOnServer();

    return (
      <main>
        <AssetsExplorerClient
          initialAssets={assets}
          sourceLabel={`${API_BASE_URL}/assets`}
          initialError={null}
        />
      </main>
    );
  } catch {
    return (
      <main>
        <AssetsExplorerClient
          initialAssets={[]}
          sourceLabel={`${API_BASE_URL}/assets`}
          initialError="No se pudieron cargar activos desde backend en este momento."
        />
      </main>
    );
  }
}

