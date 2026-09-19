# Site compatibility card

> Keep evidence sanitized. Never commit live signed URLs, token values, cookies, credentials, DRM license data, or downloaded media.

## Summary

~~~text
Site:
Date tested:
Browser:
Example playback context:

Lecteur:
Média:
DRM:
URL stable/temporaire:
Session/cookies nécessaires:
Sous-titres:
Qualités audio/vidéo:
Episode suivant détectable:
Cache navigateur possible:
Taille approximative épisode:
Difficulté:
Conclusion V1:
~~~

## Evidence

### Player

- Top-level video / iframe / unknown:
- iframe origin if relevant:
- currentSrc shape:
- MSE observed:
- MSE MIME types:

### Media

- direct MP4/WebM:
- HLS manifest:
- DASH manifest:
- segment extensions/types:
- response Content-Type signals:

### DRM / EME

- key system requested:
- encrypted event observed:
- note:

Use **not observed** when there is no DRM signal. Do not claim absence from one late capture.

### URL lifetime

- query parameter names:
- changes after reload:
- changes after delay:
- classification: stable / session-bound / short-lived / unknown

### Navigation

- current episode detectable:
- next episode candidate:
- robust selector/route available:
- adapter needed:

### Storage/fetch feasibility

- extension host permission tested:
- extension fetch succeeds:
- credentials required:
- range requests:
- CORS/other blocker:
- measured bytes/quality:

## Decision

- Conclusion:
- Smallest next technical experiment:
- Known risks/unknowns:
