# CouchCache

CouchCache is an experimental browser project for smoother video playback on intermittent connections by preparing upcoming non-DRM media while the network is healthy.

The project starts with a compatibility analyzer. It is deliberately **not** a downloader yet.

## Scope and safety boundary

CouchCache may eventually prefetch media only when the browser can access it normally and the media is not protected by DRM or another access-control mechanism.

CouchCache does **not** aim to:

- bypass DRM / Encrypted Media Extensions;
- bypass subscriptions, authentication, paywalls, geo-restrictions, or access controls;
- extract credentials, session cookies, authorization headers, or license data;
- defeat rate limits or anti-bot protections;
- commit downloaded video, tokens, cookies, private URLs, or personal information to this public repository.

If DRM/EME is detected, the analyzer records that signal and the site is treated as non-compatible unless there is a legitimate non-DRM path.

## Current milestone: Analyzer 0.1

The unpacked browser extension can be run manually on an episode page. It inventories:

- HTML video/source/track elements;
- iframe players;
- likely direct MP4/WebM media;
- HLS manifests and segments;
- MPEG-DASH manifests and CMAF-style segments;
- Media Source Extensions MIME types observed after the probe starts;
- EME requests and encrypted media events;
- likely temporary/signed URL parameter names, with query values and high-entropy path tokens redacted;
- generic next-episode link candidates;
- a small sample of relevant performance/network evidence.

It produces a local JSON report and a preliminary compatibility summary.

The analyzer does not fetch or cache video itself.

## Why an extension first

A browser extension is the best current hypothesis because it can separate:

1. page observation;
2. per-site adapters;
3. background orchestration;
4. future storage and queue management;
5. optional per-host permissions.

The decision is still reversible. The analyzer exists specifically to validate the assumptions before CouchCache implements media caching.

## Quick start

Requirements: a Chromium-family browser and, for repository checks, Node.js 20+.

1. Clone or download this repository.
2. Open the browser extension management page.
3. Enable Developer mode.
4. Choose **Load unpacked** and select the extension directory.
5. Open an episode page.
6. Start the CouchCache extension and click **Analyze this tab**.
7. Start or continue playback for roughly 20-30 seconds.
8. Re-open the popup and click **Refresh report**.
9. Copy the JSON report and use the procedure in docs/site-analysis.md.

For players initialized before CouchCache was started, the report may contain historical Resource Timing entries but can miss early EME/MSE calls. The site-analysis procedure explains the fallback checks.

## Compatibility card

Each tested site gets a short card:

~~~text
Site:
Lecteur:
Média:
DRM:
URL stable/temporaire:
Episode suivant détectable:
Cache navigateur possible:
Difficulté:
Conclusion V1:
~~~

Use docs/compatibility-template.md. Do not commit live signed URLs or credentials.

## Repository layout

~~~text
extension/
  adapters/          generic adapter registry; site adapters come later
  content/           DOM/network collector + page-world probe
  core/              protocol classification and URL redaction
  popup/             small analyzer UI
  manifest.json
  service-worker.js

docs/
  architecture.md
  site-analysis.md
  compatibility-template.md

scripts/check.mjs     zero-dependency validation
BACKLOG.md
~~~

## Checks

No npm dependencies are required.

~~~bash
npm test
~~~

The check validates the manifest, JavaScript syntax, URL redaction, media classification, and a few safety invariants.

## Status

The repository contains no site-specific assumptions yet. The first real compatibility work starts when we have the exact domains/episode URLs used in practice.
