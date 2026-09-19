let currentReport = null;

const elements = {
  analyze: document.getElementById("analyze"),
  refresh: document.getElementById("refresh"),
  copy: document.getElementById("copy"),
  status: document.getElementById("status"),
  summary: document.getElementById("summary"),
  player: document.getElementById("player"),
  media: document.getElementById("media"),
  drm: document.getElementById("drm"),
  temporary: document.getElementById("temporary"),
  next: document.getElementById("next"),
  cache: document.getElementById("cache"),
  difficulty: document.getElementById("difficulty"),
  transfer: document.getElementById("transfer")
};

async function getActiveTab() {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  return tabs[0] || null;
}

function setStatus(message) {
  elements.status.textContent = message;
}

function render(report) {
  currentReport = report || null;
  elements.copy.disabled = !currentReport;

  if (!currentReport) {
    elements.summary.hidden = true;
    return;
  }

  const summary = currentReport.summary || {};

  elements.player.textContent = summary.player || "unknown";
  elements.media.textContent = summary.media || "unknown";
  elements.drm.textContent = summary.drm || "unknown";
  elements.temporary.textContent = summary.temporaryUrls || "unknown";
  elements.next.textContent = summary.nextEpisodeDetectable || "unknown";
  elements.cache.textContent = summary.cacheBrowserPossible || "unknown";
  elements.difficulty.textContent = summary.difficulty || "unknown";
  elements.transfer.textContent = summary.observedTransfer || "unknown";
  elements.summary.hidden = false;

  setStatus(
    "Report updated " +
      new Date(currentReport.generatedAt).toLocaleTimeString() +
      "."
  );
}

async function loadReport(tabId) {
  const response = await chrome.runtime.sendMessage({
    type: "COUCHCACHE_GET_REPORT",
    tabId
  });

  if (!response || !response.ok) {
    throw new Error((response && response.error) || "Unable to read report.");
  }

  render(response.report);

  if (!response.report) {
    setStatus("No report yet. Click Analyze this tab.");
  }
}

elements.analyze.addEventListener("click", async () => {
  elements.analyze.disabled = true;

  try {
    const tab = await getActiveTab();

    if (!tab || !Number.isInteger(tab.id)) {
      throw new Error("No active browser tab.");
    }

    const response = await chrome.runtime.sendMessage({
      type: "COUCHCACHE_ANALYZE_TAB",
      tabId: tab.id
    });

    if (!response || !response.ok) {
      throw new Error((response && response.error) || "Injection failed.");
    }

    setStatus(
      "Analyzer armed. Let the video play for 20-30 seconds, then Refresh report."
    );

    await new Promise((resolve) => setTimeout(resolve, 450));
    await loadReport(tab.id);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  } finally {
    elements.analyze.disabled = false;
  }
});

elements.refresh.addEventListener("click", async () => {
  try {
    const tab = await getActiveTab();

    if (!tab || !Number.isInteger(tab.id)) {
      throw new Error("No active browser tab.");
    }

    await loadReport(tab.id);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  }
});

elements.copy.addEventListener("click", async () => {
  if (!currentReport) {
    return;
  }

  try {
    await navigator.clipboard.writeText(
      JSON.stringify(currentReport, null, 2)
    );
    setStatus("Sanitized JSON copied.");
  } catch (error) {
    setStatus(
      "Copy failed: " +
        (error instanceof Error ? error.message : String(error))
    );
  }
});

getActiveTab()
  .then((tab) => {
    if (tab && Number.isInteger(tab.id)) {
      return loadReport(tab.id);
    }
    return null;
  })
  .catch(() => {});
