const live = document.createElement("div");
document.body.append(live);
let completed = 0;
const resourceDone = () => {
    completed++;
    if (completed === 3) document.title = "sanitizer-control-finished";
};
const runId = new URL(location.href).searchParams.get("run");
const probe = kind => `${location.origin}/__sanitizer_resource_probe/${runId}-control-${kind}`;
live.addEventListener("load", resourceDone, true);
live.addEventListener("error", resourceDone, true);
live.innerHTML = [
    `<img src="${probe("image")}">`,
    `<iframe src="${probe("frame")}"></iframe>`,
    `<link rel="stylesheet" href="${probe("stylesheet")}">`,
].join("");
