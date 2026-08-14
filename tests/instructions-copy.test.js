const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "..");
const optionHtml = readFileSync(path.join(projectRoot, "option.html"), "utf8");
const modalHtml = readFileSync(path.join(projectRoot, "components", "modal.html"), "utf8");

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
    assert.match(modalHtml, /<label\b[^>]*>Contato \(opcional\):<\/label>/);
    assert.match(modalHtml, /Grupo ou contato:/);
    assert.doesNotMatch(modalHtml, /Contanto/);
});
