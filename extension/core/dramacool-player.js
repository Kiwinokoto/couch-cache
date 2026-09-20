(function installCouchCacheDramacoolPlayer(root) {
  if (root.CouchCacheDramacoolPlayer) {
    return;
  }

  const MAX_PLAYER_DATA_LENGTH = 1_000_000;
  const MAX_EPISODES = 200;

  function shortString(value, limit = 120) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
  }

  function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function summarizeHttpUrl(value) {
    try {
      const parsed = new URL(String(value || "").trim());

      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return null;
      }

      const lastSegment = parsed.pathname.split("/").pop() || "";
      const extensionMatch = lastSegment.match(/(\.[a-z0-9]{2,8})$/i);

      return {
        origin: parsed.origin,
        extension: extensionMatch ? extensionMatch[1].toLowerCase() : "",
        queryKeys: unique(Array.from(parsed.searchParams.keys())).slice(0, 30)
      };
    } catch {
      return null;
    }
  }

  function classifyMedia(value) {
    const raw = String(value || "").trim();

    if (/^<iframe\b/i.test(raw)) {
      return "iframe";
    }

    const summary = summarizeHttpUrl(raw);
    if (!summary) {
      return "unknown";
    }

    if (summary.extension === ".m3u8") {
      return "hls_manifest";
    }

    if (summary.extension === ".mpd") {
      return "dash_manifest";
    }

    if (summary.extension === ".mp4") {
      return "direct_mp4";
    }

    if (summary.extension === ".webm") {
      return "direct_webm";
    }

    return "unknown";
  }

  function splitPlaylist(rawHtml) {
    const text = String(rawHtml || "").slice(0, MAX_PLAYER_DATA_LENGTH);
    const beforePoster = text.split(/;\s*<img\b/i, 1)[0];

    return beforePoster
      .split(/;\s*(?=(?:https?:|<iframe\b|<video\b))/i)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, MAX_EPISODES);
  }

  function summarizeSubtitleField(value) {
    const tracks = String(value || "")
      .split(/,\s*/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 100);

    const summaries = tracks
      .map(summarizeHttpUrl)
      .filter(Boolean);

    return {
      count: summaries.length,
      origins: unique(summaries.map((item) => item.origin)),
      formats: unique(
        summaries.map((item) => item.extension.replace(/^\./, ""))
      )
    };
  }

  function summarize(boot) {
    if (!boot || typeof boot !== "object") {
      return null;
    }

    const playerData =
      boot.playerData && typeof boot.playerData === "object"
        ? boot.playerData
        : {};
    const settings =
      boot.settings && typeof boot.settings === "object"
        ? boot.settings
        : {};

    const chunks = splitPlaylist(playerData.html);
    const episodes = [];

    for (const chunk of chunks) {
      const fields = chunk.split("|");
      const mediaRaw = String(fields[0] || "").trim();
      const mediaSummary = summarizeHttpUrl(mediaRaw);
      const mediaFamily = classifyMedia(mediaRaw);
      const subtitleSummary = summarizeSubtitleField(fields.slice(2).join("|"));
      const subtitleLanguages = String(fields[1] || "")
        .split(",")
        .map((item) => shortString(item, 40))
        .filter(Boolean)
        .slice(0, 40);

      if (mediaFamily === "unknown" && subtitleSummary.count === 0) {
        continue;
      }

      episodes.push({
        episode: episodes.length + 1,
        mediaFamily,
        mediaOrigin: mediaSummary ? mediaSummary.origin : null,
        mediaExtension: mediaSummary ? mediaSummary.extension : "",
        queryKeys: mediaSummary ? mediaSummary.queryKeys : [],
        subtitleCount: subtitleSummary.count,
        subtitleOrigins: subtitleSummary.origins,
        subtitleFormats: subtitleSummary.formats,
        subtitleLanguages
      });
    }

    if (
      episodes.length === 0 &&
      !boot.playerDataEndpoint &&
      !boot.playerId &&
      !settings.playerId
    ) {
      return null;
    }

    const endpoint = summarizeHttpUrl(boot.playerDataEndpoint);
    const mediaFamilies = unique(
      episodes.map((item) => item.mediaFamily).filter((item) => item !== "unknown")
    );
    const mediaOrigins = unique(episodes.map((item) => item.mediaOrigin));
    const mediaQueryKeys = unique(
      episodes.flatMap((item) => item.queryKeys)
    ).slice(0, 40);
    const subtitleLanguages = unique(
      episodes.flatMap((item) => item.subtitleLanguages)
    ).slice(0, 60);
    const subtitleOrigins = unique(
      episodes.flatMap((item) => item.subtitleOrigins)
    ).slice(0, 20);
    const subtitleFormats = unique(
      episodes.flatMap((item) => item.subtitleFormats)
    ).slice(0, 20);

    const trackAccess = settings.trackAccess;

    return {
      detected: true,
      source: shortString(playerData.source || boot.source, 60),
      playerId: shortString(settings.playerId || boot.playerId, 60),
      useJw: Boolean(settings.useJw),
      hlsLibraryConfigured: Boolean(
        settings.hls &&
          typeof settings.hls === "object" &&
          settings.hls.libraryUrl
      ),
      playerDataEndpointOrigin: endpoint ? endpoint.origin : null,
      episodeCount: episodes.length,
      orderedPlaylist: episodes.length > 1,
      mediaFamilies,
      mediaOrigins,
      mediaQueryKeys,
      subtitleLanguages,
      subtitleOrigins,
      subtitleFormats,
      totalSubtitleTracks: episodes.reduce(
        (sum, item) => sum + item.subtitleCount,
        0
      ),
      protectedTrackConfigPresent: Array.isArray(trackAccess)
        ? trackAccess.length > 0
        : Boolean(trackAccess),
      episodes
    };
  }

  root.CouchCacheDramacoolPlayer = Object.freeze({
    summarize
  });
})(globalThis);
