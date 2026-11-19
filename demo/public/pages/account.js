import { generateSignInForm, generatePasswordChangeForm } from "/athena/forms.js";
import { generatePageHeader, generateFacts } from "/athena/components.js";
import { showToast, generateAlert } from "/athena/feedback.js";
import { generateButton } from "/athena/forms.js";
import { el } from "/athena/dom.js";
import { api, block, code } from "/util.js";

export default async function account(context, { app, auth, router }) {
    const root = app.wrapper;
    generatePageHeader({
        parent: root, title: "Account",
        description: "A real sign in against the API of this demo. The session is a cookie that scripts cannot read (HttpOnly); the page only keeps who you are in memory."
    });

    const user = auth.getUser();
    if (!user) {
        const form = block(root, "Sign in", "Two made up accounts. The password manager of your browser can save them, because the form is a real form.");
        const accounts = await api("/api/accounts").catch(() => []);
        generateFacts({ parent: form, inline: true, items: accounts.map(item => ({ term: item.username, description: `${item.password} (${item.roles.join(", ")})` })) });
        generateSignInForm({
            parent: form, remember: false,
            onSubmit: async ({ username, password }) => {
                auth.signIn(await api("/api/login", { method: "POST", body: { username, password } }));   // a wrong password throws: the message appears in the form
                showToast({ message: `Welcome, ${auth.getUser().name}.`, type: "success" });
                const next = context.query?.next;   // where the router sent the person from (a guarded page)
                router.navigate(typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/account");
            }
        });
        code(form, "generateSignInForm({ onSubmit: async ({ username, password }) => { auth.signIn(await post('/api/login', { username, password })); } });");
        return;
    }

    const info = block(root, "You are signed in", "");
    generateFacts({ parent: info, inline: true, items: [{ term: "Name", description: user.name }, { term: "User name", description: user.username }, { term: "Roles", description: user.roles.join(", ") }] });
    if (!auth.hasRole("admin")) generateAlert({ parent: info, type: "info", message: "Sign in as admin / admin-pass to see the administration page, which the router and the server both protect." });
    const out = el("div", { class: "demo-row" });
    info.append(out);
    generateButton({ parent: out, text: "Sign out", variant: "secondary", onclick: async () => { await api("/api/logout", { method: "POST", body: {} }); auth.signOut(); router.navigate("/"); } });

    const password = block(root, "Change the password", "The server checks the current password and the length of the new one. Nothing is changed: the accounts are fixed.");
    generatePasswordChangeForm({
        parent: password, username: user.username,
        onSubmit: async ({ currentPassword, newPassword }) => {
            const answer = await api("/api/password", { method: "POST", body: { currentPassword, newPassword } });
            showToast({ message: answer.note, type: "info" });
        }
    });
}
