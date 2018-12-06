//Hephaestus module loader for Athena UI
//Author: Csaba Tóth https://github.com/csabatibortoth/
//LICENCE: MIT
//Repository: https://github.com/csabatibortoth/athena-ui
//Version: 0.1.0

function loadLibs(options) {
    $.getScript("libs/libs.js", function () {
        console.log("Libs loaded.");
        loadModules(options);
    });
}

function loadModules(options) {
    libs.forEach(lib => {
        $.getScript(lib.src, function () {
            console.log(lib.name + " module loaded.");
        });
    });
    loadThemes(options);
}

function loadThemes(options) {
    $.getScript("res/themes/themes.js", function () {
        console.log("Themes loaded.");
        loadTheme(options);
    });
}

function loadTheme(options) {
    if (options.theme !== undefined) {
        themes.forEach(theme => {
            if (options.theme.id === theme.id) appendHead(theme);
        });
    } else appendHead(themes[0]);
}

function appendHead(theme) {
    var link = $('<link rel="stylesheet" type="text/css" />');
    link.attr('href', theme.href);
    $('head').append(link);
    console.log(theme.name + " theme loaded.");
    generateBasicLayout();
}