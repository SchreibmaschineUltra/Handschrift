// Cloudflare Worker: lässt nur Besucher mit persönlichem Link auf die Seite
// und liefert dann die Seite aus public/ aus.
//  - /?k=SCHLÜSSEL beim ersten Öffnen: bindet den Link an dieses Gerät (Cookie)
//  - danach reicht das Cookie
//  - der Besitzer-Link (OWNER_TOKEN) funktioniert auf beliebig vielen Geräten
//  - /api/me und /api/links für die Verwaltung (nur Besitzer)
import { loadLinks, saveLinks, rand, readCookie, cookieHeader, identify, isOwner, json, MAX_LINKS } from "../lib/access.js";

const page = (title, text, status) =>
  new Response(
    `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>SchreibmaschineUltra</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#1d4d45;font:17px/1.55 system-ui,sans-serif;color:#1a1c1f;padding:20px;box-sizing:border-box}
main{background:#fff;max-width:460px;padding:32px 28px;box-shadow:0 18px 30px rgba(0,0,0,.3);border-radius:3px;text-align:center}
h1{font:400 26px/1.2 "Courier New",ui-monospace,monospace;margin:0 0 12px}p{margin:0;color:#3f4a47}
</style></head><body><main><h1>${title}</h1><p>${text}</p></main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
  );

const denied = () => page("Kein Zugang", "Diese Seite ist nur mit einem persönlichen Link nutzbar. Öffne den Link, den du bekommen hast.", 403);
const usedElsewhere = () =>
  page("Link schon vergeben", "Dieser Link wurde bereits auf einem anderen Gerät aktiviert. Jeder Link gilt nur für ein Gerät. Bitte frag nach einem neuen Link oder lass das Gerät zurücksetzen.", 403);

async function apiLinks(request, env, who) {
  if (!who.owner) return json({ error: "forbidden" }, 403);
  const origin = new URL(request.url).origin;
  const links = await loadLinks(env);
  // Früher gespeicherte Besuchsdaten (IP, Zeit) löschen, falls noch vorhanden
  await Promise.all(Object.keys(links).map(async (t) => { if ((await env.DB.get("seen:" + t)) !== null) await env.DB.delete("seen:" + t); }));
  const list = () => ({
    max: MAX_LINKS,
    links: Object.entries(links)
      .map(([token, l]) => ({
        token, name: l.name, created: l.created, activated: l.activated || null,
        status: l.blocked ? "gesperrt" : l.device ? "aktiv" : "offen",
        url: `${origin}/?k=${token}`,
      }))
      .sort((a, b) => a.created.localeCompare(b.created)),
  });
  if (request.method === "GET") return json(list());
  if (request.method !== "POST") return json({ error: "method" }, 405);
  const b = await request.json().catch(() => ({}));
  const l = b.token ? links[b.token] : null;
  switch (b.action) {
    case "create": {
      if (Object.keys(links).length >= MAX_LINKS) return json({ error: "max", ...list() }, 409);
      const name = String(b.name || "").trim().slice(0, 40) || "Freund";
      links[rand()] = { name, created: new Date().toISOString(), device: null, activated: null, blocked: false };
      break;
    }
    case "reset": if (!l) return json({ error: "unknown" }, 404); l.device = null; l.activated = null; break;
    case "block": if (!l) return json({ error: "unknown" }, 404); l.blocked = true; break;
    case "unblock": if (!l) return json({ error: "unknown" }, 404); l.blocked = false; break;
    case "delete": if (!l) return json({ error: "unknown" }, 404); delete links[b.token]; break;
    default: return json({ error: "action" }, 400);
  }
  await saveLinks(env, links);
  return json(list());
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/robots.txt")
      return new Response("User-agent: *\nDisallow: /\n", { headers: { "content-type": "text/plain" } });
    if (!env.DB) return page("Noch nicht eingerichtet", "Der Speicher fehlt (KV-Binding „DB“).", 500);

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
    if (!who) return url.pathname.startsWith("/api/") ? json({ error: "forbidden" }, 403) : denied();
    if (url.pathname === "/api/me") return json({ owner: !!who.owner, name: who.link ? who.link.name : null });
    if (url.pathname === "/api/links") return apiLinks(request, env, who);
    // Verwaltung nur für den Besitzer
    if (/^\/admin(\.html)?\/?$/.test(url.pathname) && !who.owner) return denied();

    const res = await env.ASSETS.fetch(request);
    const out = new Response(res.body, res);
    out.headers.set("cache-control", "no-store");
    out.headers.set("x-robots-tag", "noindex");
    // Ausweis bei jedem Öffnen der Seite verlängern, damit er nie abläuft
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      const c = readCookie(request);
      if (c) out.headers.append("Set-Cookie", cookieHeader(c.token, c.device));
    }
    return out;
  },
};
