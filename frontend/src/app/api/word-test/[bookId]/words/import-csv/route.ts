import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

function getBackendApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ bookId: string }> }
) {
  const { bookId } = await context.params;
  const backendUrl = `${getBackendApiBase()}/api/word-test/${encodeURIComponent(bookId)}/words/import-csv`;

  const upstreamResponse = await fetch(backendUrl, {
    method: "POST",
    headers: {
      "Content-Type": request.headers.get("content-type") ?? "application/json",
      Cookie: request.headers.get("cookie") ?? "",
    },
    body: await request.text(),
    cache: "no-store",
  });

  const responseHeaders = new Headers();
  const contentType = upstreamResponse.headers.get("content-type");
  if (contentType) {
    responseHeaders.set("content-type", contentType);
  }

  const setCookie = upstreamResponse.headers.get("set-cookie");
  if (setCookie) {
    responseHeaders.append("set-cookie", setCookie);
  }

  return new NextResponse(await upstreamResponse.text(), {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}
