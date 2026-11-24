import { sanitizeHtml } from "../../src/libs/core/sanitize.js";

const marker = `${Date.now()}-${Math.random()}`;
const probe = kind => `${location.origin}/__sanitizer_resource_probe?kind=${encodeURIComponent(kind)}&run=${marker}`;
const cases = [
    ["img-src", () => `<img src="${probe("img-src")}">`],
    ["iframe-src", () => `<iframe src="${probe("iframe-src")}"></iframe>`],
    ["link-stylesheet", () => `<link rel="stylesheet" href="${probe("link-stylesheet")}">`],
    ["video-poster", () => `<video poster="${probe("video-poster")}"></video>`],
    ["video-src", () => `<video src="${probe("video-src")}"></video>`],
    ["source-src", () => `<video><source src="${probe("source-src")}"></video>`],
    ["object-data", () => `<object data="${probe("object-data")}"></object>`],
    ["embed-src", () => `<embed src="${probe("embed-src")}">`],
    ["input-image-src", () => `<input type="image" src="${probe("input-image-src")}">`],
    ["source-srcset", () => `<picture><source srcset="${probe("source-srcset")}"></picture>`],
    ["svg-image-href", () => `<svg><image href="${probe("svg-image-href")}"></image></svg>`],
    ["svg-image-xlink", () => `<svg><image xlink:href="${probe("svg-image-xlink")}"></image></svg>`],
    ["style-attribute", () => `<div style="background-image:url('${probe("style-attribute")}')">text</div>`],
    ["style-import", () => `<style>@import url('${probe("style-import")}');</style>`],
    ["body-background", () => `<body background="${probe("body-background")}"></body>`],
];

const failures = [];
for (const [kind, hostileMarkup] of cases) {
    const output = sanitizeHtml(hostileMarkup());
    if (output.includes(marker)) failures.push(`${kind}: ${output}`);
}

document.getElementById("results").textContent = failures.length
    ? `FAIL sanitizer: resource references survived: ${failures.join(" | ")}`
    : `PASS sanitizer removed resource references in ${cases.length} independent cases`;
document.title = "sanitizer-probe-finished";
