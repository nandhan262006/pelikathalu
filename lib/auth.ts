export const AUTH_COOKIE = "pk_admin";
export const SESSION_HOURS = 12;

function b64url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

async function hmac(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
}

function authSecret(): string {
  const s = process.env.DASHBOARD_SECRET || process.env.DASHBOARD_PASSWORD;
  if (!s) throw new Error("DASHBOARD_SECRET/DASHBOARD_PASSWORD not set");
  return s;
}

export async function createSessionToken(): Promise<string> {
  const exp = Date.now() + SESSION_HOURS * 3600_000;
  return `${exp}.${await hmac(String(exp), authSecret())}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const expected = await hmac(exp, authSecret());
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

export async function checkPassword(password: unknown): Promise<boolean> {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected || typeof password !== "string") return false;
  if (password.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= password.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
