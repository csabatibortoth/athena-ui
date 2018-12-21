//footerContentGenerator for Athena UI
//Author: Csaba Tóth https://github.com/csabatibortoth/
//LICENCE: MIT
//Repository: https://github.com/csabatibortoth/athena-ui
//Version: 0.1.1


function generateFooterContent() {
    generateFooterMenu();
    generateFooterCopyrightText();
}

function generateFooterMenu() {
    var items = [
        { id: "footer_menu-item-1", class: "footer-menu-item-class", text: "", inner_text: "item-1" },
        { id: "footer_menu-item-2", class: "footer-menu-item-class", text: "", inner_text: "item-2" },
        { id: "footer_menu-item-3", class: "footer-menu-item-class", text: "", inner_text: "item-3" }
    ];

    if(menuItems) items = menuItems.footerMenu;

    footer_menu_class = config.footer_menu_class;
    if (config.bordered) footer_menu_class += " default-cointainer-bordered";
    generateBasicMenu({
        parent: "footer",
        menu_id: "footer_menu",
        class: footer_menu_class,
        items: items
    });
}

function generateFooterCopyrightText() {
    HTMLElementGenerator({
        parent: 'footer',
        id: 'copyright_text',
        elementType: 'h6',
        text: config.copyright
    });
}