// Exportkontingent für den GoodNotes-Export (Cloudflare Pages Function).
//
// Voraussetzungen in Cloudflare (Pages-Projekt → Einstellungen):
//   - KV-Namespace als Binding "QUOTA"
//   - Variable ADMINS: E-Mail-Adressen ohne Limit, durch Komma getrennt
//   - Variable LIMIT (optional): Exporte pro Woche, Standard 10
// Die Seite muss mit Cloudflare Access geschützt sein; Access liefert die
// E-Mail-Adresse der angemeldeten Person im Header mit.
//
// GET  /api/quota  -> aktueller Stand
// POST /api/quota  -> einen Export verbuchen (429, wenn das Limit erreicht ist)

const DEFAULT_LIMIT = 10;

// Woche beginnt montags 00:00 Uhr deutscher Zeit (näherungsweise UTC+1).
const OFFSET_MS = 60 * 60 * 1000;

function weekStart(now = Date.now()) {
  const d = new Date(now + OFFSET_MS);
  const day = (d.getUTCDay() + 6) % 7; // Montag = 0
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day) - OFFSET_MS;
}

function config(env) {
  const limit = parseInt(env.LIMIT, 10);
  return {
    limit: Number.isFinite(limit) && limit >= 0 ? limit : DEFAULT_LIMIT,
    admins: String(env.ADMINS || "").toLowerCase().split(/[\s,;]+/).filter(Boolean),
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function state(request, env, now) {
  const email = (request.headers.get("Cf-Access-Authenticated-User-Email") || "").trim().toLowerCase();
  if (!email) return { error: json({ error: "not_logged_in" }, 401) };
  if (!env.QUOTA) return { error: json({ error: "not_configured" }, 500) };
  const { limit, admins } = config(env);
  const start = weekStart(now);
  const key = `q:${email}:${start}`;
  const used = parseInt(await env.QUOTA.get(key), 10) || 0;
  return {
    key, email, limit, used,
    admin: admins.includes(email),
    resetsAt: new Date(start + 7 * 24 * 3600 * 1000).toISOString(),
  };
}

const view = (s) => ({
  email: s.email,
  admin: s.admin,
  limit: s.admin ? null : s.limit,
  used: s.used,
  remaining: s.admin ? null : Math.max(0, s.limit - s.used),
  resetsAt: s.resetsAt,
});

export async function onRequestGet({ request, env }) {
  const s = await state(request, env);
  return s.error || json(view(s));
}

export async function onRequestPost({ request, env }) {
  const s = await state(request, env);
  if (s.error) return s.error;
  if (s.admin) return json(view(s));
  if (s.used >= s.limit) return json({ ...view(s), error: "limit_reached" }, 429);
  s.used += 1;
  await env.QUOTA.put(s.key, String(s.used), { expirationTtl: 15 * 24 * 3600 });
  return json(view(s));
}
