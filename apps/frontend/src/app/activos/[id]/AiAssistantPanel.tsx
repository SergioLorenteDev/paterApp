"use client";

import { FormEvent, useState } from "react";

type Citation = {
  documentId: string;
  title: string;
  sourceUrl: string;
  chunkIndex: number;
  excerpt: string;
};

type ChatResponse = {
  provider: string;
  answer: string;
  citations: Citation[];
};

export function AiAssistantPanel({ assetId }: { assetId: string }) {
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<"strict" | "expanded">("expanded");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ChatResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = question.trim();
    if (!value) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const apiResponse = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetId,
          question: value,
          maxCitations: 6,
          mode,
        }),
      });

      if (!apiResponse.ok) {
        throw new Error("No se pudo consultar al asistente.");
      }

      const payload = (await apiResponse.json()) as ChatResponse;
      setResponse(payload);
    } catch {
      setError("No se pudo obtener respuesta del asistente en este momento.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className="surface">
      <h2>Asistente Tecnico</h2>
      <p>Pregunta con contexto del modelo. Puedes usar modo estricto o diagnostico ampliado.</p>

      <div className="search-row" style={{ marginBottom: "10px" }}>
        <label htmlFor={`modo-ia-${assetId}`}>Modo:</label>
        <select
          id={`modo-ia-${assetId}`}
          className="input"
          value={mode}
          onChange={(event) => setMode(event.target.value as "strict" | "expanded")}
          style={{ maxWidth: "280px" }}
        >
          <option value="strict">Estricto (solo documentos)</option>
          <option value="expanded">Diagnostico ampliado (docs + hipotesis)</option>
        </select>
      </div>

      <form className="search-row" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor={`pregunta-ia-${assetId}`}>
          Pregunta tecnica
        </label>
        <input
          className="input"
          id={`pregunta-ia-${assetId}`}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ejemplo: que revisar si aparece alarma de presion hidraulica baja"
          value={question}
        />
        <button className="button button-primary" disabled={loading} type="submit">
          {loading ? "Consultando..." : "Consultar"}
        </button>
      </form>

      {error ? <p className="error-text">{error}</p> : null}

      {response ? (
        <div className="assets-list">
          <article className="asset-card">
            <p>
              <strong>Respuesta</strong>
            </p>
            <p style={{ whiteSpace: "pre-wrap" }}>{response.answer}</p>
            <p className="help-text">
              Motor: <code>{response.provider}</code> · Modo: <code>{mode}</code>
            </p>
          </article>

          {response.citations.length > 0 ? (
            <article className="asset-card">
              <p>
                <strong>Fuentes citadas</strong>
              </p>
              {response.citations.map((citation) => (
                <div key={`${citation.documentId}-${citation.chunkIndex}`} style={{ marginBottom: "10px" }}>
                  <p>
                    {citation.title} · fragmento {citation.chunkIndex}
                  </p>
                  <p className="muted">{citation.excerpt}</p>
                  <a className="button-link" href={citation.sourceUrl} rel="noreferrer" target="_blank">
                    Abrir fuente
                  </a>
                </div>
              ))}
            </article>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
