import { checkApiHealth, getNearestPoints, parseIntent } from "./api.js";
import { buildExternalRouteUrl, drawRoute, initializeMap } from "./map.js";
import { buildRecommendationReason, getChannelForAction, validateParsedIntent } from "./recommendation.js";

const state = {
  location: null,
  busy: false,
  pendingQuery: "",
};

const elements = {
  apiStatus: document.querySelector("#api-status"),
  locationButton: document.querySelector("#location-button"),
  messages: document.querySelector("#messages"),
  form: document.querySelector("#chat-form"),
  input: document.querySelector("#chat-input"),
  empty: document.querySelector("#recommendation-empty"),
  card: document.querySelector("#recommendation-card"),
  type: document.querySelector("#recommendation-type"),
  quality: document.querySelector("#recommendation-quality"),
  name: document.querySelector("#recommendation-name"),
  address: document.querySelector("#recommendation-address"),
  distance: document.querySelector("#route-distance"),
  duration: document.querySelector("#route-duration"),
  reason: document.querySelector("#recommendation-reason"),
  routeLink: document.querySelector("#open-route-link"),
  alternatives: document.querySelector("#alternatives"),
};

initializeMap();
bindEvents();
verifyApi();

function bindEvents() {
  elements.locationButton.addEventListener("click", requestLocation);
  elements.form.addEventListener("submit", handleSubmit);
}

async function verifyApi() {
  try {
    await checkApiHealth();
    setApiStatus("Servicio disponible", true);
  } catch (error) {
    setApiStatus("Servicio no disponible", false);
    addMessage("No pude conectar con el servicio de datos. Revisa el despliegue de Apps Script.", "assistant");
  }
}

function requestLocation() {
  if (!navigator.geolocation) {
    addMessage("Este navegador no ofrece geolocalización.", "assistant");
    return;
  }

  elements.locationButton.disabled = true;
  elements.locationButton.textContent = "Obteniendo ubicación…";

  navigator.geolocation.getCurrentPosition(
    async position => {
      state.location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      elements.locationButton.textContent = "Ubicación lista";
      addMessage("Ubicación recibida. Ya puedo buscar opciones cercanas.", "assistant");

      if (state.pendingQuery) {
        const query = state.pendingQuery;
        state.pendingQuery = "";
        addMessage("Retomando tu solicitud anterior…", "assistant");
        await processQuery(query);
      }
    },
    error => {
      elements.locationButton.disabled = false;
      elements.locationButton.textContent = "Usar mi ubicación";
      addMessage(locationErrorMessage(error), "assistant");
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
  );
}

async function handleSubmit(event) {
  event.preventDefault();
  if (state.busy) return;

  const query = elements.input.value.trim();
  if (!query) return;

  addMessage(query, "user");
  elements.input.value = "";

  if (!state.location) {
    state.pendingQuery = query;
    addMessage("Primero necesito tu ubicación. Pulsa “Usar mi ubicación”; continuaré automáticamente cuando la reciba.", "assistant");
    return;
  }

  await processQuery(query);
}

async function processQuery(query) {
  if (state.busy) return;

  setBusy(true);

  try {
    const intentResponse = await parseIntent(query);
    const parsed = intentResponse.parsed;
    const validationMessage = validateParsedIntent(parsed);

    if (validationMessage) {
      addMessage(validationMessage, "assistant");
      return;
    }

    const channelType = getChannelForAction(parsed.action);
    const nearestResponse = await getNearestPoints({
      latitude: state.location.latitude,
      longitude: state.location.longitude,
      type: channelType,
      limit: 5,
    });

    if (!nearestResponse.points.length) {
      addMessage("No encontré puntos compatibles cercanos en la base demostrativa.", "assistant");
      return;
    }

    const ranked = await rankByRoadRoute(nearestResponse.points.slice(0, 3));
    const recommendation = ranked[0];

    showRecommendation(parsed.action, recommendation);
    showAlternatives(ranked.slice(1));
    addMessage(`Encontré una opción para tu solicitud: ${recommendation.display_name}.`, "assistant");
  } catch (error) {
    console.error(error);
    addMessage(error.message || "Ocurrió un error al procesar la solicitud.", "assistant");
  } finally {
    setBusy(false);
  }
}

async function rankByRoadRoute(points) {
  const evaluated = [];

  for (const point of points) {
    try {
      const route = await drawRoute(state.location, point);
      evaluated.push({ ...point, route });
    } catch {
      evaluated.push({
        ...point,
        route: {
          distanceM: point.straight_line_distance_m,
          durationS: null,
        },
      });
    }
  }

  evaluated.sort((a, b) => {
    const aDuration = a.route.durationS ?? Number.POSITIVE_INFINITY;
    const bDuration = b.route.durationS ?? Number.POSITIVE_INFINITY;
    if (aDuration !== bDuration) return aDuration - bDuration;
    return a.route.distanceM - b.route.distanceM;
  });

  await drawRoute(state.location, evaluated[0]);
  return evaluated;
}

function showRecommendation(action, point) {
  elements.empty.classList.add("hidden");
  elements.card.classList.remove("hidden");
  elements.type.textContent = point.channel_type === "atm_site" ? "Cajero" : "Oficina";
  elements.quality.textContent = point.geocoding_quality || "exact";
  elements.name.textContent = point.display_name;
  elements.address.textContent = `${point.address}, ${point.city}`;
  elements.distance.textContent = formatDistance(point.route.distanceM);
  elements.duration.textContent = point.route.durationS ? formatDuration(point.route.durationS) : "No disponible";
  elements.reason.textContent = buildRecommendationReason(action, point);
  elements.routeLink.href = buildExternalRouteUrl(state.location, point);
}

function showAlternatives(points) {
  elements.alternatives.replaceChildren();

  if (!points.length) {
    elements.alternatives.innerHTML = '<p class="empty-alternatives">No hay más alternativas cercanas.</p>';
    return;
  }

  for (const point of points) {
    const article = document.createElement("article");
    article.className = "alternative-card";
    article.innerHTML = `
      <span class="channel-badge">${point.channel_type === "atm_site" ? "Cajero" : "Oficina"}</span>
      <h3>${escapeHtml(point.display_name)}</h3>
      <p>${escapeHtml(point.address)}</p>
      <strong>${formatDistance(point.route.distanceM)}</strong>
    `;
    elements.alternatives.append(article);
  }
}

function addMessage(text, role) {
  const article = document.createElement("article");
  article.className = `message ${role === "user" ? "user-message" : "assistant-message"}`;
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  article.append(paragraph);
  elements.messages.append(article);
  elements.messages.scrollTop = elements.messages.scrollHeight;
}

function setBusy(value) {
  state.busy = value;
  elements.input.disabled = value;
  elements.form.querySelector("button").disabled = value;
  elements.form.querySelector("button").textContent = value ? "Consultando…" : "Buscar";
}

function setApiStatus(text, available) {
  elements.apiStatus.textContent = text;
  elements.apiStatus.dataset.available = String(available);
}

function formatDistance(meters) {
  if (!Number.isFinite(meters)) return "No disponible";
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

function locationErrorMessage(error) {
  if (error.code === error.PERMISSION_DENIED) return "No recibí permiso para usar la ubicación.";
  if (error.code === error.POSITION_UNAVAILABLE) return "El navegador no pudo determinar la ubicación.";
  if (error.code === error.TIMEOUT) return "La solicitud de ubicación tardó demasiado.";
  return "No pude obtener la ubicación.";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
