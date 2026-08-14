const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const popupSource = fs.readFileSync(
    path.join(__dirname, "..", "popup.js"),
    "utf8",
);

function createHarness({
    createdTab = { id: 41 },
    initialStorage,
    sendMessage,
    tabs = [],
} = {}) {
    const document = {};
    const elements = new Map();
    const handlers = [];
    const readyCallbacks = [];
    const runtimeListeners = [];
    const storage = {
        active: { on: false, date_time: Date.now() },
        list: [{ active: true }],
        ...initialStorage,
    };
    const calls = {
        createdTabs: [],
        queriedTabs: [],
        sentMessages: [],
        storageWrites: [],
        tabUpdates: [],
        windowUpdates: [],
    };
    const warnings = [];

    function elementFor(selector) {
        if (!elements.has(selector)) {
            elements.set(selector, {
                hidden: null,
                html: "",
            });
        }

        const element = elements.get(selector);

        return {
            html(value) {
                if (value === undefined) return element.html;
                element.html = value;
                return this;
            },
            prop(name, value) {
                if (value === undefined) return element[name];
                element[name] = value;
                return this;
            },
        };
    }

    function jquery(target) {
        if (target === document) {
            return {
                on(event, selector, handler) {
                    handlers.push({ event, handler, selector });
                },
                ready(callback) {
                    readyCallbacks.push(callback);
                },
            };
        }

        return elementFor(target);
    }

    jquery.each = function each(items, callback) {
        Object.entries(items || {}).forEach(([key, value]) => callback(key, value));
    };

    const chrome = {
        runtime: {
            onMessage: {
                addListener(listener) {
                    runtimeListeners.push(listener);
                },
            },
        },
        storage: {
            local: {
                async get(keys) {
                    const result = {};

                    for (const key of keys) {
                        if (Object.hasOwn(storage, key)) result[key] = storage[key];
                    }

                    return result;
                },
                async set(values) {
                    calls.storageWrites.push(values);
                    Object.assign(storage, values);
                },
            },
        },
        tabs: {
            async create(options) {
                calls.createdTabs.push(options);
                return createdTab;
            },
            async query(options) {
                calls.queriedTabs.push(options);
                return tabs;
            },
            async sendMessage(tabId, message) {
                calls.sentMessages.push({ message, tabId });

                if (sendMessage) return sendMessage(tabId, message);
                return { ok: true };
            },
            async update(tabId, options) {
                calls.tabUpdates.push({ options, tabId });
                return { id: tabId, ...options };
            },
        },
        windows: {
            async update(windowId, options) {
                calls.windowUpdates.push({ options, windowId });
            },
        },
    };

    const context = vm.createContext({
        $: jquery,
        chrome,
        console: {
            warn(...args) {
                warnings.push(args);
            },
        },
        clearTimeout,
        document,
        setTimeout,
    });

    vm.runInContext(popupSource, context, { filename: "popup.js" });

    return {
        calls,
        context,
        elements,
        handlers,
        readyCallbacks,
        runtimeListeners,
        storage,
        warnings,
    };
}

test("OFF without a WhatsApp tab stores false and sends no message", async () => {
    const harness = createHarness({ tabs: [] });

    assert.equal(await harness.context.setMonitorState(false), true);
    assert.equal(harness.storage.active.on, false);
    assert.equal(harness.calls.sentMessages.length, 0);
    assert.equal(harness.calls.createdTabs.length, 0);
    assert.equal(harness.elements.get("#screen1").hidden, true);
    assert.equal(harness.elements.get("#screen2").hidden, false);
});

test("a failed ON command rolls the persisted state back to false", async () => {
    const harness = createHarness({
        tabs: [{ id: 7, windowId: 3 }],
        sendMessage: async () => {
            throw new Error("Receiving end does not exist");
        },
    });

    harness.context.COMMAND_RETRY_ATTEMPTS = 1;

    assert.equal(await harness.context.setMonitorState(true), false);
    assert.equal(harness.storage.active.on, false);
    assert.equal(harness.context.monitorOperationInProgress, false);
    assert.match(harness.elements.get("#hyperlink").html, /role="alert"/);
    assert.ok(harness.calls.storageWrites.some((write) => write.active.on === true));
    assert.equal(harness.calls.storageWrites.at(-1).active.on, false);
});

test("loading remains visible until ON is acknowledged and rendered", async () => {
    let releaseMessage;
    const messageGate = new Promise((resolve) => {
        releaseMessage = resolve;
    });
    const harness = createHarness({
        tabs: [{ id: 9, windowId: 2 }],
        sendMessage: () => messageGate,
    });

    const operation = harness.context.setMonitorState(true);
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(harness.elements.get("#screen1").hidden, false);
    assert.equal(harness.elements.get("#screen2").hidden, true);

    releaseMessage({ ok: true });

    assert.equal(await operation, true);
    assert.equal(harness.elements.get("#screen1").hidden, true);
    assert.equal(harness.elements.get("#screen2").hidden, false);
    assert.match(harness.elements.get("#hyperlink").html, /Desligar Monitoramento/);
});

test("concurrent monitor changes are rejected while one is pending", async () => {
    let releaseMessage;
    const messageGate = new Promise((resolve) => {
        releaseMessage = resolve;
    });
    const harness = createHarness({
        tabs: [{ id: 11, windowId: 4 }],
        sendMessage: () => messageGate,
    });

    const first = harness.context.setMonitorState(true);
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(await harness.context.setMonitorState(true), false);
    assert.equal(harness.calls.queriedTabs.length, 1);
    assert.equal(harness.calls.sentMessages.length, 1);

    releaseMessage({ ok: true });
    assert.equal(await first, true);
});

test("a newly created tab retries until its content script responds", async () => {
    let attempts = 0;
    const harness = createHarness({
        createdTab: { id: 21 },
        tabs: [],
        sendMessage: async () => {
            attempts += 1;
            if (attempts === 1) throw new Error("Receiving end does not exist");
            return { ok: true };
        },
    });

    assert.equal(
        harness.context.COMMAND_RETRY_ATTEMPTS * harness.context.COMMAND_RETRY_DELAY_MS,
        15000,
    );
    harness.context.COMMAND_RETRY_ATTEMPTS = 2;
    harness.context.wait = async () => {};
    assert.equal(await harness.context.setMonitorState(true), true);
    assert.equal(attempts, 2);
    assert.equal(harness.calls.createdTabs[0].url, "https://web.whatsapp.com/");
    assert.equal(harness.calls.createdTabs[0].active, false);
    assert.equal(harness.calls.tabUpdates.length, 1);
    assert.equal(harness.calls.tabUpdates[0].options.active, true);
    assert.equal(harness.storage.active.on, true);
});

test("an existing tab is reloaded once when its content script is missing", async () => {
    let attempts = 0;
    const harness = createHarness({
        tabs: [{ id: 31, windowId: 6 }],
        sendMessage: async () => {
            attempts += 1;
            if (attempts === 1) throw new Error("Receiving end does not exist");
            return { ok: true };
        },
    });

    harness.context.COMMAND_RETRY_ATTEMPTS = 2;
    harness.context.wait = async () => {};

    assert.equal(await harness.context.setMonitorState(true), true);
    assert.equal(attempts, 2);
    assert.equal(harness.calls.tabUpdates.length, 2);
    assert.equal(harness.calls.tabUpdates[0].options.url, "https://web.whatsapp.com/");
    assert.equal(harness.calls.tabUpdates[1].options.active, true);
});

test("a content script response timeout is not retried", async () => {
    const harness = createHarness({
        tabs: [{ id: 35, windowId: 8 }],
        sendMessage: () => new Promise(() => {}),
    });

    harness.context.COMMAND_RESPONSE_TIMEOUT_MS = 5;
    harness.context.COMMAND_RETRY_ATTEMPTS = 3;

    assert.equal(await harness.context.setMonitorState(true), false);
    assert.equal(harness.calls.sentMessages.length, 1);
    assert.equal(harness.storage.active.on, false);
});
