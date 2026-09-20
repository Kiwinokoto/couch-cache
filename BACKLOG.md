# Backlog

The backlog is intentionally ordered around evidence. Do not implement the multi-episode cache before the P0 compatibility work.

## P0 - first real sites

### kissasia.co — Perfect Crown

Structural study completed 2026-09-20:

- direct MP4 playlist detected in page player configuration;
- 12 ordered episode entries;
- separate WebVTT subtitles;
- next episode is directly derivable from playlist order;
- DRM/EME not observed in this source-level pass;
- site-specific structural adapter added without persisting media URLs.

Still required before any prefetch implementation:

- run the extension in a real Chromium tab on the title;
- measure one episode's response metadata and approximate size;
- verify byte-range/resume behavior;
- verify extension-context CORS and normal browser credential requirements;
- re-check URL lifetime after reload/delay;
- confirm whether alternate qualities are available.

See docs/sites/kissasia.co-perfect-crown.md.

### Additional sites

For each site:

- run docs/site-analysis.md;
- create one sanitized compatibility card;
- identify top-page versus iframe player;
- classify direct / HLS / DASH / unknown segmented media;
- record DRM as detected or not observed;
- identify subtitle format and quality variants;
- determine how the next episode is represented;
- check URL lifetime without committing token values;
- determine whether browser session credentials are required;
- estimate one episode size at a named quality.

## P0 - analyzer hardening

After the first real site reveals what is missing:

- run and validate the KissAsia adapter in a real browser;
- add optional iframe-origin analysis when required;
- add optional webRequest diagnostics only if Resource Timing/page instrumentation is insufficient;
- improve report confidence labels;
- add report-to-Markdown compatibility-card export.

## P1 - one-resource fetch feasibility

Only for a confirmed non-DRM site:

- request the minimum host permission;
- fetch one harmless manifest or a small media segment, or use response metadata for a direct file;
- record status/content type/size only;
- verify credential behavior;
- verify retry/backoff behavior;
- verify that the experiment does not disturb current playback.

No bulk episode prefetch yet.

## P1 - storage spike

Measure on the target browser:

- navigator.storage.estimate();
- Cache Storage behavior with representative segments;
- eviction behavior;
- persistent-storage behavior;
- cleanup;
- optional OPFS comparison for large direct-file chunks.

Select a backend only after measurement.

## P1 - media-plan abstraction

Define a normalized plan:

- DirectFilePlan;
- HlsPlan;
- DashPlan;
- UnsupportedPlan.

Keep site adapters responsible for discovery, not storage implementation.

## P2 - single episode offline-ready experiment

Non-DRM only:

- choose one quality;
- sequential fetch;
- resume after interruption;
- visible byte/progress state;
- strict disk cap;
- delete button;
- verify replay path.

## P2 - look-ahead queue

After single-episode replay works:

- configurable episodes ahead;
- sequential by default;
- pause/resume;
- current-playback priority;
- automatic deletion of watched episodes;
- disk quota;
- conservative 429/5xx backoff.

## Explicit non-goals

- DRM bypass;
- key/license extraction;
- credential scraping;
- aggressive parallel downloading;
- anti-bot bypass;
- assumptions about sites we have not tested.
