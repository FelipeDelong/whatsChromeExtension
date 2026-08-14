var LIST_NAME = "list";
var MAIN_LIST = [];
var CONTACT_LIST_TEMP = [];
var KEYWORD_LIST_TEMP = [];
var RESPONSE_LIST_TEMP = [];
var DATE_LIST_TEMP = [];
var TIME_LIST_TEMP = [];

function showRangeValidation(message, selector) {
    Swal.showValidationMessage(message);
    $(selector).trigger("focus");
}

function resetRangeValidation() {
    if (typeof Swal.resetValidationMessage === "function") {
        Swal.resetValidationMessage();
    }
}

function isValidDateValue(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return false;

    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var date = new Date(year, month - 1, day, 12);

    return date.getFullYear() === year
        && date.getMonth() === month - 1
        && date.getDate() === day;
}

function isValidTimeValue(value) {
    return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value || ""));
function escapeHtml(value) {
    var characters = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    };

    return String(value).replace(/[&<>"']/g, function (character) {
        return characters[character];
    });
}

function normalizeTextList(list) {
    var seen = new Set();

    return list.map(function (value) {
        return String(value).trim();
    }).filter(function (value) {
        if (value.length === 0 || seen.has(value)) {
            return false;
        }

        seen.add(value);
        return true;
    });
}

function normalizeMonitoringRecord(record) {
    var normalized = record && typeof record === "object" ? record : {};

    return {
        ...normalized,
        contact_list: Array.isArray(normalized.contact_list) ? normalized.contact_list : [],
        keyword_list: Array.isArray(normalized.keyword_list) ? normalized.keyword_list : [],
        response_list: Array.isArray(normalized.response_list) ? normalized.response_list : [],
        date_list: Array.isArray(normalized.date_list) ? normalized.date_list : [],
        time_list: Array.isArray(normalized.time_list) ? normalized.time_list : [],
    };
}

function showFormError(message, inputSelector) {
    Swal.showValidationMessage(message);
    $(inputSelector).trigger("focus");
    return false;
}

function validateMonitoringForm(recordId = null) {
    var group = $("#group").val().trim();
    CONTACT_LIST_TEMP = normalizeTextList(CONTACT_LIST_TEMP);
    KEYWORD_LIST_TEMP = normalizeTextList(KEYWORD_LIST_TEMP);
    RESPONSE_LIST_TEMP = normalizeTextList(RESPONSE_LIST_TEMP);

    if (!group) {
        return showFormError("Informe o grupo ou contato do monitoramento", "#group");
    }

    var duplicateGroup = MAIN_LIST.some(function (item, index) {
        return index !== recordId && String(item.group_name).trim() === group;
    });

    if (duplicateGroup) {
        return showFormError("Já existe um monitoramento para esse grupo ou contato", "#group");
    }

    if (KEYWORD_LIST_TEMP.length === 0) {
        return showFormError("Insira ao menos uma palavra-chave", "#input_keyWord");
    }

    if (RESPONSE_LIST_TEMP.length === 0) {
        return showFormError("Insira ao menos uma resposta", "#input_response");
    }

    return { group };
}

function addTextValue(inputSelector, list, renderList) {
    var value = $(inputSelector).val().trim();

    if (!value) {
        showFormError("Digite um texto para incluir na lista", inputSelector);
        return;
    }

    var duplicateValue = list.some(function (item) {
        return String(item).trim() === value;
    });

    if (duplicateValue) {
        showFormError("Esse texto já foi incluído", inputSelector);
        return;
    }

    $(inputSelector).val("");
    list.push(value);
    renderList();
}

//bring the html for the modal
function loadHtmlJQ(path) {
    return $.get(path);
}

async function loadMonitoringFormHtml() {
    try {
        return await loadHtmlJQ(chrome.runtime.getURL("components/modal.html"));
    } catch (error) {
        console.error("Unable to load the monitoring form.", error);
        await Swal.fire({
            icon: "error",
            title: "Não foi possível abrir o formulário",
            text: "Recarregue a página e tente novamente.",
            background: "#19191a",
            color: "#e1e1e1",
            confirmButtonText: "Fechar",
            confirmButtonColor: "#E50091",
        });
        return null;
    }
}

//renderize the Main list of cards
function renderizeMainList(list = MAIN_LIST) {
    var html = ``;

    MAIN_LIST = (Array.isArray(list) ? list : []).map(normalizeMonitoringRecord);
    console.log(MAIN_LIST);

    $.each(MAIN_LIST, function (key, value) {

        var btn_active = ``;
        var active = ``;
        var active_border = ``;
        var active_left_border = ``;

        if (value.active) {
            btn_active = `<input class="btn btnActive" id="btnActive" data-id="` + key + `" type="button" value="Retirar da Lista">`;
        } else {
            btn_active = `<input class="btn btnActive" id="btnActive" data-id="` + key + `" type="button" value="Anexar a Lista">`;

            active = `off`;
            active_border = `offBorder`;
            active_left_border = `offLeftBorder`;
        }

        var contact_list = ``;
        if (value.contact_list.length > 0) {
            $.each(value.contact_list, function (key, value) {
                contact_list += ` <div class="col-12 text2 ` + active_border + `"> ` + escapeHtml(value) + ` </div>`;
            });
        } else {
                contact_list += ` <div class="col-12 text2 offBorder"> Todos os contatos </div>`;
        }


        var keyword_list = ``;
        $.each(value.keyword_list, function (key, value) {
            keyword_list += ` <div class="col-12 text2 ` + active_border + `"> ` + escapeHtml(value) + ` </div>`;
        });

        var response_list = ``;
        $.each(value.response_list, function (key, value) {
            response_list += ` <div class="col-12 text2 ` + active_border + `"> ` + escapeHtml(value) + ` </div>`;
        });

        var date_list = ``;
        if (value.date_list.length > 0) {
            $.each(value.date_list, function (key, value) {
                var temp1 = value.date1.split('-');
                var date1 = temp1[2] + "/" + temp1[1] + "/" + temp1[0];
                var temp2 = value.date2.split('-');
                var date2 = temp2[2] + "/" + temp2[1] + "/" + temp2[0];
                date_list += ` <div class="col-12 text2 ` + active_border + `"> ` + escapeHtml(date1) + ` - ` + escapeHtml(date2) + ` </div>`;
            });
        } else {
            date_list += ` <div class="col-12 text2 offBorder"> Todos as datas </div>`
        }

        var time_list = ``;
        if (value.time_list.length > 0) {
            $.each(value.time_list, function (key, value) {
                time_list += ` <div class="col-12 text2 ` + active_border + `"> ` + escapeHtml(value.time1) + ` - ` + escapeHtml(value.time2) + `</div>`;
            });
        } else {
            time_list += ` <div class="col-12 text2 offBorder"> Todos os horários </div>`;
        }


        html += `   <div class="col-9 card ` + active + ` mt-2">

                        <div class="col-2 idCard ` + active + `" >
                            ` + (key + 1) + `
                        </div>

                        <div class="col-12">
                            <div class="row">
                                <div class="col-2 d-flex align-items-center subtitle1">Grupo/Contato:</div>
                                <div class="col-8">
                                    <div class="col-12 text1" style="text-align: center;">
                                        ` + escapeHtml(value.group_name) + `
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-12">
                            <div class="d-flex justify-content-center">
                                <div style="border-top: 1px solid #999999; width: 95%;"></div>
                            </div>
                        </div>
                        <div class="col-12">
                            <div class="row">
                                <div class="col-4">
                                    <div class="col-12 subtitle2">Contato:</div>
                                    <div class="col-12 subcard `+ active_left_border + `">
                                        ` + contact_list + `
                                    </div>
                                </div>
                                <div class="col-4">
                                    <div class="col-12 subtitle2">Palavras-Chave:</div>
                                    <div class="col-12 subcard `+ active_left_border + `">
                                        ` + keyword_list + `
                                    </div>
                                </div>
                                <div class="col-4">
                                    <div class="col-12 subtitle2">Resposta:</div>
                                    <div class="col-12 subcard `+ active_left_border + `">
                                        ` + response_list + `
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="col-12">
                            <div class="d-flex justify-content-center">
                                <div style="border-top: 1px solid #999999; width: 95%;"></div>
                            </div>
                        </div>
                        <div class="col-12">
                            <div class="row">
                                <div class="col-6">
                                    <div class="col-12 subtitle2">Data:</div>
                                    <div class="col-12 subcard2 `+ active_left_border + `">
                                        ` + date_list + `
                                    </div>
                                </div>
                                <div class="col-6">
                                    <div class="col-12 subtitle2">Horário:</div>
                                    <div class="col-12 subcard2 `+ active_left_border + `">
                                        ` + time_list + `
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                    <div class="col-2 d-flex flex-column justify-content-center align-items-start">
                            <input class="btn btnEdit" id="btnEdit" data-id="` + key + `" type="button" value="Editar">
                            ` + btn_active + ` 
                            <input class="btn btnDelete" id="btnDelete" data-id="` + key + `" type="button" value="Excluir">
                    </div>

                    `;
    });

    $("#list").html(html);

}

//renderize List of keyWords inside modal
function renderizeList_contact() {
    var html = "";
    $.each(CONTACT_LIST_TEMP, function (key, value) {
        html += `   <div class="col-12 d-flex justify-content-center">
                        <div class="col-10">
                            ` + escapeHtml(value) + `
                        </div>
                        <div class="col-2 btnExclude" id="btnExcludeContact" data-id="` + key + `">
                            x
                        </div>
                    </div>`;
    });

    $("#contact_list").html(html);
}

//renderize List of keyWords inside modal
function renderizeList_keyWord() {
    var html = "";
    $.each(KEYWORD_LIST_TEMP, function (key, value) {
        html += `   <div class="col-12 d-flex justify-content-center">
                        <div class="col-10">
                            ` + escapeHtml(value) + `
                        </div>
                        <div class="col-2 btnExclude" id="btnExcludeKeyWord" data-id="` + key + `">
                            x
                        </div>
                    </div>`;
    });

    $("#keyWord_list").html(html);
}

//renderize List of Responses inside modal
function renderizeList_response() {
    var html = "";
    $.each(RESPONSE_LIST_TEMP, function (key, value) {
        html += `   <div class="col-12 d-flex justify-content-center">
                        <div class="col-10">
                            ` + escapeHtml(value) + `
                        </div>
                        <div class="col-2 btnExclude" id="btnExcludeResponse" data-id="` + key + `">
                            x
                        </div>
                    </div>`;
    });

    $("#response_list").html(html);
}

//renderize List of dates inside modal
function renderizeList_date() {
    var html = "";
    $.each(DATE_LIST_TEMP, function (key, value) {
        var temp1 = value.date1.split('-');
        var date1 = temp1[2] + "/" + temp1[1] + "/" + temp1[0];
        var temp2 = value.date2.split('-');
        var date2 = temp2[2] + "/" + temp2[1] + "/" + temp2[0];

        html += `   <div class="col-12 d-flex justify-content-center">
                        <div class="col-10">
                            ` + escapeHtml(date1) + ` - ` + escapeHtml(date2) + `
                        </div>
                        <div class="col-2 btnExclude" id="btnExcludeDate" data-id="` + key + `">
                            x
                        </div>
                    </div>`;
    });

    $("#date_list").html(html);
}

//renderize List of times inside modal
function renderizeList_time() {
    var html = "";
    $.each(TIME_LIST_TEMP, function (key, value) {
        html += `   <div class="col-12 d-flex justify-content-center">
                        <div class="col-10">
                            ` + escapeHtml(value.time1) + ` - ` + escapeHtml(value.time2) + `
                        </div>
                        <div class="col-2 btnExclude" id="btnExcludeTime" data-id="` + key + `">
                            x
                        </div>
                    </div>`;
    });

    $("#time_list").html(html);
}

//exclude element from the list on modal
function excludeList(id, list) {
    switch (list) {
        case 1:
            CONTACT_LIST_TEMP.splice(id, 1);
            break;
        case 2:
            KEYWORD_LIST_TEMP.splice(id, 1);
            break;
        case 3:
            RESPONSE_LIST_TEMP.splice(id, 1);
            break;
        case 4:
            DATE_LIST_TEMP.splice(id, 1);
            break;
        case 5:
            TIME_LIST_TEMP.splice(id, 1);
            break;
        case 0:
            MAIN_LIST.splice(id, 1);
            break;
    }
}

//open modal
function modal(id = false) {
    CONTACT_LIST_TEMP = [];
    KEYWORD_LIST_TEMP = [];
    RESPONSE_LIST_TEMP = [];
    DATE_LIST_TEMP = [];
    TIME_LIST_TEMP = [];

    var active = true;

    return (async () => {
        var html = await loadMonitoringFormHtml();
        if (html === null) return false;

        var new_id = parseInt(id) + 1;

        return Swal.fire({
            width: '70rem',
            title: "Novo Grupo",
            background: "#19191a",
            color: "#e1e1e1",
            confirmButtonText: "Adicionar",
            confirmButtonColor: "#E50091",
            showCancelButton: true,
            cancelButtonText: "Cancelar",
            cancelButtonColor: "#6E6E6E",
            reverseButtons: true,
            allowOutsideClick: false,
            backdrop: "rgba(0,0,0,0.55)",
            html: html,
            didOpen: () => {
                if (id !== false) {
                    var record = normalizeMonitoringRecord(MAIN_LIST[id]);
                    MAIN_LIST[id] = record;
                    $("#swal2-title").text('Editar Registro ' + new_id);
                    $("#group").val(record.group_name);
                    CONTACT_LIST_TEMP = record.contact_list.slice();
                    KEYWORD_LIST_TEMP = record.keyword_list.slice();
                    RESPONSE_LIST_TEMP = record.response_list.slice();
                    DATE_LIST_TEMP = record.date_list.map(function (date) {
                        return { ...date };
                    });
                    TIME_LIST_TEMP = record.time_list.map(function (time) {
                        return { ...time };
                    });
                    active = record.active;

                    renderizeList_contact();
                    renderizeList_keyWord();
                    renderizeList_response();
                    renderizeList_date();
                    renderizeList_time();
                }
            },
            preConfirm: () => {
                return validateMonitoringForm(Number(id));
            }
        }).then((result) => {
            if (result.isConfirmed) {
                var group = result.value.group;

                var data = {
                    "group_name": group,
                    "active": active,
                    "contact_list": CONTACT_LIST_TEMP,
                    "keyword_list": KEYWORD_LIST_TEMP,
                    "response_list": RESPONSE_LIST_TEMP,
                    "date_list": DATE_LIST_TEMP,
                    "time_list": TIME_LIST_TEMP,
                };

                if (id !== false) {
                    MAIN_LIST[id] = data;
                } else {
                    MAIN_LIST.push(data);
                }

                renderizeMainList();
            }
        })
    })();
}

//check if there's a list on memory
$(document).ready(function () {
    chrome.storage.local.get([LIST_NAME], (res) => {
        console.log(res.list);
        renderizeMainList(res.list);
    });

});


// ------------ functions for the Modal ----------------

$(document).on("click", "#btnEdit", function () {
    var id = $(this).attr('data-id');
    modal(id);
});

$(document).on("click", "#btn_add_contact", function () {
    addTextValue("#input_contact", CONTACT_LIST_TEMP, renderizeList_contact);
});

$(document).on("click", "#btn_add_keyWord", function () {
    addTextValue("#input_keyWord", KEYWORD_LIST_TEMP, renderizeList_keyWord);
});

$(document).on("click", "#btn_add_response", function () {
    addTextValue("#input_response", RESPONSE_LIST_TEMP, renderizeList_response);
});

$(document).on("click", "#btn_add_date", function () {
    var date1 = $("#input_date1").val();
    var date2 = $("#input_date2").val();
    var date1IsValid = isValidDateValue(date1);
    var date2IsValid = isValidDateValue(date2);
    var date = {
        date1, date2
    }

    if (!date1 || !date2) {
        showRangeValidation("Informe as duas datas", !date1 ? "#input_date1" : "#input_date2");
    } else if (!date1IsValid || !date2IsValid) {
        showRangeValidation(
            "Informe uma faixa de datas válida",
            !date1IsValid ? "#input_date1" : "#input_date2"
        );
    } else if (date1 >= date2) {
        showRangeValidation("Informe uma faixa de datas válida", "#input_date2");
    } else if (DATE_LIST_TEMP.some(function (value) {
        return value.date1 === date1 && value.date2 === date2;
    })) {
        showRangeValidation("Essa faixa de datas já foi incluída", "#input_date1");
    } else {
        resetRangeValidation();
        $("#input_date1").val("");
        $("#input_date2").val("");
        DATE_LIST_TEMP.push(date);
        renderizeList_date();
    }
});

$(document).on("click", "#btn_add_time", function () {
    var time1 = $("#input_time1").val();
    var time2 = $("#input_time2").val();
    var time1IsValid = isValidTimeValue(time1);
    var time2IsValid = isValidTimeValue(time2);
    var time = {
        time1, time2
    }

    if (!time1 || !time2) {
        showRangeValidation("Informe os dois horários", !time1 ? "#input_time1" : "#input_time2");
    } else if (!time1IsValid || !time2IsValid) {
        showRangeValidation(
            "Informe uma faixa de horários válida",
            !time1IsValid ? "#input_time1" : "#input_time2"
        );
    } else if (time1 === time2) {
        showRangeValidation("Informe uma faixa de horários válida", "#input_time2");
    } else if (TIME_LIST_TEMP.some(function (value) {
        return value.time1 === time1 && value.time2 === time2;
    })) {
        showRangeValidation("Essa faixa de horários já foi incluída", "#input_time1");
    } else {
        resetRangeValidation();
        $("#input_time1").val("");
        $("#input_time2").val("");
        TIME_LIST_TEMP.push(time);
        renderizeList_time();
    }
});

$(document).on("click", "#btnExcludeContact", function () {
    var id = $(this).attr('data-id');

    excludeList(id, 1);

    renderizeList_contact();
});

$(document).on("click", "#btnExcludeKeyWord", function () {
    var id = $(this).attr('data-id');

    excludeList(id, 2);

    renderizeList_keyWord();
});

$(document).on("click", "#btnExcludeResponse", function () {
    var id = $(this).attr('data-id');

    excludeList(id, 3);

    renderizeList_response();
});

$(document).on("click", "#btnExcludeDate", function () {
    var id = $(this).attr('data-id');

    excludeList(id, 4);

    renderizeList_date();
});

$(document).on("click", "#btnExcludeTime", function () {
    var id = $(this).attr('data-id');

    excludeList(id, 5);

    renderizeList_time();
});

$(document).on("click", "#btnAdd", function () {

    CONTACT_LIST_TEMP = [];
    KEYWORD_LIST_TEMP = [];
    RESPONSE_LIST_TEMP = [];
    DATE_LIST_TEMP = [];
    TIME_LIST_TEMP = [];

    return (async () => {
        var html = await loadMonitoringFormHtml();
        if (html === null) return false;

        return Swal.fire({
            width: '70rem',
            title: "Novo Grupo",
            background: "#19191a",
            color: "#e1e1e1",
            confirmButtonText: "Adicionar",
            confirmButtonColor: "#E50091",
            showCancelButton: true,
            cancelButtonText: "Cancelar",
            cancelButtonColor: "#6E6E6E",
            reverseButtons: true,
            allowOutsideClick: false,
            backdrop: "rgba(0,0,0,0.55)",
            html: html,
            preConfirm: () => {
                return validateMonitoringForm();
            }
        }).then((result) => {
            if (result.isConfirmed) {
                var group = result.value.group;

                var data = {
                    "group_name": group,
                    "active": true,
                    "contact_list": CONTACT_LIST_TEMP,
                    "keyword_list": KEYWORD_LIST_TEMP,
                    "response_list": RESPONSE_LIST_TEMP,
                    "date_list": DATE_LIST_TEMP,
                    "time_list": TIME_LIST_TEMP,
                };

                MAIN_LIST.push(data);
                renderizeMainList();
            }
        })
    })();

});

$(document).on("click", "#btnActive", function () {
    var id = parseInt($(this).attr('data-id'));

    Swal.fire({
        title: "Ativar o grupo " + (id + 1) + "?",
        background: "#19191a",
        color: "#e1e1e1",
        confirmButtonText: "Confirmar",
        confirmButtonColor: "#E50091",
        showCancelButton: true,
        cancelButtonText: "Cancelar",
        cancelButtonColor: "#6E6E6E",
        reverseButtons: true,
        allowOutsideClick: false,
        backdrop: "rgba(0,0,0,0.55)",
    }).then((result) => {
        if (result.isConfirmed) {
            var value = MAIN_LIST[id].active;
            MAIN_LIST[id].active = (value == true ? false : true);
            renderizeMainList();
        }
    })
});

$(document).on("click", "#btnDelete", function () {
    var id = parseInt($(this).attr('data-id'));

    Swal.fire({
        title: "Excluir o grupo " + (id + 1) + "?",
        background: "#19191a",
        color: "#e1e1e1",
        confirmButtonText: "Confirmar",
        confirmButtonColor: "#E50091",
        showCancelButton: true,
        cancelButtonText: "Cancelar",
        cancelButtonColor: "#6E6E6E",
        reverseButtons: true,
        allowOutsideClick: false,
        backdrop: "rgba(0,0,0,0.55)",
    }).then((result) => {
        if (result.isConfirmed) {
            excludeList(id, 0);
            renderizeMainList();
        }
    })

});

$(document).on("keypress", function (event) {
    if (event.key == "Enter") {
        var id = $(':focus').attr('data-id');
        console.log(id);

        switch (id) {
            case '0':
                $("#input_contact").focus();
                break;
            case '1':
                $("#btn_add_contact").click();
                break;
            case '2':
                $('#btn_add_keyWord').click();
                break;
            case '3':
                $('#btn_add_response').click();
                break;
        }
    }
});

// -------------------------------------------------------

$(document).on('click', '#btnSave', function () {

    Swal.fire({
        title: "Salvar Alterações?",
        background: "#19191a",
        color: "#e1e1e1",
        confirmButtonText: "Confirmar",
        confirmButtonColor: "#E50091",
        showCancelButton: true,
        cancelButtonText: "Cancelar",
        cancelButtonColor: "#6E6E6E",
        reverseButtons: true,
        allowOutsideClick: false,
        backdrop: "rgba(0,0,0,0.55)",
    }).then((result) => {
        if (result.isConfirmed) {
            chrome.storage.local.set({ [LIST_NAME]: MAIN_LIST }, () => {
                const Toast = Swal.mixin({
                    toast: true,
                    position: "center",
                    showConfirmButton: false,
                    timer: 1000,
                    timerProgressBar: true,
                    didOpen: (toast) => {
                        toast.onmouseenter = Swal.stopTimer;
                        toast.onmouseleave = Swal.resumeTimer;
                    },
                    willClose: () => {
                        window.location.reload();
                    }
                });

                Toast.fire({
                    icon: "success",
                    title: "Salvo Com Sucesso",
                    background: "#19191a",
                    color: "#e1e1e1",
                });
            });
        }
    })
});
