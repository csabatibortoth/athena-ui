//registrationFormGenerator for Athena UI
//Author: Csaba Tóth https://github.com/csabatibortoth/
//LICENCE: MIT
//Repository: https://github.com/csabatibortoth/athena-ui

import config from "../../config/config.js";
import { getRegister } from "../../config/hooks.js";
import {
    EMAIL_PATTERN, generateButton, generateField, generateFormDiv, generateMessage, hashPassword, readControl, showMessage
} from "./formUtils.js";

const FORM_ID = "registrationForm";

// Reads the form. The password is SHA-256 hashed when enable_encrypt_password is set.
export function getRegistrationFormData() {
    return {
        username: readControl(FORM_ID, "username"),
        email: readControl(FORM_ID, "email"),
        password: hashPassword(readControl(FORM_ID, "password"))
    };
}

// Returns an error text, or "" when the form is valid.
export function validateRegistrationForm() {
    if (!readControl(FORM_ID, "username").trim()) return "Username is required.";
    if (!EMAIL_PATTERN.test(readControl(FORM_ID, "email"))) return "Enter a valid email address.";
    if (!readControl(FORM_ID, "password")) return "Password is required.";
    if (readControl(FORM_ID, "password") !== readControl(FORM_ID, "password2")) return "The passwords do not match.";
    return "";
}

export function generateRegistrationForm(parent = "wrapper") {
    generateFormDiv(FORM_ID, config.registrationForm_class, parent);
    generateField(FORM_ID, "username", "Username: ", "text");
    generateField(FORM_ID, "email", "Email: ", "email");
    generateField(FORM_ID, "password", "Password: ", "password");
    generateField(FORM_ID, "password2", "Confirm password: ", "password");
    generateButton(FORM_ID, "register", "Register", submitRegistration);
    generateMessage(FORM_ID);
}

function submitRegistration() {
    const error = validateRegistrationForm();
    showMessage(FORM_ID, error);
    if (!error && config.registration_enabled) getRegister()?.(getRegistrationFormData());
}
