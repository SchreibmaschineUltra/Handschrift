// Lässt nur Besucher mit gültigem persönlichem Link auf die Seite.
//  - /?k=SCHLÜSSEL beim ersten Öffnen: bindet den Link an dieses Gerät (Cookie)
//  - danach reicht das Cookie
//  - der Besitzer-Link (OWNER_TOKEN) funktioniert auf beliebig vielen Geräten
import { loadLinks, saveLinks, rand, readCookie, cookieHeader, identify, isOwner } from "../lib/access.js";

const page = (title, text, status) =>
  new Response(
    `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SchreibmaschineUltra</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#1d4d45;font:17px/1.55 system-ui,sans-serif;color:#1a1c1f;padding:20px;box-sizing:border-box}
main{background:#fff;max-width:460px;padding:32px 28px;box-shadow:0 18px 30px rgba(0,0,0,.3);border-radius:3px;text-align:center}
h1{font:400 26px/1.2 "Courier New",ui-monospace,monospace;margin:0 0 12px}p{margin:0;color:#3f4a47}
</style></head><body><main><h1>${title}</h1><p>${text}</p></main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
  );

const denied = () => page("Kein Zugang", "Diese Seite ist nur mit einem persönlichen Link nutzbar. Öffne den Link, den du bekommen hast.", 403);
const usedElsewhere = () =>
  page("Link schon vergeben", "Dieser Link wurde bereits auf einem anderen Gerät aktiviert. Jeder Link gilt nur für ein Gerät. Bitte frag nach einem neuen Link oder lass das Gerät zurücksetzen.", 403);

export async function onRequest(context) {
  const { request, env, next } = context;
  if (!env.DB) return page("Noch nicht eingerichtet", "Der Speicher fehlt (KV-Binding „DB“).", 500);
  const url = new URL(request.url);
  // Suchmaschinen draußen halten
  if (url.pathname === "/robots.txt")
    return new Response("User-agent: *\nDisallow: /\n", { headers: { "content-type": "text/plain" } });
  const k = url.searchParams.get("k");

  if (k) {
    const clean = new URL(url);
    clean.searchParams.delete("k");
    const go = (cookie) =>
      new Response(null, { status: 302, headers: { Location: clean.pathname + clean.search, "Set-Cookie": cookie, "cache-control": "no-store" } });

    if (isOwner(env, k)) {
      const c = readCookie(request);
      return go(cookieHeader(k, c && c.token === k ? c.device : rand()));
    }
    const links = await loadLinks(env);
    const l = links[k];
    if (!l || l.blocked) return denied();
    const c = readCookie(request);
    if (l.device) {
      if (c && c.token === k && c.device === l.device) return go(cookieHeader(k, l.device));
      return usedElsewhere();
    }
    const device = rand();
    l.device = device;
    l.activated = new Date().toISOString();
    await saveLinks(env, links);
    return go(cookieHeader(k, device));
  }

  const who = await identify(request, env);
  if (!who) return url.pathname.startsWith("/api/") ? new Response("Kein Zugang", { status: 403 }) : denied();
  context.data.who = who;
  return next();
}
