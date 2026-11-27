// Verwaltung der persönlichen Links – nur für den Besitzer.
// GET  /api/links            -> Liste
// POST /api/links {action, ...}
//   create {name} | reset {token} | block {token} | unblock {token} | delete {token}
import { json, loadLinks, saveLinks, rand, MAX_LINKS } from "../../lib/access.js";

const list = (links, origin) => ({
  max: MAX_LINKS,
  links: Object.entries(links)
    .map(([token, l]) => ({
      token, name: l.name, created: l.created, activated: l.activated || null,
      status: l.blocked ? "gesperrt" : l.device ? "aktiv" : "offen",
      url: `${origin}/?k=${token}`,
    }))
    .sort((a, b) => a.created.localeCompare(b.created)),
});

export async function onRequest({ request, env, data }) {
  if (!data.who.owner) return json({ error: "forbidden" }, 403);
  const origin = new URL(request.url).origin;
  const links = await loadLinks(env);
  if (request.method === "GET") return json(list(links, origin));
  if (request.method !== "POST") return json({ error: "method" }, 405);

  const b = await request.json().catch(() => ({}));
  const l = b.token ? links[b.token] : null;
  switch (b.action) {
    case "create": {
      if (Object.keys(links).length >= MAX_LINKS) return json({ error: "max", ...list(links, origin) }, 409);
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
  return json(list(links, origin));
}
