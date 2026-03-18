// Cookie Editor Pro - Background Service Worker

// Listen for tab updates to refresh popup if open
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    // Notify popup of tab change if it's open
    chrome.runtime.sendMessage({ type: 'TAB_UPDATED', tabId }).catch(() => {});
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.runtime.sendMessage({ type: 'TAB_ACTIVATED', tabId }).catch(() => {});
});
