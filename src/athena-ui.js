//Athena UI
//Author: Csaba Tóth https://github.com/csabatibortoth/
//LICENCE: MIT
//Repository: https://github.com/csabatibortoth/athena-ui
//Version: 0.1.0

function init(options) {
    loadConfig(options);
}

function loadHephaestus(options) {
    $.getScript("libs/hephaestus/hephaestus.js", function () {
        console.log("Hephaestus loaded.");
        loadLibs(options);
    });
}

function loadConfig(options) {
    $.getScript("libs/config/config.js", function () {
        console.log("config loaded");
        loadHephaestus(options);
    });
}

