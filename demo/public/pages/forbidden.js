import { generatePageHeader } from "/athena/components.js";
import { generateAlert } from "/athena/feedback.js";

export default async function forbidden(context, { app }) {
    const root = app.wrapper;
    generatePageHeader({ parent: root, title: "Not allowed" });
    generateAlert({ parent: root, type: "warning", message: "You do not have the role this page needs. Sign in as admin / admin-pass on the Account page." });
}
