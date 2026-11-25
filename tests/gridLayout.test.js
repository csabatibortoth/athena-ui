import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { clampItem, collides, compact, findFreeSpot, normalize, placeItem, rowsOf } from "../src/libs/core/gridLayout.js";

const item = (id, x, y, w, h, extra = {}) => ({ id, x, y, w, h, ...extra });
const overlaps = items => items.some(one => items.some(other => collides(one, other)));

describe("grid layout maths", () => {
    test("collides: only items that share a cell, never an item with itself", () => {
        assert.equal(collides(item("a", 0, 0, 2, 2), item("b", 1, 1, 2, 2)), true);
        assert.equal(collides(item("a", 0, 0, 2, 2), item("b", 2, 0, 2, 2)), false, "touching is not colliding");
        assert.equal(collides(item("a", 0, 0, 2, 2), item("a", 0, 0, 2, 2)), false);
    });

    test("clampItem: inside the columns and the limits, whole numbers", () => {
        assert.deepEqual(clampItem(item("a", 10, -3, 5, 0), 12, { min: { w: 2, h: 2 }, max: { w: 4 } }), item("a", 8, 0, 4, 2));
        assert.deepEqual(clampItem(item("a", 1.6, 2.2, 3.4, 1), 12), item("a", 2, 2, 3, 1));
        assert.deepEqual(clampItem(item("a", NaN, NaN, NaN, NaN), 4), item("a", 0, 0, 1, 1), "garbage becomes a valid item");
        assert.equal(clampItem(item("a", 0, 0, 50, 1), 4).w, 4, "never wider than the grid");
    });

    test("compact: items fall upwards, locked items stay, the argument is not changed", () => {
        const input = [item("a", 0, 5, 2, 2), item("b", 0, 9, 2, 2), item("c", 4, 3, 2, 2, { locked: true })];
        const result = compact(input);
        assert.deepEqual(result.map(entry => [entry.id, entry.y]), [["a", 0], ["b", 2], ["c", 3]]);
        assert.equal(input[0].y, 5);
    });

    test("placeItem: the item goes where it is put, what is in the way is pushed down, and the result has no overlap", () => {
        const items = [item("a", 0, 0, 2, 2), item("b", 2, 0, 2, 2), item("c", 2, 2, 2, 2)];
        const result = placeItem(items, "a", { x: 1 }, 4);
        assert.equal(result.find(entry => entry.id === "a").x, 1);
        assert.equal(result.find(entry => entry.id === "b").y, 2, "b is below a");
        assert.equal(result.find(entry => entry.id === "c").y, 4, "c was pushed by b in turn");
        assert.equal(overlaps(result), false);
        assert.equal(items[0].x, 0, "the argument is not changed");
    });

    test("placeItem: a locked item is not moved, not pushed, and nothing can be put on it", () => {
        const items = [item("a", 0, 0, 2, 2, { locked: true }), item("b", 2, 0, 2, 2)];
        assert.equal(placeItem(items, "a", { x: 1 }, 4), null, "a locked item cannot be placed");
        assert.equal(placeItem(items, "b", { x: 1 }, 4), null, "b cannot land on the locked item");
        assert.equal(placeItem(items, "nobody", { x: 1 }, 4), null);
        const free = placeItem(items, "b", { x: 3 }, 4);
        assert.equal(free.find(entry => entry.id === "b").x, 2, "clamped to the columns (x 2 + w 2 = 4)");
    });

    test("placeItem: limits and the columns are kept; compactItems: false leaves the gaps", () => {
        const items = [item("a", 0, 0, 2, 2)];
        assert.equal(placeItem(items, "a", { w: 9 }, 4, { limits: { max: { w: 3 } } }).at(0).w, 3);
        assert.equal(placeItem(items, "a", { w: 0 }, 4, { limits: { min: { w: 2 } } }).at(0).w, 2);
        assert.equal(placeItem(items, "a", { y: 6 }, 4).at(0).y, 0, "compacted");
        assert.equal(placeItem(items, "a", { y: 6 }, 4, { compactItems: false }).at(0).y, 6, "not compacted");
    });

    test("findFreeSpot: the leftmost place wins, rows grow without end", () => {
        const items = [item("a", 0, 0, 2, 2), item("b", 2, 0, 1, 1)];
        assert.deepEqual(findFreeSpot(items, 1, 1, 4), { x: 0, y: 2 });
        assert.deepEqual(findFreeSpot(items, 2, 1, 4), { x: 0, y: 2 });
        assert.deepEqual(findFreeSpot(items, 4, 1, 4), { x: 0, y: 2 });
        assert.deepEqual(findFreeSpot([], 9, 1, 4), { x: 0, y: 0 }, "wider than the grid: as wide as the grid");
        // A wide widget stays left, where it can still be moved right
        const wide = [item("a", 0, 0, 4, 1)];
        assert.deepEqual(findFreeSpot(wide, 8, 1, 12), { x: 0, y: 1 }, "not x:4 on the first row");
    });

    test("normalize: any list becomes a valid layout (inside, without overlap, compact) in the same order", () => {
        const messy = [item("a", 9, 9, 6, 2), item("b", 0, 0, 3, 3), item("c", 1, 1, 3, 3), item("d", -4, 2, 2, 2)];
        const result = normalize(messy, 4);
        assert.deepEqual(result.map(entry => entry.id), ["a", "b", "c", "d"]);
        assert.equal(overlaps(result), false);
        assert.ok(result.every(entry => entry.x >= 0 && entry.x + entry.w <= 4 && entry.y >= 0));
        assert.equal(result.find(entry => entry.id === "a").w, 4, "wider than the grid: cut to it");
        assert.equal(rowsOf(result), Math.max(...result.map(entry => entry.y + entry.h)));
        assert.equal(rowsOf([]), 0);
    });
});
