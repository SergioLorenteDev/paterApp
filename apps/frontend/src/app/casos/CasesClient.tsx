"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CaseItem } from "./types";

function formatDate(input: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(input));
}

function formatStatus(status: CaseItem["status"]): string {
  if (status === "in_progress") {
    return "en progreso";
  }
  if (status === "open") {
    return "abierto";
  }
  if (status === "blocked") {
    return "bloqueado";
  }
  return "cerrado";
}

export function CasesClient({
  initialCases,
  sourceLabel,
}: {
  initialCases: CaseItem[];
  sourceLabel: string;
}) {
  const [statusFilter, setStatusFilter] = useState<CaseItem["status"] | "all">("all");

  const filteredCases = useMemo(() => {
    if (statusFilter === "all") {
      return initialCases;
    }

    return initialCases.filter((caseItem) => caseItem.status === statusFilter);
  }, [initialCases, statusFilter]);

  return (
    <>
      <article className="surface">
        <h1>Casos de Postventa</h1>
        <p>
          Esta pantalla carga los casos desde servidor y en cliente solo se encarga de filtrar y
          navegar.
        </p>
        <p className="help-text">Fuente de datos: <code>{sourceLabel}</code></p>
      </article>

      <article className="surface">
        <h2>Controles</h2>
        <div className="quick-actions">
          <label className="sr-only" htmlFor="filtro-estado-casos">
            Filtrar por estado
          </label>
          <select
            className="input"
            id="filtro-estado-casos"
            onChange={(event) =>
              setStatusFilter(event.target.value as CaseItem["status"] | "all")
            }
            value={statusFilter}
          >
            <option value="all">Todos los estados</option>
            <option value="open">Abierto</option>
            <option value="in_progress">En progreso</option>
            <option value="blocked">Bloqueado</option>
            <option value="closed">Cerrado</option>
          </select>
          <Link className="button-link" href="/casos">
            Actualizar desde servidor
          </Link>
        </div>
      </article>

      <article className="surface">
        <h2>Listado</h2>
        {filteredCases.length === 0 ? (
          <p className="muted">No hay casos con el filtro actual.</p>
        ) : (
          <div className="assets-list">
            {filteredCases.map((caseItem) => (
              <article className="asset-card" key={caseItem.id}>
                <p>
                  <strong>{caseItem.id}</strong> · Activo: {caseItem.assetId}
                </p>
                <p>
                  Severidad: {caseItem.severity} · Estado:{" "}
                  <span className="status-chip">{formatStatus(caseItem.status)}</span>
                </p>
                <p>Apertura: {formatDate(caseItem.openedAt)}</p>
                <Link className="button-link button-primary" href={`/casos/${caseItem.id}`}>
                  Abrir detalle de caso
                </Link>
                <Link className="button-link" href={`/activos/${caseItem.assetId}`}>
                  Ir a ficha del activo
                </Link>
              </article>
            ))}
          </div>
        )}
      </article>

      <Link className="button-link" href="/">
        Volver al panel
      </Link>
    </>
  );
}
