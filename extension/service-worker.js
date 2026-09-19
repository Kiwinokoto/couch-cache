const REPORT_PREFIX = "couchcache-report:";

function reportKey(tabId) {
  return REPORT_PREFIX + String(tabId);
}

async function injectAnalyzer(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    world: "ISOLATED",
    files: [
      "core/classifier.js",
      "adapters/registry.js",
      "content/collector.js"
    ]
  });

  await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    files: ["content/page-probe.js"]
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") {
    return false;
  }

  if (message.type === "COUCHCACHE_ANALYZE_TAB") {
    const tabId = Number(message.tabId);

    if (!Number.isInteger(tabId)) {
      sendResponse({ ok: false, error: "Invalid tab id." });
      return false;
    }

    injectAnalyzer(tabId)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        });
      });

    return true;
  }

  if (message.type === "COUCHCACHE_REPORT") {
    const tabId = sender.tab && sender.tab.id;

    if (!Number.isInteger(tabId) || !message.report) {
      return false;
    }

    chrome.storage.local
      .set({ [reportKey(tabId)]: message.report })
      .catch(() => {});

    return false;
  }

  if (message.type === "COUCHCACHE_GET_REPORT") {
    const tabId = Number(message.tabId);

    if (!Number.isInteger(tabId)) {
      sendResponse({ ok: false, error: "Invalid tab id." });
      return false;
    }

    chrome.storage.local
      .get(reportKey(tabId))
      .then((result) => {
        sendResponse({
          ok: true,
          report: result[reportKey(tabId)] || null
        });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        });
      });

    return true;
  }

  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove(reportKey(tabId)).catch(() => {});
});
