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
    const viewport = optionHtml.match(
        /<meta\b(?=[^>]*\bname\s*=\s*["']viewport["'])[^>]*>/i,
    );
    assert.ok(viewport);

    const viewportContent = viewport[0].match(
        /\bcontent\s*=\s*["']([^"']*)["']/i,
    );
    assert.ok(viewportContent);

    const viewportDirectives = viewportContent[1]
        .split(",")
        .map((directive) => directive.trim().toLowerCase());
    assert.ok(viewportDirectives.includes("width=device-width"));
    assert.ok(viewportDirectives.includes("initial-scale=1"));
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

    ["input_date1", "input_date2", "input_time1", "input_time2"].forEach((id) => {
        assert.match(modalHtml, new RegExp(`<label\\b[^>]*\\bfor=["']${id}["'][^>]*>`, "i"));
    });

    assert.match(modalHtml, /<fieldset\b[^>]*class=["'][^"']*schedule-field[^"']*["'][^>]*>/i);
    assert.match(modalHtml, /<legend>Período por data <span>\(opcional\)<\/span><\/legend>/i);
    assert.match(modalHtml, /<legend>Período por horário <span>\(opcional\)<\/span><\/legend>/i);
});

test("settings actions use semantic buttons", () => {
    function buttonPattern(id) {
        return new RegExp(
            `<button\\b(?=[^>]*\\bid=["']${id}["'])(?=[^>]*\\btype=["']button["'])[^>]*>`,
            "i",
        );
    }

    assert.match(optionHtml, buttonPattern("btnAdd"));
    assert.match(optionHtml, buttonPattern("btnSave"));
    assert.doesNotMatch(optionHtml, /<input[^>]+type="button"/i);

    [
        "btn_add_contact",
        "btn_add_keyWord",
        "btn_add_response",
        "btn_add_date",
        "btn_add_time",
    ].forEach((id) => {
        assert.match(modalHtml, buttonPattern(id));
    });
    assert.doesNotMatch(modalHtml, /<input[^>]+type="button"/i);
});
