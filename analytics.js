(function () {
  "use strict";

  const tagId = "G-GCQMGDYCH6";

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", tagId);

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(tagId);
  document.head.appendChild(script);

  function trackCallToAction(event) {
    if (typeof window.gtag !== "function") return;
    const target = event.target instanceof Element ? event.target : event.target && event.target.parentElement;
    const link = target && target.closest ? target.closest("a[href]") : null;
    if (!link) return;

    let url;
    try {
      url = new URL(link.href, window.location.href);
    } catch (error) {
      return;
    }

    let eventName = "";
    if (url.hostname === "jup.ag" || url.hostname.endsWith(".jup.ag")) eventName = "click_jupiter";
    else if (url.hostname === "meteora.ag" || url.hostname.endsWith(".meteora.ag")) eventName = "click_meteora";
    else if (url.hostname === "t.me" && url.pathname.toLowerCase().includes("milvexa")) eventName = "click_telegram";
    else if (url.hostname === "docs.google.com" && url.pathname.includes("/forms/")) eventName = "click_signup";
    else if (url.origin === window.location.origin && url.pathname.endsWith("charge-partners.html")) eventName = "click_partner_info";
    else if (url.origin === window.location.origin && url.pathname.includes("/charge/pilot")) eventName = "click_charge_pilot";

    if (eventName) {
      window.gtag("event", eventName, { link_url: url.href });
    }
  }

  document.addEventListener("click", trackCallToAction);
})();
