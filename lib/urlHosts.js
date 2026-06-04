const SOCIAL_HOSTS = [
  "facebook.com",
  "instagram.com",
  "linktr.ee",
  "wa.me",
  "whatsapp.com",
  "tiktok.com",
  "twitter.com",
  "x.com",
];

export function extractDomain(url) {
  if (!url || typeof url !== "string") return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/** Quita redirects de Google Maps (`/url?q=...`) y deja URL visitable. */
export function normalizeWebsiteUrl(raw) {
  if (!raw || typeof raw !== "string") return null;
  let url = raw.trim();
  if (!url) return null;

  if (url.startsWith("/url?")) {
    try {
      const u = new URL(`https://www.google.com${url}`);
      url = u.searchParams.get("q") || u.searchParams.get("url") || url;
    } catch {
      /* keep */
    }
  }

  if (/google\.com\/url/i.test(url)) {
    try {
      const u = new URL(url.startsWith("http") ? url : `https://${url}`);
      url = u.searchParams.get("q") || u.searchParams.get("url") || url;
    } catch {
      /* keep */
    }
  }

  if (!url.startsWith("http")) url = `https://${url}`;
  try {
    const u = new URL(url);
    if (u.hostname.includes("google.") && !u.searchParams.get("q")) return null;
    return u.href;
  } catch {
    return null;
  }
}

export function isSocialOnlyUrl(url) {
  const d = extractDomain(url);
  if (!d) return false;
  return SOCIAL_HOSTS.some((h) => d === h || d.endsWith(`.${h}`));
}
