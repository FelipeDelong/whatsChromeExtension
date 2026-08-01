import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const optionHtml = await readFile(new URL("../option.html", import.meta.url), "utf8");
const modalHtml = await readFile(new URL("../components/modal.html", import.meta.url), "utf8");

test("instructions clearly describe the configuration fields", () => {
    assert.match(optionHtml, /Como configurar o monitoramento\?/);
    assert.match(optionHtml, /Grupo ou contato:/);
    assert.match(optionHtml, /Contatos \(opcional\):/);
    assert.match(optionHtml, /Se a lista ficar vazia, todos os contatos/);
    assert.match(optionHtml, /Períodos \(opcional\):/);
});

test("obsolete wording and misleading claims do not return", () => {
    const removedText = [
        "utlizado",
        "copair",
        "extenção",
        "tambem",
        "detecção de bots",
        "disfarçar o uso",
    ];

    for (const text of removedText) {
        assert.doesNotMatch(optionHtml, new RegExp(text, "i"));
    }
});

test("contact field is marked as optional", () => {
    assert.match(modalHtml, /<label>Contato \(opcional\):<\/label>/);
    assert.match(modalHtml, /Grupo ou contato:/);
    assert.doesNotMatch(modalHtml, /Contanto/);
});
