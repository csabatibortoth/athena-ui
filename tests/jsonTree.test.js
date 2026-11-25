import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { MAX_CHILDREN, MAX_DEPTH, MAX_NODES, MAX_TEXT, parseJson, pathOf, valueText } from "../src/libs/core/jsonTree.js";

describe("json tree helpers", () => {
    test("parseJson takes an object or an array, also with spaces around it, and nothing else", () => {
        assert.deepEqual(parseJson(' {"a":1} '), { a: 1 });
        assert.deepEqual(parseJson("[1,2]"), [1, 2]);
        for (const text of ["", "42", '"x"', "null", "{broken", '{"a":1} trailing', "plain text", undefined, null]) {
            assert.equal(parseJson(text), null, String(text));
        }
    });

    test("pathOf writes the path as a programmer would", () => {
        assert.equal(pathOf(["req", "id"]), "req.id");
        assert.equal(pathOf(["items", 2, "name"]), "items[2].name");
        assert.equal(pathOf(["headers", "x-request-id"]), 'headers["x-request-id"]');
        assert.equal(pathOf([0, "a"]), "[0].a");
        assert.equal(pathOf([]), "");
    });

    test("valueText: a string as it is, the rest as JSON", () => {
        assert.equal(valueText("hello"), "hello");
        assert.equal(valueText(42), "42");
        assert.equal(valueText(null), "null");
        assert.equal(valueText({ a: 1 }), '{\n  "a": 1\n}');
    });

    test("the limits are the documented defaults", () => {
        assert.deepEqual([MAX_DEPTH, MAX_CHILDREN, MAX_TEXT, MAX_NODES], [12, 200, 1000, 5000]);
    });
});
