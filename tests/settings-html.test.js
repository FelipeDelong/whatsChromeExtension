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
    assert.match(optionHtml, /^<!DOCTYPE html>\s*<html\b[^>]*\blang=["']pt-BR["'][^>]*>/i);
    assert.match(optionHtml, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
    assert.doesNotMatch(optionHtml, /<meta[^>]+http-equiv="X-UA-Compatible"/i);
});

test("all settings scripts stay inside the document and load with defer", () => {
    const closingDocument = optionHtml.match(/<\/body>\s*<\/html>\s*$/i);

    assert.ok(closingDocument);

    const scripts = optionHtml.match(/<script\b(?=[^>]*\bsrc\s*=)[^>]*>\s*<\/script>/gi) || [];
    assert.ok(scripts.length > 0);
    assert.ok(scripts.some((script) => /\bsrc\s*=\s*["']option\.js["']/i.test(script)));
    scripts.forEach((script) => assert.match(script, /\bdefer\b/i));
});

test("settings fields have accessible labels", () => {
    assert.match(modalHtml, /<label\b[^>]*\bfor=["']group["'][^>]*>/i);

    [
        ["input_date1", "Data inicial"],
        ["input_date2", "Data final"],
        ["input_time1", "Horário inicial"],
        ["input_time2", "Horário final"],
    ].forEach(([id, label]) => {
        const input = new RegExp(
            `<input\\b(?=[^>]*\\bid=["']${id}["'])(?=[^>]*\\baria-label=["']${label}["'])[^>]*>`,
            "i",
        );
        assert.match(modalHtml, input);
    });

    ["date_range_label", "time_range_label"].forEach((labelId) => {
        const group = new RegExp(
            `<div\\b(?=[^>]*\\brole=["']group["'])(?=[^>]*\\baria-labelledby=["']${labelId}["'])[^>]*>`,
            "i",
        );
        assert.match(modalHtml, group);
    });
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
