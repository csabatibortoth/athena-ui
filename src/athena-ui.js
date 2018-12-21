//Athena UI
//Author: Csaba Tóth https://github.com/csabatibortoth/
//LICENCE: MIT
//Repository: https://github.com/csabatibortoth/athena-ui
//Version: 0.2.1

function init(options) {
    loadConfig(options);
}

function loadHephaestus(options) {
    $.getScript(appConfig.athenaUIFolder + "libs/hephaestus/hephaestus.js", function () {
        console.log("Hephaestus loaded.");
        loadLibs(options);
    });
}

function loadConfig(options) {
    $.getScript(appConfig.athenaUIFolder + "libs/config/config.js", function () {
        if(appConfig) config.version = appConfig.version;
        if(appConfig) config.header_title_text = appConfig.header_title_text;
        if(appConfig) config.copyright = appConfig.copyright;
        console.log("config loaded");
        loadHephaestus(options);
    });
}

