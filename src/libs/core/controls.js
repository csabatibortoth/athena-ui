//controls for Athena UI
//Author: Csaba Tóth https://github.com/csabatibortoth/
//LICENCE: MIT
//Repository: https://github.com/csabatibortoth/athena-ui

import { el, resolveElement } from "./dom.js";

// The controls the older generators (menus, the login and registration forms) build, without jQuery. It does what the
// vendored HTMLControlGenerator does for the control types Athena itself uses: inputs, select, ul / ol with items.

const INPUT_TYPES = new Set([
    "text", "password", "submit", "reset", "radio", "checkbox", "button", "color", "date", "datetime-local", "email", "file",
    "month", "number", "range", "search", "tel", "time", "url", "week"
]);
const WITHOUT_VALUE = new Set(["reset", "file"]);   // a file input's value cannot be set, and reset keeps the browser's label
const EVENTS = ["change", "click"];

const handlerFor = (source, event) => {
    const handler = source[`on${event}`] ?? (event === "change" ? source.change : undefined);
    return typeof handler === "function" ? handler : undefined;
};

function base(tag, options) {
    return el(tag, { id: options.id, class: options.class });
}

function formControl(tag, options) {
    const control = base(tag, options);
    if (options.name != null) control.name = options.name;
    if (options.readOnly != null) control.readOnly = Boolean(options.readOnly);
    if (options.disabled != null) control.disabled = Boolean(options.disabled);
    for (const event of EVENTS) {
        const handler = handlerFor(options, event);
        if (handler) control.addEventListener(event, () => handler.call(options, options.data));
    }
    return control;
}

function input(options) {
    const type = options.inputType;
    const control = formControl("input", options);
    control.type = type;
    if (options.value !== undefined && !WITHOUT_VALUE.has(type)) control.value = options.value;
    if (["date", "number", "range"].includes(type)) {
        if (options.min != null) control.min = options.min;
        if (options.max != null) control.max = options.max;
    }
    if (type === "radio" || type === "checkbox") control.checked = Boolean(options.checked);
    return control;
}

function select(options) {
    const control = formControl("select", options);
    for (const item of options.items ?? []) {
        control.append(el("option", { text: item.text, prop: { value: item.value, selected: Boolean(item.selected) } }));
    }
    return control;
}

function list(options) {
    const items = [...(options.items ?? [])];
    const control = base(options.inputType, options);
    for (const item of items) control.append(el("li", { id: item.id, class: item.class, text: item.text }));
    // One listener per event on the list: an item's own handler wins, otherwise the handler of the list is called.
    for (const event of EVENTS) {
        if (![options, ...items].some(source => handlerFor(source, event))) continue;
        control.addEventListener(event, e => {
            const li = e.target.closest?.("li");
            if (!li || li.parentElement !== control) return;
            const item = items[[...control.children].indexOf(li)];
            const source = item && handlerFor(item, event) ? item : options;
            handlerFor(source, event)?.call(source, source.data);
        });
    }
    return control;
}

const FACTORIES = new Map([...[...INPUT_TYPES].map(type => [type, input]), ["select", select], ["ul", list], ["ol", list]]);

/**
 * Builds a control from `{ inputType, id, class, name, value, items, onclick, onchange, ... }` and appends it to the element given as
 * `parent` (an id or an element; without one, to the body).
 *
 * @returns {HTMLElement|undefined} the control, or undefined when the input type is not known
 */
export function generateControl(options = {}) {
    const factory = FACTORIES.get(options.inputType);
    if (!factory) {
        console.error("Athena UI: generateControl does not know the input type", options.inputType);
        return undefined;
    }
    const control = factory(options);
    (resolveElement(options.parent) ?? document.body).append(control);
    return control;
}
