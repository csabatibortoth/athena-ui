//Hephaestus module loader for Athena UI
//Author: Csaba Tóth https://github.com/csabatibortoth/
//LICENCE: MIT
//Repository: https://github.com/csabatibortoth/athena-ui
//Version: 0.0.1

function loadLibs(){
    $.getScript("libs/libs.js", function() {
        console.log("Libs loaded.");
        loadModules();
    });
}

function loadModules(){
    libs.forEach(lib => {
        $.getScript(lib.src, function() {
            console.log("Modules loaded.");
        });
    });
    loadThemes();
}

function loadThemes() {
    $.getScript("res/themes/themes.js", function() {
        console.log("Themes loaded.");
        loadTheme();
    });
}

function loadTheme(options) {
    if(options !== undefined) {
        themes.forEach(theme => {
            if(options.theme.id === theme.id) appendHead(theme);
        });
    } else appendHead(themes[0]);
}

function appendHead(theme){
    var link = $('<link rel="stylesheet" type="text/css" />');
    link.attr('href',theme.href);
    $('head').append(link);
    console.log( theme.name + " theme loaded.");
}