const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(projectRoot, file), "utf8");

const modalHtml = read("components/modal.html");
const modalCss = read("assets/css/style_modal.css");
const optionCss = read("assets/css/style_option.css");
const optionHtml = read("option.html");
const optionJs = read("option.js");

test("the options page provides a responsive semantic shell", () => {
    assert.match(optionHtml, /^<!DOCTYPE html>\s*<html lang="pt-BR">/i);
    assert.match(optionHtml, /<header class="app-header">/);
    assert.match(optionHtml, /<main class="page-content">/);
    assert.match(optionHtml, /<section class="instructions" aria-labelledby="instructions-title">/);
    assert.match(optionHtml, /<div class="monitoring-list" id="list" aria-live="polite"><\/div>/);
    assert.match(optionCss, /@media \(max-width: 52rem\)/);
    assert.match(optionCss, /@media \(max-width: 42rem\)/);
    assert.match(optionCss, /@media \(max-width: 32rem\)/);
    assert.match(optionCss, /#list:empty::before/);
});

test("modal fields remain labelled and controls remain usable", () => {
    [
        ["group", "group-label"],
        ["input_contact", "contact-field-label"],
        ["input_keyWord", "keyword-field-label"],
        ["input_response", "response-field-label"],
        ["input_date1", null],
        ["input_date2", null],
        ["input_time1", null],
        ["input_time2", null],
    ].forEach(([id, labelId]) => {
        assert.match(modalHtml, new RegExp(`<label[^>]*for="${id}"`));
        assert.match(modalHtml, new RegExp(`<input[^>]*id="${id}"`));
        if (labelId) assert.match(modalHtml, new RegExp(`id="${labelId}"`));
    });

    assert.match(modalCss, /min-height: 3rem/);
    assert.match(modalCss, /grid-template-columns: repeat\(auto-fit, minmax\(min\(100%, 17rem\), 1fr\)\)/);
    assert.doesNotMatch(modalHtml, /style=/i);
});

test("validation stays inside the monitoring modal at desktop heights", () => {
    assert.match(modalCss, /div\.swal2-popup\.monitoring-modal/);
    assert.match(
        modalCss,
        /@media \(min-width: 63rem\) and \(min-height: 48rem\) and \(max-height: 60rem\)/,
    );
    assert.match(modalCss, /\.monitoring-modal div\.swal2-validation-message/);
    assert.doesNotMatch(modalCss, /(^|\n)div\.swal2-popup\s*\{/);
    assert.equal((optionJs.match(/popup: "monitoring-modal"/g) || []).length, 2);
});

test("generated modal list controls are keyboard-accessible", () => {
    [
        "action-remove-contact",
        "action-remove-keyword",
        "action-remove-response",
        "action-remove-date",
        "action-remove-time",
    ].forEach((className) => {
        assert.match(optionJs, new RegExp(`<button class="btnExclude ${className}"`));
        assert.match(optionJs, new RegExp(`\\$\\(document\\)\\.on\\("click", "\\.${className}"`));
    });
    assert.doesNotMatch(optionJs, /id="btnExclude(?:Contact|KeyWord|Response|Date|Time)"/);
});
