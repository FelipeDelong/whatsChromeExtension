const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const optionSource = fs.readFileSync(
    path.join(__dirname, "..", "option.js"),
    "utf8",
);

function toPlain(value) {
    return JSON.parse(JSON.stringify(value));
}

function createHarness({ storedList, onSwalFire, templateLoadError } = {}) {
    const document = {};
    const elements = new Map();
    const handlers = [];
    const consoleErrors = [];
    const swalCalls = [];
    const validationMessages = [];
    let context;

    function getElement(selector) {
        if (!elements.has(selector)) {
            elements.set(selector, {
                htmlContent: "",
                focusCount: 0,
                textContent: "",
                value: "",
            });
        }

        const element = elements.get(selector);

        return {
            attr(name) {
                return element[name];
            },
            click() {},
            focus() {
                element.focusCount += 1;
                return this;
            },
            html(value) {
                if (value === undefined) {
                    return element.htmlContent;
                }

                element.htmlContent = value;
                return this;
            },
            text(value) {
                if (value === undefined) {
                    return element.textContent;
                }

                element.textContent = value;
                return this;
            },
            trigger(event) {
                if (event === "focus") {
                    element.focusCount += 1;
                }
                return this;
            },
            val(value) {
                if (value === undefined) {
                    return element.value;
                }

                element.value = value;
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
                    callback();
                },
            };
        }

        return getElement(target);
    }

    jquery.each = function each(collection, callback) {
        if (collection == null) {
            return collection;
        }

        Object.keys(collection).forEach(function (key) {
            callback(Number(key), collection[key]);
        });

        return collection;
    };
    jquery.get = async function get() {
        if (templateLoadError) {
            throw templateLoadError;
        }

        return "<form></form>";
    };

    const chrome = {
        runtime: {
            getURL(relativePath) {
                return relativePath;
            },
        },
        storage: {
            local: {
                get(_keys, callback) {
                    callback(storedList === undefined ? {} : { list: storedList });
                },
                set(_value, callback) {
                    callback();
                },
            },
        },
    };

    const Swal = {
        async fire(options) {
            swalCalls.push(options);

            if (options.didOpen) {
                options.didOpen();
            }

            if (onSwalFire) {
                return onSwalFire({ context, options });
            }

            return { isConfirmed: false };
        },
        mixin() {
            return {
                async fire() {},
            };
        },
        resumeTimer() {},
        showValidationMessage(message) {
            validationMessages.push(message);
        },
        stopTimer() {},
    };

    context = vm.createContext({
        $: jquery,
        Swal,
        chrome,
        console: {
            error(...args) {
                consoleErrors.push(args);
            },
            log() {},
        },
        document,
        window: { location: { reload() {} } },
    });
    vm.runInContext(optionSource, context, { filename: "option.js" });

    return { consoleErrors, context, elements, handlers, swalCalls, validationMessages };
}

function findHandler(handlers, selector) {
    return handlers.find(function (handler) {
        return handler.event === "click" && handler.selector === selector;
    }).handler;
}

function runAddHandler(harness) {
    return findHandler(harness.handlers, "#btnAdd")();
}

test("first execution starts with an empty configuration list", () => {
    const { context, elements } = createHarness();

    assert.deepEqual(Array.from(context.MAIN_LIST), []);
    assert.equal(elements.get("#list").htmlContent, "");
});

test("the add button has a single delegated listener", () => {
    const { handlers } = createHarness();
    const addHandlers = handlers.filter(function (handler) {
        return handler.event === "click" && handler.selector === "#btnAdd";
    });

    assert.equal(addHandlers.length, 1);
});

test("normalizeTextList trims and deduplicates values in order", () => {
    const { context } = createHarness();

    assert.deepEqual(
        Array.from(context.normalizeTextList(["  Alpha  ", "", "Alpha", "Beta", " Beta "])),
        ["Alpha", "Beta"],
    );
});

test("modal template load failures are handled at both entry points", async () => {
    const harness = createHarness({
        templateLoadError: new Error("missing template"),
    });

    assert.equal(await harness.context.modal("0"), false);
    assert.equal(await runAddHandler(harness), false);
    assert.equal(harness.consoleErrors.length, 2);
    assert.equal(harness.swalCalls.length, 2);
    assert.equal(harness.swalCalls[0].title, "Não foi possível abrir o formulário");
    assert.equal(harness.swalCalls[1].title, "Não foi possível abrir o formulário");
});

test("text handlers reject blank values and store trimmed values", () => {
    const fields = [
        {
            handler: "#btn_add_contact",
            input: "#input_contact",
            list: "CONTACT_LIST_TEMP",
            value: "Contato",
        },
        {
            handler: "#btn_add_keyWord",
            input: "#input_keyWord",
            list: "KEYWORD_LIST_TEMP",
            value: "Palavra",
        },
        {
            handler: "#btn_add_response",
            input: "#input_response",
            list: "RESPONSE_LIST_TEMP",
            value: "Resposta",
        },
    ];

    fields.forEach(function (field) {
        const { context, elements, handlers, validationMessages } = createHarness();
        const include = findHandler(handlers, field.handler);

        context.$(field.input).val("");
        include();
        context.$(field.input).val("   ");
        include();

        assert.deepEqual(Array.from(context[field.list]), []);
        assert.equal(elements.get(field.input).focusCount, 2);
        assert.deepEqual(validationMessages, [
            "Digite um texto para incluir na lista",
            "Digite um texto para incluir na lista",
        ]);

        context.$(field.input).val("  " + field.value + "  ");
        include();

        assert.deepEqual(Array.from(context[field.list]), [field.value]);
        assert.equal(elements.get(field.input).value, "");

        context.$(field.input).val(" " + field.value + " ");
        include();

        assert.deepEqual(Array.from(context[field.list]), [field.value]);
        assert.equal(elements.get(field.input).focusCount, 3);
        assert.equal(validationMessages.at(-1), "Esse texto já foi incluído");
    });
});

test("cancelling an edit leaves the stored record unchanged", async () => {
    const storedList = [{
        contact_list: ["Alice", "Bob"],
        date_list: [{ date1: "2026-08-01", date2: "2026-08-02" }],
        group_name: "Equipe",
        keyword_list: ["Olá"],
        response_list: ["Oi"],
        time_list: [{ time1: "08:00", time2: "18:00" }],
    }];
    const original = toPlain(storedList);
    const { context } = createHarness({
        storedList,
        onSwalFire({ context: modalContext }) {
            modalContext.excludeList(0, 1);
            modalContext.DATE_LIST_TEMP[0].date1 = "2030-01-01";
            modalContext.TIME_LIST_TEMP[0].time1 = "00:00";
            return { isConfirmed: false };
        },
    });

    await context.modal("0");

    assert.deepEqual(toPlain(context.MAIN_LIST), original);
    assert.deepEqual(storedList, original);
});

test("editing captures the group name inside preConfirm", async () => {
    const storedList = [{
        contact_list: [],
        date_list: [],
        group_name: "Equipe antiga",
        keyword_list: ["Olá"],
        response_list: ["Oi"],
        time_list: [],
    }];
    const { context } = createHarness({
        storedList,
        onSwalFire({ context: modalContext, options }) {
            modalContext.$("#group").val("Equipe nova");
            return {
                isConfirmed: true,
                value: options.preConfirm(),
            };
        },
    });

    await context.modal("0");

    assert.equal(context.MAIN_LIST[0].group_name, "Equipe nova");
});

test("preConfirm reports each required field and focuses it", async () => {
    const cases = [
        {
            focus: "#group",
            group: "   ",
            keywords: ["Palavra"],
            message: "Informe o grupo ou contato do monitoramento",
            responses: ["Resposta"],
        },
        {
            focus: "#input_keyWord",
            group: "Grupo",
            keywords: ["   "],
            message: "Insira ao menos uma palavra-chave",
            responses: ["Resposta"],
        },
        {
            focus: "#input_response",
            group: "Grupo",
            keywords: ["Palavra"],
            message: "Insira ao menos uma resposta",
            responses: ["   "],
        },
    ];

    for (const currentCase of cases) {
        let validationResult;
        const harness = createHarness({
            onSwalFire({ context: modalContext, options }) {
                modalContext.$("#group").val(currentCase.group);
                modalContext.KEYWORD_LIST_TEMP = currentCase.keywords;
                modalContext.RESPONSE_LIST_TEMP = currentCase.responses;
                validationResult = options.preConfirm();
                return { isConfirmed: false };
            },
        });

        await runAddHandler(harness);

        assert.equal(validationResult, false);
        assert.equal(harness.validationMessages.at(-1), currentCase.message);
        assert.equal(harness.elements.get(currentCase.focus).focusCount, 1);
        assert.equal(harness.context.MAIN_LIST.length, 0);
        assert.deepEqual(
            Array.from(harness.context.KEYWORD_LIST_TEMP),
            currentCase.keywords.map(function (value) { return value.trim(); }).filter(Boolean),
        );
        assert.deepEqual(
            Array.from(harness.context.RESPONSE_LIST_TEMP),
            currentCase.responses.map(function (value) { return value.trim(); }).filter(Boolean),
        );
    }
});

test("preConfirm stores trimmed group and text lists", async () => {
    const harness = createHarness({
        onSwalFire({ context: modalContext, options }) {
            modalContext.$("#group").val("  Grupo  ");
            modalContext.CONTACT_LIST_TEMP = ["  Contato  ", "   "];
            modalContext.KEYWORD_LIST_TEMP = ["  Palavra  ", "   "];
            modalContext.RESPONSE_LIST_TEMP = ["  Resposta  ", "   "];
            const value = options.preConfirm();

            return { isConfirmed: true, value };
        },
    });

    await runAddHandler(harness);

    assert.equal(harness.context.MAIN_LIST[0].group_name, "Grupo");
    assert.deepEqual(Array.from(harness.context.MAIN_LIST[0].contact_list), ["Contato"]);
    assert.deepEqual(Array.from(harness.context.MAIN_LIST[0].keyword_list), ["Palavra"]);
    assert.deepEqual(Array.from(harness.context.MAIN_LIST[0].response_list), ["Resposta"]);
    assert.deepEqual(harness.validationMessages, []);
});

test("user values are escaped before they are inserted into HTML", () => {
    const unsafeValue = `<img src=x onerror="alert('x')">&`;
    const escapedValue = "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;";
    const { context, elements } = createHarness({
        storedList: [{
            contact_list: [unsafeValue],
            date_list: [{ date1: "2026-01-<script>", date2: "2026-02-02" }],
            group_name: unsafeValue,
            keyword_list: [unsafeValue],
            response_list: [unsafeValue],
            time_list: [{ time1: unsafeValue, time2: "23:00" }],
        }],
    });

    const mainListHtml = elements.get("#list").htmlContent;
    assert.ok(mainListHtml.includes(escapedValue));
    assert.ok(mainListHtml.includes("&lt;script&gt;/01/2026"));
    assert.doesNotMatch(mainListHtml, /<img|<script>/);

    context.CONTACT_LIST_TEMP = [unsafeValue];
    context.renderizeList_contact();

    assert.ok(elements.get("#contact_list").htmlContent.includes(escapedValue));
    assert.equal(context.escapeHtml(unsafeValue), escapedValue);
});
