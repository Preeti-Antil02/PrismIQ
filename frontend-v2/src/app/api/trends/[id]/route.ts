import { NextRequest, NextResponse } from "next/server";
import { getClientAuthToken } from "@/lib/auth";

const BACKEND_BASE = (
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const trendId = params.id;
  const backendUrl = new URL(`${BACKEND_BASE}/trends/${trendId}`);

  const incomingAuth = request.headers.get("authorization");
  const token = incomingAuth ? incomingAuth.replace(/^Bearer\s+/i, "") : getClientAuthToken();

  try {
    const res = await fetch(backendUrl.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Backend returned ${res.status}: ${text}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to connect to backend: ${err.message}` },
      { status: 502 }
    );
  }
}
