//wrapperContentGenerator for Athena UI
//Author: Csaba Tóth https://github.com/csabatibortoth/
//LICENCE: MIT
//Repository: https://github.com/csabatibortoth/athena-ui
//Version: 0.3.1

function generateWrapperContent(options) {
    //if(!(JSON.parse(Cookies.get("loggedin")))) generateLoginForm(options);
    if (typeof nav === "function") { 
        nav();
    }
}