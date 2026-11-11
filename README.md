# athena-ui

It's a JQuery based UI for developement and education purposes.

## Prerequisites:
1. JQuery v4.0.0 loaded to the html file (before Athena UI).
2. The git submodules checked out (`git submodule update --init`):
   HTMLControlGenerator, HTMLElementGenerator, crypto-js v4.2.0, js-cookie v3.0.8
3. A browser with ES module support. The page has to be served over HTTP(S), modules do not load from `file://`.

## Usage

```html
<script src="https://code.jquery.com/jquery-4.0.0.min.js"
    integrity="sha256-OaVG6prZf4v69dPg6PhVattBXkcOWQB62pdZ3ORyrao=" crossorigin="anonymous"></script>
<script type="module">
    import { init } from "./athena-ui.js";

    init({
        theme: { id: 0 },                       // or { href: "my-theme.css" }
        config: { header_title_text: "My App" }, // see libs/config/config.js
        nav: page => console.log(page),          // called on load and on menu clicks
        login: ({ username, password }) => {},   // called by the login form
        menuItems: { headerMenu: [], footerMenu: [] }
    });
</script>
```

`init()` returns a Promise that resolves when the layout is generated.

The old global style still works: load `athena-ui.js` with `type="module"`, then use the globals
(`init`, `config`, `clearWrapper`, `generateLoginForm`, `Cookies`, ...) from classic scripts after
the DOM is ready. The global `appConfig`, `menuItems`, `nav` and `login` are picked up as before.
`appConfig.athenaUIFolder` is not needed anymore, paths are resolved relative to `athena-ui.js`.

## Authors

* **Csaba Tóth** - *Initial work* - [csabatibortoth](https://github.com/csabatibortoth)

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details

## Releases

 ### 0.4.0
  #### Changed:
   1. Rewritten as ES modules (no more chained `$.getScript` loading, no implicit globals)
   2. JQuery v4.0.0, js-cookie v3.0.8, crypto-js v4.2.0
   3. Libraries and theme load in parallel, the layout is generated when all of them are ready
   4. Theme CSS merged into a single file
   5. `init()` returns a Promise and accepts `config`, `nav`, `login`, `menuItems`
  #### Bugfix:
   1. Theme option (`theme` / `themes`) is respected, unknown theme falls back to the default
   2. Menu class does not start with "undefined"
   3. Modal script does not fail when the page has no modal
   4. Login data is not written to the console

 ### 0.3.6
  #### Added
   1. submodule update

 ### 0.3.4
  #### Added:
   1. support for custom JS loading
  #### Bugfix:
   1. Theme name fix

 ### 0.3.3
  #### Added:
   1. Modal support

 ### 0.3.2
  #### Added:
  1. title change
  2. copyright text change

 ### 0.3.1
  #### Added:
  1. Header element container added

 ### 0.3.0
  #### Added:
   1. Navigation Function call for menu

 ### 0.2.9
  #### Bugfix:
   1. Login form generation bugfix 2

 ### 0.2.8
  #### Bugfix:
   1. Login form generation bugfix

 ### 0.2.7
 #### Added:
  1. Basic layout div clear functions

 ### 0.2.6
 #### Added:
  1. Header Logo
  2. Updated Submodules

 ### 0.2.5
 #### Added
  1. JS-Cookie

 ### 0.2.4
 #### Added
  1. Crypto-JS
  2. Password encryption support

 #### Bugfixes
  1. Login form generation

 ### 0.2.3
 #### Bugfixes
  1. Bugfixes on login form generation

 ### 0.2.2
 #### Added:
  1. Login Form generation

 #### Bugfix:
  1. Config loading error fixed

 ### 0.2.1
 #### Bugfix:
  1. Some bugfixes on element generation

 ### 0.2.0
 #### Added:
  1. Element generation from external configuration

 ### 0.1.1
 #### Added:
  1. Fixes

 ### 0.1.0
 #### Added:
  1. basic html layout generation
  2. header generation
  3. footer generation
 
