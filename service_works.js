var MESSAGE_STATE_STORAGE_KEY = "processed_message_ids";
var MESSAGE_PROCESSED_TTL_MS = 6 * 60 * 60 * 1000;
var MESSAGE_CLAIM_TTL_MS = 2 * 60 * 1000;

var MESSAGE_STATE_LOCKED = false;
var MESSAGE_STATE_WAITERS = [];

function getStorageValue(key) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], (stored) => {
      var error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message || "Falha ao ler o armazenamento."));
        return;
      }

      resolve(stored?.[key]);
    });
  });
}

function setStorageValue(key, value) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, () => {
      var error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message || "Falha ao gravar o armazenamento."));
        return;
      }

      resolve(true);
    });
  });
}

function normalizeMessageId(value) {
  var id = String(value || "").trim();
  return id || null;
}

function normalizeMessageState(entries, now) {
  var list = Array.isArray(entries) ? entries : [];
  var state = new Map();
  var changed = !Array.isArray(entries);

  for (var entry of list) {
    var id = normalizeMessageId(entry?.id);
    var status = entry?.status;
    var updatedAt = Number(entry?.updatedAt);
    var token = String(entry?.token || "").trim();

    if ((!status || !Number.isFinite(updatedAt)) && Number.isFinite(Number(entry?.processedAt))) {
      status = "processed";
      updatedAt = Number(entry.processedAt);
      changed = true;
    }

    if (!id || (status !== "claimed" && status !== "processed") || !Number.isFinite(updatedAt)) {
      changed = true;
      continue;
    }

    if (status === "claimed" && !token) {
      changed = true;
      continue;
    }

    var ttl = status === "claimed" ? MESSAGE_CLAIM_TTL_MS : MESSAGE_PROCESSED_TTL_MS;
    if (now - updatedAt > ttl) {
      changed = true;
      continue;
    }

    var previous = state.get(id);
    if (previous) {
      changed = true;
      if (previous.updatedAt >= updatedAt) continue;
    }

    state.set(id, { id, status, token, updatedAt });
  }

  return { changed, state };
}

function serializeMessageState(state) {
  return Array.from(state.values(), function (entry) {
    return {
      id: entry.id,
      status: entry.status,
      token: entry.token,
      updatedAt: entry.updatedAt
    };
  });
}

async function readMessageState(now) {
  var stored = await getStorageValue(MESSAGE_STATE_STORAGE_KEY);
  return normalizeMessageState(stored, now);
}

function writeMessageState(state) {
  return setStorageValue(MESSAGE_STATE_STORAGE_KEY, serializeMessageState(state));
}

function acquireMessageStateLock() {
  if (!MESSAGE_STATE_LOCKED) {
    MESSAGE_STATE_LOCKED = true;
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    MESSAGE_STATE_WAITERS.push(resolve);
  });
}

function releaseMessageStateLock() {
  var next = MESSAGE_STATE_WAITERS.shift();

  if (next) {
    next();
  } else {
    MESSAGE_STATE_LOCKED = false;
  }
}

async function withMessageStateLock(operation) {
  await acquireMessageStateLock();

  try {
    return await operation();
  } finally {
    releaseMessageStateLock();
  }
}

function createClaimToken(now) {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return now.toString(36) + "-" + Math.random().toString(36).slice(2);
}

function claimMessage(idValue, now) {
  var id = normalizeMessageId(idValue);
  if (!id) return Promise.resolve({ ok: false, claimed: false });

  return withMessageStateLock(async function () {
    var loaded = await readMessageState(now);
    var existing = loaded.state.get(id);

    if (existing) {
      if (loaded.changed) await writeMessageState(loaded.state);
      return { ok: true, claimed: false, status: existing.status };
    }

    var token = createClaimToken(now);
    loaded.state.set(id, { id, status: "claimed", token, updatedAt: now });
    await writeMessageState(loaded.state);

    return { ok: true, claimed: true, token };
  });
}

function completeMessage(idValue, tokenValue, now) {
  var id = normalizeMessageId(idValue);
  var token = String(tokenValue || "").trim();
  if (!id || !token) return Promise.resolve({ ok: false, completed: false });

  return withMessageStateLock(async function () {
    var loaded = await readMessageState(now);
    var existing = loaded.state.get(id);

    if (existing?.status === "processed") {
      if (loaded.changed) await writeMessageState(loaded.state);
      return { ok: true, completed: true };
    }

    if (!existing || existing.status !== "claimed" || existing.token !== token) {
      if (loaded.changed) await writeMessageState(loaded.state);
      return { ok: true, completed: false };
    }

    loaded.state.set(id, { id, status: "processed", token, updatedAt: now });
    await writeMessageState(loaded.state);

    return { ok: true, completed: true };
  });
}

function releaseMessage(idValue, tokenValue, now) {
  var id = normalizeMessageId(idValue);
  var token = String(tokenValue || "").trim();
  if (!id || !token) return Promise.resolve({ ok: false, released: false });

  return withMessageStateLock(async function () {
    var loaded = await readMessageState(now);
    var existing = loaded.state.get(id);

    if (!existing) {
      if (loaded.changed) await writeMessageState(loaded.state);
      return { ok: true, released: true };
    }

    if (existing.status !== "claimed" || existing.token !== token) {
      if (loaded.changed) await writeMessageState(loaded.state);
      return { ok: true, released: false };
    }

    loaded.state.delete(id);
    await writeMessageState(loaded.state);

    return { ok: true, released: true };
  });
}

function messageFailureResponse(type, error) {
  var response = { ok: false, error: String(error?.message || error) };

  if (type === "MONITOR_MESSAGE_CLAIM") response.claimed = false;
  if (type === "MONITOR_MESSAGE_COMPLETE") response.completed = false;
  if (type === "MONITOR_MESSAGE_RELEASE") response.released = false;

  return response;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "FOCUS_WHATS") {
    (async () => {
      try {
        if (sender?.tab?.id != null && sender?.tab?.windowId != null) {
          await chrome.windows.update(sender.tab.windowId, { focused: true });
          await chrome.tabs.update(sender.tab.id, { active: true });
          sendResponse({ ok: true, via: "sender" });
          return;
        }

        const tabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
        if (!tabs.length) {
          sendResponse({ ok: false, reason: "no_tab" });
          return;
        }

        const tab = tabs[0];
        await chrome.windows.update(tab.windowId, { focused: true });
        await chrome.tabs.update(tab.id, { active: true });
        sendResponse({ ok: true, via: "query" });
      } catch (error) {
        sendResponse({ ok: false, error: String(error) });
      }
    })();

    return true;
  }

  if (msg?.type === "MONITOR_MESSAGE_CLAIM"
    || msg?.type === "MONITOR_MESSAGE_COMPLETE"
    || msg?.type === "MONITOR_MESSAGE_RELEASE") {
    (async () => {
      try {
        var now = Date.now();
        var response;

        if (msg.type === "MONITOR_MESSAGE_CLAIM") {
          response = await claimMessage(msg.id, now);
        } else if (msg.type === "MONITOR_MESSAGE_COMPLETE") {
          response = await completeMessage(msg.id, msg.token, now);
        } else {
          response = await releaseMessage(msg.id, msg.token, now);
        }

        sendResponse(response);
      } catch (error) {
        console.error("Falha ao atualizar o estado da mensagem.", error);
        sendResponse(messageFailureResponse(msg.type, error));
      }
    })();

    return true;
  }

  return undefined;
});
