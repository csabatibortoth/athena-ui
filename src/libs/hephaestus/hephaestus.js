//Hephaestus module loader for Athena UI
//Author: Csaba Tóth https://github.com/csabatibortoth/
//LICENCE: MIT
//Repository: https://github.com/csabatibortoth/athena-ui
//Version: 0.0.1

function loadLibs(){
    $.getScript("libs/libs.js", function() {
        console.log("Libs loaded but not necessarily executed.");
    });
}

function loadModules(){
    libs.forEach(lib => {
        $.getScript(lib.src, function() {
            console.log("Modules loaded but not necessarily executed.");
        });
    });
}

function loadThemes() {
    $.getScript("res/themes/themes.js", function() {
        console.log("Modules loaded but not necessarily executed.");
    });
}

function loadTheme(options) {
    if(options.theme.id !== undefined) {
        themes.forEach(theme => {
            if(options.theme.id === theme.id) appendHead(theme);
        });
    } else appendHead(themes[0]);
}

function appendHead(theme){
    var link = ('<link>');
    link.attr('rel','stylesheet');
    link.attr('href',theme.href);
    $('head').append(link);
}