chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === "FOCUS_WHATS") {
      (async () => {
        try {
          // 1) tenta focar a aba que chamou (mais certeiro)
          if (sender?.tab?.id != null && sender?.tab?.windowId != null) {
            await chrome.windows.update(sender.tab.windowId, { focused: true });
            await chrome.tabs.update(sender.tab.id, { active: true });
            sendResponse({ ok: true, via: "sender" });
            return;
          }
  
          // 2) fallback: procura qualquer aba do WhatsApp
          const tabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
          if (!tabs.length) {
            sendResponse({ ok: false, reason: "no_tab" });
            return;
          }
  
          const tab = tabs[0];
          await chrome.windows.update(tab.windowId, { focused: true });
          await chrome.tabs.update(tab.id, { active: true });
          sendResponse({ ok: true, via: "query" });
        } catch (e) {
          sendResponse({ ok: false, error: String(e) });
        }
      })();
  
      return true; // mantém o port aberto pro sendResponse async
    }
  });
  