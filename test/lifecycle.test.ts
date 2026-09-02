import assert from "node:assert/strict";
import { decideExpiry } from "../src/lifecycle_service";

const now = new Date("2026-08-30T12:00:00Z");
const result = decideExpiry({ objectKey: "previews/clip.json", builtAt: new Date("2026-08-30T09:00:00Z"), ttlHours: 2 }, now);
assert.equal(result.action, "expire");
assert.equal(result.reason, "TTL reached");
console.log("lifecycle decision test passed");
