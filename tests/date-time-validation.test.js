"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function createHarness() {
    const document = {};
    const elements = new Map();
    const handlers = new Map();
    const validationMessages = [];
    let resetCount = 0;

    function getElement(selector) {
        if (!elements.has(selector)) {
            elements.set(selector, {
                focusCount: 0,
                html: "",
                value: "",
            });
        }
        return elements.get(selector);
    }

    function jquery(selector) {
        if (selector === document) {
            return {
                on(event, delegatedSelector, handler) {
                    handlers.set(`${event}:${delegatedSelector}`, handler);
                },
                ready() {},
            };
        }

        const element = getElement(selector);
        return {
            attr() {
                return undefined;
            },
            click() {},
            focus() {
                element.focusCount += 1;
                return this;
            },
            html(value) {
                if (value === undefined) return element.html;
                element.html = value;
                return this;
            },
            text() {
                return this;
            },
            trigger(event) {
                if (event === "focus") element.focusCount += 1;
                return this;
            },
            val(value) {
                if (value === undefined) return element.value;
                element.value = value;
                return this;
            },
        };
    }

    jquery.each = (collection, callback) => {
        if (collection == null) return collection;
        Object.keys(collection).forEach((key) => callback(key, collection[key]));
        return collection;
    };
    jquery.get = async () => "";

    const Swal = {
        fire() {
            return Promise.resolve({ isConfirmed: false });
        },
        mixin() {
            return { fire() {} };
        },
        resetValidationMessage() {
            resetCount += 1;
        },
        resumeTimer() {},
        showValidationMessage(message) {
            validationMessages.push(message);
        },
        stopTimer() {},
    };

    const context = vm.createContext({
        $: jquery,
        chrome: {
            runtime: { getURL: (path) => path },
            storage: {
                local: {
                    get(_keys, callback) {
                        callback({});
                    },
                    set(_value, callback) {
                        callback?.();
                    },
                },
            },
        },
        console: { log() {} },
        document,
        Swal,
        window: { location: { reload() {} } },
    });

    const source = readFileSync(join(__dirname, "..", "option.js"), "utf8");
    vm.runInContext(source, context, { filename: "option.js" });

    return {
        context,
        elements,
        get resetCount() {
            return resetCount;
        },
        handler(selector) {
            return handlers.get(`click:${selector}`);
        },
        validationMessages,
    };
}

function setValues(harness, values) {
    Object.entries(values).forEach(([selector, value]) => {
        harness.context.$(selector).val(value);
    });
}

test("date ranges reject missing, invalid, reversed, and duplicate values", () => {
    const harness = createHarness();
    const addDate = harness.handler("#btn_add_date");

    setValues(harness, { "#input_date1": "", "#input_date2": "2026-08-02" });
    addDate();
    assert.equal(harness.validationMessages.at(-1), "Informe as duas datas");
    assert.equal(harness.elements.get("#input_date1").focusCount, 1);

    setValues(harness, { "#input_date1": "2026-02-30", "#input_date2": "2026-03-02" });
    addDate();
    assert.equal(harness.validationMessages.at(-1), "Informe uma faixa de datas válida");
    assert.equal(harness.elements.get("#input_date1").focusCount, 2);

    setValues(harness, { "#input_date1": "2026-08-02", "#input_date2": "2026-08-01" });
    addDate();
    assert.equal(harness.validationMessages.at(-1), "Informe uma faixa de datas válida");
    assert.equal(harness.context.DATE_LIST_TEMP.length, 0);

    setValues(harness, { "#input_date1": "2026-08-01", "#input_date2": "2026-08-02" });
    addDate();
    assert.deepEqual(
        Array.from(harness.context.DATE_LIST_TEMP, (value) => ({ ...value })),
        [{ date1: "2026-08-01", date2: "2026-08-02" }],
    );
    assert.equal(harness.resetCount, 1);

    setValues(harness, { "#input_date1": "2026-08-01", "#input_date2": "2026-08-02" });
    addDate();
    assert.equal(harness.context.DATE_LIST_TEMP.length, 1);
    assert.equal(harness.validationMessages.at(-1), "Essa faixa de datas já foi incluída");
});

test("time ranges reject invalid values, accept overnight, and prevent duplicates", () => {
    const harness = createHarness();
    const addTime = harness.handler("#btn_add_time");

    setValues(harness, { "#input_time1": "09:00", "#input_time2": "" });
    addTime();
    assert.equal(harness.validationMessages.at(-1), "Informe os dois horários");
    assert.equal(harness.elements.get("#input_time2").focusCount, 1);

    setValues(harness, { "#input_time1": "25:00", "#input_time2": "08:00" });
    addTime();
    assert.equal(harness.validationMessages.at(-1), "Informe uma faixa de horários válida");
    assert.equal(harness.elements.get("#input_time1").focusCount, 1);

    setValues(harness, { "#input_time1": "08:00", "#input_time2": "08:00" });
    addTime();
    assert.equal(harness.validationMessages.at(-1), "Informe uma faixa de horários válida");
    assert.equal(harness.context.TIME_LIST_TEMP.length, 0);

    setValues(harness, { "#input_time1": "22:00", "#input_time2": "06:00" });
    addTime();
    assert.deepEqual(
        Array.from(harness.context.TIME_LIST_TEMP, (value) => ({ ...value })),
        [{ time1: "22:00", time2: "06:00" }],
    );
    assert.equal(harness.resetCount, 1);

    setValues(harness, { "#input_time1": "22:00", "#input_time2": "06:00" });
    addTime();
    assert.equal(harness.context.TIME_LIST_TEMP.length, 1);
    assert.equal(harness.validationMessages.at(-1), "Essa faixa de horários já foi incluída");
});
