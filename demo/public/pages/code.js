import { createCodeEditor, createDiffView, generateCodeBlock, getLanguages } from "/athena/code.js";
import { generatePageHeader } from "/athena/components.js";
import { generateButton, generateField } from "/athena/forms.js";
import { generateJsonTree } from "/athena/json-tree.js";
import { el } from "/athena/dom.js";
import { block } from "/util.js";

const SAMPLES = {
    javascript: "// Fetch the hosts that are down\nasync function downHosts(limit = 10) {\n    const response = await fetch(`/api/hosts?status=down&limit=${limit}`);\n    if (!response.ok) throw new Error(\"The API said \" + response.status);\n    return (await response.json()).items.map(host => host.name);\n}",
    typescript: "interface Host {\n    id: number;\n    name: string;\n    status: \"up\" | \"down\" | \"unknown\";\n}\n\nexport const names = (hosts: Host[]): string[] => hosts.map(host => host.name);",
    json: "{\n    \"name\": \"athena-ui-js\",\n    \"version\": \"2.4.0\",\n    \"sideEffects\": false,\n    \"keywords\": [\"ui\", \"dashboard\", null]\n}",
    html: "<!-- A card -->\n<section class=\"card\" data-id=\"7\">\n    <h2>Hosts &amp; agents</h2>\n    <button type=\"button\" disabled>Save</button>\n</section>",
    css: "/* Tokens first */\n:root { --athena-accent: #2f6db5; }\n.card:hover > h2 {\n    color: var(--athena-accent);\n    margin: 0 auto !important;\n}",
    sql: "-- Hosts that missed a heartbeat\nSELECT h.id, h.name, COUNT(*) AS misses\nFROM hosts h JOIN heartbeats b ON b.host_id = h.id\nWHERE b.seen_at < NOW() - INTERVAL '5 minutes' AND h.status <> 'maintenance'\nGROUP BY h.id, h.name HAVING COUNT(*) > 3;",
    shell: "#!/usr/bin/env bash\nset -euo pipefail\nfor host in $(cat hosts.txt); do\n    curl --silent --max-time 3 \"https://$host/health\" || echo \"$host is down\"\ndone",
    yaml: "name: demo\non:\n  push:\n    branches: [develop, master]\njobs:\n  test:\n    runs-on: ubuntu-latest  # Node 24\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm test",
    csharp: "public record Host(int Id, string Name)\n{\n    public bool IsUp => Name is not null && Id > 0;\n}\n\n#region helpers\nstatic string Describe(Host h) => $\"{h.Name} ({h.Id})\";\n#endregion",
    python: "@dataclass\nclass Host:\n    name: str\n    up: bool = True\n\ndef down(hosts):\n    \"\"\"Names of the hosts that are down.\"\"\"\n    return [h.name for h in hosts if not h.up]  # a list"
};

const EDITOR_TEXT = "// Edit me: Tab indents, Enter keeps the indentation, brackets close themselves.\n// Ctrl+/ comments, Ctrl+F finds, Ctrl+Space suggests, Ctrl+Z undoes.\nfunction greet(name) {\n    const message = \"Hello, \" + name;\n    console.log(message);\n    return message;\n}\n";

const WORDS = ["console", "const", "constructor", "continue", "function", "greet", "message", "name", "return", "require", "await", "async"];

export default async function codePage(context, { app }) {
    const root = app.wrapper;
    generatePageHeader({
        parent: root, title: "Code",
        description: "Highlighted code, an editor that is a real textarea, and a diff view. No dependency; the colours are theme tokens, so light and dark just work."
    });

    // ------------------------------------------------------------ blocks
    const blocks = block(root, "Highlighted code", "A block with the language, a copy button and optional line numbers. The text is built as text: markup in a comment stays text.");
    const picker = generateField({ parent: blocks, name: "language", label: "Language", type: "select", options: getLanguages(), value: "javascript" });
    const shown = el("div", { attrs: { id: "code-shown" } });
    blocks.append(shown);
    let current = null;
    const showSample = () => {
        const language = picker.getValue();
        if (current) current.setCode(SAMPLES[language] ?? "", language);
        else current = generateCodeBlock({ parent: shown, code: SAMPLES[language], language, lineNumbers: true, highlightLines: [1] });
    };
    picker.element.addEventListener("change", showSample);
    showSample();

    // ------------------------------------------------------------ editor
    const editing = block(root, "Editor", "A textarea over the highlighted text: native input, selection and mobile keyboards, screen readers read it. Escape, then Tab, leaves the editor.");
    const bar = el("div", { class: "demo-row" });
    editing.append(bar);
    const host = el("div", { attrs: { id: "code-editor" } });
    editing.append(host);
    const result = el("p", { class: "demo-note", attrs: { id: "code-status", role: "status" } });
    const editor = createCodeEditor({
        element: host, value: EDITOR_TEXT, language: "javascript", label: "Demo code editor",
        readOnlyRanges: [{ from: 1, to: 2 }],
        provideCompletions: ({ prefix }) => WORDS.filter(word => word.startsWith(prefix) && word !== prefix).map(label => ({ label, detail: "word" })),
        onChange: value => { result.textContent = `${value.split("\n").length} lines, ${value.length} characters`; }
    });
    editor.setMarkers([{ line: 4, message: "Prefer a template string.", level: "warning" }]);
    generateButton({ parent: bar, text: "Find", variant: "secondary", onclick: () => editor.openFind() });
    generateButton({ parent: bar, text: "Undo", variant: "secondary", onclick: () => editor.undo() });
    generateButton({ parent: bar, text: "Redo", variant: "secondary", onclick: () => editor.redo() });
    generateButton({ parent: bar, text: "Wrap", variant: "secondary", onclick: () => editor.setWrap(!editor.element.classList.contains("code-wrap")) });
    generateButton({ parent: bar, text: "Read only", variant: "secondary", onclick: () => editor.setReadOnly(!editor.textarea.readOnly) });
    editing.append(result);
    editing.append(el("p", { class: "demo-note", text: "The first two lines are locked (a read-only range) and line 4 has a lint marker (the status line shows its message when the caret is on it)." }));

    // ------------------------------------------------------------ folding, minimap, multiple cursors
    const large = block(root, "Folding, a minimap, several cursors", "Click the arrow beside a line number to fold a block (Ctrl+Shift+[ and ] with the keyboard). Ctrl+D selects the next occurrence, Ctrl+Alt+arrows or Alt+click add a cursor, Escape goes back to one. The value always holds every line.");
    const largeHost = el("div", { attrs: { id: "code-large" } });
    large.append(largeHost);
    const long = createCodeEditor({
        element: largeHost, language: "javascript", label: "Folding editor", folding: true, minimap: true, multipleCursors: true,
        value: Array.from({ length: 12 }, (_, index) => `function step${index + 1}(items) {\n    // keep what is ready\n    for (const item of items) {\n        if (item.ready) {\n            items.push(item.name);\n        }\n    }\n    return items;\n}`).join("\n\n")
    });
    const folding = el("div", { class: "demo-row" });
    large.append(folding);
    generateButton({ parent: folding, text: "Fold all", variant: "secondary", onclick: () => long.foldAll() });
    generateButton({ parent: folding, text: "Unfold all", variant: "secondary", onclick: () => long.unfoldAll() });

    // ------------------------------------------------------------ diff
    const diffing = block(root, "Difference", "A line diff (Myers) with highlighted code on both sides. Long unchanged parts are folded.");
    const diffBar = el("div", { class: "demo-row" });
    diffing.append(diffBar);
    const diff = createDiffView({
        parent: diffing, language: "javascript", context: 2,
        original: SAMPLES.javascript, modified: SAMPLES.javascript.replace("limit = 10", "limit = 25").replace("throw new Error(\"The API said \" + response.status);", "throw new Error(`The API said ${response.status}`);\n    // not ok")
    });
    generateButton({ parent: diffBar, text: "Unified", variant: "secondary", onclick: () => diff.setMode("unified") });
    generateButton({ parent: diffBar, text: "Split", variant: "secondary", onclick: () => diff.setMode("split") });
    generateButton({ parent: diffBar, text: "Diff the editor", variant: "secondary", onclick: () => diff.setTexts(EDITOR_TEXT, editor.getValue()) });

    // ------------------------------------------------------------ JSON tree
    const treeBlock = block(root, "JSON tree", "An object as a tree that opens and closes, with buttons to copy a value or its path. The word in term is marked. Everything is shown as text.");
    generateJsonTree({ request: { id: "7f3a", method: "GET", path: "/api/hosts", headers: { "x-request-id": "abc-123" } }, response: { status: 503, retry: true, error: "upstream timeout", note: "<img src=x> stays text" } }, { parent: treeBlock, term: "timeout", open: 2 });

    return () => {
        editor.destroy();
        long.destroy();
        current?.destroy();
    };
}
