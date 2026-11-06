import type { NextRequest } from "next/server";

// Script de rastreo público. Se pega en el <head> de todas las páginas del embudo:
//   <script src="https://TU-DOMINIO/t.js" async></script>
// Opcional: ?hosts=checkout.midominio.com,otro.com para sumar dominios de checkout propios.
//
// Qué hace:
// 1) Lee utm_*, fbclid y ttclid de la URL al llegar y los guarda 30 días (cookie + localStorage),
//    así la origen sobrevive a quiz y páginas intermedias.
// 2) Agrega los parámetros a todo link o formulario de checkout, también a los botones que aparecen después
//    (por ejemplo el de la VSL con retraso), con MutationObserver.
// 3) Traduce al formato que cada gateway devuelve en el webhook:
//    Digistore24 → custom · Hotmart → src y sck · Kiwify → utm_* y sck · Stripe → client_reference_id ·
//    ClickBank → tid · Whop → utm_*. La origen compacta es "f_<id del anuncio>" (Meta), "t_<id>" (TikTok)
//    o "g_<id>" (Google): cabe en cualquier campo.
const SCRIPT = String.raw`(function(){
  if (window.__trk) return; window.__trk = 1;
  var KEYS = ["utm_source","utm_medium","utm_campaign","utm_content","utm_term","utm_id","fbclid","ttclid","gclid","gbraid","wbraid"];
  var NAME = "_trk", DAYS = 30;
  var HOSTS = ["pay.hotmart.com","pay.kiwify.com.br","kiwify.app","digistore24.com","checkout-ds24.com","buy.stripe.com","checkout.stripe.com","pay.clickbank.net","clickbank.net","whop.com"].concat(__EXTRA__);
  function read(){
    try { var v = localStorage.getItem(NAME); if (v) return JSON.parse(v); } catch(e){}
    var m = document.cookie.match(new RegExp("(?:^|; )" + NAME + "=([^;]*)"));
    if (m) { try { return JSON.parse(decodeURIComponent(m[1])); } catch(e){} }
    return null;
  }
  function write(o){
    var s = JSON.stringify(o);
    try { localStorage.setItem(NAME, s); } catch(e){}
    var exp = new Date(Date.now() + DAYS * 864e5).toUTCString();
    var parts = location.hostname.split("."), set = false;
    // Cookie en el dominio raíz para compartirla entre subdominios (quiz.x.com → pagina.x.com).
    for (var i = parts.length - 2; i >= 0 && !set; i--) {
      var dom = parts.slice(i).join(".");
      document.cookie = NAME + "=" + encodeURIComponent(s) + "; expires=" + exp + "; path=/; domain=" + dom + "; SameSite=Lax";
      set = document.cookie.indexOf(NAME + "=") >= 0;
    }
    if (!set) document.cookie = NAME + "=" + encodeURIComponent(s) + "; expires=" + exp + "; path=/; SameSite=Lax";
  }
  var q = new URLSearchParams(location.search), now = {}, has = false;
  for (var i = 0; i < KEYS.length; i++) { var v = q.get(KEYS[i]); if (v) { now[KEYS[i]] = v; has = true; } }
  var data = read();
  if (has) { now.ts = Date.now(); data = now; write(data); }
  var page = location.hostname + location.pathname;
  function compact(d){
    if (!d) return "";
    var src = (d.utm_source || "").toLowerCase();
    var p = /^(tiktok|tt)/.test(src) || d.ttclid ? "t" : (/^(fb|facebook|ig|instagram|meta)/.test(src) || d.fbclid ? "f" : (/^(google|gads|adwords|youtube)/.test(src) || d.gclid || d.gbraid || d.wbraid ? "g" : ""));
    var id = /^\d{5,25}$/.test(d.utm_content || "") ? d.utm_content : (/^\d{5,25}$/.test(d.utm_campaign || "") ? d.utm_campaign : "");
    return p && id ? p + "_" + id : "";
  }
  function isCheckout(u){
    var h = u.hostname.toLowerCase();
    for (var i = 0; i < HOSTS.length; i++) { var x = HOSTS[i]; if (h === x || h.slice(-(x.length + 1)) === "." + x) return true; }
    return false;
  }
  function decorateUrl(href, force){
    var u; try { u = new URL(href, location.href); } catch(e){ return href; }
    if (!force && !isCheckout(u)) return href;
    var d = read() || {}, c = compact(d), h = u.hostname;
    function set(k, v){ if (v && !u.searchParams.get(k)) u.searchParams.set(k, v); }
    for (var i = 0; i < KEYS.length; i++) set(KEYS[i], d[KEYS[i]]);
    set("src", d.utm_source); set("sck", c || ("pg_" + page).slice(0, 60));
    if (/digistore24|checkout-ds24/.test(h)) set("custom", c || ("pg_" + page).slice(0, 60));
    if (/stripe\.com$/.test(h) && c) set("client_reference_id", c);
    if (/clickbank/.test(h) && c) set("tid", c);
    set("page", page);
    return u.toString();
  }
  function decorate(el){
    if (el.tagName === "A" && el.href) { var n = decorateUrl(el.href, el.hasAttribute("data-trk")); if (n !== el.href) el.href = n; }
    else if (el.tagName === "FORM" && el.action) { var m = decorateUrl(el.action, el.hasAttribute("data-trk")); if (m !== el.action) el.action = m; }
  }
  function scan(root){
    if (!root || !root.querySelectorAll) return;
    if (root.tagName === "A" || root.tagName === "FORM") decorate(root);
    var list = root.querySelectorAll("a[href],form[action]");
    for (var i = 0; i < list.length; i++) decorate(list[i]);
  }
  window.trkDecorate = function(url){ return decorateUrl(url, true); };
  document.addEventListener("click", function(e){ var a = e.target && e.target.closest ? e.target.closest("a[href]") : null; if (a) decorate(a); }, true);
  function start(){
    scan(document);
    new MutationObserver(function(ms){
      for (var i = 0; i < ms.length; i++) {
        if (ms[i].type === "attributes") decorate(ms[i].target);
        for (var j = 0; j < ms[i].addedNodes.length; j++) scan(ms[i].addedNodes[j]);
      }
    }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["href","action"] });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();`;

export function GET(req: NextRequest) {
  const extra = (req.nextUrl.searchParams.get("hosts") ?? "")
    .split(",").map((h) => h.trim().toLowerCase()).filter((h) => /^[a-z0-9.-]{3,100}$/.test(h)).slice(0, 20);
  return new Response(SCRIPT.replace("__EXTRA__", JSON.stringify(extra)), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
