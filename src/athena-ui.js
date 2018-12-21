//Athena UI
//Author: Csaba Tóth https://github.com/csabatibortoth/
//LICENCE: MIT
//Repository: https://github.com/csabatibortoth/athena-ui
//Version: 0.2.2

if(typeof appConfig == 'undefined') var appConfig = { athenaUIFolder: "" };

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
        if(typeof appConfig == 'undefined') config.version = appConfig.version;
        if(typeof appConfig == 'undefined') config.header_title_text = appConfig.header_title_text;
        if(typeof appConfig == 'undefined') config.copyright = appConfig.copyright;
        console.log("config loaded");
        loadHephaestus(options);
    });
}

