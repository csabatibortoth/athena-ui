const live = document.createElement("div");
document.body.append(live);
let completed = 0;
const resourceDone = () => {
    completed++;
    if (completed === 3) document.title = "sanitizer-control-finished";
};
live.addEventListener("load", resourceDone, true);
live.addEventListener("error", resourceDone, true);
live.innerHTML = [
    `<img src="${location.origin}/__sanitizer_resource_probe?kind=control-image">`,
    `<iframe src="${location.origin}/__sanitizer_resource_probe?kind=control-frame"></iframe>`,
    `<link rel="stylesheet" href="${location.origin}/__sanitizer_resource_probe?kind=control-stylesheet">`,
].join("");
