const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const projectRoot = join(__dirname, "..");

function parseVersion(source) {
    const match = source.match(/sweetalert2 v(\d+)\.(\d+)\.(\d+)/i);

    assert.ok(match, "the vendored JavaScript must declare its SweetAlert2 version");
    return match.slice(1).map(Number);
}

function isAtLeast(actual, minimum) {
    return actual.some((part, index) => {
        if (part === minimum[index]) return false;
        return part > minimum[index] && actual.slice(0, index).every((value, key) => value === minimum[key]);
    }) || actual.every((part, index) => part === minimum[index]);
}

test("vendored SweetAlert2 assets come from the same patched major version", () => {
    const script = readFileSync(join(projectRoot, "assets/js/sweetalert2.min.js"), "utf8");
    const stylesheet = readFileSync(join(projectRoot, "assets/css/libs/sweetalert2.min.css"), "utf8");
    const license = readFileSync(join(projectRoot, "assets/licenses/sweetalert2-LICENSE.txt"), "utf8");

    assert.equal(script.includes("sweetalert2 v11.26.25"), true);
    assert.equal(isAtLeast(parseVersion(script), [11, 22, 4]), true);
    assert.match(stylesheet, /--swal2-background:/);
    assert.match(stylesheet, /\.swal2-popup/);
    assert.doesNotMatch(stylesheet, /@import\s+url/i);
    assert.match(license, /MIT License/);
});
