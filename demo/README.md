# Athena UI demo

A demo and test application for Athena UI: tables with 100,000 rows from a server, a chart that streams and zooms, every kind of form field, native dialogs, a menu with
groups inside groups, three themes with light and dark modes, and a real sign in. It is served by a small Node server with no dependencies, under a strict
Content-Security-Policy (`script-src 'self'; style-src 'self'`): no inline script, no inline style.

It is also the end to end test of the library: the tests in `demo/tests` open every page in a real browser, click, type and press keys, and fail on any error,
failed request or policy violation.

**Live: https://athena-ui-js-demo-duc7dncrfhg5fxfs.northeurope-01.azurewebsites.net** (deployed from `master` by GitHub Actions; on the Free plan of Azure App Service it sleeps when idle, so the first request can take a few seconds).

```sh
npm run demo            # http://localhost:3000   (PORT=8080 npm run demo for another port)
npm run test:demo       # the server, the API, and every page in headless Chrome
npm run demo:build      # makes demo/dist, the package that is deployed
```

## What is in it

| Folder | |
| --- | --- |
| `demo/server.mjs`, `demo/api.mjs` | Static files with security headers, ETag and gzip; the API: hosts (100,000 made up ones, always the same), metrics (a signal that depends only on the time), a sign in with a session cookie (HttpOnly, SameSite=Strict, Secure on https), two accounts |
| `demo/public/` | The pages (`pages/*.js`, one per group of components, loaded when first visited) and `demo.css` (a theme of its own, "Ocean", is two blocks of tokens) |
| `demo/tests/` | `demo.test.mjs` (server and API, with Node's test runner), `browser.test.mjs` (the pages in headless Chrome through the DevTools protocol, `cdp.mjs`) |
| `demo/scripts/` | `build-package.mjs` (the deployment package; `build.json` in it names the commit, shown in the footer), `smoke.mjs` (a check of the running site) |

The demo uses Athena UI from `src/` of this repository (`/athena/...`), not from npm: it always shows the code that is deployed.
The accounts are made up and public: `demo` / `demo-pass` (viewer) and `admin` / `admin-pass` (administrator). The data lives in memory and nothing is stored.

## Deploying to Azure App Service

The workflow `.github/workflows/demo-deploy.yml` runs the tests (`ci.yml`), builds `demo/dist` (server, pages and a copy of `src/`; no dependencies, so Azure installs and builds
nothing), deploys it with `azure/webapps-deploy`, and then checks the site (`demo/scripts/smoke.mjs`: the new version answers and runs the deployed commit, the files are there, the headers are strict, and the
cookie is HttpOnly, Secure and SameSite=Strict). It runs when `master` changes, and on request from any branch (Actions, "Deploy the demo to Azure App Service", Run workflow).

### Once, in Azure (Linux App Service, Node 24)

1. **Runtime**: Settings, Configuration, Stack settings: Node 24 LTS. Leave the *Startup Command* empty (App Service runs `npm start`, which is `node server.mjs`), or set it to `node server.mjs`.
2. **HTTPS only**: Settings, Configuration, General settings, *HTTPS Only* on. **Always On** on (not on the free plan; without it the first request after a quiet time waits for the start).
   Minimum TLS 1.2 or later.
3. **Port**: nothing to do. The server listens on `PORT` (which App Service sets) or `WEBSITES_PORT`. The cookie is `Secure` because the server trusts `X-Forwarded-Proto` when it runs on App Service.
4. **Deployment credentials**: the workflow uses the publish profile, which needs *SCM Basic Auth Publishing Credentials* on (Settings, Configuration, General settings). New apps have it off. With the CLI:

   ```sh
   az resource update --resource-group <group> --name scm --namespace Microsoft.Web --resource-type basicPublishingCredentialsPolicies --parent sites/<app> --set properties.allow=true
   ```

5. **The publish profile**: Overview, *Download publish profile*, or

   ```sh
   az webapp deployment list-publishing-profiles --resource-group <group> --name <app> --xml > publish-profile.xml
   ```

### Once, in GitHub

The workflow deploys through an *environment* named `demo`. A secret of an environment is only given to jobs that deploy to it (and you can require a reviewer for it).

```sh
gh api -X PUT repos/csabatibortoth/athena-ui/environments/demo
gh variable set AZURE_WEBAPP_NAME --env demo --body "<the name of the app service>"
gh secret set AZURE_WEBAPP_PUBLISH_PROFILE --env demo < publish-profile.xml
```

Delete `publish-profile.xml` afterwards (it contains the deployment password). Then run the workflow once by hand and open the URL it prints.
If a step says the variable or the secret is missing, the first step of the deploy job tells which.

To rotate the credentials: *Reset publish profile* in Azure and set the secret again.

### Without a long lived secret (OIDC), if you prefer

A federated credential lets GitHub sign in without a stored password. Create an app registration with a federated credential for
`repo:csabatibortoth/athena-ui:environment:demo`, give it the *Website Contributor* role on the app, store `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`
and `AZURE_SUBSCRIPTION_ID` as variables of the environment, and in `demo-deploy.yml` add `permissions: id-token: write` to the deploy job and replace the `publish-profile` line by a login step before the deploy:

```yaml
      - uses: azure/login@v2
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}
```

`azure/webapps-deploy@v3` then deploys with that login (no `publish-profile`, and no need to switch SCM basic auth on).

## Security of the demo

It is a public page with fake data, but it is written as if it were not: no inline script or style (the policy forbids them), the same-origin check and `SameSite=Strict` on every post,
JSON only with a size limit, a rate limit on sign in, sessions in memory with a lifetime and a cap, a constant time comparison of passwords, no file outside the two folders and no
hidden file can be asked for, and the security headers (`Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `X-Frame-Options`) are on every answer.
The demo accounts are public on purpose and have no power: nothing the demo can do changes anything outside its own memory.
