(function installCouchCachePageProbe(root) {
  const MARKER = "COUCHCACHE_PAGE_PROBE_V1";

  function emit(type, payload) {
    try {
      root.postMessage(
        {
          marker: MARKER,
          type,
          payload
        },
        "*"
      );
    } catch {
      // Diagnostics must never break playback.
    }
  }

  function emitPlayerConfig() {
    try {
      const parser = root.CouchCacheDramacoolPlayer;

      if (!parser || typeof parser.summarize !== "function") {
        return;
      }

      const summary = parser.summarize(root.DramacoolPlayerBoot);

      if (summary) {
        emit("player-config", summary);
      }
    } catch {
      // Site-specific diagnostics are best effort only.
    }
  }

  if (root.__couchCachePageProbeInstalled) {
    emit("probe-status", { installed: true, reused: true });
    emitPlayerConfig();
    return;
  }

  root.__couchCachePageProbeInstalled = true;

  let networkEventCount = 0;
  const NETWORK_EVENT_LIMIT = 120;

  function emitNetwork(payload) {
    if (networkEventCount >= NETWORK_EVENT_LIMIT) {
      return;
    }

    networkEventCount += 1;
    emit("network", payload);
  }

  if (typeof root.fetch === "function") {
    const nativeFetch = root.fetch;

    root.fetch = async function couchCacheObservedFetch() {
      const args = Array.from(arguments);
      const request = args[0];
      const requestUrl =
        typeof request === "string"
          ? request
          : request && typeof request.url === "string"
            ? request.url
            : "";

      const response = await nativeFetch.apply(this, args);

      try {
        emitNetwork({
          source: "fetch",
          method:
            (args[1] && args[1].method) ||
            (request && request.method) ||
            "GET",
          url: response.url || requestUrl,
          status: response.status,
          contentType: response.headers.get("content-type") || ""
        });
      } catch {
        // Keep the original fetch semantics.
      }

      return response;
    };
  }

  if (root.XMLHttpRequest && root.XMLHttpRequest.prototype) {
    const requestMeta = new WeakMap();
    const nativeOpen = root.XMLHttpRequest.prototype.open;

    root.XMLHttpRequest.prototype.open = function couchCacheObservedOpen(
      method,
      url
    ) {
      try {
        requestMeta.set(this, {
          method: String(method || "GET"),
          url: String(url || "")
        });

        this.addEventListener(
          "loadend",
          () => {
            const meta = requestMeta.get(this) || {};

            let contentType = "";
            try {
              contentType = this.getResponseHeader("content-type") || "";
            } catch {
              // Cross-origin/header policy may hide it.
            }

            emitNetwork({
              source: "xhr",
              method: meta.method || "GET",
              url: this.responseURL || meta.url || "",
              status: Number(this.status) || 0,
              contentType
            });
          },
          { once: true }
        );
      } catch {
        // Continue with the page request.
      }

      return nativeOpen.apply(this, arguments);
    };
  }

  if (
    root.MediaSource &&
    root.MediaSource.prototype &&
    typeof root.MediaSource.prototype.addSourceBuffer === "function"
  ) {
    const nativeAddSourceBuffer = root.MediaSource.prototype.addSourceBuffer;

    root.MediaSource.prototype.addSourceBuffer =
      function couchCacheObservedAddSourceBuffer(mimeType) {
        emit("mse-source-buffer", {
          mimeType: String(mimeType || "")
        });

        return nativeAddSourceBuffer.apply(this, arguments);
      };
  }

  try {
    const navigatorPrototype =
      root.Navigator && root.Navigator.prototype
        ? root.Navigator.prototype
        : null;

    if (
      navigatorPrototype &&
      typeof navigatorPrototype.requestMediaKeySystemAccess === "function"
    ) {
      const nativeRequestMediaKeySystemAccess =
        navigatorPrototype.requestMediaKeySystemAccess;

      navigatorPrototype.requestMediaKeySystemAccess =
        function couchCacheObservedKeySystem(keySystem) {
          emit("eme-key-system", {
            keySystem: String(keySystem || "")
          });

          return nativeRequestMediaKeySystemAccess.apply(this, arguments);
        };
    }
  } catch {
    // Some browsers may expose a non-writable method.
  }

  document.addEventListener(
    "encrypted",
    (event) => {
      emit("encrypted", {
        initDataType: String(event.initDataType || "")
      });
    },
    true
  );

  emit("probe-status", { installed: true, reused: false });
  emitPlayerConfig();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", emitPlayerConfig, {
      once: true
    });
  } else {
    root.setTimeout(emitPlayerConfig, 0);
  }

  root.setTimeout(emitPlayerConfig, 1000);
})(window);
