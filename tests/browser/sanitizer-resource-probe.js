import { sanitizeHtml } from "../../src/libs/core/sanitize.js";

const marker = `${Date.now()}-${Math.random()}`;
const probe = kind => `${location.origin}/__sanitizer_resource_probe?kind=${encodeURIComponent(kind)}&run=${marker}`;
const reference = (scope, kind) => probe(`${scope}-${kind}`);
const cases = [
    ["image-src", scope => `<img src="${reference(scope, "image-src")}">`],
    ["image-srcset", scope => `<img srcset="${reference(scope, "image-srcset")} 1x">`],
    ["picture-source", scope => `<picture><source srcset="${reference(scope, "picture-source")} 1x"><img></picture>`],
    ["iframe-src", scope => `<iframe src="${reference(scope, "iframe-src")}"></iframe>`],
    ["link-stylesheet", scope => `<link rel="stylesheet" href="${reference(scope, "link-stylesheet")}">`],
    ["link-preload", scope => `<link rel="preload" as="image" href="${reference(scope, "link-preload")}">`],
    ["video-poster", scope => `<video poster="${reference(scope, "video-poster")}"></video>`],
    ["video-source", scope => `<video><source src="${reference(scope, "video-source")}"></video>`],
    ["audio-source", scope => `<audio><source src="${reference(scope, "audio-source")}"></audio>`],
    ["object-data", scope => `<object data="${reference(scope, "object-data")}"></object>`],
    ["embed-src", scope => `<embed src="${reference(scope, "embed-src")}">`],
    ["input-image-src", scope => `<input type="image" src="${reference(scope, "input-image-src")}">`],
    ["svg-image-href", scope => `<svg><image href="${reference(scope, "svg-image-href")}"></image></svg>`],
    ["svg-image-xlink", scope => `<svg><image xlink:href="${reference(scope, "svg-image-xlink")}"></image></svg>`],
    ["style-attribute", scope => `<div style="background-image:url('${reference(scope, "style-attribute")}')">text</div>`],
    ["style-element", scope => `<style>body{background-image:url('${reference(scope, "style-element")}')}</style>`],
    ["body-background", scope => `<body background="${reference(scope, "body-background")}"></body>`],
];

function hasResourceMarkup(output) {
    return output.includes(marker) ||
        /<(?:img|iframe|link|video|audio|source|object|embed|input|picture|svg|image|style|body)\b/i.test(output) ||
        /\s(?:src|srcset|poster|data|href|xlink:href|background|style)\s*=/i.test(output);
}

const failures = [];
for (const [kind, hostileMarkup] of cases) {
    const payload = hostileMarkup("single");
    const output = sanitizeHtml(payload);
    const liveResult = document.createElement("div");
    document.body.append(liveResult);
    liveResult.innerHTML = output;
    liveResult.remove();
    if (hasResourceMarkup(output)) failures.push(`${kind}: ${output}`);
}

const combinedOutput = sanitizeHtml(cases.map(([, hostileMarkup]) => hostileMarkup("combined")).join(""));
const combinedResult = document.createElement("div");
document.body.append(combinedResult);
combinedResult.innerHTML = combinedOutput;
combinedResult.remove();
if (hasResourceMarkup(combinedOutput)) failures.push(`combined: ${combinedOutput}`);

document.getElementById("results").textContent = failures.length
    ? `FAIL sanitizer: resource markup survived: ${failures.join(" | ")}`
    : `PASS sanitizer removed resource markup in ${cases.length} independent cases and their combined payload`;
document.title = "sanitizer-probe-finished";
