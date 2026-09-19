(function installCouchCacheClassifier(root) {
  if (root.CouchCacheClassifier) {
    return;
  }

  const TEMPORARY_QUERY_NAMES = [
    "token",
    "access_token",
    "auth",
    "authorization",
    "expires",
    "expiry",
    "expire",
    "exp",
    "signature",
    "sig",
    "policy",
    "key-pair-id",
    "keypairid",
    "hdnea",
    "hmac",
    "jwt",
    "session",
    "secure"
  ];

  function temporarySignals(queryKeys) {
    const lowered = queryKeys.map((key) => String(key).toLowerCase());
    return lowered.filter((key) =>
      TEMPORARY_QUERY_NAMES.some(
        (name) => key === name || key.includes(name)
      )
    );
  }

  function looksSensitivePathSegment(rawSegment) {
    if (!rawSegment) {
      return false;
    }

    let segment = String(rawSegment);

    try {
      segment = decodeURIComponent(segment);
    } catch {
      // Keep the encoded form when it is not valid percent-encoding.
    }

    if (
      /^eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}$/.test(
        segment
      )
    ) {
      return true;
    }

    if (/^[a-f0-9]{24,}$/i.test(segment)) {
      return true;
    }

    if (
      segment.length >= 40 &&
      /^[A-Za-z0-9_-]+$/.test(segment) &&
      /[A-Za-z]/.test(segment) &&
      /\d/.test(segment)
    ) {
      return true;
    }

    return false;
  }

  function sanitizePathname(pathname) {
    return String(pathname || "")
      .split("/")
      .map((segment) =>
        looksSensitivePathSegment(segment) ? ":redacted" : segment
      )
      .join("/");
  }

  function sanitizeUrl(value, baseUrl) {
    if (!value) {
      return null;
    }

    try {
      const parsed = new URL(String(value), baseUrl || undefined);

      if (parsed.protocol === "blob:") {
        return {
          url: "blob:" + (parsed.origin || "opaque"),
          origin: parsed.origin || null,
          pathname: "",
          queryKeys: [],
          temporarySignals: [],
          protocol: "blob:"
        };
      }

      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return {
          url: parsed.protocol,
          origin: null,
          pathname: "",
          queryKeys: [],
          temporarySignals: [],
          protocol: parsed.protocol
        };
      }

      const queryKeys = Array.from(new Set(Array.from(parsed.searchParams.keys())));
      const pathname = sanitizePathname(parsed.pathname);

      return {
        url: parsed.origin + pathname,
        origin: parsed.origin,
        pathname,
        queryKeys,
        temporarySignals: temporarySignals(queryKeys),
        protocol: parsed.protocol
      };
    } catch {
      return null;
    }
  }

  function normalizeContentType(contentType) {
    return String(contentType || "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
  }

  function classifyMedia(urlInfo, contentType) {
    const path = String(
      urlInfo && typeof urlInfo === "object"
        ? urlInfo.pathname || urlInfo.url || ""
        : urlInfo || ""
    ).toLowerCase();
    const type = normalizeContentType(contentType);

    if (
      path.endsWith(".m3u8") ||
      type === "application/vnd.apple.mpegurl" ||
      type === "application/x-mpegurl"
    ) {
      return "hls_manifest";
    }

    if (path.endsWith(".mpd") || type === "application/dash+xml") {
      return "dash_manifest";
    }

    if (
      path.endsWith(".vtt") ||
      path.endsWith(".srt") ||
      path.endsWith(".ass") ||
      path.endsWith(".ssa") ||
      type === "text/vtt"
    ) {
      return "subtitle";
    }

    if (path.endsWith(".m4s") || type === "video/iso.segment") {
      return "cmaf_segment";
    }

    if (path.endsWith(".ts")) {
      return "transport_segment";
    }

    if (path.endsWith(".aac") || path.endsWith(".m4a")) {
      return "audio_media";
    }

    if (path.endsWith(".mp4") || type === "video/mp4") {
      return "direct_mp4";
    }

    if (path.endsWith(".webm") || type === "video/webm") {
      return "direct_webm";
    }

    if (
      (urlInfo && urlInfo.protocol === "blob:") ||
      path.startsWith("blob:")
    ) {
      return "mse_blob";
    }

    if (type.startsWith("video/") || type.startsWith("audio/")) {
      return "media_other";
    }

    return "unknown";
  }

  function inferMedia(kinds) {
    const set = new Set(kinds);

    if (set.has("hls_manifest")) {
      return "HLS";
    }

    if (set.has("dash_manifest")) {
      return "MPEG-DASH";
    }

    if (set.has("direct_mp4") || set.has("direct_webm")) {
      return "direct file";
    }

    if (
      set.has("cmaf_segment") ||
      set.has("transport_segment") ||
      set.has("mse_blob")
    ) {
      return "segmented/MSE (protocol not yet proven)";
    }

    return "unknown";
  }

  function sanitizeText(value, maxLength) {
    const limit = Number.isInteger(maxLength) ? maxLength : 160;
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
  }

  function bytesToText(value) {
    const bytes = Number(value);

    if (!Number.isFinite(bytes) || bytes <= 0) {
      return "unknown";
    }

    const units = ["B", "KiB", "MiB", "GiB"];
    let amount = bytes;
    let unitIndex = 0;

    while (amount >= 1024 && unitIndex < units.length - 1) {
      amount /= 1024;
      unitIndex += 1;
    }

    return amount.toFixed(unitIndex === 0 ? 0 : 1) + " " + units[unitIndex];
  }

  root.CouchCacheClassifier = Object.freeze({
    sanitizeUrl,
    classifyMedia,
    inferMedia,
    temporarySignals,
    sanitizeText,
    bytesToText
  });
})(globalThis);
