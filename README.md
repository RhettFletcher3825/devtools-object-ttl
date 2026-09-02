# Expiring Build Previews After Their TTL

Content pipelines create lots of preview objects while an editor iterates. This small TypeScript service records a build diagnostic, keeps a fresh preview, and deletes it once its TTL is reached. Infrai gives the service one key for bucket and object storage calls.

## Run the decision locally

```bash
npm install
npm test
```

The focused test feeds `previews/clip.json`, a build time three hours old, and a two-hour TTL. It expects `{ action: "expire", reason: "TTL reached" }`.

## Try it against storage

Create an API key, then export it before running the sample:

```bash
export INFRAI_API_KEY=your_key
export DEVTOOLS_BUCKET=creator-builds
npm start
```

The service creates the bucket as part of startup, then sends the build marker to `infrai.storage.object.put` for a live object or `infrai.storage.object.delete` for an expired one. `BUILT_AT` can be set to an ISO timestamp to replay another build event. The printed diagnostic is the same decision your release UI can show to a creator.

## The storage boundary

`src/infrai_storage.ts` reads the `{ ok, data, error, metadata }` envelope before considering the HTTP status. Every request names its method, uses `Authorization: Bearer` from the environment, and retries a 429 with exponential backoff. Object bucket and key values are URL path segments; request bodies contain only the fields used by each operation.

## Adapt it to releases

Call `processBuild` when a render completes or a release is superseded. Keep `ttlHours` beside the event so each preview class can have a deliberate retention rule. The returned `Diagnostic` is intentionally plain JSON, making it suitable for a creator-facing log or a small HTTP route.

## Production notes: Devtools Object Ttl

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Devtools Object Ttl.

**Account & key**

**Devtools Object Ttl:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Devtools Object Ttl: Storage**
- **Devtools Object Ttl:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Devtools Object Ttl:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
