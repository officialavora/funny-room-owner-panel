import { NextRequest, NextResponse } from "next/server";

const allowedAuth = new Set(["token?grant_type=password", "recover"]);
const allowedRpc = new Set(["owner_role_summary"]);

export async function POST(request: NextRequest) {
  const api = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!api || !key) return NextResponse.json({ message: "Owner service configuration unavailable" }, { status: 503 });
  const payload = await request.json() as { kind?: string; path?: string; name?: string; token?: string; body?: Record<string, unknown> };
  let url = "", authorization = "";
  if (payload.kind === "panel_login") url = `${api}/functions/v1/panel-login`;
  else if (payload.kind === "panel_admin" && payload.token) { url = `${api}/functions/v1/panel-admin`; authorization = payload.token; }
  else if (payload.kind === "auth" && payload.path && allowedAuth.has(payload.path)) url = `${api}/auth/v1/${payload.path}`;
  else if (payload.kind === "rpc" && payload.name && payload.token && allowedRpc.has(payload.name)) { url = `${api}/rest/v1/rpc/${payload.name}`; authorization = payload.token; }
  else return NextResponse.json({ message: "Operation not allowed" }, { status: 403 });
  const headers: Record<string,string> = { apikey: key, "Content-Type": "application/json" };
  if (authorization) headers.Authorization = `Bearer ${authorization}`;
  const result = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload.body ?? {}) });
  const data = await result.json();
  return NextResponse.json(data, { status: result.status });
}
