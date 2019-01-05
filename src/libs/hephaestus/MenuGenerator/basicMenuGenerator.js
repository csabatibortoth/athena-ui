//basicMenuGenerator for Athena UI
//Author: Csaba Tóth https://github.com/csabatibortoth/
//LICENCE: MIT
//Repository: https://github.com/csabatibortoth/athena-ui
//Version: 0.3.0

/*            { id: "item-1", class: "header-menu-item-class", text: "" },
            { id: "item-2", class: "header-menu-item-class", text: "" },
            { id: "item-3", class: "header-menu-item-class", text: "" } */

function generateBasicMenu(options) {
    generateMenuWireFrame(options);
    addMenuItemToWireFrame(options);
}

function generateMenuWireFrame(options) {
    var menu_class = options.menu_class;
    if (options.bordered) menu_class += " default-cointainer-bordered";
    if (options.class) menu_class += " " + options.class;
    HTMLControlGenerator({
        inputType: "ul",
        parent: options.parent,
        id: options.menu_id,
        class: menu_class,
        items: options.items,
    });
}

function addMenuItemToWireFrame(options) {
    var i = 0;
    options.items.forEach(element => {
        HTMLElementGenerator({
            parent: element.id,
            id: options.menu_id + "-item-" + i,
            elementType: 'span',
            text: element.inner_text,
            onclick: function () {
                console.log("click");
                if (typeof nav === "function") { 
                    nav(element.inner_text);
                }
            }
        });
        i++;
    });

}

