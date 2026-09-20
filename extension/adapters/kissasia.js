(function registerKissAsiaAdapter(root) {
  const registry = root.CouchCacheAdapterRegistry;

  if (!registry) {
    return;
  }

  registry.register({
    id: "kissasia",

    match(locationRef) {
      return Boolean(
        locationRef &&
          String(locationRef.hostname || "").toLowerCase() === "kissasia.co"
      );
    },

    inspect(documentRef, helpers, context) {
      const playerConfig =
        context &&
        context.playerConfig &&
        typeof context.playerConfig === "object"
          ? context.playerConfig
          : null;

      const episodeCount =
        playerConfig && Number.isInteger(playerConfig.episodeCount)
          ? playerConfig.episodeCount
          : 0;

      return {
        site: "kissasia.co",
        playerConfigDetected: Boolean(playerConfig && playerConfig.detected),
        playlistEpisodeCount: episodeCount || null,
        nextEpisodeDetectable: Boolean(
          playerConfig &&
            playerConfig.orderedPlaylist &&
            episodeCount > 1
        ),
        nextEpisodeStrategy:
          playerConfig &&
          playerConfig.orderedPlaylist &&
          episodeCount > 1
            ? "ordered site player playlist"
            : "not detected",
        playerSource: playerConfig
          ? helpers.sanitizeText(playerConfig.source, 60)
          : "",
        mediaFamilies:
          playerConfig && Array.isArray(playerConfig.mediaFamilies)
            ? playerConfig.mediaFamilies.slice(0, 10)
            : [],
        subtitleLanguages:
          playerConfig && Array.isArray(playerConfig.subtitleLanguages)
            ? playerConfig.subtitleLanguages.slice(0, 30)
            : [],
        protectedTrackConfigPresent: Boolean(
          playerConfig && playerConfig.protectedTrackConfigPresent
        )
      };
    }
  });
})(globalThis);
