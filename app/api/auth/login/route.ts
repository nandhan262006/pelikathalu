import { NextResponse } from "next/server";
import { AUTH_COOKIE, checkPassword, createSessionToken, SESSION_HOURS } from "@/lib/auth";

export async function POST(req: Request) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: unknown };
  if (!(await checkPassword(password))) {
    return NextResponse.json({ error: "invalid password" }, { status: 401 });
  }
  const token = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_HOURS * 3600,
    path: "/",
  });
  return res;
}
