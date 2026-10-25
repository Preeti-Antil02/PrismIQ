import { NextRequest, NextResponse } from "next/server";
import { getClientAuthToken } from "@/lib/auth";

const BACKEND_BASE = (
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const company = searchParams.get("company");
  const department = searchParams.get("department");
  const urgency = searchParams.get("urgency");

  const query = new URLSearchParams();
  if (company) query.set("company", company);
  if (department) query.set("department", department);
  if (urgency) query.set("urgency", urgency);

  const qs = query.toString() ? `?${query.toString()}` : "";
  const backendUrl = `${BACKEND_BASE}/decision-support${qs}`;

  const incomingAuth = req.headers.get("authorization");
  const token = incomingAuth ? incomingAuth.replace(/^Bearer\s+/i, "") : getClientAuthToken();

  try {
    const res = await fetch(backendUrl, {
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
      { error: `Backend proxy connection failed: ${err.message}` },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest) {
  const incomingAuth = req.headers.get("authorization");
  const token = incomingAuth ? incomingAuth.replace(/^Bearer\s+/i, "") : getClientAuthToken();

  try {
    const body = await req.json();
    const res = await fetch(`${BACKEND_BASE}/decision-support`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
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
      { error: `Backend proxy connection failed: ${err.message}` },
      { status: 502 }
    );
  }
}
