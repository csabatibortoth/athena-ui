import { test } from "node:test";
import assert from "node:assert/strict";
import { clamp, columnAt, focusStep, indexAt, scrollSpeed, stepOf } from "../src/libs/core/boardLayout.js";

const columns = [{ left: 0, right: 100 }, { left: 110, right: 210 }, { left: 220, right: 320 }];

test("columnAt: the column that contains the position, else the nearest, -1 without columns", () => {
    assert.equal(columnAt(columns, 50), 0); assert.equal(columnAt(columns, 150), 1); assert.equal(columnAt(columns, 300), 2);
    assert.equal(columnAt(columns, 104), 0, "in the gap: the nearer one"); assert.equal(columnAt(columns, 106), 1);
    assert.equal(columnAt(columns, -500), 0); assert.equal(columnAt(columns, 9999), 2);
    assert.equal(columnAt([], 10), -1);
});

test("indexAt: before the first card whose middle is below the pointer, else at the end", () => {
    const cards = [{ top: 0, bottom: 40 }, { top: 50, bottom: 90 }, { top: 100, bottom: 140 }];
    assert.equal(indexAt(cards, -10), 0); assert.equal(indexAt(cards, 19), 0); assert.equal(indexAt(cards, 21), 1); assert.equal(indexAt(cards, 69), 1);
    assert.equal(indexAt(cards, 71), 2); assert.equal(indexAt(cards, 121), 3); assert.equal(indexAt(cards, 9999), 3);
    assert.equal(indexAt([], 50), 0, "an empty column: the first place");
});

test("stepOf: the keyboard moves a picked-up card within a column and between columns; the index stays inside; blocked moves are null", () => {
    const lengths = [3, 0, 2];            // the columns without the card that is moved
    assert.deepEqual(stepOf({ column: 0, index: 1 }, "ArrowUp", lengths), { column: 0, index: 0 });
    assert.equal(stepOf({ column: 0, index: 0 }, "ArrowUp", lengths), null);
    assert.deepEqual(stepOf({ column: 0, index: 2 }, "ArrowDown", lengths), { column: 0, index: 3 }, "to the end");
    assert.equal(stepOf({ column: 0, index: 3 }, "ArrowDown", lengths), null, "already at the end");
    assert.deepEqual(stepOf({ column: 0, index: 2 }, "ArrowRight", lengths), { column: 1, index: 0 }, "into an empty column");
    assert.deepEqual(stepOf({ column: 1, index: 0 }, "ArrowRight", lengths), { column: 2, index: 0 });
    assert.deepEqual(stepOf({ column: 0, index: 3 }, "ArrowRight", [3, 5]), { column: 1, index: 3 });
    assert.deepEqual(stepOf({ column: 2, index: 2 }, "ArrowLeft", [3, 1, 2]), { column: 1, index: 1 }, "the index is cut to the length");
    assert.equal(stepOf({ column: 0, index: 0 }, "ArrowLeft", lengths), null); assert.equal(stepOf({ column: 2, index: 0 }, "ArrowRight", lengths), null);
    assert.deepEqual(stepOf({ column: 0, index: 2 }, "Home", lengths), { column: 0, index: 0 }); assert.equal(stepOf({ column: 0, index: 0 }, "Home", lengths), null);
    assert.deepEqual(stepOf({ column: 0, index: 0 }, "End", lengths), { column: 0, index: 3 }); assert.equal(stepOf({ column: 0, index: 3 }, "End", lengths), null);
    assert.equal(stepOf({ column: 0, index: 0 }, "x", lengths), null); assert.equal(stepOf({ column: 0, index: 0 }, "Enter", lengths), null);
});

test("focusStep: up and down in a column, left and right to the next column that has cards, Home and End; null when there is nowhere to go", () => {
    const lengths = [3, 0, 2];
    assert.deepEqual(focusStep({ column: 0, index: 0 }, "ArrowDown", lengths), { column: 0, index: 1 }); assert.equal(focusStep({ column: 0, index: 2 }, "ArrowDown", lengths), null);
    assert.equal(focusStep({ column: 0, index: 0 }, "ArrowUp", lengths), null); assert.deepEqual(focusStep({ column: 0, index: 2 }, "ArrowUp", lengths), { column: 0, index: 1 });
    assert.deepEqual(focusStep({ column: 0, index: 2 }, "ArrowRight", lengths), { column: 2, index: 1 }, "skips the empty column, the same height as far as there is one");
    assert.deepEqual(focusStep({ column: 2, index: 0 }, "ArrowLeft", lengths), { column: 0, index: 0 });
    assert.equal(focusStep({ column: 2, index: 0 }, "ArrowRight", lengths), null); assert.equal(focusStep({ column: 0, index: 0 }, "ArrowLeft", lengths), null);
    assert.deepEqual(focusStep({ column: 0, index: 1 }, "End", lengths), { column: 0, index: 2 }); assert.deepEqual(focusStep({ column: 0, index: 1 }, "Home", lengths), { column: 0, index: 0 });
    assert.equal(focusStep({ column: 0, index: 2 }, "End", lengths), null); assert.equal(focusStep({ column: 0, index: 0 }, "Home", lengths), null);
});

test("scrollSpeed: zero in the middle, faster the nearer the edge, negative at the start, zero in a box that is too small", () => {
    assert.equal(scrollSpeed(500, 0, 1000), 0);
    assert.equal(scrollSpeed(1000, 0, 1000), 18); assert.equal(scrollSpeed(0, 0, 1000), -18);
    assert.ok(scrollSpeed(980, 0, 1000) > 0 && scrollSpeed(980, 0, 1000) < 18); assert.ok(scrollSpeed(990, 0, 1000) > scrollSpeed(960, 0, 1000));
    assert.ok(scrollSpeed(20, 0, 1000) < 0); assert.equal(scrollSpeed(1500, 0, 1000), 18, "outside: the fastest");
    assert.equal(scrollSpeed(50, 0, 100), 0, "too small to have a middle");
    assert.equal(scrollSpeed(10, 0, 1000, { edge: 20, max: 5 }), -3);
    assert.equal(clamp(5, 0, 3), 3); assert.equal(clamp(-1, 0, 3), 0); assert.equal(clamp(2, 0, 3), 2);
});
