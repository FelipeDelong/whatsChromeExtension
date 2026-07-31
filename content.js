var LIST_NAME = "list";
var ACTIVE = "active";

var ON = false;

var LIST_ACTIVE = [];
var LIST_ID = [];

var BURN = [];

var LIST_UNREAD_MESSAGE = [];

//auxiliary functions
function onTabClosing() {
  chrome.storage.local.set({ [ALREADY_ACTIVE_NAME]: [] });
}

function normalizeText(string) {
  var text = String(string).toLowerCase().normalize("NFD").replace("  ", "");  // remove acentos.replace(/\s+/g, " ").trim();
  return text
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

function randomIndex(x) {
  x = Number(x);
  return Math.floor(Math.random() * x);
}

async function sendScript(scriptText) {
  var lines = scriptText.split(/[\n\t]+/).map(line => line.trim()).filter(line => line);

  main = document.querySelector(`div[id="main"]`);
  textarea = main.querySelector(`div[contenteditable="true"]`);

  if (!textarea) throw new Error("Não há uma conversa aberta")

  for (var line of lines) {

    var time;
    switch (randomIndex(3)) {
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

    setTimeout(() => {
      (main.querySelector(`button[aria-label="Enviar"]`)).click();
    }, time);

    if (lines.indexOf(line) !== lines.length - 1) await new Promise(resolve => setTimeout(resolve, 250));
  }

  return lines.length;
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
  var result = false;

  if (time_list || !time_list > 0) {
    result = true;
  } else {
    var time_message = new Date("2026-01-01T" + message.time + ":00"); // "HH:MM"

    $.each(time_list, function (key, value) {
      var time1 = new Date("2026-01-01T" + value.time1 + ":00");
      var time2 = new Date("2026-01-01T" + value.time2 + ":00");

      if (time1 <= time_message && time_message <= time2) {
        result = true;
      }
    });
  }

  return result;
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function quoteMessage(el) {
  el.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true, cancelable: true, view: window }));
  el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true, view: window }));

  await wait(500);

  var main = document.querySelector('div[id="main"]');
  if (!main) {
    throw new Error("Não achei #main");
  }

  var dropDown_menu = main.querySelector('div[aria-label="Menu de contexto"]');
  if (!dropDown_menu) {
    throw new Error("Não achei Menu de contexto");
  };

  dropDown_menu.click();

  await wait(500);

  var quoted_btn = Array.from(document.querySelectorAll("span")).find(el => (el.textContent || "").trim() === "Responder");

  if (!quoted_btn) {
    throw new Error('Não achei o botão "Responder"');
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
  for (var key2 = 0; key2 < messages.length; key2++) {
    for (var key = 0; key < LIST_ACTIVE.length; key++) {
      var value = LIST_ACTIVE[key];

      var message = messages[key2];

      var contacts = (value.contact_list || []).map(c => String(c).toLowerCase()); //lower case values of comparation
      var keywords = (value.keyword_list || []).map(c => normalizeText(String(c))); //lower case values of comparation
      var date_list = value.date_list || [];
      var time_list = value.time_list || [];

      var today = new Date();
      var message_time = new Date(message.date + "T" + message.time + ":00");

      var diffMin = Math.floor((today - message_time) / 60000); //analise messages with maximum of 1 minute difference from now

      if (diffMin <= 300) {
        if (contacts.includes((message.autor).toLowerCase()) || contacts.length == 0) { //checks autor

          if (checkDate(date_list, message) && checkTime(time_list, message)) { //checks date and time

            var normalize_message = message.text.toLowerCase();

            var list_words = normalize_message.split(" "); //try to find match with words

            if (list_words.some(w => keywords.includes(w))) { //checks message
              await foundMessage(key, message.element);
            } else if (normalize_message.length > 3 && keywords.some(w => normalize_message.includes(w))) { //try to find match phrase
              await foundMessage(key, message.element);
            }
          } else {
            console.log('data ou horario invalido');
          }
        }
      }
    }
  }

}

//call the function that quote the message thats match with values of list, then send script of the list 
async function foundMessage(index, element) {
  var list = LIST_ACTIVE[index];
  if (!list || !list.response_list || !list.response_list.length) return;

  try {
    await quoteMessage(element);
    await sendScript(list.response_list[randomIndex(list.response_list.length)]);
  } catch (e) {
    await sendScript(list.response_list[randomIndex(list.response_list.length)]);
  }
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
  }

  var components = main.querySelectorAll(".message-in div[data-pre-plain-text]");
  if (!components) {
    sendMessagePopup("Nenhuma Conversa Encontrada");
    return false;
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

      console.log(res);

      $.each(res.list, function (key, value) {
        if (value.active) {
          list_temp.push(value);

          LIST_ACTIVE = list_temp;
        }
      });

      resolve(LIST_ACTIVE.length > 0 ? true : false);

    });
  });
}

async function startLoop() {
  chrome.storage.local.get([ACTIVE], async (res) => {
    var now = Date.now();

    var dateDiff = (now - res.active.date_time) / (1000 * 60 * 60);

    if (res.active.on == true && dateDiff <= 2) {
      var result = await prepareList();

      if (result) {
        while (true && ON) {

          var result = await observeContacts();

          if (result) {
            var response = await checkUnreadMessage();

            if (response) {
              if (LIST_ACTIVE.length > 0) {
                var messages = await getMain();
                if (messages) {
                  await checkMessage(messages);
                }
              }
            }

          }

          await wait(10000);
        }
      }

    }
  });
}


chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "ON") {

    ON = true;

    startLoop();

    sendResponse({ ok: true });
  } else {
    if (msg?.type === "OFF") {
      ON = false;
    }
  }
});



function focusWhatsTab() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "FOCUS_WHATS" }, (res) => {
      resolve(!!res?.ok);
    });
  });
}

function sanitazeString(string) {
  var result = string.replace("\n", " ");
  result = String(result).toLowerCase().normalize("NFD").replace("  ", "");  // remove acentos.replace(/\s+/g, " ").trim();

  return result;
}

$(document).ready(function () {
  const url = new URL(window.location.href);
  const monitor = url.searchParams.get("monitor");
  if (monitor) {
    ON = true;
    startLoop();
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
  await focusWhatsTab();

  var side = document.querySelector('div[id="side"]');
  var textarea = side?.querySelector('div[data-lexical-editor="true"]');

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

  for (var key1 = 0; key1 < LIST_UNREAD_MESSAGE.length; key1++) {
    var message = LIST_UNREAD_MESSAGE[key1];

    for (var key = 0; key < LIST_ACTIVE.length; key++) {
      var value = LIST_ACTIVE[key];

      var group_name = (value.group_name.toLowerCase()); //lower case values of comparation
      var contacts = (value.contact_list || []).map(c => String(c).toLowerCase()); //lower case values of comparation
      var keywords = (value.keyword_list || []).map(c => normalizeText(String(c))); //lower case values of comparation

      if (group_name.includes((message.contact).toLowerCase())) { //checks contact or group name

        if (contacts.includes((message.autor).toLowerCase()) || contacts.length == 0) { //checks autor

          var normalize_message = message.message;

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