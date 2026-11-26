import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import { diffLines, hunksOf, splitLines } from "../src/libs/core/codeDiff.js";
import { TOKEN_TYPES, getLanguage, getLanguages, registerLanguage, tokenize } from "../src/libs/core/codeLanguages.js";

const types = (text, language) => tokenize(text, language).filter(token => token.type).map(token => `${token.type}:${token.text}`);

describe("code tokenizer", () => {
    test("every language gives the text back, whatever the text is", () => {
        const samples = ["", "\n", "plain words", "const a = 'x' // c\n/* block */ `t${1}`", '{"a":[1,2,{"b":null}]}', "<a href=x>t</a><!-- c -->", "a { b: c; }", "SELECT 1 -- c", "echo $HOME # c",
            "a: 1\n- b", "class A { }", "def f():\n  pass", "\"unclosed", "'unclosed", "/* unclosed", "`unclosed", "<unclosed", "\u0000\u0001 weird 😀 text"];
        for (const name of getLanguages()) {
            for (const sample of samples) {
                assert.equal(tokenize(sample, name).map(token => token.text).join(""), sample, `${name}: ${JSON.stringify(sample)}`);
            }
        }
    });

    test("template strings: code inside ${} is code, at any depth", () => {
        const source = "const a = `x ${ f(`y ${1 + 2} {`, '}') } z`; // end";
        assert.equal(tokenize(source, "js").map(token => token.text).join(""), source);
        const found = types(source, "js");
        for (const expected of ["function:f", "number:1", "number:2", "string:'}'", "comment:// end"]) assert.ok(found.includes(expected), `${expected} in ${found}`);
        assert.deepEqual(types("`plain`", "js"), ["string:`plain`"]);
        for (const broken of ["`a ${ b", "`a ${ `", "`${".repeat(200), "`a \\", "`${ /* }"]) assert.equal(tokenize(broken, "js").map(token => token.text).join(""), broken, broken);
    });

    test("template strings: a regular expression inside ${} does not swallow what follows", () => {
        for (const first of ["const a = `${s.replace(/'/g, '')}`;", "const a = `${s.split(/\\//)}`;", "const a = `${s.replace(/\\{/g, \"\")}`;", "const a = `${s.replace(/`/g, \"\")}`;", "const a = `${/[/\"]/.test(s)}`;", "const a = `${x / 2} ${y / 3}`;"]) {
            const found = types(`${first}\nconst next = 1; // after`, "js");
            assert.ok(found.includes("comment:// after") && found.includes("number:1"), `${first}: ${found}`);
        }
    });

    test("html: script and style have their own colours, other script types stay plain", () => {
        const source = "<SCRIPT>const a = '</p>';</SCRIPT><style>a { color: red; }</style><script type=\"text/x-template\">const b</script><p>const</p>";
        assert.equal(tokenize(source, "html").map(token => token.text).join(""), source);
        const found = types(source, "html");
        assert.ok(found.includes("keyword:const") && found.includes("string:'</p>'") && found.includes("property:color"), String(found));
        assert.equal(found.filter(entry => entry === "keyword:const").length, 1, "not in the template, not in the paragraph");
        assert.ok(types("<script>\nlet x", "html").includes("keyword:let"), "while it is typed");
        const spans = [];
        tokenize("<p>\n<script>\n1\n</script>", "html", spans);
        assert.deepEqual(spans.filter(span => span.nested).map(span => [span.start, span.end]), [[4, 24]]);
    });

    test("the languages and their aliases are there", () => {
        for (const name of ["javascript", "typescript", "json", "html", "css", "sql", "shell", "yaml", "csharp", "python", "log"]) assert.ok(getLanguage(name), name);
        for (const [alias, name] of [["js", "javascript"], ["ts", "typescript"], ["sh", "shell"], ["bash", "shell"], ["yml", "yaml"], ["c#", "csharp"], ["cs", "csharp"], ["py", "python"], ["JS", "javascript"], ["xml", "html"]]) {
            assert.equal(getLanguage(alias)?.name, name, alias);
        }
        assert.equal(getLanguage("nonsense"), undefined);
    });

    test("log lines: times, addresses, ids, urls, sizes, levels, frames and quoted requests", () => {
        assert.deepEqual(types("2026-11-23T08:06:05.405Z host sshd[12]: from 192.168.2.190:45451 port", "log"),
            ["number:2026-11-23T08:06:05.405Z", "number:192.168.2.190:45451"]);
        assert.deepEqual(types("Nov 18 14:39:23 myhost node: ok", "log"), ["number:Nov 18 14:39:23"]);
        assert.deepEqual(types("peer 2001:db8::1 and fe80::1ff:fe23:4567:890a", "log"), ["number:2001:db8::1", "number:fe80::1ff:fe23:4567:890a"]);
        assert.deepEqual(types("id 3f2b8c1e-9a4d-4e7f-b1c2-0d5e6f7a8b9c end", "log"), ["variable:3f2b8c1e-9a4d-4e7f-b1c2-0d5e6f7a8b9c"]);
        assert.deepEqual(types("see https://example.com/a/b?x=1, then mail me@example.org.", "log"),
            ["string:https://example.com/a/b?x=1", "string:me@example.org"]);
        assert.deepEqual(types("took 120ms and 4kB, 12.5% used", "log"), ["number:120ms", "number:4kB", "number:12.5%"]);
        assert.deepEqual(types("user=bob retries=3", "log"), ["property:user=", "property:retries="]);
        assert.deepEqual(types('"GET /a/b HTTP/1.1" 502 17', "log"),
            ["string:\"", "keyword:GET", "string: ", "property:/a/b", 'string: HTTP/1.1"', "number:502"]);
        assert.deepEqual(types("[ERROR] disk WARN INFO debug", "log"), ["keyword:ERROR", "keyword:WARN", "keyword:INFO"]);
        assert.deepEqual(types("at Foo.bar (/app/src/server.js:12:3)", "log"), ["property:/app/src/server.js:12:3"]);
        assert.deepEqual(types("at 10:15:32 done", "log"), ["number:10:15:32"]);
        assert.deepEqual(types("[25/Nov/2026:10:11:12 +0000] GET /a 200", "log"),
            ["number:25/Nov/2026:10:11:12 +0000", "keyword:GET", "number:200"], "the nginx / Apache time form");
    });

    test("log lines: what looks like a part but is not stays plain", () => {
        for (const line of ["version 999.1.1.1 and 1.2.3", "ratio 1:2:3 and 12:34", "a 2026/11/23 date", "error warning info plain words"]) {
            assert.deepEqual(tokenize(line, "log").filter(token => token.type).map(token => token.text), [], line);
        }
    });

    test("log lines: random input gives every character back", () => {
        const chars = "abcXYZ019:./@-_[]\"= µµ";
        for (let i = 0; i < 200; i++) {
            let line = "";
            for (let j = 0; j < (i * 37) % 120; j++) line += chars[(i * j + j * j) % chars.length];
            assert.equal(tokenize(line, "log").map(token => token.text).join(""), line, JSON.stringify(line));
        }
    });

    test("an unknown language, or no text, is not an error", () => {
        assert.deepEqual(tokenize("x = 1", "nonsense"), [{ type: null, text: "x = 1" }]);
        assert.deepEqual(tokenize("", "js"), []);
        assert.deepEqual(tokenize(null, "js"), []);
    });

    test("javascript: keywords, strings, comments, numbers, regular expressions, functions", () => {
        assert.deepEqual(types("const a = 1.5e3; // hi", "js"), ["keyword:const", "operator:=", "number:1.5e3", "punctuation:;", "comment:// hi"]);
        assert.ok(types('foo("x\\"y")', "js").includes('string:"x\\"y"'), "an escaped quote stays inside the string");
        assert.ok(types("x = /ab+c/g", "js").includes("string:/ab+c/g"), "a regular expression after =");
        assert.deepEqual(types("a / b / c", "js"), ["operator:/", "operator:/"], "division is not a regular expression");
        assert.deepEqual(types("`a ${b} c`", "js"), ["string:`a ", "punctuation:${", "punctuation:}", "string: c`"], "the code inside ${} is not a string");
        assert.ok(types("foo(1)", "js").includes("function:foo"));
        assert.ok(types("/* a\nb */ x", "js").includes("comment:/* a\nb */"), "a block comment spans lines");
    });

    test("typescript has the types, json tells keys from strings, yaml tells keys from values", () => {
        assert.ok(types("interface A { x: string }", "ts").includes("keyword:interface"));
        assert.ok(types("let x: string", "ts").includes("type:string"));
        assert.deepEqual(types('{"a": "b"}', "json").filter(item => /^(property|string)/.test(item)), ['property:"a"', 'string:"b"']);
        assert.deepEqual(types("name: x # c\nok: true", "yaml").filter(item => /^(property|comment|literal)/.test(item)), ["property:name", "comment:# c", "property:ok", "literal:true"]);
    });

    test("html: tag, attributes and their values, entities, comments", () => {
        assert.deepEqual(types('<a href="x" disabled>t &amp; u</a>', "html"), ["tag:<a", "attribute:href", "punctuation:=", 'string:"x"', "attribute:disabled", "tag:>", "entity:&amp;", "tag:</a>"]);
        assert.deepEqual(types("<!-- c -->", "html"), ["comment:<!-- c -->"]);
    });

    test("css, sql, shell, c# and python have the usual things", () => {
        assert.ok(types("a:hover { color: #fff; --x: 1px }", "css").includes("property:color"));
        assert.ok(types("a:hover { color: #fff; }", "css").includes("selector::hover"), "a selector with a colon is not a property");
        assert.ok(types("select id from t -- c", "sql").includes("keyword:select"), "SQL keywords in any case");
        assert.ok(types("SELECT 'it''s'", "sql").includes("string:'it''s'"));
        assert.ok(types('echo "$HOME" # c', "sh").includes("variable:$HOME") === false, "inside a string it is a string");
        assert.ok(types("echo $HOME # c", "sh").includes("variable:$HOME"));
        assert.ok(types("if x; then exit 1; fi", "sh").includes("keyword:then"));
        assert.ok(types('var s = $"x{n}";', "c#").includes('string:$"x{n}"'));
        assert.ok(types("public class A {}", "cs").includes("keyword:class"));
        assert.ok(types('def f(x):\n    """doc"""', "py").includes('string:"""doc"""'));
        assert.ok(types("True or None", "python").includes("literal:True"));
    });

    test("a language can be registered; a bad one is refused", () => {
        registerLanguage({ name: "toy", aliases: ["t0y"], rules: [{ type: "keyword", pattern: /\b(?:go|stop)\b/ }, { type: "number", pattern: /\d+/ }] });
        assert.deepEqual(types("go 12 away stop", "T0Y"), ["keyword:go", "number:12", "keyword:stop"]);
        assert.throws(() => registerLanguage({ name: "x" }), /rules/);
        assert.throws(() => registerLanguage({ name: "x", rules: [{ type: 1, pattern: /x/ }] }), /pattern/);
        assert.ok(TOKEN_TYPES.includes("keyword"));
    });

    test("a rule with groups of its own does not confuse the others", () => {
        registerLanguage({ name: "groups", rules: [{ type: "one", pattern: /(a)(b)(c)/ }, { type: "two", pattern: /x+/ }] });
        assert.deepEqual(types("abc xx abc", "groups"), ["one:abc", "two:xx", "one:abc"]);
    });

    test("a big text is fast enough (50,000 lines under a few seconds) and a huge one is left plain", () => {
        const big = "const x = foo(1, 'a');\n".repeat(50000);
        const started = performance.now();
        const tokens = tokenize(big, "js");
        assert.ok(performance.now() - started < 4000, `took ${Math.round(performance.now() - started)} ms`);
        assert.equal(tokens.map(token => token.text).join("").length, big.length);
        const huge = "x".repeat(3_100_000);
        assert.deepEqual(tokenize(huge, "js"), [{ type: null, text: huge }]);
    });

    test("no rule can hang on a hostile line (a long unclosed string and comment)", () => {
        const started = performance.now();
        for (const name of getLanguages()) {
            tokenize(`"${"\\".repeat(20000)}`, name);
            tokenize(`/* ${"*".repeat(20000)}`, name);
            tokenize(`<a ${"b=\"c\" ".repeat(3000)}`, name);
        }
        assert.ok(performance.now() - started < 4000, `took ${Math.round(performance.now() - started)} ms`);
    });
});

describe("line diff", () => {
    const ops = (a, b) => diffLines(splitLines(a), splitLines(b)).map(op => (op.type === "equal" ? "=" : op.type === "add" ? `+${op.b}` : `-${op.a}`)).join(" ");

    test("small cases", () => {
        assert.equal(ops("a\nb\nc", "a\nx\nc"), "= -1 +1 =");
        assert.equal(ops("a\nb", "a\nb"), "= =");
        assert.equal(ops("a\nb\nc\nd", "b\nc\nd\ne"), "-0 = = = +3");
        assert.equal(ops("x", "x\ny"), "= +1");
    });

    test("applying the operations to the old lines gives the new lines, for random inputs", () => {
        for (let round = 0; round < 300; round++) {
            const make = size => Array.from({ length: Math.floor(Math.random() * size) }, () => String(Math.floor(Math.random() * 5)));
            const a = make(30);
            const b = make(30);
            const result = diffLines(a, b);
            assert.deepEqual(result.filter(op => op.type !== "remove").map(op => b[op.b]), b);
            assert.deepEqual(result.filter(op => op.type !== "add").map(op => a[op.a]), a);
        }
    });

    test("a big file with a few changes is quick; too many changes fall back to a coarse result", () => {
        const a = Array.from({ length: 5000 }, (_, i) => `line ${i}`);
        const b = a.map((line, i) => (i % 50 === 0 ? `${line} changed` : line));
        const started = performance.now();
        const result = diffLines(a, b);
        assert.ok(performance.now() - started < 1000);
        assert.equal(result.filter(op => op.type === "add").length, 100);
        const coarse = diffLines(a, a.map(line => `${line}!`), { maxEdits: 10 });
        assert.equal(coarse.filter(op => op.type === "remove").length, 5000, "coarse: everything removed");
        assert.equal(coarse.filter(op => op.type === "add").length, 5000, "and added");
    });

    test("hunksOf keeps the context and counts what it leaves out", () => {
        const result = diffLines(splitLines("1\n2\n3\n4\n5\n6\n7\n8\n9"), splitLines("1\n2\n3\n4\nX\n6\n7\n8\n9"));
        const hunks = hunksOf(result, 1);
        assert.equal(hunks.length, 1);
        assert.equal(hunks[0].skippedBefore, 3);
        assert.equal(hunks[0].ops.length, 4, "one line before, the change (remove and add), one after");
        assert.equal(hunksOf(result, Infinity).length, 1);
        assert.equal(hunksOf(result, Infinity)[0].skippedBefore, 0);
    });

    test("splitLines counts the way an editor does", () => {
        assert.deepEqual(splitLines("a\r\nb\rc\n"), ["a", "b", "c", ""]);
        assert.deepEqual(splitLines(""), [""]);
    });
});

describe("code colours", () => {
    const css = readFileSync(new URL("../src/res/themes/tokens.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");
    const luminance = hex => {
        const [r, g, b] = [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16) / 255).map(value => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (a, b) => {
        const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
        return (high + 0.05) / (low + 0.05);
    };
    // the three blocks that hold the token colours: light, dark by choice, dark by the system
    const blocks = [...css.matchAll(/--athena-tok-comment:/g)].map(match => {
        const start = css.lastIndexOf("{", match.index);
        return css.slice(start, css.indexOf("}", match.index));
    });

    test("there are three blocks, each with every token type", () => {
        assert.equal(blocks.length, 3);
        for (const block of blocks) for (const type of TOKEN_TYPES) assert.match(block, new RegExp(`--athena-tok-${type}: #[0-9a-f]{6};`), type);
    });

    test("every token colour has at least 4.5:1 contrast on the code background, in the light and in the dark theme", () => {
        const light = css.match(/--athena-surface-alt: (#[0-9a-f]{6});/)[1];
        const dark = css.match(/data-mode="dark"\] \{[^}]*--athena-surface-alt: (#[0-9a-f]{6});/s)[1];
        const backgrounds = [light, dark, dark];
        blocks.forEach((block, index) => {
            for (const type of TOKEN_TYPES) {
                const colour = block.match(new RegExp(`--athena-tok-${type}: (#[0-9a-f]{6});`))[1];
                const ratio = contrast(colour, backgrounds[index]);
                assert.ok(ratio >= 4.5, `${type} ${colour} on ${backgrounds[index]} is ${ratio.toFixed(2)}:1`);
            }
        });
    });
});
