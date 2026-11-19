import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildStylingDocs } from "../scripts/styling-docs.mjs";

test("docs/styling.md is up to date (run `npm run docs`)", () => {
    const written = readFileSync(new URL("../docs/styling.md", import.meta.url), "utf8").replace(/\r\n/g, "\n");
    assert.equal(written, buildStylingDocs());
});
