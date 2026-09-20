import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extensionRoot = path.join(root, "extension");

const requiredFiles = [
  "manifest.json",
  "service-worker.js",
  "core/classifier.js",
  "core/dramacool-player.js",
  "adapters/registry.js",
  "adapters/kissasia.js",
  "content/collector.js",
  "content/page-probe.js",
  "popup/popup.html",
  "popup/popup.css",
  "popup/popup.js"
];

for (const relative of requiredFiles) {
  assert.ok(
    fs.existsSync(path.join(extensionRoot, relative)),
    "Missing extension file: " + relative
  );
}

const manifest = JSON.parse(
  fs.readFileSync(path.join(extensionRoot, "manifest.json"), "utf8")
);

assert.equal(manifest.manifest_version, 3);
assert.deepEqual(
  manifest.permissions.slice().sort(),
  ["activeTab", "scripting", "storage"].sort()
);
assert.equal(manifest.host_permissions, undefined);
assert.ok(
  Array.isArray(manifest.optional_host_permissions),
  "Host permissions must remain optional."
);

const javascriptFiles = [
  "service-worker.js",
  "core/classifier.js",
  "core/dramacool-player.js",
  "adapters/registry.js",
  "adapters/kissasia.js",
  "content/collector.js",
  "content/page-probe.js",
  "popup/popup.js"
];

for (const relative of javascriptFiles) {
  const source = fs.readFileSync(path.join(extensionRoot, relative), "utf8");
  new vm.Script(source, { filename: relative });

  for (const forbidden of [
    "document.cookie",
    "response.arrayBuffer(",
    "response.blob(",
    "response.text(",
    "getAllResponseHeaders("
  ]) {
    assert.equal(
      source.includes(forbidden),
      false,
      relative + " unexpectedly contains " + forbidden
    );
  }
}

const classifierSource = fs.readFileSync(
  path.join(extensionRoot, "core/classifier.js"),
  "utf8"
);
const sandbox = { URL, decodeURIComponent };
sandbox.globalThis = sandbox;
vm.runInNewContext(classifierSource, sandbox, {
  filename: "core/classifier.js"
});

const classifier = sandbox.CouchCacheClassifier;
assert.ok(classifier, "Classifier should install itself.");

const redacted = classifier.sanitizeUrl(
  "https://cdn.example.test/video/master.m3u8?token=SECRET&expires=123&quality=720#fragment"
);

assert.equal(redacted.url, "https://cdn.example.test/video/master.m3u8");
assert.equal(JSON.stringify(redacted).includes("SECRET"), false);
assert.deepEqual(
  Array.from(redacted.queryKeys),
  ["token", "expires", "quality"]
);
assert.deepEqual(
  Array.from(redacted.temporarySignals),
  ["token", "expires"]
);

const pathSecret = "abcdef0123456789abcdef0123456789";
const pathRedacted = classifier.sanitizeUrl(
  "https://cdn.example.test/signed/" + pathSecret + "/master.m3u8"
);
assert.equal(
  pathRedacted.url,
  "https://cdn.example.test/signed/:redacted/master.m3u8"
);
assert.equal(JSON.stringify(pathRedacted).includes(pathSecret), false);

assert.equal(classifier.classifyMedia(redacted, ""), "hls_manifest");
assert.equal(
  classifier.classifyMedia(
    classifier.sanitizeUrl("https://cdn.example.test/manifest"),
    "application/dash+xml"
  ),
  "dash_manifest"
);
assert.equal(
  classifier.classifyMedia(
    classifier.sanitizeUrl("https://cdn.example.test/episode.mp4"),
    "video/mp4"
  ),
  "direct_mp4"
);
assert.equal(
  classifier.classifyMedia(
    classifier.sanitizeUrl("blob:https://example.test/random-object-id"),
    ""
  ),
  "mse_blob"
);

const dramacoolSource = fs.readFileSync(
  path.join(extensionRoot, "core/dramacool-player.js"),
  "utf8"
);
vm.runInNewContext(dramacoolSource, sandbox, {
  filename: "core/dramacool-player.js"
});

const parser = sandbox.CouchCacheDramacoolPlayer;
assert.ok(parser, "Dramacool player parser should install itself.");

const syntheticSecret = "SHOULD_NOT_LEAK";
const playerSummary = parser.summarize({
  source: "blogger",
  playerDataEndpoint:
    "https://site.example.test/wp-json/player-data?post=42",
  playerData: {
    source: "blogger",
    html:
      "https://cdn.example.test/private/episode-1.mp4?token=" +
      syntheticSecret +
      "|English,French|\n" +
      "https://subs.example.test/episode-1.en.vtt,\n" +
      "https://subs.example.test/episode-1.fr.vtt;\n" +
      "https://cdn.example.test/private/episode-2.mp4|English|\n" +
      "https://subs.example.test/episode-2.en.vtt;\n" +
      '<img src="https://images.example.test/poster.jpg">'
  },
  settings: {
    playerId: "kisskh",
    useJw: true,
    trackAccess: [],
    hls: {
      libraryUrl: "https://cdn.example.test/hls.js"
    }
  }
});

assert.equal(playerSummary.episodeCount, 2);
assert.equal(playerSummary.orderedPlaylist, true);
assert.deepEqual(
  Array.from(playerSummary.mediaFamilies),
  ["direct_mp4"]
);
assert.deepEqual(
  Array.from(playerSummary.mediaOrigins),
  ["https://cdn.example.test"]
);
assert.deepEqual(
  Array.from(playerSummary.mediaQueryKeys),
  ["token"]
);
assert.equal(playerSummary.totalSubtitleTracks, 3);
assert.deepEqual(
  Array.from(playerSummary.subtitleLanguages),
  ["English", "French"]
);
assert.deepEqual(
  Array.from(playerSummary.subtitleOrigins),
  ["https://subs.example.test"]
);
assert.equal(playerSummary.protectedTrackConfigPresent, false);
assert.equal(JSON.stringify(playerSummary).includes(syntheticSecret), false);
assert.equal(JSON.stringify(playerSummary).includes("episode-1.mp4"), false);
assert.equal(JSON.stringify(playerSummary).includes("episode-1.en.vtt"), false);

console.log("CouchCache checks passed.");
