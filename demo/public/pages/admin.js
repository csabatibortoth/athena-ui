import { generatePageHeader, generateFacts } from "/athena/components.js";
import { generateAlert } from "/athena/feedback.js";
import { api, block } from "/util.js";

// The router lets only an administrator in (route option roles: ["admin"]), and the server checks the role again: both are needed.
export default async function admin(context, { app }) {
    const root = app.wrapper;
    generatePageHeader({ parent: root, title: "Administration", description: "A page for the admin role only." });
    const stats = block(root, "Server numbers", "Asked from /api/admin/stats, which answers 403 to anybody who is not an administrator.");
    try {
        const data = await api("/api/admin/stats");
        generateFacts({ parent: stats, inline: true, items: [
            { term: "Hosts", description: String(data.hosts) }, { term: "Added hosts", description: String(data.added) }, { term: "Sessions", description: String(data.sessions) },
            { term: "Node.js", description: data.node }, { term: "Uptime", description: `${data.uptime} s` }
        ] });
    } catch (error) {
        generateAlert({ parent: stats, type: "error", message: error.message });
    }
}
