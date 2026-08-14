var LIST_NAME = "list";
var ACTIVE = "active";

var ON = false;
var MONITOR_RUN_ID = 0;
var MONITOR_START_PROMISE = null;
var MONITOR_LOOP_ACTIVE = false;
var LIST_ACTIVE = [];
var LIST_ID = [];

var BURN = [];

var LIST_UNREAD_MESSAGE = [];

var PROCESSED_MESSAGE_ELEMENTS = new WeakSet();
var IN_FLIGHT_MESSAGE_ELEMENTS = new WeakSet();

//auxiliary functions
function onTabClosing() {
  chrome.storage.local.set({ [ALREADY_ACTIVE_NAME]: [] });
}

function normalizeText(string) {
  return String(string || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fnv1aHash(str) {
  var h = 0x811c9dc5; // offset basis
  for (var i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    // h *= 16777619 (com overflow 32-bit)
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  // retorna em hex
  return ("00000000" + h.toString(16)).slice(-8);
}

function buildKey(meta) {
  return [meta.autor, meta.date, meta.time, meta.text].join("||");
}

function getMessageId(message) {
  var id = String(message?.id || "").trim();
  return id || null;
}

function getMessageReference(message) {
  var element = message?.element;

  if ((typeof element === "object" && element !== null) || typeof element === "function") {
    return element;
  }

  if ((typeof message === "object" && message !== null) || typeof message === "function") {
    return message;
  }

  return null;
}

function wasMessageProcessed(message) {
  var reference = getMessageReference(message);
  return reference !== null && PROCESSED_MESSAGE_ELEMENTS.has(reference);
}

function sendRuntimeRequest(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      var error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message || "Falha na comunicação com a extensão."));
        return;
      }

      resolve(response);
    });
  });
}

async function reserveMessage(message) {
  var id = getMessageId(message);
  var reference = getMessageReference(message);

  if (wasMessageProcessed(message)) return false;
  if (reference !== null && IN_FLIGHT_MESSAGE_ELEMENTS.has(reference)) return false;

  if (id === null) {
    if (reference !== null) IN_FLIGHT_MESSAGE_ELEMENTS.add(reference);
    return { kind: "local", reference };
  }

  var response;

  try {
    response = await sendRuntimeRequest({
      type: "MONITOR_MESSAGE_CLAIM",
      id
    });
  } catch (error) {
    console.warn("Não foi possível reservar a mensagem.", error);
    return false;
  }

  if (response?.ok !== true) return false;

  if (response.claimed !== true || !response.token) {
    if (response.status === "processed" && reference !== null) {
      PROCESSED_MESSAGE_ELEMENTS.add(reference);
    }
    return false;
  }

  if (reference !== null) IN_FLIGHT_MESSAGE_ELEMENTS.add(reference);

  return {
    kind: "central",
    id,
    reference,
    token: response.token
  };
}

async function finishMessage(reservation, processed) {
  var reference = reservation?.reference || null;
  if (reference !== null) IN_FLIGHT_MESSAGE_ELEMENTS.delete(reference);

  if (reservation?.kind === "local") {
    if (processed && reference !== null) PROCESSED_MESSAGE_ELEMENTS.add(reference);
    return processed;
  }

  if (reservation?.kind !== "central") return false;

  var type = processed ? "MONITOR_MESSAGE_COMPLETE" : "MONITOR_MESSAGE_RELEASE";
  var response;

  try {
    response = await sendRuntimeRequest({
      type,
      id: reservation.id,
      token: reservation.token
    });
  } catch (error) {
    console.warn("Não foi possível finalizar o estado da mensagem.", error);
    return false;
  }

  if (processed) {
    var completed = response?.ok === true && response.completed === true;
    if (completed && reference !== null) PROCESSED_MESSAGE_ELEMENTS.add(reference);
    return completed;
  }

  return response?.ok === true && response.released === true;
}

function randomIndex(x) {
  x = Number(x);
  return Math.floor(Math.random() * x);
}

async function sendScript(scriptText) {
  var lines = String(scriptText || "").split(/[\n\t]+/).map(line => line.trim()).filter(line => line);

  if (lines.length === 0) return false;

  var main = document.querySelector(`div[id="main"]`);
  if (!main) return false;

  var textarea = main.querySelector(`div[contenteditable="true"]`);
  if (!textarea) return false;

  for (var lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    var line = lines[lineIndex];

    var time;
    switch (randomIndex(4)) {
      case 1:
        time = 100;
        break;
      case 2:
        time = 1000;
        break;
      case 3:
        time = 1500;
        break;
      default:
        time = 3000;
    }

    textarea.focus();
    document.execCommand('insertText', false, line);
    textarea.dispatchEvent(new Event('change', { bubbles: true }));

    await wait(time);

    var sendButton = main.querySelector(`button[aria-label="Enviar"]`);
    if (!sendButton) return false;

    sendButton.click();

    if (lineIndex !== lines.length - 1) await wait(250);
  }

  return true;
}

function checkDate(date_list, message) {
  var result = false;

  if (!date_list || !date_list.length > 0) {
    result = true;
  } else {
    var date_message = new Date(message.date + "T12:00:00");

    $.each(date_list, function (key, value) {

      var date1 = new Date(value.date1 + "T12:00:00");
      var date2 = new Date(value.date2 + "T12:00:00");

      if (date1 <= date_message && date_message <= date2) {
        result = true;
      };
    });

  }
  return result;

}

function checkTime(time_list, message) {
  if (!Array.isArray(time_list) || time_list.length === 0) return true;

  function toMinutes(value) {
    var match = /^(\d{2}):(\d{2})$/.exec(String(value || ""));
    if (!match) return null;

    var hours = Number(match[1]);
    var minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;

    return (hours * 60) + minutes;
  }

  var messageMinutes = toMinutes(message?.time);
  if (messageMinutes === null) return false;

  return time_list.some(function (value) {
    var startMinutes = toMinutes(value?.time1);
    var endMinutes = toMinutes(value?.time2);

    if (startMinutes === null || endMinutes === null) return false;
    if (startMinutes === endMinutes) return false;

    if (startMinutes < endMinutes) {
      return startMinutes <= messageMinutes && messageMinutes <= endMinutes;
    }

    return messageMinutes >= startMinutes || messageMinutes <= endMinutes;
  });
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function findMessageMenuTrigger(element) {
  var scopes = [];

  function addScope(scope) {
    if (scope && !scopes.includes(scope)) scopes.push(scope);
  }

  addScope(element);

  if (typeof element?.closest === "function") {
    addScope(element.closest(".message-in"));
    addScope(element.closest("[data-id]"));
  }

  for (var scope of scopes) {
    if (typeof scope.querySelectorAll !== "function") continue;

    var triggers = Array.from(scope.querySelectorAll('div[aria-label="Menu de contexto"]'));
    if (triggers.length === 1) return triggers[0];
    if (triggers.length > 1) return null;
  }

  return null;
}

function isOpenMenu(menu) {
  return !!menu
    && menu.hidden !== true
    && menu.getAttribute?.("aria-hidden") !== "true";
}

function wasOpenedByClick(menu, menusBeforeClick) {
  return isOpenMenu(menu)
    && (!menusBeforeClick.has(menu) || menusBeforeClick.get(menu) === false);
}

function resolveOpenedMenu(trigger, menusBeforeClick, menus) {
  var openedMenus = menus.filter(function (menu) {
    return wasOpenedByClick(menu, menusBeforeClick);
  });

  var relationshipIds = ["aria-controls", "aria-owns"].flatMap(function (attribute) {
    return String(trigger.getAttribute?.(attribute) || "").split(/\s+/).filter(Boolean);
  });

  if (relationshipIds.length > 0) {
    var controlledMenus = [];

    relationshipIds.forEach(function (id) {
      var controlled = typeof document.getElementById === "function"
        ? document.getElementById(id)
        : null;

      if (!controlled) return;
      if (menus.includes(controlled)) controlledMenus.push(controlled);

      if (typeof controlled.querySelectorAll === "function") {
        controlledMenus.push(...Array.from(controlled.querySelectorAll('[role="menu"]')));
      }
    });

    controlledMenus = [...new Set(controlledMenus)].filter(function (menu) {
      return openedMenus.includes(menu);
    });

    return controlledMenus.length === 1 ? controlledMenus[0] : null;
  }

  var triggerId = String(trigger.id || trigger.getAttribute?.("id") || "");

  if (triggerId) {
    var labelledMenus = menus.filter(function (menu) {
      var labelledBy = String(menu.getAttribute?.("aria-labelledby") || "").split(/\s+/);
      return labelledBy.includes(triggerId);
    });

    if (labelledMenus.length > 0) {
      labelledMenus = labelledMenus.filter(function (menu) {
        return openedMenus.includes(menu);
      });

      return labelledMenus.length === 1 ? labelledMenus[0] : null;
    }
  }

  return openedMenus.length === 1 ? openedMenus[0] : null;
}

async function quoteMessage(el) {
  if (!el) return false;

  el.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true, cancelable: true, view: window }));
  el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true, view: window }));

  await wait(500);

  var main = document.querySelector('div[id="main"]');
  if (!main) {
    return false;
  }

  var dropDown_menu = findMessageMenuTrigger(el);
  if (!dropDown_menu) {
    return false;
  };

  var menusBeforeClick = new Map(Array.from(document.querySelectorAll('[role="menu"]')).map(function (menu) {
    return [menu, isOpenMenu(menu)];
  }));
  dropDown_menu.click();

  await wait(500);

  var menus = Array.from(document.querySelectorAll('[role="menu"]'));
  var openedMenu = resolveOpenedMenu(dropDown_menu, menusBeforeClick, menus);

  if (!openedMenu) return false;

  var quoted_btn = Array.from(openedMenu.querySelectorAll("span")).find(el => (el.textContent || "").trim() === "Responder");

  if (!quoted_btn) {
    return false;
  };

  quoted_btn.click();

  await wait(200);

  el.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true, cancelable: true, view: window }));
  el.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, cancelable: true, view: window }));

  return true;
}

//--------------------------------------

//checks if the message is in accord the conditions of list
async function checkMessage(messages) {
  if (!Array.isArray(messages)) return false;

  var sentResponse = false;

  for (var key2 = 0; key2 < messages.length; key2++) {
    var message = messages[key2];

    if (!message || wasMessageProcessed(message)) continue;

    for (var key = 0; key < LIST_ACTIVE.length; key++) {
      var value = LIST_ACTIVE[key];

      if (!value) continue;

      var contacts = (value.contact_list || []).map(c => normalizeText(c)); //normalized participant names
      var keywords = (value.keyword_list || []).map(c => normalizeText(String(c))); //lower case values of comparation
      var date_list = value.date_list || [];
      var time_list = value.time_list || [];

      if (!message.date || !message.time) continue;

      var today = new Date();
      var message_time = new Date(message.date + "T" + message.time + ":00");

      if (Number.isNaN(message_time.getTime())) continue;

      var diffMin = Math.floor((today - message_time) / 60000); // Analyze messages from now through five hours ago.

      if (diffMin >= 0 && diffMin <= 300) {
        if (contacts.includes(normalizeText(message.autor)) || contacts.length == 0) { //checks autor

          if (checkDate(date_list, message) && checkTime(time_list, message)) { //checks date and time

            var normalize_message = normalizeText(message.text);

            var list_words = normalize_message.split(" "); //try to find match with words

            var matchesKeyword = list_words.some(w => keywords.includes(w))
              || (normalize_message.length > 3 && keywords.some(w => normalize_message.includes(w)));

            if (matchesKeyword) {
              var reservation = await reserveMessage(message);
              if (!reservation) break;

              var sent = false;

              try {
                sent = await foundMessage(key, message.element);
              } catch (error) {
                console.warn("Não foi possível enviar a resposta.", error);
              }

              var finalized = await finishMessage(reservation, sent);

              if (sent) {
                if (finalized) sentResponse = true;
                break;
              }
            }
          } else {
            console.log('data ou horario invalido');
          }
        }
      }
    }
  }

  return sentResponse;
}

//call the function that quote the message thats match with values of list, then send script of the list 
async function foundMessage(index, element) {
  var list = LIST_ACTIVE[index];
  if (!list || !list.response_list || !list.response_list.length) return false;

  var response = list.response_list[randomIndex(list.response_list.length)];

  try {
    await quoteMessage(element);
  } catch (e) {
    console.warn("Não foi possível citar a mensagem; enviando sem citação.", e);
  }

  return sendScript(response);
}

//remove quote mention of a message
function removeQuoted(el) {
  var clone = el.cloneNode(true);
  var quoted = clone.querySelectorAll(".quoted-mention");
  for (var i = 0; i < quoted.length; i++) quoted[i].remove();
  return (clone.innerText || "").trim();
}

//get info of a message
function messageData(pre) {
  // Grupos: 1=time, 2=date, 3=author
  var re = /^\[(\d{2}:\d{2}),\s*(\d{2}\/\d{2}\/\d{4})\]\s*(.*?):\s*$/;
  var m = pre ? pre.match(re) : null;

  if (!m) {
    return { autor: (pre || "").trim(), date: null, time: null };
  }

  var time = m[1]; // "12:03"
  var dateBR = m[2]; // "02/01/2026"
  var autor = (m[3] || "").trim();

  var p = dateBR.split("/");
  var date = (p[2] && p[1] && p[0]) ? (p[2] + "-" + p[1] + "-" + p[0]) : null;

  return { autor: autor, date: date, time: time };
}

function getMessageElementId(element) {
  if (!element || typeof element.closest !== "function") return null;

  var container = element.closest("[data-id]");
  if (!container || typeof container.getAttribute !== "function") return null;

  var id = String(container.getAttribute("data-id") || "").trim();
  return id || null;
}

function sendMessagePopup(message) {
  chrome.runtime.sendMessage({
    type: "MESSAGE",
    data: message,
  });
}

//get Main every time that the list is updated
function getMain() {

  var main = document.querySelector(`div[id="main"]`);

  if (!main) {
    sendMessagePopup("Nenhuma conversa Encontrada");
    return false;
  }

  var components = main.querySelectorAll(".message-in div[data-pre-plain-text]");
  if (!components || components.length === 0) {
    sendMessagePopup("Nenhuma Conversa Encontrada");
    return [];
  } else {
    var arr = Array.from(components);

    arr = arr.filter(function (el) {
      return !el.querySelector(".quoted-mention");
    });

    var messages = arr.map(function (el) {
      var element = el;
      var meta = messageData(el.getAttribute("data-pre-plain-text"));
      return {
        element: element,
        id: getMessageElementId(element),
        autor: meta.autor,
        text: ((el.innerText || "").trim()).replace(/\n/g, ' '),
        date: meta.date,
        time: meta.time
      };
    });

    return messages;
  }

}

//set List of active keywords and responses
function prepareList() {
  return new Promise((resolve) => {
    var list_temp = [];

    chrome.storage.local.get([LIST_NAME], (res) => {
      $.each(res?.list || [], function (key, value) {
        if (value.active) {
          list_temp.push(value);
        }
      });

      LIST_ACTIVE = list_temp;
      resolve(LIST_ACTIVE.length > 0);

    });
  });
}

function readStoredMonitorState() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([ACTIVE], (res) => {
      var error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message || "Não foi possível ler o estado do monitor."));
        return;
      }

      resolve(res?.active || null);
    });
  });
}

function isStoredMonitorActive(activeState) {
  if (activeState?.on !== true) return false;

  var dateTime = Number(activeState.date_time);
  if (!Number.isFinite(dateTime)) return false;

  var dateDiff = (Date.now() - dateTime) / (1000 * 60 * 60);
  return dateDiff >= 0 && dateDiff <= 2;
}

function isCurrentMonitorRun(runId) {
  return ON && runId === MONITOR_RUN_ID;
}

function stopLoop() {
  ON = false;
  MONITOR_RUN_ID += 1;
  MONITOR_START_PROMISE = null;
  MONITOR_LOOP_ACTIVE = false;
}

function storeMonitorStopped() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({
      [ACTIVE]: {
        on: false,
        date_time: Date.now()
      }
    }, () => {
      var error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message || "Não foi possível salvar o estado do monitor."));
        return;
      }

      resolve(true);
    });
  });
}

async function stopLoopAndPersist() {
  stopLoop();

  try {
    await storeMonitorStopped();
  } catch (error) {
    console.warn("Não foi possível persistir o encerramento do monitor.", error);
  }
}

async function runMonitorLoop(runId) {
  try {
    while (isCurrentMonitorRun(runId)) {
      var activeState = await readStoredMonitorState();
      if (!isCurrentMonitorRun(runId)) break;

      if (!isStoredMonitorActive(activeState)) {
        await stopLoopAndPersist();
        break;
      }

      var observed = await observeContacts();
      if (!isCurrentMonitorRun(runId)) break;

      if (observed) {
        var response = await checkUnreadMessage();
        if (!isCurrentMonitorRun(runId)) break;

        if (response && LIST_ACTIVE.length > 0) {
          var messages = await getMain();
          if (!isCurrentMonitorRun(runId)) break;

          if (messages) {
            await checkMessage(messages);
            if (!isCurrentMonitorRun(runId)) break;
          }
        }
      }

      await wait(10000);
    }
  } catch (error) {
    if (isCurrentMonitorRun(runId)) {
      console.warn("O monitoramento foi interrompido.", error);
      await stopLoopAndPersist();
    }
  } finally {
    if (runId === MONITOR_RUN_ID) {
      MONITOR_LOOP_ACTIVE = false;
    }
  }
}

async function initializeMonitorRun(runId) {
  try {
    var activeState = await readStoredMonitorState();

    if (!isCurrentMonitorRun(runId) || !isStoredMonitorActive(activeState)) {
      if (runId === MONITOR_RUN_ID) ON = false;
      return false;
    }

    var hasActiveRecords = await prepareList();

    if (!isCurrentMonitorRun(runId) || !hasActiveRecords) {
      if (runId === MONITOR_RUN_ID) ON = false;
      return false;
    }

    MONITOR_LOOP_ACTIVE = true;
    void runMonitorLoop(runId);
    return true;
  } catch (error) {
    if (runId === MONITOR_RUN_ID) {
      ON = false;
      MONITOR_LOOP_ACTIVE = false;
    }

    console.warn("Não foi possível iniciar o monitoramento.", error);
    return false;
  } finally {
    if (runId === MONITOR_RUN_ID) {
      MONITOR_START_PROMISE = null;
    }
  }
}

function startLoop() {
  if (ON && MONITOR_START_PROMISE) {
    return MONITOR_START_PROMISE;
  }

  if (ON && MONITOR_LOOP_ACTIVE) {
    return Promise.resolve(true);
  }

  ON = true;
  var runId = ++MONITOR_RUN_ID;
  var startPromise = initializeMonitorRun(runId);

  MONITOR_START_PROMISE = startPromise;
  return startPromise;
}


chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "ON") {
    void (async () => {
      var started = await startLoop();
      sendResponse({ ok: started });
    })();
    return true;
  }

  if (msg?.type === "OFF") {
    stopLoop();
    sendResponse({ ok: true });
  }

  return undefined;
});



function focusWhatsTab() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "FOCUS_WHATS" }, (res) => {
      resolve(!!res?.ok);
    });
  });
}

function sanitazeString(string) {
  return normalizeText(string);
}

$(document).ready(function () {
  const url = new URL(window.location.href);
  const monitor = url.searchParams.get("monitor");
  if (monitor === "ON" && !ON) {
    void startLoop();
  }
});

async function simulateEnter(el) {

  return new Promise((resolve) => {
    el.focus();

    const down = new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });

    const up = new KeyboardEvent("keyup", {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });

    el.dispatchEvent(down);
    el.dispatchEvent(up);

    resolve(true);
  })

}

function cleanSearchContact() {
  var btn = document.querySelector(`button[aria-label="Cancelar pesquisa"]`);
  if (btn) {
    btn.click();
  }
  return true;
}

async function goToContact(group_name) {
  if (!group_name || !await focusWhatsTab()) return false;

  var side = document.querySelector('div[id="side"]');
  var textarea = side?.querySelector('div[data-lexical-editor="true"]');

  if (!textarea) return false;

  textarea.focus();

  document.execCommand("selectAll", false, null);
  document.execCommand("delete", false, null);
  document.execCommand("insertText", false, group_name);

  textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));

  await wait(2000);
  await simulateEnter(textarea);
  await wait(500);
  await cleanSearchContact();

  return true;
}

async function checkUnreadMessage() {

  if (!Array.isArray(LIST_UNREAD_MESSAGE)) return false;

  for (var key1 = 0; key1 < LIST_UNREAD_MESSAGE.length; key1++) {
    var message = LIST_UNREAD_MESSAGE[key1];

    if (!message) continue;

    var normalized_contact = normalizeText(message.contact);
    if (!normalized_contact) continue;

    for (var key = 0; key < LIST_ACTIVE.length; key++) {
      var value = LIST_ACTIVE[key];

      if (!value || !value.group_name) continue;

      var group_name = String(value.group_name); //preserve original name for WhatsApp search
      var normalized_group_name = normalizeText(group_name);
      var contacts = (value.contact_list || []).map(c => normalizeText(c)); //lower case values of comparation
      var keywords = (value.keyword_list || []).map(c => normalizeText(String(c))); //lower case values of comparation

      if (normalized_group_name.includes(normalized_contact)) { //checks contact or group name

        if (contacts.includes(normalizeText(message.autor)) || contacts.length == 0) { //checks autor

          var normalize_message = normalizeText(message.message);

          var list_words = normalize_message.split(" "); //try to find match with words

          if (list_words.some(w => keywords.includes(w))) { //checks message
            var result = await goToContact(group_name);
            if (result) {
              return true;
            }
          } else if (normalize_message.length > 3 && keywords.some(w => normalize_message.includes(w))) { //try to find match phrase
            var result = await goToContact(group_name);
            if (result) {
              return true;
            }
          }
        }
      }

    }

  }

}

//get list of unread mesages
async function observeContacts() {

  return new Promise((resolve) => {
    var badges = Array.from(document.querySelectorAll('span[aria-label]')).filter(function (s) {
      var a = (s.getAttribute("aria-label") || "").toLowerCase();
      return a.includes("mensagem não lida") || a.includes("mensagens não lidas") || a.includes("não lidas"); // cobre singular e plural
    });

    if (!badges) {
      resolve(false);
    } else {

      var list = [];

      $.each(badges, function (key, value) {
        var temp = value.closest(`div[role="row"]`);

        if (temp) {
          var elements = Array.from(temp.querySelectorAll(`span[title]`));

          var contact = "";
          var autor = "";
          var message = "";

          elements.map(function (el, key) {
            var value1 = el.attributes.title.value;
            var value2 = el.innerText;

            if (key == 0) {
              contact = value1;
            } else {

              if (value2.includes("\n:")) { //case group
                value2 = value2.split("\n:");

                autor = value2[0];
                message = value1;
              } else { //case contact
                autor = contact;
                message = value2;
              }

            }

          });

          var data = {
            "contact": contact,
            "autor": autor,
            "message": sanitazeString(message),
          }

          list.push(data);

        }
      });

      LIST_UNREAD_MESSAGE = list;
      console.log(LIST_UNREAD_MESSAGE);
      resolve(true);
    }

  });

}
