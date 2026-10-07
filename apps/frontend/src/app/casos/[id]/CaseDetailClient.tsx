"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type CaseStatus = "open" | "in_progress" | "blocked" | "closed";

type CaseDetail = {
  id: string;
  assetId: string;
  severity: string;
  status: CaseStatus;
  openedAt: string;
  closedAt: string | null;
  rootCause: string | null;
  resolution: string | null;
};

function formatStatus(status: CaseStatus): string {
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

export function CaseDetailClient({
  initialCase,
}: {
  initialCase: CaseDetail;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<CaseStatus>(initialCase.status);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChangeStatus(nextStatus: CaseStatus) {
    if (status === nextStatus) {
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetch(`/api/cases/${initialCase.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(responseText || "No se pudo actualizar el estado del caso.");
      }

      setStatus(nextStatus);
      router.refresh();
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Error desconocido.");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <>
      <article className="surface">
        <h1>Detalle de Caso {initialCase.id}</h1>
        <p>
          Activo: <strong>{initialCase.assetId}</strong> · Severidad: {initialCase.severity}
        </p>
        <p>
          Estado actual: <span className="status-chip">{formatStatus(status)}</span>
        </p>
        <p>Apertura: {new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(initialCase.openedAt))}</p>
        <p>
          Cierre: {initialCase.closedAt
            ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(
                new Date(initialCase.closedAt),
              )
            : "No cerrado"}
        </p>
      </article>

      <article className="surface">
        <h2>Actualizar Estado</h2>
        <div className="quick-actions">
          <button
            aria-pressed={status === "open"}
            className={`button ${status === "open" ? "button-primary" : ""}`}
            disabled={isUpdating}
            onClick={() => onChangeStatus("open")}
            type="button"
          >
            Abierto
          </button>
          <button
            aria-pressed={status === "in_progress"}
            className={`button ${status === "in_progress" ? "button-primary" : ""}`}
            disabled={isUpdating}
            onClick={() => onChangeStatus("in_progress")}
            type="button"
          >
            En progreso
          </button>
          <button
            aria-pressed={status === "blocked"}
            className={`button ${status === "blocked" ? "button-primary" : ""}`}
            disabled={isUpdating}
            onClick={() => onChangeStatus("blocked")}
            type="button"
          >
            Bloqueado
          </button>
          <button
            aria-pressed={status === "closed"}
            className={`button ${status === "closed" ? "button-primary" : ""}`}
            disabled={isUpdating}
            onClick={() => onChangeStatus("closed")}
            type="button"
          >
            Cerrado
          </button>
        </div>
        {isUpdating ? (
          <p aria-live="polite" className="help-text">
            Actualizando estado...
          </p>
        ) : null}
        {error ? (
          <p aria-live="assertive" className="error-text">
            {error}
          </p>
        ) : null}
      </article>

      <article className="surface">
        <h2>Diagnostico</h2>
        <p>
          Causa raiz: {initialCase.rootCause ?? "No registrada"}
        </p>
        <p>
          Resolucion: {initialCase.resolution ?? "No registrada"}
        </p>
      </article>

      <div className="quick-actions">
        <Link className="button-link" href="/casos">
          Volver a casos
        </Link>
        <Link className="button-link" href={`/activos/${initialCase.assetId}`}>
          Ir a ficha del activo
        </Link>
      </div>
    </>
  );
}
