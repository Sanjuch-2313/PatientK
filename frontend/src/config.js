const productionApiUrl = "https://patientk.onrender.com";
const configuredApiUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const localApiUrl = /^https?:\/\/(localhost|127(?:\.\d{1,3}){3})(?::\d+)?$/i;

// Never ship a local development endpoint in a production build, even if
// Netlify has a stale VITE_API_BASE_URL value configured.
export const API_BASE_URL = (
  import.meta.env.PROD && configuredApiUrl && localApiUrl.test(configuredApiUrl)
    ? productionApiUrl
    : configuredApiUrl || productionApiUrl
).replace(/\/+$/, "");
