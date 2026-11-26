import { animate, easings, fadeIn, flip, getMotion, prefersReducedMotion, setMotion, spring, stagger, tween } from "/athena/motion.js";
import { generatePageHeader, generateStat, generateSkeleton } from "/athena/components.js";
import { generateChart } from "/athena/chart.js";
import { generateButton, generateField } from "/athena/forms.js";
import { showDialog } from "/athena/dialog.js";
import { showToast } from "/athena/feedback.js";
import { el } from "/athena/dom.js";
import { block, code } from "/util.js";

export default async function motion(context, { app }) {
    const root = app.wrapper;
    generatePageHeader({
        parent: root, title: "Motion",
        description: "Animations and transitions that are an enhancement: every one reads the duration tokens, nothing waits for them, and they are all off when the person asks for less motion."
    });

    // ------------------------------------------------------------ the preference
    const preference = block(root, "Less motion?", "The system setting (prefers-reduced-motion) is followed. This switch overrides it for this page: it puts data-motion on <html>, where the tokens read it.");
    const status = el("p", { class: "demo-note", attrs: { id: "motion-status", role: "status" } });
    const show = () => { status.textContent = `Preference: ${getMotion()}. Reduced motion is ${prefersReducedMotion() ? "ON: nothing below moves." : "off: everything below moves."}`; };
    const field = generateField({ parent: preference, name: "motion", label: "Motion", type: "select", options: [{ value: "system", text: "Like the system" }, { value: "full", text: "Full motion" }, { value: "reduce", text: "Reduced" }], value: getMotion() });
    field.element.addEventListener("change", () => { setMotion(field.getValue()); show(); });
    preference.append(status);
    show();

    // ------------------------------------------------------------ a list that moves
    const list = block(root, "A list that moves", "flip(list, change): the rows slide from where they were to where they are now, and new ones fade in.");
    const names = ["Anna", "Béla", "Cecília", "Dénes", "Emese", "Ferenc"];
    const items = el("ul", { class: "motion-list", attrs: { id: "motion-list" } });
    list.append(items);
    const addItem = name => items.append(el("li", { class: "motion-item", text: name }));
    names.forEach(addItem);
    const bar = el("div", { class: "demo-row" });
    list.append(bar);
    generateButton({ parent: bar, text: "Shuffle", variant: "secondary", onclick: () => flip(items, () => items.append(...[...items.children].sort(() => Math.random() - 0.5))) });
    generateButton({ parent: bar, text: "Sort", variant: "secondary", onclick: () => flip(items, () => items.append(...[...items.children].sort((a, b) => a.textContent.localeCompare(b.textContent)))) });
    generateButton({ parent: bar, text: "Add one", variant: "secondary", onclick: () => flip(items, () => items.prepend(el("li", { class: "motion-item", text: `New ${items.children.length + 1}` }))) });
    generateButton({ parent: bar, text: "Remove the first", variant: "secondary", onclick: () => flip(items, () => items.firstElementChild?.remove()) });
    code(list, "await flip(list, () => list.append(...sorted));   // measures, does the change, slides what moved");

    // ------------------------------------------------------------ stagger and spring
    const two = el("div", { class: "demo-two" });
    root.append(two);
    const stag = block(two, "Stagger", "stagger(items, run, { step }): each one starts a little after the one before.");
    const chips = el("div", { class: "demo-row", attrs: { id: "motion-chips" } });
    stag.append(chips);
    for (let i = 1; i <= 8; i++) chips.append(el("span", { class: "badge badge-info", text: `#${i}` }));
    generateButton({ parent: stag, text: "Play", variant: "secondary", onclick: () => stagger(chips.children, (chip, index, delay) => animate(chip, [{ opacity: 0, translate: "0 16px" }, { opacity: 1, translate: "0 0" }], { delay, duration: 300 }), { step: 60 }) });

    const springBlock = block(two, "A spring", "spring() makes a linear() easing from a damped spring, so it can overshoot.");
    const track = el("div", { class: "motion-track" });
    const ball = el("span", { class: "motion-ball", attrs: { id: "motion-ball" } });
    track.append(ball);
    springBlock.append(track);
    let right = false;
    generateButton({
        parent: springBlock, text: "Move", variant: "secondary", onclick: () => {
            const { easing, duration } = spring({ stiffness: 220, damping: 12 });
            const far = `${Math.min(240, track.clientWidth - 16 - ball.offsetWidth)}px 0`;      // a narrow screen has a shorter track
            animate(ball, right ? [{ translate: far }, { translate: "0 0" }] : [{ translate: "0 0" }, { translate: far }], { easing, duration, fill: "forwards" });
            right = !right;
        }
    });

    // ------------------------------------------------------------ tween, skeleton
    const three = el("div", { class: "demo-two" });
    root.append(three);
    const counting = block(three, "A tween", "tween({ from, to, duration, easing, onUpdate }): numbers over time, for anything that is not CSS (a game, a counter).");
    const stat = generateStat({ parent: counting, label: "Visitors today", value: 0, note: "counted up" });
    let shown = 0;
    generateButton({
        parent: counting, text: "Count", variant: "secondary", onclick: () => {
            const target = Math.round(500 + Math.random() * 9000);
            tween({ from: shown, to: target, duration: 900, easing: easings.easeOutCubic, onUpdate: value => { shown = value; stat.setValue(Math.round(value).toLocaleString()); } });
        }
    });

    const loading = block(three, "A skeleton", "generateSkeleton(): where the content will be, so the page does not jump when it arrives.");
    const slot = el("div", { attrs: { id: "motion-slot" } });
    loading.append(slot);
    const content = () => { slot.replaceChildren(el("p", { text: "Here is what was loading: three lines of text that arrived after a moment." })); fadeIn(slot.firstChild); };
    generateSkeleton({ parent: slot, lines: 3 });
    generateButton({
        parent: loading, text: "Load again", variant: "secondary", onclick: () => {
            slot.replaceChildren();
            generateSkeleton({ parent: slot, lines: 3 });
            setTimeout(content, 1500);
        }
    });

    // ------------------------------------------------------------ what the components do by themselves
    const own = block(root, "What the components do by themselves", "A dialog fades and rises, a toast slides in and out, a menu and a tooltip fade, an accordion opens smoothly, a theme change cross-fades, a page change is a view transition (use the menu), and a chart draws itself.");
    const row = el("div", { class: "demo-row" });
    own.append(row);
    generateButton({ parent: row, text: "Open a dialog", variant: "secondary", onclick: () => showDialog({ title: "It fades in", content: "And out again when you close it.", size: "small", buttons: [{ text: "Close", value: true, autofocus: true }] }) });
    generateButton({ parent: row, text: "Show a toast", variant: "secondary", onclick: () => showToast({ message: "I slide in, and out.", type: "info", duration: 2500 }) });
    const chartBox = el("div", { attrs: { id: "motion-chart" } });
    own.append(chartBox);
    let chart = null;
    const draw = () => {
        chart?.destroy();
        chart = generateChart({
            parent: chartBox, type: "bar", title: "Drawn when it appears", width: 520, height: 240, labels: ["Mon", "Tue", "Wed", "Thu", "Fri"],
            series: [{ name: "Visits", data: [12, 19, 8, 15, 22] }]
        });
    };
    draw();
    generateButton({ parent: row, text: "Draw the chart again", variant: "secondary", onclick: draw });

    return () => chart?.destroy();
}
