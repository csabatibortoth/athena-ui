//wrapperContentGenerator for Athena UI
//Author: Csaba Tóth https://github.com/csabatibortoth/
//LICENCE: MIT
//Repository: https://github.com/csabatibortoth/athena-ui
//Version: 0.2.7

function generateWrapperContent(options) {
    if(!(JSON.parse(Cookies.get("loggedin")))) generateLoginForm(options);
}