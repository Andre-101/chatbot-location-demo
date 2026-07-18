import { APP_CONFIG } from "./config.js";

export async function apiGet(action, parameters = {}) {
  const url = new URL(APP_CONFIG.API_URL);
  url.searchParams.set("action", action);

  for (const [key, value] of Object.entries(parameters)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), { method: "GET" });
  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.message || data.error || "La API no pudo completar la solicitud.");
  }

  return data;
}

export function checkApiHealth() {
  return apiGet("health");
}

export function parseIntent(query) {
  return apiGet("parse", { q: query });
}

export function getNearestPoints({ latitude, longitude, type = "", limit = APP_CONFIG.DEFAULT_NEAREST_LIMIT }) {
  return apiGet("nearest", {
    lat: latitude,
    lon: longitude,
    type,
    limit,
  });
}
