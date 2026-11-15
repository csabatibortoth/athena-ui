//Athena UI
//Author: Csaba Tóth https://github.com/csabatibortoth/
//LICENCE: MIT
//Repository: https://github.com/csabatibortoth/athena-ui
//Version: 0.5.0

/* global $ */

import config, { applyConfig } from "./libs/config/config.js";
import { getAppConfig, setHooks } from "./libs/config/hooks.js";
import { loadLibs, loadScript, loadTheme } from "./libs/hephaestus/hephaestus.js";
import * as layout from "./libs/hephaestus/LayoutGenerator/basicLayoutGenerator.js";
import * as header from "./libs/hephaestus/LayoutGenerator/headerContentGenerator.js";
import * as wrapper from "./libs/hephaestus/LayoutGenerator/wrapperContentGenerator.js";
import * as footer from "./libs/hephaestus/LayoutGenerator/footerContentGenerator.js";
import * as menu from "./libs/hephaestus/MenuGenerator/basicMenuGenerator.js";
import * as loginForm from "./libs/hephaestus/formGenerator/loginFormGenerator.js";
import * as registrationForm from "./libs/hephaestus/formGenerator/registrationFormGenerator.js";
import * as lostPasswordForm from "./libs/hephaestus/formGenerator/lostPasswordFormGenerator.js";
import * as chart from "./libs/hephaestus/chartGenerator/chartGenerator.js";
import * as table from "./libs/hephaestus/tableGenerator/tableGenerator.js";
import * as modal from "./libs/hephaestus/modalGenerator/modalGenerator.js";
import Cookies from "./libs/js-cookie/src/api.mjs";
import { HTMLElementGenerator } from "./libs/hephaestus/HTMLElementGenerator/src/HTMLElementGenerator.js";

if (typeof $ !== "function") {
    throw new Error("Athena UI: jQuery has to be loaded before athena-ui.js");
}

/**
 * Loads the libraries and the theme in parallel, then generates the layout.
 *
 * @param {object} [options]
 * @param {{id?: number, href?: string}} [options.theme] registered theme id or custom stylesheet
 * @param {object} [options.config] settings overriding the defaults (and the global appConfig)
 * @param {Function} [options.nav] navigation callback (falls back to the global nav)
 * @param {Function} [options.login] login callback (falls back to the global login)
 * @param {Function} [options.register] registration callback (falls back to the global register)
 * @param {Function} [options.lostPassword] lost password callback (falls back to the global lostPassword)
 * @param {object} [options.menuItems] { headerMenu, footerMenu } (falls back to the global menuItems)
 * @returns {Promise<object>} the effective configuration
 */
export async function init(options = {}) {
    applyConfig(getAppConfig(), options.config);
    setHooks(options);

    await Promise.all([
        loadLibs(config.customLoader ? [config.customLoader] : []),
        loadTheme(options.theme ?? options.themes),
        new Promise(resolve => $(resolve))
    ]);

    layout.generateBasicLayout();
    return config;
}

const AthenaUI = {
    init,
    config,
    loadScript,
    Cookies,
    HTMLElementGenerator,
    ...layout,
    ...header,
    ...wrapper,
    ...footer,
    ...menu,
    ...loginForm,
    ...registrationForm,
    ...lostPasswordForm,
    ...chart,
    ...table,
    ...modal
};

// Classic scripts (the customLoader, inline handlers) keep working: the whole API
// stays reachable as globals, like in the pre-module versions.
Object.assign(globalThis, AthenaUI, { AthenaUI });

export { config, loadScript, Cookies, HTMLElementGenerator };
export * from "./libs/hephaestus/LayoutGenerator/basicLayoutGenerator.js";
export * from "./libs/hephaestus/LayoutGenerator/headerContentGenerator.js";
export * from "./libs/hephaestus/LayoutGenerator/wrapperContentGenerator.js";
export * from "./libs/hephaestus/LayoutGenerator/footerContentGenerator.js";
export * from "./libs/hephaestus/MenuGenerator/basicMenuGenerator.js";
export * from "./libs/hephaestus/formGenerator/loginFormGenerator.js";
export * from "./libs/hephaestus/formGenerator/registrationFormGenerator.js";
export * from "./libs/hephaestus/formGenerator/lostPasswordFormGenerator.js";
export * from "./libs/hephaestus/chartGenerator/chartGenerator.js";
export * from "./libs/hephaestus/tableGenerator/tableGenerator.js";
export * from "./libs/hephaestus/modalGenerator/modalGenerator.js";
export default AthenaUI;
