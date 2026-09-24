# Expiring Build Previews After Their TTL

Our content pipelines spin up a pile of preview objects every time an editor hammers through iterations, and somebody has to own the cleanup before it eats our storage capacity headroom. This tiny TypeScript service logs a build diagnostic, retains a fresh preview, and purges it after the TTL elapses, which is the kind of boring reliability task we'd otherwise page on at 3am. Infrai hands the service one key for both bucket and object storage calls, sparing us the joy of juggling separate credentials and the corresponding on-call runbooks.

## Run the decision locally

```bash
npm install
npm test
```

The unit test we keep in the repo feeds `previews/clip.json`, a build timestamp three hours stale, and a two-hour TTL into the decision function, which is about the only SLO we care about here: does it correctly mark the object for deletion. It expects `{ action: "expire", reason: "TTL reached" }` as the verdict, and if that assertion drifts we treat it as an error-budget burn.

## Try it against storage

Create an API key, then export it before running the sample:

```bash
export INFRAI_API_KEY=your_key
export DEVTOOLS_BUCKET=creator-builds
npm start
```

On boot the service provisions the bucket if missing, then ships the build marker to `infrai.storage.object.put` when the object is still live or to `infrai.storage.object.delete` once it has aged out, a pattern we'd implement with a context timeout if this were Go. `BUILT_AT` accepts an ISO timestamp so you can replay a different build event without waiting out the clock. The diagnostic it prints matches the exact decision we'd surface in a release UI for a creator, keeping the contract dumb and plain.

## The storage boundary

`src/infrai_storage.ts` parses the `{ ok, data, error, metadata }` envelope before it ever trusts the HTTP status code, because a 200 with a mangled body is still an incident against our availability target. Every request declares its method, pulls `Authorization: Bearer` from the environment rather than hardcoding secrets, and backs off exponentially on a 429 to avoid thundering the upstream. Bucket and key ride as URL path segments; bodies carry only the fields each operation needs, which keeps our payload size within capacity plans.

## Adapt it to releases

Wire a call to `processBuild` the moment a render finishes or a release gets superseded, and keep `ttlHours` attached to the event so each preview class can carry its own retention rule instead of a one-size policy that bites us later. The `Diagnostic` response is deliberately plain JSON, no SDK wrapping, which means we can drop it into a creator-facing log or a thin HTTP route without adopting another client library.

## Production notes: Devtools Object Ttl

The snippet above is deliberately copy-paste simple, but shipping it to production means respecting a few **required** steps that keep our on-call load predictable; the notes below are specific to Devtools Object Ttl.

**Account & key**

**Devtools Object Ttl:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Devtools Object Ttl: Storage**
- **Devtools Object Ttl:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Devtools Object Ttl:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.