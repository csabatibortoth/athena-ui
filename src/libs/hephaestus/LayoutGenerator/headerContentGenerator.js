//headerContentGenerator for Athena UI
//Author: Csaba Tóth https://github.com/csabatibortoth/
//LICENCE: MIT
//Repository: https://github.com/csabatibortoth/athena-ui
//Version: 0.3.6

function generateHeaderContent() {
    generateContaninerForElements({parent:"header",id:"header_logo_container",text:""});
    generateHeaderLogo();
    generateContaninerForElements({parent:"header",id:"header_title_container",text:""});
    generateHeaderTitle();
    generateContaninerForElements({parent:"header",id:"header_menu_container",text:""});
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
        parent: "header_menu_container",
        menu_id: "header_menu",
        class: header_menu_class,
        items: items
    });
}

function clearHeaderMenu(){
    $('#header_menu_container').empty();
}

function generateHeaderTitle() {
    HTMLElementGenerator({
        parent: 'header_title_container',
        id: 'header_title_text',
        elementType: 'h1',
        text: config.header_title_text
    });
}

function generateHeaderLogo() {
    HTMLElementGenerator({
        parent: 'header_logo_container',
        id: 'header_title_logo',
        elementType: 'img',
        src: appConfig.header_img_url,
        alt: config.header_title_text + "_logo",
    });
}

function generateContaninerForElements(params){
    HTMLElementGenerator({
        parent: params.parent,
        id: params.id,
        elementType: 'div',
        text: params.text
    });
}