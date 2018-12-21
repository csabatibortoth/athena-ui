//basicLayoutGenerator for Athena UI
//Author: Csaba Tóth https://github.com/csabatibortoth/
//LICENCE: MIT
//Repository: https://github.com/csabatibortoth/athena-ui
//Version: 0.2.1

function generateBasicLayout() {
    generateContainer();
    if(config.generateHeader) generateHeader();
    generateWrapper();
    if(config.generateFooter) generateFooter();
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
        //text: "header"
    });
    if(config.generateHeadercontent) generateHeaderContent();
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
        //text: "wrapper"
    });
    if(config.generateWrappercontent) generateWrapperContent();
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
        //text: "footer"
    });
    if(config.generateFooterContent) generateFooterContent();
}
