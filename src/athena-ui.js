//Athena UI
//Author: Csaba Tóth https://github.com/csabatibortoth/
//LICENCE: MIT
//Repository: https://github.com/csabatibortoth/athena-ui
//Version: 0.0.1

function init(options) {
    loadHephaestus();
    //loadLibs();
    //loadModules();
    //loadTheme(options);
}

function loadHephaestus(){
    $.getScript("libs/hephaestus/hephaestus.js", function() {
        console.log("Hephaestus loaded.");
        loadLibs();
    });
}

