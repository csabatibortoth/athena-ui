import { sanitizeHtml } from "../../src/libs/core/sanitize.js";

const runId = new URL(location.href).searchParams.get("run") ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const resourcePath = (scope, kind) => `/__sanitizer_resource_probe/${runId}-${scope}-${kind}`;
const resourceUrl = (scope, kind) => `${location.origin}${resourcePath(scope, kind)}`;
const cases = [
    ["image-src", url => `<img src="${url}">`],
    ["image-srcset", url => `<img srcset="${url} 1x">`],
    ["picture-source", url => `<picture><source srcset="${url} 1x"><img></picture>`],
    ["iframe-src", url => `<iframe src="${url}"></iframe>`],
    ["link-stylesheet", url => `<link rel="stylesheet" href="${url}">`],
    ["link-preload", url => `<link rel="preload" as="image" href="${url}">`],
    ["video-poster", url => `<video poster="${url}"></video>`],
    ["video-source", url => `<video><source src="${url}"></video>`],
    ["audio-source", url => `<audio><source src="${url}"></audio>`],
    ["object-data", url => `<object data="${url}"></object>`],
    ["embed-src", url => `<embed src="${url}">`],
    ["input-image-src", url => `<input type="image" src="${url}">`],
    ["svg-image-href", url => `<svg><image href="${url}"></image></svg>`],
    ["svg-image-xlink", url => `<svg><image xlink:href="${url}"></image></svg>`],
    ["style-attribute", url => `<div style="background-image:url('${url}')">text</div>`],
    ["style-element", url => `<style>body{background-image:url('${url}')}</style>`],
    ["body-background", url => `<body background="${url}"></body>`],
];

const resourceElements = new Set(["img", "iframe", "link", "video", "audio", "source", "object", "embed", "input", "picture", "svg", "image", "style"]);
const resourceAttributes = new Set(["src", "srcset", "poster", "data", "href", "xlink:href", "background", "style"]);

function resourceMarkupFailures(root, label) {
    const failures = [];
    for (const element of root.querySelectorAll("*")) {
        const tag = element.localName.toLowerCase();
        if (resourceElements.has(tag)) failures.push(`${label}: unexpected <${tag}> in the resulting DOM`);
        for (const attribute of element.attributes) {
            const name = attribute.name.toLowerCase();
            if (resourceAttributes.has(name)) failures.push(`${label}: unexpected ${name} attribute on <${tag}>`);
        }
    }
    return failures;
}

function payloadFor(index, mode) {
    if (mode === "combined") {
        return cases.map(([name, makeMarkup]) => makeMarkup(resourceUrl(mode, name))).join("");
    }
    const [name, makeMarkup] = cases[index];
    return makeMarkup(resourceUrl(mode, name));
}

window.sanitizerProbeCases = cases.map(([name]) => [name]);
window.runSanitizerProbe = (index, mode) => {
    const selected = mode === "combined" ? cases.map(([name]) => name) : [cases[index][0]];
    const paths = selected.map(name => resourcePath(mode, name));
    const output = sanitizeHtml(payloadFor(index, mode));
    const failures = [];
    const template = document.createElement("template");
    template.innerHTML = output;
    failures.push(...resourceMarkupFailures(template.content, `${mode} returned HTML`));

    // Rich text consumers assign the public sanitizer's result to a live element.
    // This catches resources that survive as markup even when its static HTML check misses them.
    const inserted = document.createElement("div");
    inserted.innerHTML = output;
    failures.push(...resourceMarkupFailures(inserted, `${mode} inserted HTML`));
    document.body.append(inserted);
    inserted.remove();

    if (paths.some(path => output.includes(path))) failures.push(`${mode}: a probe URL survived in the returned HTML`);
    return { name: selected.join(", "), paths, failures };
};
