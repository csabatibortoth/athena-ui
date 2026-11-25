import { createBoard } from "/athena/board.js";
import { generatePageHeader } from "/athena/components.js";
import { generateButton } from "/athena/forms.js";
import { el } from "/athena/dom.js";
import { block, code } from "/util.js";

// The board: columns of cards that a person moves with the mouse, a finger (by the handle) or the keyboard. The page plays the part of the server:
// a move takes a moment, and a card that is marked "needs a review" may not go to Done: the server refuses and the board puts the card back.
const COLUMNS = [{ id: "todo", title: "To do" }, { id: "doing", title: "Doing" }, { id: "review", title: "Review" }, { id: "done", title: "Done" }];
const FIRST = [
    { id: "T-1", column: "todo", title: "Write the release notes", owner: "anna", risky: false },
    { id: "T-2", column: "todo", title: "Check the dark theme", owner: "phil", risky: false },
    { id: "T-3", column: "todo", title: "Deploy to staging (needs a review first)", owner: "gordon", risky: true },
    { id: "T-4", column: "doing", title: "Fix the table sorting with a very long title that goes on and on", owner: "anna", risky: false },
    { id: "T-5", column: "review", title: "Touch check on a phone", owner: "steve", risky: false },
    { id: "T-6", column: "done", title: "Publish 2.8.0", owner: "phil", risky: false }
];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export default async function board(context, { app }) {
    const root = app.wrapper;
    generatePageHeader({
        parent: root, title: "Board",
        description: "Columns of cards. Drag a card with the mouse, or with a finger by its handle; with the keyboard press Space on a card, move it with the arrow keys and press Space or Enter to drop it (Escape cancels)."
    });

    const bar = block(root, "Try it", "A move takes half a second here, as if a server answered. The card marked \"needs a review\" is refused when it goes to Done: the board puts it back and says so.");
    const row = el("div", { class: "demo-row", attrs: { id: "board-bar" } });
    bar.append(row);
    const log = el("ul", { class: "demo-log", attrs: { id: "board-log", "aria-live": "polite" } });
    const say = text => { log.prepend(el("li", { text })); while (log.children.length > 6) log.lastChild.remove(); };
    const stage = el("div", { attrs: { id: "board" } });
    root.append(stage);

    let data = structuredClone(FIRST);
    let counter = FIRST.length;
    const instance = createBoard({
        element: stage, label: "Demo board", columns: COLUMNS, cards: data,
        renderCard(card, container) {
            container.append(el("div", { class: "demo-card-key", text: card.id }), el("div", { class: "board-card-title", text: card.title }), el("div", { class: "demo-card-owner", text: card.owner }));
        },
        async onMove({ id, card, from, to }) {
            say(`${id}: ${from.column} ${from.index + 1} to ${to.column} ${to.index + 1}`);
            await wait(500);
            if (to.column === "done" && card.risky) { say(`${id}: the server refused (it needs a review first)`); return false; }
            const mine = data.find(item => item.id === id);
            if (mine) mine.column = to.column;
            return true;
        },
        onMoveError: (error, move) => say(`${move.id}: ${error.message}`),
        onOpen: card => say(`opened ${card.id}`),
        onCollapse: (id, folded) => say(`${id} ${folded ? "folded" : "shown"}`)
    });

    generateButton({
        parent: row, text: "Add card", variant: "secondary", onclick: () => {
            counter += 1;
            data = [...instance.getCards().map(entry => entry.card), { id: `T-${counter}`, column: "todo", title: `New card ${counter}`, owner: "anna", risky: false }];
            instance.update({ cards: data });
            say(`added T-${counter}: the other cards keep their place and the focus`);
        }
    });
    generateButton({ parent: row, text: "Reload from the server", variant: "secondary", onclick: () => { instance.update({ cards: instance.getCards().map(entry => entry.card) }); say("reloaded: nothing changed, nothing was drawn again"); } });
    generateButton({ parent: row, text: "Fold Done", variant: "secondary", onclick: () => instance.collapse("done", !instance.isCollapsed("done")) });

    const how = block(root, "How it is made", "The board shows what it is given and tells the application what the person did. The application keeps the data, and answers a move with true, false or an error.");
    code(how, `import { createBoard } from "athena-ui-js/board";

const board = createBoard({
    element: "board",
    columns: [{ id: "todo", title: "To do" }, { id: "done", title: "Done" }],
    cards: [{ id: "T-1", column: "todo", title: "Write the release notes" }],
    async onMove({ id, to }) {                 // the card is already shown in its new place
        const ok = await save(id, to.column, to.index);
        return ok;                               // false, an error or a rejected promise: the card goes back
    },
    onOpen: card => openPage(card.id)
});
board.update({ cards: freshFromTheServer });   // the cards that stay keep their element and the focus`);

    root.append(log);
    return () => instance.destroy();
}
