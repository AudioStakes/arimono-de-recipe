const BEACON_SOURCE = "https://static.cloudflareinsights.com/beacon.min.js";
const PRODUCTION_ORIGIN = "https://arimono-de-recipe.pages.dev";
// Public site identifier, not a Cloudflare API credential.
const SITE_TOKEN = "cbfdc0af97dc410f89024a9de8ecc87b";

export function initializeWebAnalytics(): void {
  if (window.location.origin !== PRODUCTION_ORIGIN) return;

  const install = (): void => {
    if (document.querySelector(`script[src="${BEACON_SOURCE}"]`)) return;
    const script = document.createElement("script");
    script.type = "module";
    script.async = true;
    script.fetchPriority = "low";
    script.src = BEACON_SOURCE;
    script.dataset["cfBeacon"] = JSON.stringify({ token: SITE_TOKEN });
    document.body.append(script);
  };

  if (document.readyState === "complete") {
    install();
  } else {
    window.addEventListener("load", install, { once: true });
  }
}
