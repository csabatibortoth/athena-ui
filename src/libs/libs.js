//libs for Athena UI
//Author: Csaba Tóth https://github.com/csabatibortoth/
//LICENCE: MIT
//Repository: https://github.com/csabatibortoth/athena-ui

// Classic (non-module) scripts that have to be loaded at runtime because they
// register globals. Everything else is a regular ES module import.
// `needs`: the script is only loaded when it is wanted ("crypto": enable_encrypt_password is on)
const lib = (id, name, path, needs) => ({ id, name, needs, src: new URL(path, import.meta.url).href });

export default [
    lib(10, "crypto-js", "crypto-js/crypto-js.js", "crypto")
];
