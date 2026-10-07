import { NextResponse } from "next/server";

const INTERNAL_API_BASE_URL =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000/api";
const API_TOKEN = process.env.API_TOKEN ?? process.env.NEXT_PUBLIC_API_TOKEN ?? "dev-tecnico";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const response = await fetch(`${INTERNAL_API_BASE_URL}/documents/${id}/file`, {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
      },
      cache: "no-store",
      redirect: "follow",
    });

    if (!response.ok || !response.body) {
      return NextResponse.json(
        { message: "No se pudo obtener el documento tecnico." },
        { status: response.status || 500 },
      );
    }

    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    const contentDisposition = response.headers.get("content-disposition") ?? `inline; filename="${id}"`;

    return new NextResponse(response.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition,
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Error interno al recuperar el documento." },
      { status: 500 },
    );
  }
}
