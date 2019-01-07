//loginFormGenerator for Athena UI
//Author: Csaba Tóth https://github.com/csabatibortoth/
//LICENCE: MIT
//Repository: https://github.com/csabatibortoth/athena-ui
//Version: 0.3.4

function generateLoginForm(options) {
    generateFormDiv(options);
    generateFormElements(options);
}

function generateFormDiv(options){
    HTMLElementGenerator({
        elementType: "div",
        parent: "wrapper",
        id: "loginForm",
        class: config.loginForm_class,
        //text: "wrapper"
    });
}

function generateFormElements(options){
    generateUsernameElements(options);
    generatePasswordElements(options);
    generateSubmitElement(options);
}

function generateUsernameElements(options) {
    HTMLElementGenerator({
        elementType: "div",
        parent: "loginForm",
        id: "loginForm-username",
        class: "container"
    });
    HTMLElementGenerator({
        elementType: "span",
        parent: "loginForm-username",
        id: "loginForm-username-label",
        class: "container",
        text: "Username: "
    });
    HTMLControlGenerator({
        inputType: "text",
        parent: "loginForm-username",
        id: "loginForm-username-control",
        class: "text-filed-class",
        change: function (data) {
            console.log(data)
        },
        onclick: function () {
            console.log("click")
        }
    });
}

function generatePasswordElements(options) {
    HTMLElementGenerator({
        elementType: "div",
        parent: "loginForm",
        id: "loginForm-password",
        class: "container"
    });
    HTMLElementGenerator({
        elementType: "span",
        parent: "loginForm-password",
        id: "loginForm-password-label",
        class: "container",
        text: "Password: "
    });
    HTMLControlGenerator({
        inputType: "password",
        parent: "loginForm-password",
        id: "loginForm-password-control",
        class: "text-filed-class",
        change: function (data) {
            console.log(data)
        },
        onclick: function () {
            console.log("click")
        }
    });
}

function generateSubmitElement(options) {
    HTMLElementGenerator({
        elementType: "div",
        parent: "loginForm",
        id: "loginForm-submit",
        class: "container"
    });
    HTMLControlGenerator({
        inputType: "button",
        parent: "loginForm-submit",
        text: "Login",
        value: "Login",
        id: "loginForm-submit-login",
        class: "button-filed-class",
        onclick: function () {
            $('#loginForm-password-control').val();
            var password = $('#loginForm-password-control').val();
            if(config.enable_encrypt_password) password = CryptoJS.SHA256($('#loginForm-password-control').val()).toString();
            if(config.login_enabled) login({username: $('#loginForm-username-control').val(), password: password});
            var data = {username: $('#loginForm-username-control').val(), password: password};
            console.log(JSON.stringify(data));
        }
    });
}