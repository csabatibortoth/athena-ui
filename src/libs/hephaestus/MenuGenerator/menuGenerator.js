//menuGenerator for Athena UI
//Author: Csaba Tóth https://github.com/csabatibortoth/
//LICENCE: MIT
//Repository: https://github.com/csabatibortoth/athena-ui

import { asHandle, cx, el, mount, setContent, uid } from "../../core/dom.js";
import { translate } from "../../core/i18n.js";
import { isSafeUrl } from "../../core/sanitize.js";
import { initialsOf } from "../componentGenerator/componentGenerator.js";

/**
 * Generates a navigation menu. Items are real links (`href`) or buttons, so the keyboard and screen readers work without help:
 * Tab reaches every item, Enter and Space use it, the arrow keys move inside a group, Esc closes it.
 *
 * @param {object} options
 * @param {string|Element} [options.parent]
 * @param {{id: string, label: string, icon?: string|Node, href?: string, disabled?: boolean, align?: "end",
 *          avatar?: {name: string, src?: string}, children?: object[]}[]} options.items
 *        `icon` is shown before the label (text, or a Node such as an SVG; it is hidden from screen readers).
 *        `avatar` shows the picture (or the initials) of a person: for the user menu, usually with `align: "end"` and children.
 *        An item with `children` opens a group of items (one level).
 * @param {(item: object, event: Event) => void} [options.onNavigate] called when a PERSON uses an item (click, Enter, Space).
 *        It is never called by select() or while the menu is built.
 * @param {string} [options.active] id of the item that is the current page at the start
 * @param {boolean} [options.followHash=false] the item whose `href` equals location.hash is the active one, and follows hashchange
 * @param {"bar"|"bottom-tabs"|"responsive"} [options.layout="bar"] "bottom-tabs": a bar of tabs at the bottom of the screen,
 *        groups open as sheets above it. "responsive": a bar on wide screens, bottom tabs on a tablet or phone (max 700px).
 * @param {string} [options.label] accessible name of the navigation
 * @param {string} [options.id]
 * @param {string} [options.class]
 * @returns {{element: HTMLElement, select: (id: string|null) => void, getActive: () => string|null, close: Function,
 *            update: (changes?: {items?: object[]}) => object, destroy: Function}}
 */
export function generateMenu(options = {}) {
    const layout = options.layout ?? "bar";
    let items = options.items ?? [];
    let active = null;
    const nodes = new Map();       // id -> { item, control, group }
    let openGroup = null;

    const list = el("ul", { class: "athena-menu-list" });
    const element = el("nav", {
        id: options.id,
        class: cx("athena-menu", `athena-menu-${layout}`, options.class),
        attrs: { "aria-label": options.label ?? translate("menu") }
    }, list);

    const content = item => {
        const parts = [];
        if (item.avatar) {
            const avatar = el("span", { class: "menu-avatar", attrs: { "aria-hidden": "true" } });
            if (item.avatar.src && isSafeUrl(item.avatar.src)) avatar.append(el("img", { attrs: { src: item.avatar.src, alt: "" } }));
            else avatar.textContent = initialsOf(item.avatar.name);
            parts.push(avatar);
        }
        if (item.icon) parts.push(setContent(el("span", { class: "menu-icon", attrs: { "aria-hidden": "true" } }), item.icon));
        parts.push(el("span", { class: "menu-label", text: item.label }));
        return parts;
    };

    // A link when there is an address, a button otherwise.
    const control = (item, inGroup) => {
        const common = { class: cx("menu-control", inGroup && "menu-sub-control"), attrs: { "data-id": item.id } };
        const node = item.href && !item.children?.length
            ? el("a", { ...common, attrs: { ...common.attrs, href: item.href, role: inGroup ? "menuitem" : null } }, ...content(item))
            : el("button", { ...common, attrs: { ...common.attrs, type: "button", disabled: item.disabled, role: inGroup ? "menuitem" : null } }, ...content(item));
        if (item.disabled && node.tagName === "A") {
            node.setAttribute("aria-disabled", "true");
            node.removeAttribute("href");
        }
        if (inGroup) node.tabIndex = -1;
        return node;
    };

    const closeGroup = (restoreFocus = false) => {
        if (!openGroup) return;
        const { toggle, sheet } = openGroup;
        sheet.hidden = true;
        toggle.setAttribute("aria-expanded", "false");
        if (restoreFocus) toggle.focus();
        openGroup = null;
        element.ownerDocument.removeEventListener("pointerdown", onOutside);
    };
    const onOutside = event => { if (!element.contains(event.target)) closeGroup(); };

    function openSheet(toggle, sheet, focusFirst) {
        closeGroup();
        sheet.hidden = false;
        toggle.setAttribute("aria-expanded", "true");
        openGroup = { toggle, sheet };
        element.ownerDocument.addEventListener("pointerdown", onOutside);
        if (focusFirst) sheet.querySelector("[role=menuitem]:not([aria-disabled=true]):not(:disabled)")?.focus();
    }

    function build() {
        list.replaceChildren();
        nodes.clear();
        closeGroup();
        for (const item of items) {
            const li = el("li", { class: cx("menu-item", item.align === "end" && "menu-item-end", item.children?.length && "has-submenu") });
            const toggle = control(item, false);
            nodes.set(item.id, { item, control: toggle, li });
            if (item.children?.length) {
                const sheetId = uid("menu-sheet");
                const sheet = el("ul", { id: sheetId, class: "menu-sheet", attrs: { role: "menu", hidden: true, "aria-label": item.label } });
                toggle.setAttribute("aria-haspopup", "menu");
                toggle.setAttribute("aria-expanded", "false");
                toggle.setAttribute("aria-controls", sheetId);
                toggle.append(el("span", { class: "menu-caret", text: "▾", attrs: { "aria-hidden": "true" } }));
                toggle.addEventListener("click", () => (sheet.hidden ? openSheet(toggle, sheet, false) : closeGroup()));
                toggle.addEventListener("keydown", event => {
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                        event.preventDefault();
                        openSheet(toggle, sheet, true);
                    } else if (event.key === "Escape") closeGroup();
                });
                for (const child of item.children) {
                    const childLi = el("li", { attrs: { role: "none" } });
                    const node = control(child, true);
                    nodes.set(child.id, { item: child, control: node, li: childLi, parent: item.id });
                    node.addEventListener("click", event => {
                        closeGroup(true);
                        options.onNavigate?.(child, event);
                    });
                    childLi.append(node);
                    sheet.append(childLi);
                }
                sheet.addEventListener("keydown", event => {
                    const entries = [...sheet.querySelectorAll("[role=menuitem]:not([aria-disabled=true]):not(:disabled)")];
                    const index = entries.indexOf(element.ownerDocument.activeElement);
                    if (event.key === "ArrowDown") entries[(index + 1) % entries.length]?.focus();
                    else if (event.key === "ArrowUp") entries[(index - 1 + entries.length) % entries.length]?.focus();
                    else if (event.key === "Home") entries[0]?.focus();
                    else if (event.key === "End") entries.at(-1)?.focus();
                    else if (event.key === "Escape") closeGroup(true);
                    else if (event.key === "Tab") closeGroup();
                    else return;
                    if (event.key !== "Tab") event.preventDefault();
                });
                li.append(toggle, sheet);
            } else {
                toggle.addEventListener("click", event => {
                    if (item.disabled) return;
                    options.onNavigate?.(item, event);
                });
                li.append(toggle);
            }
            list.append(li);
        }
        // Arrow keys move along the top level, like a toolbar (Tab still reaches every item).
        list.onkeydown = event => {
            if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
            if (event.target.closest(".menu-sheet")) return;
            const tops = [...list.querySelectorAll(":scope > li > .menu-control:not(:disabled)")];
            const index = tops.indexOf(event.target);
            if (index < 0) return;
            event.preventDefault();
            tops[(index + (event.key === "ArrowRight" ? 1 : -1) + tops.length) % tops.length].focus();
        };
        select(active);
    }

    /** Marks the current page: class is-active and aria-current="page" on the item (and has-active on its group). Does not call onNavigate. */
    function select(id) {
        active = id ?? null;
        for (const { control: node, li, parent } of nodes.values()) {
            node.classList.remove("is-active");
            node.removeAttribute("aria-current");
            if (!parent) li.classList.remove("has-active");
        }
        const found = nodes.get(active);
        if (!found) return;
        found.control.classList.add("is-active");
        found.control.setAttribute("aria-current", "page");
        if (found.parent) nodes.get(found.parent).li.classList.add("has-active");
    }

    const view = element.ownerDocument.defaultView;
    const fromHash = () => {
        const hash = view.location.hash;
        const match = [...nodes.values()].find(({ item }) => item.href && item.href === hash);
        if (match) select(match.item.id);
    };
    if (options.followHash) view.addEventListener("hashchange", fromHash);

    active = options.active ?? null;
    build();
    if (options.followHash) fromHash();
    mount(options.parent, element);

    return asHandle({
        element,
        select,
        getActive: () => active,
        close: closeGroup,
        update(changes = {}) {
            if (changes.items) {
                items = changes.items;
                build();
                if (options.followHash) fromHash();
            }
            return this;
        },
        destroy() {
            closeGroup();
            view.removeEventListener("hashchange", fromHash);
            element.remove();
        }
    });
}
