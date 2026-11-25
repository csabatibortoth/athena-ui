//JSON tree: a collapsible view of any JSON value, with native details / summary.
//A value from the data is always a text node, never markup. Types are told apart by shape as
//well as colour (strings stand in quotes, null is italic). Limits keep a hostile or huge
//value from making the page heavy; "copy value" copies all of a truncated string.
//LICENCE: MIT
//Repository: https://github.com/csabatibortoth/athena-ui

import { asHandle, cx, el, mount } from "./dom.js";
import { translate } from "./i18n.js";
import { copyToClipboard } from "../hephaestus/feedbackGenerator/feedbackGenerator.js";

export const MAX_DEPTH = 12;
export const MAX_CHILDREN = 200;
export const MAX_TEXT = 1000;

/** The text as an object or an array when it is JSON of that kind; otherwise null. */
export function parseJson(text) {
    const t = String(text ?? "").trim();
    if (!((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]")))) return null;
    try {
        const value = JSON.parse(t);
        return value !== null && typeof value === "object" ? value : null;
    } catch {
        return null;
    }
}

/** A path as a programmer writes it: req.id, items[2].name, headers["x-request-id"]. */
export function pathOf(parts) {
    return parts.reduce((path, key) => {
        if (typeof key === "number") return `${path}[${key}]`;
        if (/^[A-Za-z_$][\w$]*$/.test(key)) return path ? `${path}.${key}` : key;
        return `${path}[${JSON.stringify(key)}]`;
    }, "");
}

/** What "copy value" puts on the clipboard: a string as it is, anything else as JSON. */
export const valueText = value => (typeof value === "string" ? value : JSON.stringify(value, null, 2));

const typeOf = value => (value === null ? "null" : Array.isArray(value) ? "array" : typeof value);

function actions(value, path) {
    const button = (label, aria, click) => el("button", {
        class: "athena-jt-btn",
        attrs: { type: "button", title: aria, "aria-label": aria },
        on: { click }
    }, label);
    return el("span", { class: "athena-jt-actions" },
        button("copy", translate("json.copyValue"), () => copyToClipboard(valueText(value))),
        path ? button("path", translate("json.copyPath", { path }), () => copyToClipboard(path)) : null);
}

function shortText(text, max) {
    return text.length > max ? `${text.slice(0, max)}… ${translate("json.moreChars", { count: text.length - max })}` : text;
}

function build(key, value, parts, depth, ctx) {
    const type = typeOf(value);
    const path = pathOf(parts);
    const label = key === null ? null : el("span", { class: "athena-jt-key", text: String(key) });
    const colon = label ? ": " : null;

    if (type === "object" || type === "array") {
        const entries = type === "array" ? value.map((entry, index) => [index, entry]) : Object.entries(value);
        const shown = entries.slice(0, ctx.maxChildren);
        const children = depth >= ctx.maxDepth
            ? [el("div", { class: "athena-jt-more", text: translate("json.tooDeep") })]
            : [...shown.map(([childKey, childValue]) => build(childKey, childValue, [...parts, childKey], depth + 1, ctx)),
                entries.length > shown.length ? el("div", { class: "athena-jt-more", text: translate("json.more", { count: entries.length - shown.length }) }) : null];
        return el("details", { class: cx("athena-jt-node", `athena-jt-${type}`), prop: { open: depth < ctx.open } },
            el("summary", {},
                label, colon,
                el("span", { class: "athena-jt-brace", text: type === "array" ? `[${entries.length}]` : `{${entries.length}}` }),
                actions(value, path)),
            el("div", { class: "athena-jt-children" }, children));
    }

    const shown = type === "string" ? `"${shortText(value, ctx.maxText)}"` : String(value);
    return el("div", { class: "athena-jt-row" },
        label, colon,
        el("span", { class: cx("athena-jt-val", `athena-jt-${type}`), text: shown }),
        actions(value, path));
}

/**
 * A JSON value as a tree. Options: parent, class, open (levels open at first, default 2),
 * maxDepth, maxChildren, maxText. Returns the usual handle with expandAll() and collapseAll().
 */
export function generateJsonTree(value, options = {}) {
    let current = value;
    let ctx = { open: 2, maxDepth: MAX_DEPTH, maxChildren: MAX_CHILDREN, maxText: MAX_TEXT, ...options };
    const tree = el("div", { class: "athena-jt-tree" });
    const render = () => tree.replaceChildren(build(null, current, [], 0, ctx));
    const all = on => tree.querySelectorAll("details").forEach(node => { node.open = on; });
    const bar = el("div", { class: "athena-jt-bar" },
        el("button", { class: "athena-jt-btn", attrs: { type: "button" }, on: { click: () => all(true) } }, translate("json.expandAll")),
        el("button", { class: "athena-jt-btn", attrs: { type: "button" }, on: { click: () => all(false) } }, translate("json.collapseAll")));
    const root = el("div", { class: cx("athena-json-tree", options.class) }, bar, tree);
    if (options.parent) mount(options.parent, root);
    render();
    return asHandle({
        element: root,
        update(next, nextOptions) {
            if (arguments.length) current = next;
            ctx = { ...options, ...(nextOptions ?? {}) };
            render();
            return this;
        },
        expandAll: () => all(true),
        collapseAll: () => all(false)
    });
}
