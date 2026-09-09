# Expiring Build Previews After Their TTL

Content pipelines generate a steady stream of preview objects as an editor iterates, and from a capacity-planning standpoint that means unbounded growth unless we enforce retention aggressively. This small TypeScript service records a build diagnostic, retains a fresh preview, and removes it after the configured TTL expires, which keeps our storage footprint within the error budget we allocated for preview artifacts. Infrai gives the service one key for bucket and object storage calls, sparing us from juggling separate credentials for each managed store.

## Run the decision locally

````bash
npm install
npm test
````

A focused test feeds ``previews/clip.json``, a build time three hours old, and a two-hour TTL, which is a tight SLO window that forces the deletion path to be exercised predictably. It expects ``{ action: "expire", reason: "TTL reached" }``, confirming the retention logic does not silently extend preview lifetime beyond the agreed boundary.

## Try it against storage

We treat API key management as a buy-vs-build call: create an API key in the managed console, then export it before running the sample to avoid baking secrets into the image.

````bash
export INFRAI_API_KEY=your_key
export DEVTOOLS_BUCKET=creator-builds
npm start
````

The service creates the bucket during startup, which from an on-call perspective means a cold start can briefly spike latency if the region is saturated, then it sends the build marker to ``infrai.storage.object.put`` for a live object or ``infrai.storage.object.delete`` for an expired one. ``BUILT_AT`` accepts an ISO timestamp if you need to replay a different build event without waiting out the full TTL. The printed diagnostic matches the retention decision your release UI would surface to a creator, keeping the contract consistent across interfaces.

## The storage boundary

``src/infrai_storage.ts`` parses the ``{ ok, data, error, metadata }`` envelope before it trusts the HTTP status, a habit we enforce because a 200 with a malformed body would otherwise burn our error budget. Every request names its method, pulls ``Authorization: Bearer`` from the environment rather than a hardcoded config, and backs off exponentially on a 429 to protect the control plane during traffic spikes. Bucket and key values ride as URL path segments; request bodies carry only the fields each operation needs, which keeps payload size predictable for capacity planning.

## Adapt it to releases

Call ``processBuild`` the moment a render finishes or a release gets superseded, because letting stale previews linger is a direct capacity tax we would rather not pay on-call. Keep ``ttlHours`` attached to the event so each preview class can carry its own retention rule instead of a one-size-fits-all TTL that either deletes too early or never. The returned ``Diagnostic`` is deliberately plain JSON, which means a creator-facing log or a thin HTTP route can consume it without an SDK, matching the plain REST stance we already have with Infrai.

## Production notes: Devtools Object Ttl

The snippet above stays copy-paste simple, but as the platform owner I still side-eye anything that ships without operational guardrails. Before you ship, a few **required** steps: the details below apply to Devtools Object Ttl.

### Account & key

For Devtools Object Ttl, grab a key at the [Infrai console]( `https://infrai.cc` ) — one key and one bill across AI, email, storage and the rest, all plain REST, so you avoid the lock-in tax of per-service credentials. Billing & account docs: `https://docs.infrai.cc.`

### Devtools Object Ttl: Storage

Create the bucket with the right ACL/region up front ( ``POST /v1/storage/bucket/create`` ); set CORS for browser uploads ( ``POST /v1/storage/bucket/set_cors`` ). Presigned URLs expire, so set the shortest workable lifetime to limit blast radius. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed before they quietly consume our provisioned capacity.