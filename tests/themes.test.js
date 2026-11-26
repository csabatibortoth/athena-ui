// The text on a status colour must be readable (WCAG AA: 4.5:1) in every theme and mode that ships.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const luminance = hex => {
    const full = hex.length === 4 ? hex.replace(/[0-9a-f]/gi, "$&$&") : hex;
    const [r, g, b] = [1, 3, 5].map(i => parseInt(full.slice(i, i + 2), 16) / 255).map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (high + 0.05) / (low + 0.05);
};

describe("themes", () => {
    for (const file of ["src/res/themes/tokens.css", "src/res/themes/appearance.css", "src/res/themes/dark/style.css", "demo/public/demo.css"]) {
        test(`${file}: every block with status colours has readable text for them`, () => {
            // without the comments: braces in a comment would hide a block from the check (it happened to the light colours)
            const css = readFileSync(new URL(`../${file}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
            let blocks = 0;
            for (const [block] of css.matchAll(/\{[^{}]*\}/g)) {
                const token = name => new RegExp(`--athena-${name}:\\s*(#[0-9a-fA-F]{3,6})\\b`).exec(block)?.[1];
                if (!token("success")) continue;
                blocks++;
                for (const name of ["info", "success", "warning", "danger"]) {
                    assert.ok(token(`${name}-fg`), `${name}-fg is missing in ${block.slice(0, 80)}`);
                    const ratio = contrast(token(name), token(`${name}-fg`));
                    assert.ok(ratio >= 4.5, `${name} ${token(name)} with ${token(`${name}-fg`)}: ${ratio.toFixed(2)}:1`);
                }
            }
            assert.equal(blocks, [...css.matchAll(/--athena-success:/g)].length, "every block that sets the status colours is checked");
        });
    }
});
