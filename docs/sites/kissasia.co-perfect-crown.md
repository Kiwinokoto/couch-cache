# KissAsia compatibility — kissasia.co / Perfect Crown

Test date: 2026-09-20

This is the first CouchCache site study. It records only structural evidence. No live media URL, cookie, token, DRM license data, or downloaded media belongs in this file.

## Summary

~~~text
Site: kissasia.co
Example: Perfect Crown (2026), completed series, 12 episodes
Lecteur: site player configured for JW Player with HTML5 fallback
Média: direct MP4 playlist in page player configuration
DRM: not observed; not proof of absence
URL stable/temporaire: no query parameters observed on this sample; lifetime not independently measured
Session/cookies nécessaires: unknown; not tested
Sous-titres: separate WebVTT tracks
Qualités audio/vidéo: one media entry per episode observed; alternate qualities not observed
Episode suivant détectable: yes, ordered playlist contains all 12 episodes
Cache navigateur possible: promising candidate; fetch/range/CORS/storage replay still untested
Taille approximative épisode: unknown
Difficulté: low/medium
Conclusion V1: strong direct-file candidate; use a site adapter, then run one controlled fetch/storage experiment
~~~

## Evidence

The public series page exposes a player bootstrap object used by the site's Dramacool-derived theme.

Observed structure:

- one ordered playlist containing 12 episode entries;
- one direct MP4 media entry per episode;
- separate WebVTT subtitle tracks;
- subtitle languages include Filipino, Khmer, English, Indonesian, Malay, Portuguese, Arabic, Hindi, German, French and Spanish;
- the player is configured to use JW Player, with native HTML5/HLS fallbacks in the generic player code;
- the page also configures hls.js, but the Perfect Crown entries observed in this sample are direct MP4 rather than HLS;
- the generic player code contains optional subtitle preparation/encryption support, but the Perfect Crown configuration exposes direct VTT tracks and no protected-track configuration;
- no video EME key-system evidence was observed during this source-level study.

The page also loads third-party advertising/popunder code. Browser testing should therefore remain user-triggered and avoid broad permissions.

## Navigation model

This site is unusually favorable for look-ahead discovery: the series page gives the player the ordered episode playlist up front.

For this sample, CouchCache does not need to scrape a separate “Next episode” page link. A KissAsia adapter can treat playlist item N+1 as the next episode.

This is still an adapter concern rather than a product-wide assumption: other KissAsia titles or servers may use iframe, HLS, DASH, protected tracks, or different player data.

## What is deliberately not concluded yet

The following still require a controlled browser/network test:

- Content-Length / approximate episode size;
- Accept-Ranges / resumable byte-range support;
- CORS behavior from the extension context;
- whether a browser session or Referer/Origin policy is required;
- whether the media URL remains valid after reload or after a delay;
- whether alternate video qualities exist outside the bootstrap data;
- actual Cache Storage or OPFS behavior;
- replay from CouchCache-managed storage.

Until those checks are done, “direct MP4” means technically promising, not “ready for bulk prefetch”.

## Analyzer adaptation

The initial adapter should extract only sanitized structure from the page-world bootstrap:

- episode count and ordering;
- media family;
- media origin only, not the media path;
- query parameter names only, never values;
- subtitle count/languages/origins/formats;
- whether protected-track configuration is present.

No real media URLs are committed to this public repository.
