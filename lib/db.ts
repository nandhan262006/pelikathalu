import { createClient, type Client } from "@libsql/client";

let client: Client | null = null;

export function getDb(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url || !authToken) throw new Error("TURSO_DATABASE_URL / TURSO_AUTH_TOKEN missing");
    client = createClient({ url, authToken });
  }
  return client;
}

/** Retry transient Turso/network failures with exponential backoff (250ms→2s). */
export async function withRetry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i < tries - 1) await new Promise((r) => setTimeout(r, 250 * 2 ** i));
    }
  }
  throw last;
}
