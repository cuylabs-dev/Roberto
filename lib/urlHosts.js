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

export function isSocialOnlyUrl(url) {
  const d = extractDomain(url);
  if (!d) return false;
  return SOCIAL_HOSTS.some((h) => d === h || d.endsWith(`.${h}`));
}
