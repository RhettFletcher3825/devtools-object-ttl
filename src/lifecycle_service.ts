import { z } from "zod";
import { infrai } from "./infrai_storage";

export const requestSchema = z.object({ objectKey: z.string().min(1), builtAt: z.coerce.date(), ttlHours: z.number().positive().max(168) });
export type BuildRequest = z.infer<typeof requestSchema>;
export type Diagnostic = { objectKey: string; action: "keep" | "expire"; ageHours: number; reason: string };

export function decideExpiry(input: BuildRequest, now: Date): Diagnostic {
  const ageHours = (now.getTime() - input.builtAt.getTime()) / 3_600_000;
  const expire = ageHours >= input.ttlHours;
  return { objectKey: input.objectKey, action: expire ? "expire" : "keep", ageHours: Math.round(ageHours * 100) / 100, reason: expire ? "TTL reached" : "TTL still active" };
}

export async function processBuild(raw: unknown, now = new Date()): Promise<Diagnostic> {
  const input = requestSchema.parse(raw);
  const bucket = process.env.DEVTOOLS_BUCKET ?? "creator-builds";
  await infrai.storage.bucket.create({ name: bucket });
  const diagnostic = decideExpiry(input, now);
  const marker = Buffer.from(JSON.stringify({ ...diagnostic, checkedAt: now.toISOString() })).toString("base64");
  if (diagnostic.action === "expire") await infrai.storage.object.delete(bucket, input.objectKey);
  else await infrai.storage.object.put(bucket, input.objectKey, { data_base64: marker, content_type: "application/json", idempotency_key: `build-${input.objectKey}-${input.builtAt.getTime()}` });
  return diagnostic;
}
