# Site analysis procedure

Use this procedure for every new streaming site before implementing an adapter.

## 0. Safety

Use an episode the user can already play normally in the browser.

Do not paste or commit:

- cookies;
- Authorization headers;
- DRM license traffic;
- token values;
- signed query-string values;
- private account URLs;
- downloaded video.

The CouchCache report strips query values automatically, but still review an export before publishing it.

## 1. Baseline page

Record:

- site/domain;
- example series;
- episode number;
- whether login is required;
- whether playback is in the top page or a visible iframe;
- available quality/audio/subtitle choices.

Do not infer support yet.

## 2. Run CouchCache Analyzer

1. Open the episode page.
2. Open CouchCache and choose **Analyze this tab**.
3. Start or continue playback.
4. Let at least 20-30 seconds play.
5. If useful, change quality once and enable subtitles once.
6. Open CouchCache again and choose **Refresh report**.
7. Copy the sanitized JSON.

Look first at:

- summary.player;
- summary.media;
- summary.drm;
- summary.temporaryUrls;
- evidence.videos;
- evidence.iframes;
- evidence.resources;
- evidence.probe.network;
- evidence.probe.mseTypes;
- evidence.probe.keySystems.

## 3. Decide the media family

### Direct file candidate

Strong signals:

- video currentSrc is an http(s) MP4/WebM URL;
- network evidence identifies video/mp4 or video/webm;
- no MSE blob URL is required.

Next test later: range support, URL lifetime, credentials, size.

### HLS candidate

Strong signals:

- .m3u8;
- application/vnd.apple.mpegurl or application/x-mpegURL;
- .ts or HLS/CMAF segment pattern associated with a manifest.

Next test later: master/media playlist structure, rendition selection, subtitles, URL expiry.

### DASH candidate

Strong signals:

- .mpd;
- application/dash+xml;
- .m4s/CMAF segments plus MSE behavior.

Next test later: representation selection, initialization segments, subtitles, URL expiry.

### MSE but protocol unclear

Signals:

- video uses blob:;
- MediaSource.addSourceBuffer is observed;
- only generic segment URLs are visible.

Classify as unknown segmented media until DevTools or a host-permission network probe identifies the manifest/protocol.

### iframe player

If the top page only contains a third-party iframe, record the iframe origin.

Do not automatically grant broad host permissions. The next diagnostic step is to grant or configure access only for the player origin and repeat the analysis there.

## 4. DRM check

If the report shows:

- one or more keySystems; or
- encrypted media events;

mark DRM as detected for that playback path.

Conclusion: non-compatible for CouchCache prefetch unless the site also exposes a separate legitimate non-DRM playback path. Do not attempt to inspect or replay license exchange.

If no DRM signal appears, write **not observed**, not **none**. Late instrumentation can miss an earlier EME initialization.

## 5. URL lifetime

The analyzer only detects suspicious parameter names. It does not prove expiry.

For a future controlled test:

1. capture only a redacted structural fingerprint of the media URL;
2. reload the same episode;
3. compare host/path/query-key structure;
4. after a reasonable delay, determine whether the old URL still works without publishing it.

Classify as stable, session-bound, short-lived, or unknown.

## 6. Session/cookie requirement

Do not copy cookie values.

The clean test is behavioral: can the extension fetch the same non-DRM resource with a narrowly granted host permission and normal browser credentials, or does it fail?

Record only:

- no session apparently required;
- browser session required;
- unknown.

## 7. CORS / extension fetch

CORS behavior of the page does not automatically predict extension-origin fetch behavior.

Run a dedicated fetch spike only after the media URL family is known. Record status/content type/byte count; do not log credentials.

## 8. Episode navigation

Start with generic candidates:

- rel=next;
- visible Next / Next episode controls;
- nearby episode-number links.

Then create a site adapter only when the DOM/route pattern is understood.

The adapter should return normalized episode metadata and next URLs. It should not contain download logic.

## 9. Size estimate

Prefer measured media bytes.

For segmented streams, estimate from a representative episode by summing segment sizes or using playlist/representation metadata where reliable.

For direct files, use Content-Length and/or completed transfer size if available.

Do not extrapolate from one quality to another without noting the quality.

## 10. Fill the compatibility card

Copy docs/compatibility-template.md and fill it with evidence.

Allowed conclusions:

- easy;
- feasible with HLS/DASH;
- requires a site-specific adapter;
- not cleanly compatible;
- unknown / needs another targeted test.

## Manual fallback: DevTools Network

Use this only when the analyzer is ambiguous.

Filter for:

- m3u8;
- mpd;
- mp4;
- webm;
- m4s;
- ts;
- vtt;
- media.

Inspect request URL structure and response Content-Type. Never publish cookies, Authorization headers, signed token values, or DRM license payloads.

The goal is classification, not extraction.
