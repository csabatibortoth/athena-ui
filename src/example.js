import { init, clearWrapper, generateLoginForm, generateRegistrationForm, generateLostPasswordForm, generateChart, generateTable } from "./athena-ui.js";

const page = name => ({
    Login: generateLoginForm,
    Register: generateRegistrationForm,
    "Lost password": generateLostPasswordForm,
    Charts: () => {
        const labels = ["Q1", "Q2", "Q3", "Q4"];
        generateChart({ type: "bar", title: "Revenue", labels, series: [{ name: "2025", data: [12, 19, 8, 15] }, { name: "2026", data: [14, 17, 12, 21] }] });
        generateChart({ type: "line", title: "Growth", labels, series: [{ name: "Users", data: [-3, 4, 9, 14] }] });
        generateChart({ type: "pie", title: "Share", labels: ["A", "B", "C"], series: [{ data: [50, 30, 20] }], width: 400 });
        generateChart({ type: "donut", title: "Share", labels: ["A", "B", "C"], series: [{ data: [50, 30, 20] }], width: 400 });
    },
    Tables: () => generateTable({
        caption: "Users",
        columns: [{ key: "name", label: "Name" }, { key: "age", label: "Age" }, { key: "city", label: "City" }],
        rows: [
            { name: "Anna", age: 31, city: "Budapest" }, { name: "Béla", age: 27, city: "Szeged" },
            { name: "Csilla", age: 45, city: "Pécs" }, { name: "Dani", age: 22, city: "Győr" },
            { name: "Emma", age: 38, city: "Debrecen" }
        ],
        filter: true,
        pageSize: 3
    })
}[name]);

init({
    theme: { id: 0 },
    config: { login_enabled: true, registration_enabled: true, lost_password_enabled: true },
    menuItems: {
        headerMenu: ["Login", "Register", "Lost password", "Charts", "Tables"].map(text => ({ id: `menu-${text}`, class: "menu-item", text: "", inner_text: text })),
        footerMenu: []
    },
    nav: name => {
        if (!name) return;
        clearWrapper();
        page(name)?.();
    },
    login: data => console.log("login", data.username),
    register: data => console.log("register", data.username, data.email),
    lostPassword: data => console.log("lostPassword", data.email)
});
