// Small helpers of the demo pages.

import { el } from "/athena/dom.js";
import { generateCodeBlock } from "/athena/code.js";

/** Calls the API of the demo (same origin, with the session cookie). Throws an Error with .status and .fields when the answer is not ok. */
export async function api(path, { method = "GET", body } = {}) {
    const response = await fetch(path, {
        method,
        credentials: "same-origin",
        headers: body === undefined ? {} : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error ?? response.statusText), { status: response.status, fields: data.fields });
    return data;
}

/** A titled block of a page: returns the element to put the demo into. */
export function block(parent, title, description) {
    const section = el("section", { class: "demo-block" }, el("h2", { text: title }));
    if (description) section.append(el("p", { text: description }));
    parent.append(section);
    return section;
}

/** The code behind a demo: a highlighted block with a copy button (the text is built as text, never as markup). */
export function code(parent, text, language = "javascript") {
    generateCodeBlock({ parent, code: text, language });
}

/** A status as the coloured word of a cell. */
export const statusNode = status => el("span", { class: `demo-status-${status}`, text: status });
