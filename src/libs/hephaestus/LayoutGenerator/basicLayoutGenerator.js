//basicLayoutGenerator for Athena UI
//Author: Csaba Tóth https://github.com/csabatibortoth/
//LICENCE: MIT
//Repository: https://github.com/csabatibortoth/athena-ui
//Version: 0.0.1

function generateBasicLayout() {
    generateContainer();
    generateHeader();
    generateWrapper();
    generateFooter();

    generateHeaderMenu();
    generateFooterMenu();
}

function generateContainer() {
    var container_class = config.container_class;
    if (config.bordered) container_class += " default-cointainer-bordered";
    HTMLElementGenerator({
        parent: "",
        elementType: "div",
        id: "container",
        class: container_class
    });
}

/* HEADER ELEMENT GENERATION */

function generateHeader() {
    var header_class = config.header_class;
    if (config.bordered) header_class += " default-cointainer-bordered";
    HTMLElementGenerator({
        elementType: "div",
        parent: "container",
        id: "header",
        class: header_class,
        text: "header"
    });
}

function generateHeaderMenu() {
    header_menu_class = config.header_menu_class;
    if (config.bordered) header_menu_class += " default-cointainer-bordered";
    generateBasicMenu({
        parent: "header",
        menu_id: "header_menu",
        class: header_menu_class,
        items: [
            { id: "header_menu-item-1", class: "header-menu-item-class", text: "",inner_text:"item-1"},
            { id: "header_menu-item-2", class: "header-menu-item-class", text: "",inner_text:"item-2"},
            { id: "header_menu-item-3", class: "header-menu-item-class", text: "",inner_text:"item-3"}
        ]
    });
}

/* WRAPPER ELEMENT GENERATION */

function generateWrapper() {
    var wrapper_class = config.wrapper_class;
    if (config.bordered) wrapper_class += " default-cointainer-bordered";
    HTMLElementGenerator({
        elementType: "div",
        parent: "container",
        id: "wrapper",
        class: wrapper_class,
        text: "wrapper"
    });
}

/* FOOTER ELEMENT GENERATION */

function generateFooter() {
    var footer_class = config.footer_class;
    if (config.bordered) footer_class += " default-cointainer-bordered";
    HTMLElementGenerator({
        elementType: "div",
        parent: "container",
        id: "footer",
        class: footer_class,
        text: "footer"
    });
}

function generateFooterMenu() {
    footer_menu_class = config.footer_menu_class;
    if (config.bordered) footer_menu_class += " default-cointainer-bordered";
    generateBasicMenu({
        parent: "footer",
        menu_id: "footer_menu",
        class: footer_menu_class,
        items: [
            { id: "footer_menu-item-1", class: "footer-menu-item-class", text: "",inner_text:"item-1"},
            { id: "footer_menu-item-2", class: "footer-menu-item-class", text: "",inner_text:"item-2"},
            { id: "footer_menu-item-3", class: "footer-menu-item-class", text: "",inner_text:"item-3"}
        ]
    });
}