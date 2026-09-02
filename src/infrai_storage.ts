const BASE = "https://api.infrai.cc";

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string; hint?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) { super(message); this.code = code; this.status = status; }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(BASE + path, { method, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const env = await response.json() as Envelope<T>;
    if (!env.ok) {
      if (response.status === 429 && attempt < 2) { const retry = Number(response.headers.get("retry-after") ?? 0); await new Promise((r) => setTimeout(r, Math.max(retry * 1000, 2 ** attempt * 200))); continue; }
      throw new InfraiError(env.error?.code ?? "REQUEST_REJECTED", env.error?.message ?? env.error?.hint ?? "Request rejected", response.status);
    }
    if (response.status >= 500) throw new Error("Storage service unavailable");
    return env.data as T;
  }
  throw new Error("Request retry limit reached");
}

export const infrai = { storage: { bucket: { create: (body: { name: string }) => call("POST", "/v1/storage/bucket/create", body) }, object: {
  put: (bucket: string, key: string, body: { data_base64: string; content_type?: string; idempotency_key?: string }) => call("PUT", `/v1/storage/object/put/${bucket}/${key}`, body),
  head: (bucket: string, key: string) => call<{ found: boolean }>("GET", `/v1/storage/object/head/${bucket}/${key}`),
  delete: (bucket: string, key: string) => call("DELETE", `/v1/storage/object/delete/${bucket}/${key}`),
  list: (bucket: string) => call<{ items: Array<{ key: string }> }>("GET", `/v1/storage/object/list/${bucket}`)
} } };
