import { showDialog, showConfirm, showFormDialog, alertDialog, promptDialog } from "/athena/dialog.js";
import { showToast, generateAlert, generateProgress, generateSpinner, copyToClipboard } from "/athena/feedback.js";
import { generateButton } from "/athena/forms.js";
import { generatePageHeader } from "/athena/components.js";
import { el } from "/athena/dom.js";
import { api, block, code } from "/util.js";

export default async function dialogs(context, { app, auth }) {
    const root = app.wrapper;
    generatePageHeader({
        parent: root, title: "Dialogs and feedback",
        description: "Dialogs are the native <dialog> element: the browser traps the focus, closes it with Esc, dims and blocks the page behind it, and gives the focus back."
    });

    const buttons = (title, description) => {
        const section = block(root, title, description);
        const row = el("div", { class: "demo-row" });
        section.append(row);
        return { section, add: (text, onclick, variant = "primary") => generateButton({ parent: row, text, variant, onclick }) };
    };

    // ------------------------------------------------------------ plain dialogs
    const plain = buttons("Dialogs", "Four sizes, one handle: await the result, or keep the handle and close it yourself.");
    for (const size of ["small", "medium", "large", "full"]) {
        plain.add(`Open ${size}`, async () => {
            const result = await showDialog({
                title: `A ${size} dialog`, size,
                content: ["The width comes from a token (", el("code", { text: `--athena-dialog-${size === "full" ? "large" : size}` }), "). Press Esc, click outside it, or use a button."],
                buttons: [{ text: "Cancel", value: "cancel", variant: "secondary" }, { text: "OK", value: "ok", autofocus: true }]
            });
            showToast({ message: `Result: ${result === null ? "dismissed" : result}`, type: "info", duration: 2500 });
        }, "secondary");
    }
    plain.add("Alert", () => alertDialog("Saved. Nothing else to do.", { title: "Done" }), "secondary");
    plain.add("Prompt", async () => {
        const name = await promptDialog("What is the name of the new report?", { title: "New report", validate: value => (value.trim().length < 3 ? "Use at least three characters." : "") });
        if (name !== null) showToast({ message: `Report "${name}" created.`, type: "success" });
    }, "secondary");

    // ------------------------------------------------------------ confirmations
    const sure = buttons("Confirmations", "For things that cannot be undone, the person has to type what they are deleting.");
    sure.add("Confirm", async () => {
        const yes = await showConfirm({ title: "Archive the report?", message: "It will be hidden from the list.", confirmText: "Archive" });
        showToast({ message: yes ? "Archived." : "Kept.", type: yes ? "success" : "info", duration: 2000 });
    }, "secondary");
    sure.add("Delete (type to confirm)", async () => {
        const yes = await showConfirm({ title: "Delete host", message: "host-00042 and its history will be removed for good.", confirmText: "Delete", danger: true, typeToConfirm: "host-00042" });
        if (yes) showToast({ message: "Deleted (this demo deletes nothing).", type: "warning" });
    }, "danger");
    code(sure.section, "await showConfirm({ message, confirmText: 'Delete', danger: true, typeToConfirm: host.name });");

    // ------------------------------------------------------------ form dialog
    const add = buttons("A form in a dialog", auth.isSignedIn()
        ? "Add a host. The server checks the name: try 'host-00001' (taken) or 'Bad Name' (not allowed), then a free one."
        : "Adding a host needs a signed in user: the server says no, and the dialog shows it and stays open. Sign in on the Account page (demo / demo-pass) and try again.");
    add.add("Add a host", async () => {
        const saved = await showFormDialog({
            title: "Add a host", intro: "The agent connects with this name.", size: "small", submitText: "Add",
            fields: [{ name: "name", label: "Name", required: true, placeholder: "host-new-1", autocomplete: "off" }],
            onSubmit: async values => { await api("/api/hosts", { method: "POST", body: values }); }
        });
        if (saved) showToast({ message: "The host was added.", type: "success" });
    });
    code(add.section, "await showFormDialog({ fields, onSubmit: async values => { await post(values); } });   // a thrown error (with .fields) stays in the dialog");

    // ------------------------------------------------------------ toasts, alerts, progress
    const toasts = buttons("Toasts", "They are announced to screen readers and go away by themselves.");
    for (const type of ["info", "success", "warning", "error"]) toasts.add(type, () => showToast({ title: type[0].toUpperCase() + type.slice(1), message: `This is a ${type} toast.`, type }), "secondary");
    toasts.add("Copy a token", () => copyToClipboard("demo-token-8f2c1a"), "secondary");

    const alerts = block(root, "Alerts, progress and spinner", "");
    for (const type of ["info", "success", "warning", "error"]) generateAlert({ parent: alerts, type, title: `${type}:`, message: "A message that stays on the page." });
    const bar = generateProgress({ parent: alerts, label: "Uploading", value: 0 });
    let value = 0;
    const timer = setInterval(() => { value = (value + 7) % 107; bar.setValue(Math.min(value, 100)); }, 400);
    const spin = el("div", { class: "demo-row" });
    alerts.append(spin);
    generateSpinner({ parent: spin, size: "small" });
    generateSpinner({ parent: spin });
    generateSpinner({ parent: spin, size: "large" });

    return () => clearInterval(timer);
}
