// Loads jQuery only when the test run asks for it (it is optional since 1.3). An external file, because the page runs under a strict
// Content-Security-Policy (see run.mjs): no inline script, no inline style.
//   ?jquery=cdn loads it from the jQuery CDN, ?jquery=<url> from there.
const jquery = new URLSearchParams(location.search).get("jquery");
if (jquery) {
    const script = document.createElement("script");
    script.src = jquery === "cdn" ? "https://code.jquery.com/jquery-4.0.0.min.js" : jquery;
    script.async = false;
    document.head.append(script);
}
