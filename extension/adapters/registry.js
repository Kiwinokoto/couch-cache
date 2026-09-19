(function installCouchCacheAdapterRegistry(root) {
  if (root.CouchCacheAdapterRegistry) {
    return;
  }

  const genericAdapter = {
    id: "generic",

    match() {
      return true;
    },

    inspect(documentRef, helpers) {
      const candidates = [];
      const seen = new Set();
      const nodes = documentRef.querySelectorAll("a[href], link[rel~='next']");

      for (const node of nodes) {
        if (candidates.length >= 30) {
          break;
        }

        const href = node.href || node.getAttribute("href");
        const safeUrl = helpers.sanitizeUrl(href, documentRef.location.href);

        if (!safeUrl || seen.has(safeUrl.url)) {
          continue;
        }

        const rel = String(node.getAttribute("rel") || "").toLowerCase();
        const label = helpers.sanitizeText(
          [
            node.textContent,
            node.getAttribute("aria-label"),
            node.getAttribute("title")
          ]
            .filter(Boolean)
            .join(" "),
          100
        );

        let reason = null;

        if (rel.split(/\s+/).includes("next")) {
          reason = "rel-next";
        } else if (/\bnext(?:\s+episode)?\b/i.test(label)) {
          reason = "next-label";
        } else if (/\b(?:episode|ep\.?)[\s#:-]*\d+\b/i.test(label)) {
          reason = "episode-label";
        }

        if (!reason) {
          continue;
        }

        seen.add(safeUrl.url);
        candidates.push({
          url: safeUrl.url,
          queryKeys: safeUrl.queryKeys,
          label,
          reason
        });
      }

      return {
        nextEpisodeCandidates: candidates
      };
    }
  };

  const adapters = [genericAdapter];

  function register(adapter) {
    if (
      !adapter ||
      typeof adapter.id !== "string" ||
      typeof adapter.match !== "function" ||
      typeof adapter.inspect !== "function"
    ) {
      throw new TypeError("Invalid CouchCache adapter.");
    }

    if (adapters.some((item) => item.id === adapter.id)) {
      throw new Error("Duplicate CouchCache adapter id: " + adapter.id);
    }

    adapters.unshift(adapter);
  }

  function select(locationRef) {
    for (const adapter of adapters) {
      if (adapter.id === "generic") {
        continue;
      }

      try {
        if (adapter.match(locationRef)) {
          return adapter;
        }
      } catch {
        // A broken site adapter must not break the generic analyzer.
      }
    }

    return genericAdapter;
  }

  root.CouchCacheAdapterRegistry = Object.freeze({
    register,
    select,
    list() {
      return adapters.map((adapter) => adapter.id);
    }
  });
})(globalThis);
