import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

import { toCsv } from "../src/libs/core/csv.js";
import { formatBytes, matchesAccept } from "../src/libs/core/format.js";
import { addMessages, setLocale, translate } from "../src/libs/core/i18n.js";
import { pageRange } from "../src/libs/core/pagination.js";
import { isSafeUrl } from "../src/libs/core/sanitize.js";
import { clampWidth, expandedWindow, virtualWindow } from "../src/libs/core/tableMath.js";
import { validateAll, validateDateRange, validateValue } from "../src/libs/core/validation.js";
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

describe("virtualWindow", () => {
    const base = { viewportHeight: 100, rowHeight: 20, overscan: 2 };

    test("window at the top", () => {
        assert.deepEqual(virtualWindow({ ...base, scrollTop: 0, total: 1000 }), { start: 0, end: 7, offsetTop: 0, offsetBottom: 993 * 20 });
    });

    test("window in the middle keeps the total height", () => {
        const w = virtualWindow({ ...base, scrollTop: 2000, total: 1000 });
        assert.equal(w.start, 98);
        assert.equal(w.end, 107);
        assert.equal(w.offsetTop + (w.end - w.start) * 20 + w.offsetBottom, 1000 * 20);
    });

    test("window at the bottom does not run past the end", () => {
        const w = virtualWindow({ ...base, scrollTop: 100000, total: 1000 });
        assert.equal(w.end, 1000);
        assert.equal(w.offsetBottom, 0);
        assert.ok(w.start < w.end);
    });

    test("empty and short lists", () => {
        assert.deepEqual(virtualWindow({ ...base, scrollTop: 0, total: 0 }), { start: 0, end: 0, offsetTop: 0, offsetBottom: 0 });
        assert.deepEqual(virtualWindow({ ...base, scrollTop: 0, total: 3 }), { start: 0, end: 3, offsetTop: 0, offsetBottom: 0 });
    });

    test("negative scroll (elastic scrolling) is treated as the top", () => {
        assert.equal(virtualWindow({ ...base, scrollTop: -50, total: 100 }).start, 0);
    });

    test("expandedWindow: open detail rows move the window with the scroll position", () => {
        const extras = { 0: 200, 1: 200, 2: 200, 3: 200, 4: 200, 5: 200 };
        const options = { scrollTop: 4200, viewportHeight: 120, rowHeight: 30, total: 1000, overscan: 5 };
        assert.deepEqual(expandedWindow(options), virtualWindow(options), "without details it is the plain window");
        assert.deepEqual(expandedWindow({ ...options, extras }), { start: 95, end: 109, offsetTop: 4050, offsetBottom: 26730 });
        // The plain window at that scroll offset would show rows 135..149; the details above it move the view to 100..
        assert.equal(virtualWindow(options).start + 40, 175, "the old maths does not know about the details");
        const deep = expandedWindow({ ...options, scrollTop: 6000, extras });
        assert.equal(deep.start, 155, "scrolling past the details still follows the real content");
        assert.equal(expandedWindow({ ...options, extras: {} }).start, virtualWindow(options).start, "without details it is the plain window");
    });

    test("clampWidth", () => {
        assert.equal(clampWidth(10), 40);
        assert.equal(clampWidth(99.6), 100);
        assert.equal(clampWidth(5000), 1200);
        assert.equal(clampWidth(30, 50, 40), 50);
    });
});

describe("validateDateRange", () => {
    test("order", () => {
        assert.equal(validateDateRange("2026-01-01", "2026-01-31"), "");
        assert.equal(validateDateRange("2026-01-01", "2026-01-01"), "");
        assert.match(validateDateRange("2026-02-01", "2026-01-31"), /must not be before/);
    });

    test("empty dates are not an error", () => {
        assert.equal(validateDateRange("", ""), "");
        assert.equal(validateDateRange("2026-01-01", ""), "");
    });

    test("limits", () => {
        assert.match(validateDateRange("2025-12-31", "2026-01-05", { min: "2026-01-01" }), /2026-01-01 or later/);
        assert.match(validateDateRange("2026-01-01", "2026-03-05", { max: "2026-02-01" }), /2026-02-01 or earlier/);
    });
});

describe("isSafeUrl", () => {
    test("accepts web, mail, phone and relative links", () => {
        for (const url of ["https://a.com", "HTTP://a.com", "mailto:a@b.co", "tel:+3612345", "#top", "/path", "./a", "../a"]) {
            assert.equal(isSafeUrl(url), true, url);
        }
    });

    test("rejects script and data URLs, also when disguised", () => {
        for (const url of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", " javascript:alert(1)", "java\tscript:alert(1)", "java\nscript:alert(1)", "data:text/html,x", "vbscript:x", "//evil.com", "", null]) {
            assert.equal(isSafeUrl(url), false, String(url));
        }
    });

    // Browsers read a backslash in an http(s) URL as a slash, so "/\\evil.com" is "//evil.com": another site, not a path of this one.
    test("rejects links that a browser reads as protocol-relative, with a backslash or hidden characters", () => {
        for (const url of ["/\\evil.com", "/\\evil.com/x", "/\\\\evil.com", "/\t/evil.com", "/\n/evil.com", "\\\\evil.com"]) {
            assert.equal(isSafeUrl(url), false, JSON.stringify(url));
            // and the standard URL parser agrees that these leave the origin (so this is not a guess about browsers)
            if (url.startsWith("/") || url.startsWith("\\")) assert.notEqual(new URL(url, "https://app.example").origin, "https://app.example", JSON.stringify(url));
        }
    });

    test("still accepts the plain paths that look similar", () => {
        for (const url of ["/a/b", "/a\\b", "/%5Cevil", "/path?x=/\\y", "/#/route", "./a/b", "../a/b", "https:evil", "https:/evil", "HtTpS://example.test", "a/b"]) {
            // "a/b" has no scheme and no slash in front: it is not in the allow-list (an anchor target is "#...", a path "/...")
            assert.equal(isSafeUrl(url), url !== "a/b", JSON.stringify(url));
        }
    });

    test("rejects whitespace-obfuscated backslash paths and mixed-case script schemes", () => {
        for (const url of ["/ \\evil.com", "/\\ evil.com", "JaVaScRiPt:alert(1)", " jAvAsCrIpT:alert(1)"]) {
            assert.equal(isSafeUrl(url), false, JSON.stringify(url));
        }
    });
});

describe("translate: plural forms and Intl formats", () => {
    test("chooses the form by count, with the rules of the language", () => {
        setLocale("en");
        assert.equal(translate("validation.minLength", { min: 1, count: 1 }), "Enter at least 1 character.");
        assert.equal(translate("validation.minLength", { min: 8, count: 8 }), "Enter at least 8 characters.");
        addMessages("en", { files: { 0: "No files", one: "{count} file", other: "{count:number} files" } });
        assert.equal(translate("files", { count: 0 }), "No files");
        assert.equal(translate("files", { count: 1 }), "1 file");
        assert.equal(translate("files", { count: 1200 }), "1,200 files");
        // a language with more forms
        addMessages("pl", { files: { one: "{count} plik", few: "{count} pliki", many: "{count} plików", other: "{count} pliku" } });
        setLocale("pl");
        assert.equal(translate("files", { count: 1 }), "1 plik");
        assert.equal(translate("files", { count: 3 }), "3 pliki");
        assert.equal(translate("files", { count: 5 }), "5 plików");
        setLocale("en");
    });

    test("formats numbers and dates in the current language", () => {
        addMessages("en", { price: "Total {sum:number}, until {day:date}" });
        const day = new Date(Date.UTC(2026, 10, 19, 12));
        setLocale("en");
        assert.equal(translate("price", { sum: 123456.5, day }), "Total 123,456.5, until Nov 19, 2026");
        setLocale("hu");
        assert.match(translate("price", { sum: 123456.5, day }), /123\s456,5/);
        setLocale("en");
    });

    test("a plural message without a count uses 'other'; a missing param stays", () => {
        setLocale("en");
        assert.equal(translate("files"), "{count:number} files");
        assert.equal(translate("page", { page: 1 }), "Page 1 / {pages}");
    });
});
