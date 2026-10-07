"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Asset } from "../home-types";

export function AssetsExplorerClient({
  initialAssets,
  sourceLabel,
  initialError,
}: {
  initialAssets: Asset[];
  sourceLabel: string;
  initialError: string | null;
}) {
  const [query, setQuery] = useState("");

  const filteredAssets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return initialAssets;
    }

    return initialAssets.filter((asset) => {
      const haystack = [
        asset.id,
        asset.model,
        asset.serialNumber,
        asset.customerId,
        asset.status,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [initialAssets, query]);

  return (
    <>
      <section className="header">
        <span className="badge">Consulta de activos</span>
        <h1>Todos Los Activos</h1>
        <p>Busca por ID, modelo, serie, cliente o estado para abrir la ficha tecnica.</p>
      </section>

      <article className="surface">
        <form className="search-row" onSubmit={(event) => event.preventDefault()}>
          <label className="sr-only" htmlFor="buscador-global-activos">
            Buscar activos
          </label>
          <input
            id="buscador-global-activos"
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ejemplo: AST-1001, SINAMICS, SN-778821, CUST-301"
          />
        </form>
        <p className="help-text">
          Fuente de datos: <code>{sourceLabel}</code>
        </p>
        {initialError ? <p className="error-text">{initialError}</p> : null}
        <div className="assets-list">
          {filteredAssets.length === 0 ? (
            <p className="muted">No hay activos que coincidan con el filtro.</p>
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
                <Link className="button-link button-primary" href={`/activos/${asset.id}`}>
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

