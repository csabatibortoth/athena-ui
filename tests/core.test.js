import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

import { toCsv } from "../src/libs/core/csv.js";
import { formatBytes, matchesAccept } from "../src/libs/core/format.js";
import { addMessages, setLocale, translate } from "../src/libs/core/i18n.js";
import { pageRange } from "../src/libs/core/pagination.js";
import { validateAll, validateValue } from "../src/libs/core/validation.js";
import { matchRoute, normalizePath, parseQuery } from "../src/libs/hephaestus/router/matchRoute.js";

afterEach(() => setLocale("en"));

describe("validateValue", () => {
    test("required", () => {
        assert.equal(validateValue("", { required: true }), "This field is required.");
        assert.equal(validateValue([], { required: true }), "This field is required.");
        assert.equal(validateValue(false, { required: true }), "This field is required.");
        assert.equal(validateValue("x", { required: true }), "");
    });

    test("optional empty values skip every other rule", () => {
        assert.equal(validateValue("", { email: true, minLength: 5 }), "");
    });

    test("email, length, pattern", () => {
        assert.match(validateValue("nope", { email: true }), /valid email/);
        assert.equal(validateValue("a@b.co", { email: true }), "");
        assert.match(validateValue("ab", { minLength: 3 }), /at least 3/);
        assert.match(validateValue("abcd", { maxLength: 3 }), /at most 3/);
        assert.match(validateValue("abc", { pattern: "^\\d+$" }), /invalid format/);
        assert.equal(validateValue("123", { pattern: /^\d+$/ }), "");
    });

    test("numeric range", () => {
        assert.match(validateValue(5, { min: 10 }), /at least 10/);
        assert.match(validateValue(50, { max: 10 }), /at most 10/);
        assert.equal(validateValue(0, { min: 0, max: 10 }), "");
    });

    test("match and custom rules", () => {
        assert.match(validateValue("a", { match: "other" }, { other: "b" }), /do not match/);
        assert.equal(validateValue("a", { match: "other" }, { other: "a" }), "");
        assert.equal(validateValue("a", { validate: () => "Custom" }), "Custom");
        assert.equal(validateValue("a", { validate: () => false }), "The value is invalid.");
        assert.equal(validateValue("a", { validate: () => true }), "");
    });

    test("validateAll returns only the invalid fields", () => {
        const errors = validateAll({ a: { required: true }, b: { required: true } }, { a: "x", b: "" });
        assert.deepEqual(Object.keys(errors), ["b"]);
    });
});

describe("translate", () => {
    test("falls back to English, then to the key", () => {
        setLocale("hu");
        assert.equal(translate("login"), "Belépés");
        addMessages("de", { login: "Anmelden" });
        setLocale("de");
        assert.equal(translate("login"), "Anmelden");
        assert.equal(translate("register"), "Register");
        assert.equal(translate("no.such.key"), "no.such.key");
    });

    test("uses the base language of a regional locale", () => {
        setLocale("hu-HU");
        assert.equal(translate("cancel"), "Mégse");
    });

    test("replaces placeholders", () => {
        assert.equal(translate("page", { page: 2, pages: 5 }), "Page 2 / 5");
        assert.equal(translate("validation.minLength"), "Enter at least {min} characters.");
    });

    test("validation messages follow the locale", () => {
        setLocale("hu");
        assert.equal(validateValue("", { required: true }), "A mező kitöltése kötelező.");
    });
});

describe("matchRoute", () => {
    test("static and param routes", () => {
        assert.deepEqual(matchRoute("/", "/"), {});
        assert.deepEqual(matchRoute("/users", "/users/"), {});
        assert.deepEqual(matchRoute("/users/:id", "/users/42"), { id: "42" });
        assert.deepEqual(matchRoute("/users/:id", "/users/a%20b"), { id: "a b" });
        assert.equal(matchRoute("/users/:id", "/users"), null);
        assert.equal(matchRoute("/users", "/users/1"), null);
        assert.equal(matchRoute("/users/:id", "/groups/1"), null);
    });

    test("wildcard captures the rest", () => {
        assert.deepEqual(matchRoute("/files/*", "/files/a/b"), { rest: "a/b" });
        assert.deepEqual(matchRoute("/files/*", "/files"), { rest: "" });
    });

    test("malformed escape does not throw", () => {
        assert.equal(matchRoute("/u/:id", "/u/%E0%A4%A"), null);
    });

    test("normalizePath and parseQuery", () => {
        assert.equal(normalizePath("users//1/?x=1#top"), "/users/1");
        assert.equal(normalizePath(""), "/");
        assert.deepEqual(parseQuery("a=1&b=two"), { a: "1", b: "two" });
    });
});

describe("pageRange", () => {
    test("collapses long ranges", () => {
        assert.deepEqual(pageRange(5, 10, 1), [1, "…", 4, 5, 6, "…", 10]);
        assert.deepEqual(pageRange(1, 10, 1), [1, 2, "…", 10]);
        assert.deepEqual(pageRange(10, 10, 1), [1, "…", 9, 10]);
    });

    test("does not hide a single page behind a gap", () => {
        assert.deepEqual(pageRange(4, 7, 1), [1, 2, 3, 4, 5, 6, 7]);
    });

    test("one page", () => {
        assert.deepEqual(pageRange(1, 1, 1), [1]);
    });
});

describe("toCsv", () => {
    const columns = [{ key: "name", label: "Name" }, { key: "note" }];

    test("quotes separators, quotes and line breaks", () => {
        const csv = toCsv(columns, [{ name: "A, B", note: 'say "hi"' }, { name: "x", note: "l1\nl2" }]);
        assert.equal(csv, 'Name,note\r\n"A, B","say ""hi"""\r\nx,"l1\nl2"');
    });

    test("neutralizes spreadsheet formulas, keeps negative numbers", () => {
        const csv = toCsv(columns, [{ name: "=SUM(A1)", note: -5 }, { name: "@x", note: "-3" }]);
        assert.equal(csv, "Name,note\r\n'=SUM(A1),-5\r\n'@x,-3");
    });

    test("missing values and a custom separator", () => {
        assert.equal(toCsv(columns, [{ name: "a" }], ";"), "Name;note\r\na;");
    });
});

describe("format", () => {
    test("formatBytes", () => {
        assert.equal(formatBytes(0), "0 B");
        assert.equal(formatBytes(1536), "1.5 KB");
        assert.equal(formatBytes(5 * 1024 * 1024), "5 MB");
        assert.equal(formatBytes(-1), "");
    });

    test("matchesAccept", () => {
        const png = { name: "A.PNG", type: "image/png" };
        const pdf = { name: "doc.pdf", type: "application/pdf" };
        assert.equal(matchesAccept(png, ""), true);
        assert.equal(matchesAccept(png, ".png"), true);
        assert.equal(matchesAccept(png, "image/*"), true);
        assert.equal(matchesAccept(pdf, "image/*,.png"), false);
        assert.equal(matchesAccept(pdf, "application/pdf"), true);
    });
});
