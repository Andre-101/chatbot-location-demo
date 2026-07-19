import { checkApiHealth, getNearestPoints, parseIntent } from "./api.js";
import {
  buildExternalRouteUrl,
  drawRoute,
  initializeMap,
  showCurrentPosition,
} from "./map.js";
import {
  buildRecommendationReason,
  getChannelForAction,
  validateParsedIntent,
} from "./recommendation.js";

const isMobileGps = window.matchMedia("(pointer: coarse), (max-width: 640px)").matches;

const state = {
  location: null,
  busy: false,
  pendingQuery: "",
  watchId: null,
};

const elements = {
  apiStatus: document.querySelector("#api-status"),
  locationButton: document.querySelector("#location-button"),
  locationLabel: document.querySelector("#location-label"),
  messages: document.querySelector("#messages"),
  form: document.querySelector("#chat-form"),
  input: document.querySelector("#chat-input"),
  sendButton: document.querySelector(".send-button"),
  quickActions: document.querySelectorAll(".quick-action"),
  empty: document.querySelector("#recommendation-empty"),
  card: document.querySelector("#recommendation-card"),
  resultCard: document.querySelector(".result-card"),
  resultState: document.querySelector("#result-state"),
  type: document.querySelector("#recommendation-type"),
  distanceBadge: document.querySelector("#recommendation-distance"),
  name: document.querySelector("#recommendation-name"),
  address: document.querySelector("#recommendation-address"),
  distance: document.querySelector("#route-distance"),
  duration: document.querySelector("#route-duration"),
  reason: document.querySelector("#recommendation-reason"),
  routeLink: document.querySelector("#open-route-link"),
  alternativesSection: document.querySelector("#alternatives-section"),
  alternatives: document.querySelector("#alternatives"),
};

initializeMap();
bindEvents();
verifyApi();

function bindEvents() {
  elements.locationButton.addEventListener("click", () => requestLocation());
  elements.form.addEventListener("submit", handleSubmit);

  elements.quickActions.forEach(button => {
    button.addEventListener("click", () => {
      elements.input.value = button.dataset.query || "";
      elements.input.focus();
      elements.input.setSelectionRange(elements.input.value.length, elements.input.value.length);
    });
  });
}

async function verifyApi() {
  try {
    await checkApiHealth();
    setApiStatus("En línea", true);
  } catch (error) {
    console.error(error);
    setApiStatus("Sin conexión", false);
  }
}

function requestLocation() {
  if (!navigator.geolocation) {
    addMessage("La ubicación no está disponible en este navegador.", "assistant");
    return;
  }

  setLocationState("loading");

  const options = {
    enableHighAccuracy: true,
    timeout: 20000,
    maximumAge: isMobileGps ? 0 : 30000,
  };

  if (isMobileGps) {
    if (state.watchId !== null) navigator.geolocation.clearWatch(state.watchId);

    state.watchId = navigator.geolocation.watchPosition(
      handlePosition,
      handleLocationError,
      options,
    );
    return;
  }

  navigator.geolocation.getCurrentPosition(handlePosition, handleLocationError, options);
}

async function handlePosition(position) {
  const firstFix = !state.location;

  state.location = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
  };

  setLocationState("active");
  showCurrentPosition(state.location, { center: firstFix });

  if (state.pendingQuery && !state.busy) {
    const query = state.pendingQuery;
    state.pendingQuery = "";
    await processQuery(query);
  }
}

function handleLocationError(error) {
  setLocationState("idle");
  addMessage(locationErrorMessage(error), "assistant");
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
    addMessage(isMobileGps ? "Activando GPS…" : "Obteniendo tu ubicación…", "assistant");
    requestLocation();
    return;
  }

  await processQuery(query);
}

async function processQuery(query) {
  if (state.busy) return;

  setBusy(true);
  setResultState("Buscando", false);

  try {
    const intentResponse = await parseIntent(query);
    const parsed = intentResponse.parsed;
    const validationMessage = validateParsedIntent(parsed);

    if (validationMessage) {
      addMessage(validationMessage, "assistant");
      setResultState("Esperando consulta", false);
      return;
    }

    const requestedChannel = getChannelForAction(parsed.action);
    const nearestResponse = await getNearestPoints({
      latitude: state.location.latitude,
      longitude: state.location.longitude,
      type: "",
      limit: 50,
    });

    const allNearby = Array.isArray(nearestResponse.points)
      ? nearestResponse.points
      : [];

    const compatible = allNearby
      .filter(point => channelMatches(point.channel_type, requestedChannel))
      .slice(0, 5);

    if (!compatible.length) {
      addMessage("No encontré una opción disponible para esa operación.", "assistant");
      setResultState("Sin resultados", false);
      return;
    }

    const ranked = await rankByRoadRoute(compatible.slice(0, 3));
    const recommendation = ranked[0];

    showRecommendation(parsed.action, recommendation);
    showAlternatives(ranked.slice(1));
    addMessage("Listo. Esta es la mejor opción.", "assistant");
    setResultState("Ruta lista", true);

    if (window.matchMedia("(max-width: 980px)").matches) {
      elements.resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } catch (error) {
    console.error(error);
    addMessage("No pude completar la búsqueda. Intenta de nuevo.", "assistant");
    setResultState("Intenta de nuevo", false);
  } finally {
    setBusy(false);
  }
}

function channelMatches(value, expected) {
  if (!expected) return true;

  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");

  const aliases = {
    atm_site: new Set(["atm_site", "atm", "cajero", "cajero_automatico", "cash_machine"]),
    office: new Set(["office", "oficina", "branch", "sucursal"]),
  };

  return aliases[expected]?.has(normalized) || normalized === expected;
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
  const distanceText = formatDistance(point.route.distanceM);

  elements.empty.classList.add("hidden");
  elements.card.classList.remove("hidden");
  elements.type.textContent = channelMatches(point.channel_type, "atm_site") ? "Cajero" : "Oficina";
  elements.distanceBadge.textContent = distanceText;
  elements.name.textContent = point.display_name;
  elements.address.textContent = `${point.address}, ${titleCase(point.city)}`;
  elements.distance.textContent = distanceText;
  elements.duration.textContent = point.route.durationS
    ? formatDuration(point.route.durationS)
    : "—";
  elements.reason.textContent = buildRecommendationReason(action, point);
  elements.routeLink.href = buildExternalRouteUrl(state.location, point);
}

function showAlternatives(points) {
  elements.alternatives.replaceChildren();

  if (!points.length) {
    elements.alternativesSection.classList.add("hidden");
    return;
  }

  for (const point of points) {
    const article = document.createElement("article");
    article.className = "alternative-card";
    article.innerHTML = `
      <span class="channel-badge">${channelMatches(point.channel_type, "atm_site") ? "Cajero" : "Oficina"}</span>
      <h3>${escapeHtml(point.display_name)}</h3>
      <p>${escapeHtml(point.address)}</p>
      <strong>${formatDistance(point.route.distanceM)}</strong>
    `;
    elements.alternatives.append(article);
  }

  elements.alternativesSection.classList.remove("hidden");
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
  elements.sendButton.disabled = value;
  elements.sendButton.setAttribute("aria-label", value ? "Buscando" : "Enviar consulta");
  elements.sendButton.querySelector("span").textContent = value ? "…" : "→";
}

function setApiStatus(text, available) {
  elements.apiStatus.lastChild.textContent = ` ${text}`;
  elements.apiStatus.dataset.available = String(available);
}

function setLocationState(status) {
  const labels = {
    idle: isMobileGps ? "Activar GPS" : "Activar ubicación",
    loading: isMobileGps ? "Buscando GPS…" : "Buscando…",
    active: isMobileGps ? "GPS activo" : "Ubicación activa",
  };

  elements.locationLabel.textContent = labels[status];
  elements.locationButton.disabled = status === "loading";
  elements.locationButton.dataset.active = String(status === "active");
}

function setResultState(text, active) {
  elements.resultState.textContent = text;
  elements.resultState.dataset.active = String(active);
}

function formatDistance(meters) {
  if (!Number.isFinite(meters)) return "—";
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

function locationErrorMessage(error) {
  if (error.code === error.PERMISSION_DENIED) return "Necesito permiso para usar tu ubicación.";
  if (error.code === error.POSITION_UNAVAILABLE) return "No pude obtener tu ubicación.";
  if (error.code === error.TIMEOUT) return "La ubicación tardó demasiado. Intenta de nuevo.";
  return "No pude obtener tu ubicación.";
}

function titleCase(value) {
  return String(value || "")
    .toLocaleLowerCase("es")
    .replace(/(^|\s)\p{L}/gu, letter => letter.toLocaleUpperCase("es"));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
