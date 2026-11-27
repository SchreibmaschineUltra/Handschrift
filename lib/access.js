// Gemeinsame Hilfen für den Zugangsschutz mit persönlichen Links.
//
// Einstellungen im Cloudflare-Pages-Projekt:
//   - KV-Namespace als Binding "DB"
//   - Variable OWNER_TOKEN (geheim): Schlüssel des Besitzer-Links
// Gespeichert wird alles unter dem Schlüssel "links" als ein JSON-Objekt:
//   { TOKEN: { name, created, device, activated, blocked } }

export const MAX_LINKS = 15;
export const COOKIE = "hs";
const COOKIE_AGE = 400 * 24 * 3600; // Höchstwert, den Browser akzeptieren

export const rand = (bytes = 16) => {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export async function loadLinks(env) {
  return (await env.DB.get("links", { type: "json" })) || {};
}
export async function saveLinks(env, links) {
  await env.DB.put("links", JSON.stringify(links));
}

export function readCookie(request) {
  const m = (request.headers.get("Cookie") || "").match(/(?:^|;\s*)hs=([^;]+)/);
  if (!m) return null;
  const [token, device] = decodeURIComponent(m[1]).split(".");
  return token && device ? { token, device } : null;
}

export function cookieHeader(token, device) {
  return `${COOKIE}=${encodeURIComponent(token + "." + device)}; Path=/; Max-Age=${COOKIE_AGE}; HttpOnly; Secure; SameSite=Lax`;
}

export const isOwner = (env, token) => !!env.OWNER_TOKEN && token === env.OWNER_TOKEN;

// Wer ist das? -> { owner } | { link } | null
export async function identify(request, env) {
  const c = readCookie(request);
  if (!c) return null;
  if (isOwner(env, c.token)) return { owner: true, token: c.token };
  const links = await loadLinks(env);
  const l = links[c.token];
  if (!l || l.blocked) return null;
  // Gerät muss passen. Direkt nach der Aktivierung kann der Speicher kurz
  // noch den alten Stand liefern (device leer) – dann gilt das Cookie.
  if (l.device && l.device !== c.device) return null;
  return { owner: false, token: c.token, link: l };
}

export function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });
}
