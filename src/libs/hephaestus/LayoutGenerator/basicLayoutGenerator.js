//basicLayoutGenerator for Athena UI
//Author: Csaba Tóth https://github.com/csabatibortoth/
//LICENCE: MIT
//Repository: https://github.com/csabatibortoth/athena-ui
//Version: 0.0.1

function generateBasicLayout(){
    generateContainer();
    generateHeader();
    generateWrapper();
    generateFooter();
}

function generateContainer(){
    HTMLElementGenerator({
        parent: "",
        elementType: "div",
        id: "container",
        class: "container"
    });
}

function generateHeader(){
    HTMLElementGenerator({
        elementType: "div",
        parent: "container",
        id: "header",
        class: "header-container"
    });
}

function generateWrapper(){
    HTMLElementGenerator({
        elementType: "div",
        parent: "container",
        id: "wrapper",
        class: "wrapper-container"
    });
}

function generateFooter(){
    HTMLElementGenerator({
        elementType: "div",
        parent: "container",
        id: "footer",
        class: "footer-container"
    });
}