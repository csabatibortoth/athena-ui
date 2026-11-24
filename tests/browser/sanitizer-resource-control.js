const image = new Image();
image.onload = image.onerror = () => {
    document.title = "sanitizer-control-finished";
};
image.src = `${location.origin}/__sanitizer_resource_probe?kind=control`;
