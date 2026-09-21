// Where the API lives.
//
// Self-hosted installs MUST set VITE_API_BASE_URL at build time (or serve the API
// from the same origin as the app, in which case it can stay empty). We never
// fall back to the author's hosted demo API for other domains — that would silently
// send a customer's data to our servers.
const DEMO_API_BY_HOST = {
  "ordo-inky.vercel.app": "https://ordo-api-30dh.onrender.com",
  "ordo-benjaminbaya.vercel.app": "https://ordo-api-30dh.onrender.com",
};

function resolveApiBase() {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  if (import.meta.env.DEV) return "http://localhost:5000";
  if (typeof window !== "undefined" && DEMO_API_BY_HOST[window.location.hostname]) {
    return DEMO_API_BY_HOST[window.location.hostname];
  }
  return ""; // same origin
}

export const API_BASE_URL = resolveApiBase();

/** Absolute URL for a server-relative asset path such as "/uploads/abc.png". */
export const assetUrl = (path) => (path ? `${API_BASE_URL}${path}` : null);
