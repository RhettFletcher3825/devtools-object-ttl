import { processBuild } from "./lifecycle_service";

const builtAt = process.env.BUILT_AT ?? new Date(Date.now() - 2 * 3_600_000).toISOString();
const result = await processBuild({ objectKey: "previews/reel-42.json", builtAt, ttlHours: 1 });
console.log(JSON.stringify(result, null, 2));
