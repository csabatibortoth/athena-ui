import { generateForm } from "/athena/forms.js";
import { generateDateTimeRange, generateStepper, generateDropZone, generateRichText, generateWysiwyg, generateAutocomplete } from "/athena/inputs.js";
import { generatePageHeader } from "/athena/components.js";
import { showToast } from "/athena/feedback.js";
import { el } from "/athena/dom.js";
import { block, code } from "/util.js";

const countries = ["Austria", "Belgium", "Croatia", "Czechia", "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary", "Ireland", "Italy", "Latvia", "Lithuania", "Poland", "Portugal", "Romania", "Slovakia", "Slovenia", "Spain", "Sweden"];

export default async function forms(context, { app }) {
    const root = app.wrapper;
    generatePageHeader({ parent: root, title: "Forms", description: "Real forms: labels, validation when you leave a field and live afterwards, errors read out by screen readers, Enter submits." });

    const all = block(root, "A form with every kind of field", "Leave a required field, or type a wrong value, and look at the messages. Submit to see the values.");
    const result = el("pre", { class: "demo-code", text: "The values appear here." });
    const form = generateForm({
        parent: all, submitText: "Send", resetText: "Reset",
        fields: [
            { name: "name", label: "Name", required: true, minLength: 3, help: "At least three characters" },
            { name: "email", label: "Email", type: "email", required: true },
            { name: "password", label: "Password", type: "password", required: true, minLength: 8, autocomplete: "new-password" },
            { name: "again", label: "Password again", type: "password", match: "password", autocomplete: "new-password" },
            { name: "age", label: "Age", type: "number", min: 18, max: 120 },
            { name: "born", label: "Date of birth", type: "date" },
            { name: "country", label: "Country", type: "autocomplete", options: countries, placeholder: "Start typing…" },
            { name: "visited", label: "Visited", type: "multiselect", options: countries.slice(0, 12), placeholder: "Pick some" },
            { name: "plan", label: "Plan", type: "select", options: ["Free", "Team", "Business"], placeholder: "Choose…", required: true },
            { name: "billing", label: "Billing", type: "radio", options: ["Monthly", "Yearly"], value: "Monthly" },
            { name: "extras", label: "Extras", type: "checkboxes", options: ["Backups", "Support", "Audit log"] },
            { name: "bio", label: "About you", type: "textarea", rows: 3 },
            { name: "news", label: "Send me the news", type: "switch", value: true },
            { name: "terms", label: "I accept the terms", type: "checkbox", required: true }
        ],
        onSubmit: values => {
            const { password, again, ...rest } = values;
            void password; void again;
            result.textContent = JSON.stringify(rest, null, 2);
            showToast({ message: "The form is valid.", type: "success" });
        }
    });
    void form;
    all.append(result);
    code(all, "generateForm({ fields: [{ name: 'email', type: 'email', required: true }, ...], onSubmit: async values => { /* throw to show an error in the form */ } });");

    const times = block(root, "Date and time range", "Presets are measured from now when you ask. Typing in a field makes it a custom range.");
    const readout = el("p", { text: "" });
    const range = generateDateTimeRange({
        parent: times, label: "Show data from", preset: "24h",
        onChange: () => { const { from, to } = range.getRange(); readout.textContent = `From ${from?.toLocaleString() ?? "?"} to ${to?.toLocaleString() ?? "?"}`; }
    });
    readout.textContent = `From ${range.getRange().from.toLocaleString()} to ${range.getRange().to.toLocaleString()}`;
    times.append(readout);

    const wizard = block(root, "A wizard", "A step can say no: the first one needs a name.");
    let wizardName = "";
    generateStepper({
        parent: wizard,
        steps: [
            { title: "Who", content: () => { const input = el("input", { attrs: { type: "text", placeholder: "Your name", "aria-label": "Your name" } }); input.addEventListener("input", () => { wizardName = input.value; }); return input; }, validate: () => wizardName.trim().length >= 2 || "Enter your name first." },
            { title: "Where", content: () => generateAutocomplete({ options: countries, placeholder: "Country" }).element },
            { title: "Done", content: () => el("p", { text: "That is all. Press Finish." }) }
        ],
        onFinish: () => showToast({ message: `Thank you, ${wizardName}.`, type: "success" })
    });

    const files = block(root, "Drop files", "Type, size and number are checked before anything would be uploaded (this demo keeps nothing).");
    const dropped = el("p", { text: "No files yet." });
    generateDropZone({
        parent: files, accept: ".png,.jpg,.pdf,image/*", maxSize: 2 * 1024 * 1024, maxFiles: 3,
        onDrop: list => { dropped.textContent = `Accepted: ${list.map(file => file.name).join(", ")}`; },
        onReject: rejected => showToast({ message: rejected.map(item => `${item.file.name}: ${item.reason}`).join(" · "), type: "warning" })
    });
    files.append(dropped);

    const editors = block(root, "Rich text", "The text you write is cleaned by an allow-list sanitizer before it is used; script, style and event attributes never get through.");
    const two = el("div", { class: "demo-two" });
    editors.append(two);
    generateRichText({ parent: two, label: "Rich text", value: "<p>Select some text and use the toolbar.</p>" });
    generateWysiwyg({ parent: two, label: "With a source view", value: "<p><strong>Bold</strong> and <em>italic</em></p>" });
}
