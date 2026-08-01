const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "..");
const optionHtml = fs.readFileSync(path.join(projectRoot, "option.html"), "utf8");
const modalHtml = fs.readFileSync(
    path.join(projectRoot, "components", "modal.html"),
    "utf8",
);

test("the settings page uses HTML5 Standards Mode", () => {
    assert.match(optionHtml, /^<!DOCTYPE html>\s*<html lang="pt-BR">/i);
    assert.match(optionHtml, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
    assert.doesNotMatch(optionHtml, /<meta[^>]+http-equiv="X-UA-Compatible"/i);
});

test("all settings scripts stay inside the document and load with defer", () => {
    const closingDocument = optionHtml.match(/<\/body>\s*<\/html>\s*$/i);

    assert.ok(closingDocument);
    assert.match(optionHtml, /<script src="option\.js" defer><\/script>/);

    const scripts = optionHtml.match(/<script\b[^>]*><\/script>/g) || [];
    assert.equal(scripts.length, 5);
    scripts.forEach((script) => assert.match(script, /\sdefer>/));
});

test("settings actions use semantic buttons", () => {
    assert.match(optionHtml, /<button id="btnAdd"[^>]*type="button">/);
    assert.match(optionHtml, /<button id="btnSave"[^>]*type="button">/);
    assert.doesNotMatch(optionHtml, /<input[^>]+type="button"/i);

    [
        "btn_add_contact",
        "btn_add_keyWord",
        "btn_add_response",
        "btn_add_date",
        "btn_add_time",
    ].forEach((id) => {
        assert.match(modalHtml, new RegExp(`<button[^>]+id="${id}"[^>]+type="button">`));
    });
    assert.doesNotMatch(modalHtml, /<input[^>]+type="button"/i);
});
