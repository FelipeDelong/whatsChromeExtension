var LIST_NAME = "list";
var ACTIVE = "active";
var THEME_NAME = "theme";
var THEME_PATH = "assets/css/themes";
var THEME_FILES = new Set([
    "default.css",
    "dark-blue.css",
    "light.css",
    "purple.css",
]);
var WHATS_URL = "https://web.whatsapp.com/";
var WHATS_URL_PATTERN = "https://web.whatsapp.com/*";
var COMMAND_RETRY_ATTEMPTS = 60;
var COMMAND_RETRY_DELAY_MS = 250;
var COMMAND_RESPONSE_TIMEOUT_MS = 2000;

var LIST = [];
var LIST_ACTIVE = [];
var monitorOperationInProgress = false;

function applyTheme(themeFile) {
    var fileName = THEME_FILES.has(themeFile) ? themeFile : "default.css";
    $("#themeStylesheet").attr("href", THEME_PATH + "/" + fileName);
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function openOrFocusWhats(shouldOpen) {
    var tabs = await chrome.tabs.query({ url: WHATS_URL_PATTERN });
    var tab = tabs.length > 0 ? tabs[0] : null;

    if (!shouldOpen) {
        return {
            tabId: Number.isInteger(tab?.id) ? tab.id : null,
            created: false,
            windowId: tab?.windowId ?? null,
        };
    }

    if (tab) {
        return {
            tabId: Number.isInteger(tab.id) ? tab.id : null,
            created: false,
            windowId: tab.windowId ?? null,
        };
    }

    var createdTab = await chrome.tabs.create({
        url: WHATS_URL,
        active: false,
    });

    return {
        tabId: Number.isInteger(createdTab?.id) ? createdTab.id : null,
        created: true,
        windowId: createdTab?.windowId ?? null,
    };
}

async function focusWhats(target) {
    if (!Number.isInteger(target?.tabId)) return;

    await chrome.tabs.update(target.tabId, { active: true });

    if (target.windowId != null) {
        await chrome.windows.update(target.windowId, { focused: true });
    }
}

function startLoading() {
    $("#screen1").attr("hidden", false).show();
    $("#screen2").attr("hidden", true).hide();
}

function switchScreen() {
    return new Promise((resolve) => {
        var $s1 = $("#screen1");
        var $s2 = $("#screen2");

        $s2.attr("hidden", false).show();
        $s1.attr("hidden", true).hide();

        $s2.stop(true, true).fadeOut(300, function () {
            $(this).attr("hidden", true);
        });

        $s1.attr("hidden", false).hide().stop(true, true).fadeIn(200);

        setTimeout(function () {
            $s1.stop(true, true).fadeOut(300, function () {
                $(this).attr("hidden", true);
            });

            $s2.attr("hidden", false).hide().stop(true, true).fadeIn(200, function () {
                resolve(true);
            });
        }, 500);
    });
}

async function finishLoading() {
    await switchScreen();
}

$(document).ready(function () {
    chrome.storage.local.get([THEME_NAME], (res) => {
        applyTheme(res.theme);
    });
});
function renderOperationError() {
    $("#hyperlink").html(
        '<p class="warning" role="alert">Não foi possível atualizar o monitoramento.</p>'
    );
}

async function sendMessageWithTimeout(tabId, message) {
    var timeoutId = null;
    var timeout = new Promise((resolve, reject) => {
        timeoutId = setTimeout(function () {
            var error = new Error("O monitor demorou para responder.");
            error.isResponseTimeout = true;
            reject(error);
        }, COMMAND_RESPONSE_TIMEOUT_MS);
    });

    try {
        return await Promise.race([
            chrome.tabs.sendMessage(tabId, message),
            timeout,
        ]);
    } finally {
        clearTimeout(timeoutId);
    }
}

async function sendMonitorCommand(tabId, type, options = {}) {
    if (!Number.isInteger(tabId)) {
        throw new Error("A aba do WhatsApp Web não está disponível.");
    }

    var shouldRetry = options.retry === true;
    var attempts = shouldRetry ? COMMAND_RETRY_ATTEMPTS : 1;
    var shouldReload = options.reloadOnFirstFailure === true;
    var lastError = null;

    for (var attempt = 0; attempt < attempts; attempt += 1) {
        try {
            var response = await sendMessageWithTimeout(tabId, { type });

            if (response?.ok !== true) {
                throw new Error("O monitor não confirmou o comando.");
            }

            return response;
        } catch (error) {
            lastError = error;

            if (error?.isResponseTimeout) {
                throw error;
            }

            if (attempt === 0 && shouldReload) {
                await chrome.tabs.update(tabId, { url: WHATS_URL });
            }

            if (attempt === attempts - 1) {
                break;
            }

            await wait(COMMAND_RETRY_DELAY_MS);
        }
    }

    throw lastError || new Error("Não foi possível comunicar com o WhatsApp Web.");
}

async function checkMonitor(tabId) {
    var [listResult, activeResult] = await Promise.all([
        chrome.storage.local.get([LIST_NAME]),
        chrome.storage.local.get([ACTIVE]),
    ]);
    var active = false;
    var activeState = activeResult?.active;
    var now = Date.now();

    if (activeState) {
        var dateDiff = (now - Number(activeState.date_time)) / (1000 * 60 * 60);

        if (activeState.on === true && Number.isFinite(dateDiff) && dateDiff >= 0 && dateDiff <= 2) {
            active = true;
        }
    }

    LIST = Array.isArray(listResult?.list) ? listResult.list : [];
    LIST_ACTIVE = [];

    $.each(LIST, function (key, value) {
        if (value?.active) {
            LIST_ACTIVE.push(key);
        }
    });

    var html = "";

    if (active && Number.isInteger(tabId)) {
        html = `<div class="col-9" id="btnWhatsOff">
                    <button class="form-control btn btnWhatsOff" type="button">
                        <span class="hyperlinkWhats">Desligar Monitoramento</span>
                    </button>
                </div>`;
    } else if (LIST_ACTIVE.length > 0) {
        html = `<div class="col-8">
                    <button class="form-control btn btnWhats" type="button">
                        <span class="hyperlinkWhats">Ligar Monitoramento</span>
                    </button>
                </div>`;
    } else {
        html = `<div class="col-11" id="btnWhatsOff">
                    <button class="form-control btn btnWhatsOff" type="button" disabled>
                        <span class="hyperlinkWhats">Nenhum Registro Encontrado</span>
                        <span>(Ative Registros em Configuração)</span>
                    </button>
                </div>`;
    }

    $("#hyperlink").html(html);
    return { active, tabId };
}

async function storeMonitorState(enabled) {
    await chrome.storage.local.set({
        [ACTIVE]: {
            on: enabled,
            date_time: Date.now(),
        },
    });
}

async function setMonitorState(enabled) {
    if (monitorOperationInProgress) {
        return false;
    }

    monitorOperationInProgress = true;
    startLoading();
    var tabId = null;
    var activationConfirmed = false;

    try {
        var target = await openOrFocusWhats(enabled);
        tabId = target.tabId;

        if (enabled) {
            if (!Number.isInteger(tabId)) {
                throw new Error("Não foi possível abrir o WhatsApp Web.");
            }

            await storeMonitorState(true);
            await sendMonitorCommand(tabId, "ON", {
                retry: true,
                reloadOnFirstFailure: !target.created,
            });
            activationConfirmed = true;
        } else {
            await storeMonitorState(false);

            if (Number.isInteger(tabId)) {
                await sendMonitorCommand(tabId, "OFF");
            }
        }

        await checkMonitor(tabId);

        if (enabled) {
            await focusWhats(target);
        }

        return true;
    } catch (error) {
        if (enabled && !activationConfirmed) {
            try {
                await storeMonitorState(false);
            } catch (storageError) {
                console.warn("Não foi possível reverter o estado do monitor.", storageError);
            }
        }

        console.warn("Não foi possível alterar o monitoramento.", error);
        renderOperationError();
        return false;
    } finally {
        monitorOperationInProgress = false;
        await finishLoading();
    }
}

async function refreshPopup() {
    if (monitorOperationInProgress) {
        return false;
    }

    startLoading();

    try {
        var target = await openOrFocusWhats(false);
        await checkMonitor(target.tabId);
        return true;
    } catch (error) {
        console.warn("Não foi possível carregar o monitoramento.", error);
        renderOperationError();
        return false;
    } finally {
        await finishLoading();
    }
}

$(document).ready(function () {
    void refreshPopup();
});

$(document).on("click", ".btnWhats", function () {
    void setMonitorState(true);
});

$(document).on("click", ".btnWhatsOff", function () {
    void setMonitorState(false);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type !== "UPDATE") {
        return undefined;
    }

    void (async () => {
        var ok = await refreshPopup();
        sendResponse({ ok });
    })();

    return true;
});
