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
  "adapters/registry.js",
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
  "adapters/registry.js",
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
const sandbox = { URL };
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

console.log("CouchCache checks passed.");
