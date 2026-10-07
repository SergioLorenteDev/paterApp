import Link from "next/link";

export default async function DocumentViewerPage({
  params,
}: {
  params: Promise<{ id: string; docId: string }>;
}) {
  const { id, docId } = await params;

  return (
    <main>
      <article className="surface">
        <h1>Visor Tecnico</h1>
        <p>
          Documento: <strong>{docId}</strong> · Activo: <strong>{id}</strong>
        </p>
      </article>

      <article className="surface">
        <iframe
          src={`/api/documents/${docId}/file`}
          style={{ width: "100%", minHeight: "78vh", border: "1px solid var(--border)", borderRadius: "12px" }}
          title={`Documento ${docId}`}
        />
      </article>

      <Link className="button-link" href={`/activos/${id}`}>
        Volver a ficha del activo
      </Link>
    </main>
  );
}
