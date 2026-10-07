"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { Asset } from "./home-types";

export function HomeClient({
  initialAssets,
  sourceLabel,
  initialError,
}: {
  initialAssets: Asset[];
  sourceLabel: string;
  initialError: string | null;
}) {
  const router = useRouter();
  const [assetQuery, setAssetQuery] = useState("");

  const filteredAssets = useMemo(() => {
    const normalizedQuery = assetQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return initialAssets;
    }

    return initialAssets.filter((asset) => asset.id.toLowerCase().includes(normalizedQuery));
  }, [initialAssets, assetQuery]);

  const openCases = 24;
  const slaRisk = 6;
  const mttr = "11.4h";

  function onSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedQuery = assetQuery.trim().toUpperCase();
    if (!normalizedQuery) {
      return;
    }

    router.push(`/activos/${normalizedQuery}`);
  }

  return (
    <>
      <section className="header">
        <span className="badge">Base operativa MVP</span>
        <h1>PaterApp Operaciones de Campo</h1>
        <p>Acceso rapido al estado de maquinas, casos y metricas de postventa.</p>
      </section>

      <section className="grid">
        <article className="surface">
          <h2>Resumen de Hoy</h2>
          <div className="metric">
            <span>Casos abiertos</span>
            <strong>{openCases}</strong>
          </div>
          <div className="metric">
            <span>Riesgo de SLA</span>
            <strong>{slaRisk}</strong>
          </div>
          <div className="metric">
            <span>MTTR (7d)</span>
            <strong>{mttr}</strong>
          </div>
        </article>

        <article className="surface">
          <h2>Acciones Rapidas</h2>
          <div className="quick-actions">
            <Link className="button-link" href="/">
              Actualizar Activos
            </Link>
            <Link
              className="button-link"
              href={`/activos/${assetQuery.trim().toUpperCase() || "AST-1001"}`}
            >
              Escanear QR
            </Link>
            <Link className="button-link" href="/casos">
              Ver Casos
            </Link>
            <Link className="button-link" href="/activos">
              Todos Los Activos
            </Link>
            <Link className="button-link" href="/kpis">
              Ver KPIs
            </Link>
          </div>
        </article>
      </section>

      <article className="surface">
        <h2>Buscador de Activos (base QR)</h2>
        <form className="search-row" onSubmit={onSearchSubmit}>
          <label className="sr-only" htmlFor="buscador-activo">
            Escribe el identificador del activo
          </label>
          <input
            aria-describedby="fuente-activos"
            id="buscador-activo"
            className="input"
            onChange={(event) => setAssetQuery(event.target.value)}
            placeholder="Ejemplo: AST-1001"
            value={assetQuery}
          />
          <button className="button button-primary" type="submit">
            Filtrar
          </button>
        </form>
        <p className="help-text" id="fuente-activos">
          Fuente de datos: <code>{sourceLabel}</code>
        </p>
        {initialError ? <p className="error-text">{initialError}</p> : null}
        <div className="assets-list">
          {filteredAssets.length === 0 ? (
            <p className="muted">No hay activos disponibles con el filtro actual.</p>
          ) : (
            filteredAssets.map((asset) => (
              <article className="asset-card" key={asset.id}>
                <p>
                  <strong>{asset.id}</strong> · {asset.model}
                </p>
                <p>
                  Serie: {asset.serialNumber} · Cliente: {asset.customerId}
                </p>
                <p>
                  Estado: <span className="status-chip">{asset.status}</span>
                </p>
                <Link className="button-link" href={`/activos/${asset.id}`}>
                  Abrir ficha
                </Link>
              </article>
            ))
          )}
        </div>
      </article>
    </>
  );
}
