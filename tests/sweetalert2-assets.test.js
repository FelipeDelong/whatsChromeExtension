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

test("vendored SweetAlert2 artifacts match release 11.26.25", () => {
    const script = readFileSync(join(projectRoot, "assets/js/sweetalert2.min.js"), "utf8");
    const stylesheet = readFileSync(join(projectRoot, "assets/css/libs/sweetalert2.min.css"), "utf8");
    const license = readFileSync(join(projectRoot, "assets/licenses/sweetalert2-LICENSE.txt"), "utf8");

    assert.deepEqual(parseVersion(script), [11, 26, 25]);
    assert.match(stylesheet, /\[data-swal2-theme=dark\]/);
    assert.match(stylesheet, /--swal2-dark-theme-black:/);
    assert.match(stylesheet, /\.swal2-popup/);
    assert.doesNotMatch(stylesheet, /@import\s+url/i);
    assert.match(license, /MIT License/);
});
