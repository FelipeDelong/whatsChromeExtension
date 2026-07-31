var LIST_NAME = "list";
var ACTIVE = "active";
var LIST_ACTIVE = [];

async function openOrFocusWhats(status) {
    const tabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });

    var id_tab = tabs.length ? tabs[0].id : 0;

    if (status) {
        if (tabs.length) {
            const tab = tabs[0];
            if (tab.windowId != null) await chrome.windows.update(tab.windowId, { focused: true });
            await chrome.tabs.update(tab.id, { active: true });
        } else {
            const created = await chrome.tabs.create({ url: "https://web.whatsapp.com/?monitor=ON" });
            id_tab = created.id;
        }
    }

    return id_tab;
}



function checkMonitor(whats) {
    setTimeout(function () {
        chrome.storage.local.get([LIST_NAME], (res) => {

            chrome.storage.local.get([ACTIVE], (response) => {
                var active = false;
                var now = Date.now();

                console.log(response);

                if (response.length > 0) {

                    var dateDiff = (now - response.active.date_time) / (1000 * 60 * 60);

                    if (response.active.on == true && dateDiff <= 2) {
                        active = true;
                    }
                }


                LIST = res.list;

                var html = ``;
                $.each(LIST, function (key, value) {
                    if (value.active) {
                        LIST_ACTIVE.push(key);
                    }
                });

                if (active == true && whats != 0) {
                    html = `<div class="col-9" id="btnWhatsOff">
                            <button class="form-control btn btnWhatsOff">
                                <label class="hyperlinkWhats">Desligar Monitoramento</label>
                            </button>
                        </div>
                        `;
                } else if (LIST_ACTIVE.length > 0) {
                    html = `<div class="col-8">
                            <button class="form-control btn btnWhats">
                                <label class="hyperlinkWhats">Ligar Monitoramento</label>
                            </button>
                        </div>
                        `;
                } else {
                    html = `<div class="col-11" id="btnWhatsOff">
                            <button class="form-control btn btnWhatsOff" disabled>
                                    <label class="hyperlinkWhats">Nenhum Registro Encontrado</label>
                                    <label>(Ative Registros em Configuração)</label>
                            </button>
                        </div>
                        `;
                }
                $('#hyperlink').html(html);

            });

        });
    }, 250);
}

$(document).ready(async function () {
    id_tab = await openOrFocusWhats(false);
    checkMonitor(id_tab);
});

$(document).on('click', '.btnWhats', async function () {

    var data = {
        on: true,
        date_time: Date.now(),
    }

    chrome.storage.local.set({ [ACTIVE]: data }, async () => {
        checkMonitor();
        var id_tab = await openOrFocusWhats(true);
        chrome.tabs.sendMessage(id_tab, { type: "ON" });
    });

});

$(document).on('click', '.btnWhatsOff', async function () {
    await switchScreen();

    var data = {
        on: false,
        date_time: Date.now(),
    }

    chrome.storage.local.set({ [ACTIVE]: data }, async () => {
        checkMonitor();
        var id_tab = await openOrFocusWhats(false);
        chrome.tabs.sendMessage(id_tab, { type: "OFF" });
    });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === "UPDATE") {
        checkMonitor();
        sendResponse({ ok: true });
    }
});

