import { APP_CONFIG } from "./config.js";

let map;
let userMarker;
let pointMarker;
let routeLayer;
let resizeObserver;

export function initializeMap() {
  const container = document.querySelector("#map");

  map = L.map(container, {
    zoomControl: true,
    preferCanvas: true,
  }).setView([4.5709, -74.2973], 5);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  const refreshSize = () => {
    window.requestAnimationFrame(() => map.invalidateSize({ pan: false }));
  };

  resizeObserver = new ResizeObserver(refreshSize);
  resizeObserver.observe(container);

  window.addEventListener("load", refreshSize, { once: true });
  window.addEventListener("resize", refreshSize);
  window.setTimeout(refreshSize, 100);
  window.setTimeout(refreshSize, 500);
}

export async function drawRoute(origin, destination) {
  clearMapLayers();
  map.invalidateSize({ pan: false });

  userMarker = L.marker([origin.latitude, origin.longitude])
    .addTo(map)
    .bindPopup("Tu ubicación");

  pointMarker = L.marker([destination.latitude, destination.longitude])
    .addTo(map)
    .bindPopup(destination.display_name);

  const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const url = `${APP_CONFIG.OSRM_BASE_URL}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`OSRM HTTP ${response.status}`);

    const data = await response.json();
    const route = data.routes?.[0];
    if (!route) throw new Error("OSRM no devolvió una ruta.");

    routeLayer = L.geoJSON(route.geometry, { weight: 5 }).addTo(map);
    map.invalidateSize({ pan: false });
    map.fitBounds(routeLayer.getBounds(), { padding: [32, 32] });

    return {
      distanceM: route.distance,
      durationS: route.duration,
    };
  } catch (error) {
    const bounds = L.latLngBounds([
      [origin.latitude, origin.longitude],
      [destination.latitude, destination.longitude],
    ]);
    map.invalidateSize({ pan: false });
    map.fitBounds(bounds, { padding: [32, 32] });
    throw error;
  }
}

function clearMapLayers() {
  for (const layer of [userMarker, pointMarker, routeLayer]) {
    if (layer && map.hasLayer(layer)) map.removeLayer(layer);
  }
}

export function buildExternalRouteUrl(origin, destination) {
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${origin.latitude}%2C${origin.longitude}%3B${destination.latitude}%2C${destination.longitude}`;
}
