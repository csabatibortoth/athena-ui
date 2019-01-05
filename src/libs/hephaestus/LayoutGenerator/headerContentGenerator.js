//headerContentGenerator for Athena UI
//Author: Csaba Tóth https://github.com/csabatibortoth/
//LICENCE: MIT
//Repository: https://github.com/csabatibortoth/athena-ui
//Version: 0.2.6

function generateHeaderContent() {
    generateHeaderLogo();
    generateHeaderTitle();
    generateHeaderMenu();
}

function generateHeaderMenu() {
    var items = [
        { id: "header_menu-item-1", class: "header-menu-item-class", text: "", inner_text: "item-1" },
        { id: "header_menu-item-2", class: "header-menu-item-class", text: "", inner_text: "item-2" },
        { id: "header_menu-item-3", class: "header-menu-item-class", text: "", inner_text: "item-3" }
    ];

    if(typeof menuItems != 'undefined') items = menuItems.headerMenu;

    header_menu_class = config.header_menu_class;
    if (config.bordered) header_menu_class += " default-cointainer-bordered";
    generateBasicMenu({
        parent: "header",
        menu_id: "header_menu",
        class: header_menu_class,
        items: items
    });
}

function generateHeaderTitle() {
    HTMLElementGenerator({
        parent: 'header',
        id: 'header_title_text',
        elementType: 'h1',
        text: config.header_title_text + " v" + config.version
    });
}

function generateHeaderLogo() {
    HTMLElementGenerator({
        parent: 'header',
        id: 'header_title_logo',
        elementType: 'img',
        src: appConfig.header_img_url,
        alt: config.header_title_text + "_logo",
    });
}