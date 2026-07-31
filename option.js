var LIST_NAME = "list";
var MAIN_LIST = [];
var CONTACT_LIST_TEMP = [];
var KEYWORD_LIST_TEMP = [];
var RESPONSE_LIST_TEMP = [];
var DATE_LIST_TEMP = [];
var TIME_LIST_TEMP = [];

//bring the html for the modal
function loadHtmlJQ(path) {
    return $.get(path);
}

//renderize the Main list of cards
function renderizeMainList(list = MAIN_LIST) {
    var html = ``;

    MAIN_LIST = list;
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
                contact_list += ` <div class="col-12 text2 ` + active_border + `"> ` + value + ` </div>`;
            });
        } else {
                contact_list += ` <div class="col-12 text2 offBorder"> Todos os contatos </div>`;
        }


        var keyword_list = ``;
        $.each(value.keyword_list, function (key, value) {
            keyword_list += ` <div class="col-12 text2 ` + active_border + `"> ` + value + ` </div>`;
        });

        var response_list = ``;
        $.each(value.response_list, function (key, value) {
            response_list += ` <div class="col-12 text2 ` + active_border + `"> ` + value + ` </div>`;
        });

        var date_list = ``;
        if (value.date_list.length > 0) {
            $.each(value.date_list, function (key, value) {
                var temp1 = value.date1.split('-');
                var date1 = temp1[2] + "/" + temp1[1] + "/" + temp1[0];
                var temp2 = value.date2.split('-');
                var date2 = temp2[2] + "/" + temp2[1] + "/" + temp2[0];
                date_list += ` <div class="col-12 text2 ` + active_border + `"> ` + date1 + ` - ` + date2 + ` </div>`;
            });
        } else {
            date_list += ` <div class="col-12 text2 offBorder"> Todos as datas </div>`
        }

        var time_list = ``;
        if (value.time_list.length > 0) {
            $.each(value.time_list, function (key, value) {
                time_list += ` <div class="col-12 text2 ` + active_border + `"> ` + value.time1 + ` - ` + value.time2 + `</div>`;
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
                                        ` + value.group_name + `
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
                            ` + value + `
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
                            ` + value + `
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
                            ` + value + `
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
                            ` + date1 + ` - ` + date2 + `
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
                            ` + value.time1 + ` - ` + value.time2 + `
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

    (async () => {
        var html = await loadHtmlJQ(chrome.runtime.getURL("components/modal.html"));
        var new_id = parseInt(id) + 1;

        Swal.fire({
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
                if (id) {
                    $("#swal2-title").text('Editar Registro ' + new_id);
                    $("#group").val(MAIN_LIST[id]["group_name"]);
                    CONTACT_LIST_TEMP = MAIN_LIST[id]["contact_list"];
                    KEYWORD_LIST_TEMP = MAIN_LIST[id]["keyword_list"];
                    RESPONSE_LIST_TEMP = MAIN_LIST[id]["response_list"];
                    DATE_LIST_TEMP = MAIN_LIST[id]["date_list"];
                    TIME_LIST_TEMP = MAIN_LIST[id]["time_list"];
                    active = MAIN_LIST[id]["active"];

                    renderizeList_contact();
                    renderizeList_keyWord();
                    renderizeList_response();
                    renderizeList_date();
                    renderizeList_time();
                }
            },
            preConfirm: () => {
                //msg de erro caso o campo esteja vazio

                return { group };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                var group = $("#group").val();

                var data = {
                    "group_name": group,
                    "active": active,
                    "contact_list": CONTACT_LIST_TEMP,
                    "keyword_list": KEYWORD_LIST_TEMP,
                    "response_list": RESPONSE_LIST_TEMP,
                    "date_list": DATE_LIST_TEMP,
                    "time_list": TIME_LIST_TEMP,
                };

                if (id) {
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

$(document).on("click", "#btnAdd", function () {
    modal();
});

$(document).on("click", "#btnEdit", function () {
    var id = $(this).attr('data-id');
    modal(id);
});

$(document).on("click", "#btn_add_contact", function () {
    var value = $("#input_contact").val();

    if (!value) {
        hiddenText("#hidden_contact", "Digite um texto para incluir na lista");
    } else if (CONTACT_LIST_TEMP.includes(value)) {
        hiddenText("#hidden_contact", "Esse texto já foi incluido");
    } else {
        $("#input_contact").val("");
        CONTACT_LIST_TEMP.push(value);
        renderizeList_contact();
    }
});

$(document).on("click", "#btn_add_keyWord", function () {
    var value = $("#input_keyWord").val();

    if (!value) {
        hiddenText("#hidden_keyWord", "Digite um texto para incluir na lista");
    } else if (KEYWORD_LIST_TEMP.includes(value)) {
        hiddenText("#hidden_keyWord", "Esse texto já foi incluido");
    } else {
        $("#input_keyWord").val("");
        KEYWORD_LIST_TEMP.push(value);
        renderizeList_keyWord();
    }
});

$(document).on("click", "#btn_add_response", function () {
    var value = $("#input_response").val();

    if (!value) {
        hiddenText("#hidden_response", "Digite um texto para incluir na lista");
    } else if (RESPONSE_LIST_TEMP.includes(value)) {
        hiddenText("#hidden_response", "Esse texto já foi incluido");
    } else {
        $("#input_response").val("");
        RESPONSE_LIST_TEMP.push(value);
        renderizeList_response();
    }
});

$(document).on("click", "#btn_add_date", function () {
    var date1 = $("#input_date1").val();
    var date2 = $("#input_date2").val();
    var date = {
        date1, date2
    }

    var value1 = new Date($("#input_date1").val() + 'T12:00:00');
    var value2 = new Date($("#input_date2").val() + 'T12:00:00');

    if (value1 == "Invalid Date" || value2 == "Invalid Date") {
        hiddenText("#hidden_date", "Digite uma data para incluir na lista");
    } else if (value1 >= value2) {
        hiddenText("#hidden_date", "Datas inválidas");
    } else if (DATE_LIST_TEMP.includes(date)) {
        hiddenText("#hidden_date", "Essas datas já foram incluídas");
    } else {

        $("#input_date1").val("");
        $("#input_date2").val("");
        DATE_LIST_TEMP.push(date);
        renderizeList_date();
    }
});

$(document).on("click", "#btn_add_time", function () {
    var time1 = $("#input_time1").val();
    var time2 = $("#input_time2").val();
    var time = {
        time1, time2
    }

    if (!time1 || !time2) {
        hiddenText("#hidden_time", "Digite um horário para incluir na lista");
    } else if (time1 >= time2) {
        hiddenText("#hidden_time", "Horários inválidos");
    } else if (TIME_LIST_TEMP.includes(time)) {
        hiddenText("#hidden_time", "Esses horários já foram incluídos");
    } else {

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

    (async () => {
        var html = await loadHtmlJQ(chrome.runtime.getURL("components/modal.html"));

        Swal.fire({
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
                var group = $("#group").val();

                if (!group) {
                    hiddenText("#hidden_group", "Digite o nome do grupo");
                    $("#group").trigger("focus");
                    return false;
                }

                if ((MAIN_LIST.map(item => (item.group_name))).includes(group)) {
                    hiddenText("#hidden_group", "Nome de grupo já existe na lista");
                    $("#group").trigger("focus");
                    return false;
                }

                // if (CONTACT_LIST_TEMP.length == 0) {
                //     hiddenText("#hidden_contact", "Insira ao menos um Contato");
                //     $("#input_contact").trigger("focus");
                //     return false;
                // }

                if (KEYWORD_LIST_TEMP.length == 0) {
                    hiddenText("#hidden_keyWord", "Insira ao menos uma Palavra-Chave");
                    $("#input_keyWord").trigger("focus");
                    return false;
                }

                if (RESPONSE_LIST_TEMP.length == 0) {
                    hiddenText("#hidden_response", "Insira ao menos uma Resposta");
                    $("#input_response").trigger("focus");
                    return false;
                }

                return { group };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                var group = $("#group").val();

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
