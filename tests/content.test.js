const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const CONTENT_SCRIPT = fs.readFileSync(
  path.join(__dirname, "..", "content.js"),
  "utf8"
);
function createHarness(initialStorage = {}, runtimeHandler = null) {
  const storage = { ...initialStorage };
  const runtimeMessages = [];

  function jquery() {
    return {
      ready() {}
    };
  }

  jquery.each = function (items, callback) {
    Object.entries(items || {}).forEach(([key, value]) => callback(key, value));
  };

  const document = {
    execCommand() {
      return true;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    }
  };

  const chrome = {
    runtime: {
      lastError: null,
      onMessage: {
        addListener() {}
      },
      sendMessage(message, callback) {
        runtimeMessages.push(message);

        if (runtimeHandler) {
          runtimeHandler(message, callback, chrome.runtime);
          return;
        }

        if (!callback) return;

        if (message.type === "MONITOR_MESSAGE_CLAIM") {
          callback({ ok: true, claimed: true, token: `token-${message.id}` });
        } else if (message.type === "MONITOR_MESSAGE_COMPLETE") {
          callback({ ok: true, completed: true });
        } else if (message.type === "MONITOR_MESSAGE_RELEASE") {
          callback({ ok: true, released: true });
        } else {
          callback({ ok: true });
        }
      }
    },
    storage: {
      local: {
        get(keys, callback) {
          const result = {};
          for (const key of keys) {
            if (Object.hasOwn(storage, key)) result[key] = storage[key];
          }
          callback(result);
        },
        set(values, callback) {
          Object.assign(storage, values);
          if (callback) callback();
        }
      }
    }
  };

  const context = vm.createContext({
    $: jquery,
    URL,
    chrome,
    console: {
      error() {},
      log() {},
      warn() {}
    },
    document,
    Event,
    MouseEvent: class MouseEvent {},
    setTimeout,
    clearTimeout,
    window: {
      location: { href: "https://web.whatsapp.com/" }
    }
  });

  vm.runInContext(CONTENT_SCRIPT, context, { filename: "content.js" });

  return { context, document, runtimeMessages, storage };
}

function currentMessage(text, overrides = {}) {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");

  return {
    autor: "Contato",
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    element: {},
    text,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    ...overrides
  };
}

function matchingRule(keyword = "alerta") {
  return {
    contact_list: [],
    date_list: [],
    group_name: "Grupo",
    keyword_list: [keyword],
    response_list: ["Resposta"],
    time_list: []
  };
}

test("normalizeText removes diacritics and collapses every whitespace run", () => {
  const { context } = createHarness();

  assert.equal(
    context.normalizeText("  AÇÃO\t  São\nPaulo  "),
    "acao sao paulo"
  );
  assert.equal(context.sanitazeString("Olá\n\nMUNDO"), "ola mundo");
});

test("checkTime enforces inclusive ranges, including ranges across midnight", () => {
  const { context } = createHarness();
  const daytime = [{ time1: "08:30", time2: "12:00" }];
  const overnight = [{ time1: "22:00", time2: "02:00" }];

  assert.equal(context.checkTime([], { time: "03:00" }), true);
  assert.equal(context.checkTime(daytime, { time: "08:30" }), true);
  assert.equal(context.checkTime(daytime, { time: "10:15" }), true);
  assert.equal(context.checkTime(daytime, { time: "12:01" }), false);
  assert.equal(context.checkTime(overnight, { time: "23:30" }), true);
  assert.equal(context.checkTime(overnight, { time: "01:30" }), true);
  assert.equal(context.checkTime(overnight, { time: "12:00" }), false);
  assert.equal(context.checkTime([{ time1: "08:30", time2: "08:30" }], { time: "08:30" }), false);
  assert.equal(context.checkTime(daytime, { time: "99:99" }), false);
});

test("DOM entry points return safely when WhatsApp has no active pane", async () => {
  const { context, runtimeMessages } = createHarness();

  assert.equal(context.getMain(), false);
  assert.equal(await context.sendScript("resposta"), false);

  context.focusWhatsTab = async () => true;
  assert.equal(await context.goToContact("Grupo"), false);
  assert.equal(runtimeMessages.at(-1).data, "Nenhuma conversa Encontrada");
});

test("sendScript reaches every configured typing delay", async () => {
  const { context, document } = createHarness();
  const outcomes = [0, 1, 2, 3];
  const bounds = [];
  const delays = [];
  const textarea = {
    dispatchEvent() {},
    focus() {}
  };
  const sendButton = {
    click() {}
  };
  const main = {
    querySelector(selector) {
      if (selector === 'div[contenteditable="true"]') return textarea;
      if (selector === 'button[aria-label="Enviar"]') return sendButton;
      return null;
    }
  };

  document.querySelector = () => main;
  context.randomIndex = (bound) => {
    bounds.push(bound);
    return outcomes.shift();
  };
  context.wait = async (delay) => {
    delays.push(delay);
  };

  assert.equal(await context.sendScript("one\ntwo\nthree\nfour"), true);
  assert.deepEqual(bounds, [4, 4, 4, 4]);
  assert.deepEqual(delays, [3000, 250, 100, 250, 1000, 250, 1500]);
});

test("quoteMessage ignores a preexisting menu and uses the menu opened by its trigger", async () => {
  const { context, document } = createHarness();
  let unrelatedClicked = false;
  let correctClicked = false;
  let menuOpened = false;
  const unrelatedResponder = {
    textContent: "Responder",
    click() {
      unrelatedClicked = true;
    }
  };
  const correctResponder = {
    textContent: "Responder",
    click() {
      correctClicked = true;
    }
  };
  const preexistingMenu = {
    getAttribute() {
      return null;
    },
    querySelectorAll() {
      return [unrelatedResponder];
    }
  };
  const openedMenu = {
    getAttribute() {
      return null;
    },
    querySelectorAll() {
      return [correctResponder];
    }
  };
  const menuTrigger = {
    click() {
      menuOpened = true;
    }
  };
  const messageContainer = {
    querySelectorAll(selector) {
      return selector === 'div[aria-label="Menu de contexto"]' ? [menuTrigger] : [];
    }
  };
  const messageElement = {
    closest() {
      return messageContainer;
    },
    dispatchEvent() {},
    querySelectorAll() {
      return [];
    }
  };

  document.querySelector = () => ({});
  document.querySelectorAll = (selector) => {
    if (selector !== "[role=\"menu\"]") return [];
    return menuOpened ? [preexistingMenu, openedMenu] : [preexistingMenu];
  };
  context.wait = async () => {};

  assert.equal(await context.quoteMessage(messageElement), true);
  assert.equal(correctClicked, true);
  assert.equal(unrelatedClicked, false);
});

test("quoteMessage fails when its trigger does not open an identifiable menu", async () => {
  const { context, document } = createHarness();
  let responderClicked = false;
  const preexistingMenu = {
    getAttribute() {
      return null;
    },
    querySelectorAll() {
      return [{
        textContent: "Responder",
        click() {
          responderClicked = true;
        }
      }];
    }
  };
  const menuTrigger = {
    click() {}
  };
  const messageContainer = {
    querySelectorAll(selector) {
      return selector === 'div[aria-label="Menu de contexto"]' ? [menuTrigger] : [];
    }
  };
  const messageElement = {
    closest() {
      return messageContainer;
    },
    dispatchEvent() {},
    querySelectorAll() {
      return [];
    }
  };

  document.querySelector = () => ({});
  document.querySelectorAll = (selector) => {
    return selector === "[role=\"menu\"]" ? [preexistingMenu] : [];
  };
  context.wait = async () => {};

  assert.equal(await context.quoteMessage(messageElement), false);
  assert.equal(responderClicked, false);
});

test("quoteMessage binds concurrent message triggers to their controlled menus", async () => {
  const { context, document } = createHarness();
  const opened = { first: false, second: false };
  const clicks = { first: 0, second: 0 };

  function createMenu(name) {
    const responder = {
      textContent: "Responder",
      click() {
        clicks[name] += 1;
      }
    };

    return {
      getAttribute(attribute) {
        if (attribute === "aria-hidden") return opened[name] ? "false" : "true";
        return null;
      },
      querySelectorAll(selector) {
        return selector === "span" ? [responder] : [];
      }
    };
  }

  function createMessage(name) {
    const trigger = {
      id: `trigger-${name}`,
      click() {
        opened[name] = true;
      },
      getAttribute(attribute) {
        if (attribute === "aria-controls") return `menu-${name}`;
        if (attribute === "id") return this.id;
        return null;
      }
    };
    const container = {
      querySelectorAll(selector) {
        return selector === 'div[aria-label="Menu de contexto"]' ? [trigger] : [];
      }
    };

    return {
      closest() {
        return container;
      },
      dispatchEvent() {},
      querySelectorAll() {
        return [];
      }
    };
  }

  const firstMenu = createMenu("first");
  const secondMenu = createMenu("second");
  const menus = {
    "menu-first": firstMenu,
    "menu-second": secondMenu
  };

  document.getElementById = (id) => menus[id] || null;
  document.querySelector = () => ({});
  document.querySelectorAll = (selector) => {
    return selector === "[role=\"menu\"]" ? [firstMenu, secondMenu] : [];
  };
  context.wait = async () => {
    await Promise.resolve();
  };

  assert.deepEqual(
    await Promise.all([
      context.quoteMessage(createMessage("first")),
      context.quoteMessage(createMessage("second"))
    ]),
    [true, true]
  );
  assert.deepEqual(clicks, { first: 1, second: 1 });
});

test("getMain extracts the stable WhatsApp message id", () => {
  const { context, document } = createHarness();
  const container = {
    getAttribute(name) {
      return name === "data-id" ? "message-42" : null;
    }
  };
  const element = {
    innerText: "Alerta",
    closest() {
      return container;
    },
    getAttribute() {
      return "[10:30, 01/08/2026] Contato: ";
    },
    querySelector() {
      return null;
    }
  };
  const main = {
    querySelectorAll() {
      return [element];
    }
  };

  document.querySelector = () => main;

  const messages = context.getMain();
  assert.equal(messages.length, 1);
  assert.equal(messages[0].id, "message-42");
});

test("checkMessage responds once to the same normalized message", async () => {
  const { context, runtimeMessages } = createHarness();
  const message = currentMessage("Olá, AÇÃO   ESPECIAL agora", {
    id: "normalized-message"
  });
  let deliveries = 0;

  context.LIST_ACTIVE = [matchingRule("acao especial")];
  context.foundMessage = async () => {
    deliveries += 1;
    return true;
  };

  assert.equal(await context.checkMessage([message, message]), true);
  assert.equal(await context.checkMessage([message]), false);
  assert.equal(deliveries, 1);
  assert.deepEqual(
    runtimeMessages.map((runtimeMessage) => runtimeMessage.type),
    ["MONITOR_MESSAGE_CLAIM", "MONITOR_MESSAGE_COMPLETE"]
  );
});

test("checkMessage normalizes participant filters consistently", async () => {
  const { context } = createHarness();
  const message = currentMessage("alerta", {
    autor: "Jose da Silva",
    id: "normalized-participant"
  });
  let deliveries = 0;

  context.LIST_ACTIVE = [{
    ...matchingRule(),
    contact_list: ["  José\t  da Silva  "]
  }];
  context.foundMessage = async () => {
    deliveries += 1;
    return true;
  };

  assert.equal(await context.checkMessage([message]), true);
  assert.equal(deliveries, 1);
});

test("checkMessage accepts only messages from zero through 300 minutes old", async () => {
  const { context, runtimeMessages } = createHarness();
  const fixedNow = new Date(2026, 7, 1, 12, 0, 0).getTime();
  const pad = (value) => String(value).padStart(2, "0");
  let deliveries = 0;

  class FixedDate extends Date {
    constructor(value) {
      super(arguments.length === 0 ? fixedNow : value);
    }

    static now() {
      return fixedNow;
    }
  }

  function messageAtAge(ageMinutes) {
    const timestamp = new Date(fixedNow - (ageMinutes * 60000));

    return {
      autor: "Contato",
      date: `${timestamp.getFullYear()}-${pad(timestamp.getMonth() + 1)}-${pad(timestamp.getDate())}`,
      element: {},
      id: `age-${ageMinutes}`,
      text: "alerta",
      time: `${pad(timestamp.getHours())}:${pad(timestamp.getMinutes())}`
    };
  }

  context.Date = FixedDate;
  context.LIST_ACTIVE = [matchingRule()];
  context.foundMessage = async () => {
    deliveries += 1;
    return true;
  };

  assert.equal(
    await context.checkMessage([
      messageAtAge(-1),
      messageAtAge(0),
      messageAtAge(300),
      messageAtAge(301)
    ]),
    true
  );
  assert.equal(deliveries, 2);
  assert.deepEqual(
    runtimeMessages
      .filter((message) => message.type === "MONITOR_MESSAGE_CLAIM")
      .map((message) => message.id),
    ["age-0", "age-300"]
  );
});

test("checkMessage reserves a stable id before concurrent delivery", async () => {
  let centrallyClaimed = false;
  const { context } = createHarness({}, (message, callback) => {
    if (message.type === "MONITOR_MESSAGE_CLAIM") {
      if (centrallyClaimed) {
        callback({ ok: true, claimed: false, status: "claimed" });
      } else {
        centrallyClaimed = true;
        callback({ ok: true, claimed: true, token: "claim-token" });
      }
    } else if (message.type === "MONITOR_MESSAGE_COMPLETE") {
      callback({ ok: true, completed: true });
    }
  });
  const firstMessage = currentMessage("alerta concorrente", {
    id: "concurrent-message"
  });
  const secondMessage = currentMessage("alerta concorrente", {
    id: "concurrent-message"
  });
  let deliveries = 0;
  let releaseDelivery;
  const deliveryGate = new Promise((resolve) => {
    releaseDelivery = resolve;
  });

  context.LIST_ACTIVE = [matchingRule()];
  context.foundMessage = async () => {
    deliveries += 1;
    await deliveryGate;
    return true;
  };

  const first = context.checkMessage([firstMessage]);
  const second = context.checkMessage([secondMessage]);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(deliveries, 1);
  releaseDelivery();
  assert.deepEqual(await Promise.all([first, second]), [true, false]);
});

test("checkMessage releases the reservation after delivery failure", async () => {
  const { context, runtimeMessages } = createHarness();
  const message = currentMessage("segunda tentativa", {
    id: "retry-message"
  });
  let deliveries = 0;

  context.LIST_ACTIVE = [matchingRule("segunda")];
  context.foundMessage = async () => {
    deliveries += 1;
    return deliveries > 1;
  };

  assert.equal(await context.checkMessage([message]), false);
  assert.equal(context.wasMessageProcessed(message), false);
  assert.equal(await context.checkMessage([message]), true);
  assert.equal(context.wasMessageProcessed(message), true);
  assert.equal(deliveries, 2);
  assert.deepEqual(
    runtimeMessages.map((runtimeMessage) => runtimeMessage.type),
    [
      "MONITOR_MESSAGE_CLAIM",
      "MONITOR_MESSAGE_RELEASE",
      "MONITOR_MESSAGE_CLAIM",
      "MONITOR_MESSAGE_COMPLETE"
    ]
  );
});

test("distinct identical messages are processed separately", async () => {
  const { context } = createHarness();
  const first = currentMessage("alerta repetido");
  const second = currentMessage("alerta repetido");
  let deliveries = 0;

  context.LIST_ACTIVE = [matchingRule()];
  context.foundMessage = async () => {
    deliveries += 1;
    return true;
  };

  assert.equal(await context.checkMessage([first, second]), true);
  assert.equal(deliveries, 2);
  assert.equal(await context.checkMessage([first, second]), false);
  assert.equal(deliveries, 2);
});

test("runtime lastError prevents a message claim", async () => {
  let deliveries = 0;
  const { context } = createHarness({}, (message, callback, runtime) => {
    if (message.type !== "MONITOR_MESSAGE_CLAIM") return;

    runtime.lastError = { message: "storage unavailable" };
    callback(undefined);
    runtime.lastError = null;
  });
  const message = currentMessage("alerta indisponível", {
    id: "storage-error-message"
  });

  context.LIST_ACTIVE = [matchingRule()];
  context.foundMessage = async () => {
    deliveries += 1;
    return true;
  };

  assert.equal(await context.checkMessage([message]), false);
  assert.equal(deliveries, 0);
  assert.equal(context.wasMessageProcessed(message), false);
});

test("failed completion is not declared as processed", async () => {
  const { context } = createHarness({}, (message, callback) => {
    if (message.type === "MONITOR_MESSAGE_CLAIM") {
      callback({ ok: true, claimed: true, token: "claim-token" });
    } else if (message.type === "MONITOR_MESSAGE_COMPLETE") {
      callback({ ok: false, completed: false, error: "storage unavailable" });
    }
  });
  const message = currentMessage("alerta sem confirmação", {
    id: "completion-error-message"
  });
  let deliveries = 0;

  context.LIST_ACTIVE = [matchingRule()];
  context.foundMessage = async () => {
    deliveries += 1;
    return true;
  };

  assert.equal(await context.checkMessage([message]), false);
  assert.equal(deliveries, 1);
  assert.equal(context.wasMessageProcessed(message), false);
});

test("checkUnreadMessage searches with the original group name", async () => {
  const { context } = createHarness();
  let searchedName = null;

  context.LIST_ACTIVE = [{
    ...matchingRule(),
    group_name: "José"
  }];
  context.LIST_UNREAD_MESSAGE = [{
    autor: "Jose",
    contact: "Jose",
    message: "alerta"
  }];
  context.goToContact = async (groupName) => {
    searchedName = groupName;
    return true;
  };

  assert.equal(await context.checkUnreadMessage(), true);
  assert.equal(searchedName, "José");
});

test("checkUnreadMessage skips entries without a contact", async () => {
  const { context } = createHarness();
  let searches = 0;

  context.LIST_ACTIVE = [matchingRule()];
  context.LIST_UNREAD_MESSAGE = [{
    autor: "Contato",
    contact: "   ",
    message: "alerta"
  }];
  context.goToContact = async () => {
    searches += 1;
    return true;
  };

  assert.equal(Boolean(await context.checkUnreadMessage()), false);
  assert.equal(searches, 0);
});
