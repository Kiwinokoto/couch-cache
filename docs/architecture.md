# Architecture

## Goal

CouchCache should make ordinary, non-DRM browser video more tolerant of intermittent Wi-Fi by preparing upcoming episodes while bandwidth is available.

The key architectural rule is: **analyze first, cache second**. A player that looks like HTML5 video can still hide a segmented stream, an iframe, temporary URLs, session requirements, or EME.

## Phase 0: compatibility analyzer

Implemented now.

### Popup

User-triggered control surface:

- start analysis for the active tab;
- display the latest preliminary summary;
- refresh after playback has generated more evidence;
- copy a sanitized JSON report.

### Service worker

Minimal orchestration only:

- inject the isolated collector into the active top-level page;
- inject the page-world probe;
- receive sanitized reports;
- keep the latest report in extension-local metadata storage.

It does not download media.

### Isolated collector

Reads browser-visible state without altering the player:

- video/source/track elements;
- iframe URLs;
- Resource Timing entries;
- generic navigation candidates;
- events sent by the page-world probe.

All URLs are sanitized before persistence. Query parameter values and fragments are discarded.

### Page-world probe

Some player APIs must be observed in the page JavaScript world. The probe minimally wraps or observes:

- fetch;
- XMLHttpRequest completion;
- MediaSource.addSourceBuffer;
- Navigator.requestMediaKeySystemAccess;
- encrypted media events.

It records metadata only: URL, HTTP status, exposed content type, MSE MIME type, key-system name, and encrypted-event type. It never reads response bodies, cookies, authorization headers, license messages, or encryption initialization bytes.

Reloading the page removes the wrappers.

### Adapter registry

The analyzer has a generic adapter plus a stable registration surface for future site adapters.

A site adapter may provide:

- site match logic;
- series/episode metadata extraction;
- next-episode discovery;
- player iframe discovery;
- site-specific confidence notes.

An adapter must not contain credentials, tokens, captured signed URLs, or DRM circumvention code.

## Proposed product V1 after feasibility

Do not implement these components until at least one real site has a completed compatibility card.

### Queue planner

Responsibilities:

- current episode + configurable look-ahead count;
- sequential by default;
- concurrency 1 unless measurements justify more;
- pause/resume;
- backoff after 429/5xx/network errors;
- never compete aggressively with current playback.

### Fetch layer

Per-site adapter provides a normalized media plan rather than raw download code.

Possible plans:

- direct file with optional byte-range resume;
- HLS manifest + selected rendition + segment list;
- DASH MPD + selected representation + segment list;
- unsupported/DRM.

Authentication and CORS behavior must be measured per site. No design should assume that an extension-origin fetch can reproduce the player request.

### Storage index

Structured metadata belongs in IndexedDB or extension storage:

- series/episode identity;
- media plan fingerprint;
- segment/file state;
- watched/prepared state;
- byte counts;
- last access;
- expiry hints.

Large media should not be stored in chrome.storage.

### Media bytes

Candidates to test:

- Cache Storage for request/response-shaped manifests and segments;
- OPFS for large direct-file/chunk workflows if Cache Storage proves awkward;
- IndexedDB only where structured Blob storage is clearly useful.

Use navigator.storage.estimate() for quota/usage visibility. Persistent-storage behavior must be verified in the target browser rather than assumed.

### Playback integration

This is the largest unknown.

Direct files may be comparatively simple if a stable local representation can be supplied to a player.

HLS/DASH commonly use Media Source Extensions. Possible future approaches include:

1. serving cached segment responses back to the existing player;
2. an adapter-controlled playback path using MSE;
3. declaring a site unsupported if transparent replay cannot be done cleanly.

Do not choose an MSE playback implementation until real players have been observed.

## Why Cache Storage is promising but not yet chosen

Cache Storage naturally stores Request/Response pairs and is available in workers. That maps well to manifests and immutable media segments.

It does not, by itself, solve:

- access to the original authenticated request;
- signed URL expiry;
- byte-range reconstruction for one giant MP4;
- replay into a third-party player;
- storage eviction policy;
- mapping equivalent URLs whose signatures change.

Therefore it is a candidate backend, not an architectural assumption.

## DRM policy

Signals include:

- requestMediaKeySystemAccess calls;
- HTMLMediaElement encrypted events.

A DRM signal ends the ordinary caching experiment for that playback path. CouchCache may report the key-system identifier for diagnosis but must not request licenses, inspect license payloads, extract keys, or attempt decryption.

## Permissions policy

Start with:

- activeTab;
- scripting;
- storage.

Host access is optional and should be requested only when a concrete site/CDN test needs it.

Network-level webRequest analysis is a second-level diagnostic because Chrome requires host access to both the requested URL and its initiator for subresources.

## Browser scope

Analyzer 0.1 targets Chromium MV3 because it gives us one concrete platform to validate quickly.

The code deliberately avoids a framework/build chain. Cross-browser work should happen after we know which streaming patterns matter.
