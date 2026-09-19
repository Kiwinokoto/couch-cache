(function installCouchCacheCollector(root) {
  const MARKER = "COUCHCACHE_PAGE_PROBE_V1";
  const C = root.CouchCacheClassifier;
  const registry = root.CouchCacheAdapterRegistry;

  if (!C || !registry) {
    return;
  }

  if (root.__couchCacheCollectorInstalled) {
    root.__couchCacheCollectorInstalled.publish();
    return;
  }

  const state = {
    network: [],
    mseTypes: [],
    keySystems: [],
    encryptedEvents: [],
    probeStatus: null,
    publishTimer: null
  };

  function uniquePush(target, value, keyFn, limit) {
    if (!value || target.length >= limit) {
      return;
    }

    const key = keyFn(value);
    if (!target.some((item) => keyFn(item) === key)) {
      target.push(value);
    }
  }

  function safeMediaUrl(value) {
    return C.sanitizeUrl(value, location.href);
  }

  function collectVideos() {
    return Array.from(document.querySelectorAll("video"))
      .slice(0, 10)
      .map((video) => {
        const sourceUrls = Array.from(video.querySelectorAll("source[src]"))
          .slice(0, 20)
          .map((source) => ({
            url: safeMediaUrl(source.src),
            type: C.sanitizeText(source.type, 100)
          }))
          .filter((item) => item.url);

        const tracks = Array.from(video.querySelectorAll("track[src]"))
          .slice(0, 20)
          .map((track) => ({
            url: safeMediaUrl(track.src),
            kind: C.sanitizeText(track.kind, 40),
            srclang: C.sanitizeText(track.srclang, 20),
            label: C.sanitizeText(track.label, 80)
          }))
          .filter((item) => item.url);

        return {
          currentSrc: safeMediaUrl(video.currentSrc),
          src: safeMediaUrl(video.src),
          sourceUrls,
          tracks,
          readyState: Number(video.readyState),
          networkState: Number(video.networkState),
          duration:
            Number.isFinite(video.duration) && video.duration > 0
              ? Number(video.duration.toFixed(2))
              : null
        };
      });
  }

  function collectIframes() {
    return Array.from(document.querySelectorAll("iframe"))
      .slice(0, 30)
      .map((iframe) => {
        const safe = safeMediaUrl(iframe.src);

        return {
          url: safe,
          title: C.sanitizeText(
            iframe.getAttribute("title") || iframe.name || "",
            100
          ),
          crossOrigin:
            Boolean(safe && safe.origin) && safe.origin !== location.origin
        };
      })
      .filter((item) => item.url);
  }

  function collectResources() {
    if (!performance || typeof performance.getEntriesByType !== "function") {
      return [];
    }

    const result = [];

    for (const entry of performance.getEntriesByType("resource")) {
      if (result.length >= 120) {
        break;
      }

      const safe = safeMediaUrl(entry.name);
      if (!safe) {
        continue;
      }

      const kind = C.classifyMedia(safe, "");
      const initiatorType = String(entry.initiatorType || "");

      if (
        kind === "unknown" &&
        initiatorType !== "video" &&
        initiatorType !== "audio"
      ) {
        continue;
      }

      result.push({
        url: safe,
        kind,
        initiatorType,
        transferSize: Number(entry.transferSize) || 0,
        encodedBodySize: Number(entry.encodedBodySize) || 0,
        durationMs: Number.isFinite(entry.duration)
          ? Number(entry.duration.toFixed(1))
          : null
      });
    }

    return result;
  }

  function collectTemporarySignals(items) {
    const signals = new Set();

    function visit(value) {
      if (!value) {
        return;
      }

      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }

      if (value.temporarySignals) {
        value.temporarySignals.forEach((signal) => signals.add(signal));
      }

      if (typeof value === "object") {
        Object.values(value).forEach(visit);
      }
    }

    visit(items);
    return Array.from(signals).sort();
  }

  function buildReport() {
    const videos = collectVideos();
    const iframes = collectIframes();
    const resources = collectResources();
    const adapter = registry.select(location);

    let adapterEvidence = { nextEpisodeCandidates: [] };
    try {
      adapterEvidence =
        adapter.inspect(document, {
          sanitizeUrl: C.sanitizeUrl,
          sanitizeText: C.sanitizeText
        }) || adapterEvidence;
    } catch {
      adapterEvidence = {
        nextEpisodeCandidates: [],
        error: "adapter-inspection-failed"
      };
    }

    const mediaKinds = [];

    for (const video of videos) {
      for (const candidate of [video.currentSrc, video.src]) {
        if (candidate) {
          mediaKinds.push(C.classifyMedia(candidate, ""));
        }
      }

      for (const source of video.sourceUrls) {
        mediaKinds.push(C.classifyMedia(source.url, source.type));
      }
    }

    for (const resource of resources) {
      mediaKinds.push(resource.kind);
    }

    for (const event of state.network) {
      mediaKinds.push(event.kind);
    }

    if (state.mseTypes.length > 0) {
      mediaKinds.push("mse_blob");
    }

    const drmDetected =
      state.keySystems.length > 0 || state.encryptedEvents.length > 0;
    const hasBlob = videos.some(
      (video) =>
        (video.currentSrc && video.currentSrc.protocol === "blob:") ||
        (video.src && video.src.protocol === "blob:")
    );

    const media = C.inferMedia(mediaKinds);
    const temporarySignals = collectTemporarySignals([
      videos,
      iframes,
      resources,
      state.network
    ]);

    let player = "unknown";
    if (hasBlob || state.mseTypes.length > 0) {
      player = "HTMLMediaElement + Media Source Extensions likely";
    } else if (videos.length > 0) {
      player = "HTMLMediaElement";
    } else if (iframes.length > 0) {
      player = "iframe player possible";
    }

    let difficulty = "unknown - needs site evidence";
    let cacheBrowserPossible =
      "unknown - run a controlled non-DRM fetch/storage test";

    if (drmDetected) {
      difficulty = "non-compatible candidate: DRM/EME signal detected";
      cacheBrowserPossible = "no CouchCache prefetch attempt on this playback path";
    } else if (media === "direct file") {
      difficulty = "low/medium candidate: validate URL lifetime, range and session";
      cacheBrowserPossible = "candidate";
    } else if (media === "HLS" || media === "MPEG-DASH") {
      difficulty = "medium/high candidate: segmented stream + replay path to validate";
      cacheBrowserPossible = "candidate";
    } else if (iframes.some((frame) => frame.crossOrigin)) {
      difficulty = "site adapter / iframe-origin permission likely";
    }

    const observedBytes = resources.reduce(
      (sum, item) => sum + Math.max(item.encodedBodySize, item.transferSize, 0),
      0
    );

    return {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      page: {
        url: C.sanitizeUrl(location.href),
        title: C.sanitizeText(document.title, 160)
      },
      adapter: adapter.id,
      summary: {
        player,
        media,
        drm: drmDetected
          ? "detected"
          : "not observed (not proof of absence)",
        temporaryUrls:
          temporarySignals.length > 0
            ? "possible: " + temporarySignals.join(", ")
            : "not indicated by query-key names",
        nextEpisodeDetectable:
          Array.isArray(adapterEvidence.nextEpisodeCandidates) &&
          adapterEvidence.nextEpisodeCandidates.length > 0
            ? "candidate(s) found"
            : "not detected generically",
        cacheBrowserPossible,
        difficulty,
        sessionCookies: "unknown (cookie values are not inspected)",
        observedTransfer: C.bytesToText(observedBytes)
      },
      evidence: {
        videos,
        iframes,
        resources,
        adapter: adapterEvidence,
        probe: {
          status: state.probeStatus,
          network: state.network,
          mseTypes: state.mseTypes,
          keySystems: state.keySystems,
          encryptedEvents: state.encryptedEvents
        }
      }
    };
  }

  function publish() {
    state.publishTimer = null;

    const report = buildReport();

    chrome.runtime
      .sendMessage({
        type: "COUCHCACHE_REPORT",
        report
      })
      .catch(() => {});
  }

  function schedulePublish() {
    if (state.publishTimer !== null) {
      return;
    }

    state.publishTimer = root.setTimeout(publish, 350);
  }

  root.addEventListener("message", (event) => {
    if (event.source !== root) {
      return;
    }

    const message = event.data;
    if (!message || message.marker !== MARKER || typeof message.type !== "string") {
      return;
    }

    const payload =
      message.payload && typeof message.payload === "object"
        ? message.payload
        : {};

    if (message.type === "network") {
      const safe = safeMediaUrl(payload.url);
      if (safe) {
        const item = {
          source: C.sanitizeText(payload.source, 20),
          method: C.sanitizeText(payload.method, 12),
          url: safe,
          status: Number(payload.status) || 0,
          contentType: C.sanitizeText(payload.contentType, 120)
        };

        item.kind = C.classifyMedia(item.url, item.contentType);

        if (item.kind !== "unknown" || item.contentType.startsWith("video/") || item.contentType.startsWith("audio/")) {
          uniquePush(
            state.network,
            item,
            (entry) =>
              [
                entry.source,
                entry.method,
                entry.url && entry.url.url,
                entry.contentType,
                entry.status
              ].join("|"),
            100
          );
        }
      }
    }

    if (message.type === "mse-source-buffer") {
      uniquePush(
        state.mseTypes,
        C.sanitizeText(payload.mimeType, 180),
        (value) => value,
        20
      );
    }

    if (message.type === "eme-key-system") {
      uniquePush(
        state.keySystems,
        C.sanitizeText(payload.keySystem, 120),
        (value) => value,
        10
      );
    }

    if (message.type === "encrypted") {
      uniquePush(
        state.encryptedEvents,
        {
          initDataType: C.sanitizeText(payload.initDataType, 80)
        },
        (value) => value.initDataType,
        10
      );
    }

    if (message.type === "probe-status") {
      state.probeStatus = {
        installed: Boolean(payload.installed),
        reused: Boolean(payload.reused)
      };
    }

    schedulePublish();
  });

  root.__couchCacheCollectorInstalled = {
    publish
  };

  publish();
})(globalThis);
