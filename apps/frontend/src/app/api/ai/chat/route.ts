import { NextRequest, NextResponse } from "next/server";

const INTERNAL_API_BASE_URL =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000/api";
const API_TOKEN = process.env.API_TOKEN ?? process.env.NEXT_PUBLIC_API_TOKEN ?? "dev-tecnico";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${INTERNAL_API_BASE_URL}/ai/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const text = await response.text();

    return new NextResponse(text, {
      status: response.status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch {
    return NextResponse.json(
      { message: "Error interno al consultar al asistente tecnico." },
      { status: 500 },
    );
  }
}
