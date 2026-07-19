import { APP_CONFIG } from "./config.js";

let map;
let userMarker;
let accuracyCircle;
let pointMarker;
let routeLayer;
let resizeObserver;

const userIcon = L.divIcon({
  className: "user-location-marker",
  html: '<span aria-hidden="true"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const destinationIcon = L.divIcon({
  className: "destination-marker",
  html: '<span aria-hidden="true">●</span>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

export function initializeMap() {
  const container = document.querySelector("#map");

  map = L.map(container, {
    zoomControl: true,
    preferCanvas: true,
    attributionControl: true,
  }).setView([4.5709, -74.2973], 5);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap",
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

export function showCurrentPosition(location, { center = true } = {}) {
  const latLng = [location.latitude, location.longitude];

  if (!userMarker) {
    userMarker = L.marker(latLng, {
      icon: userIcon,
      zIndexOffset: 1000,
    }).addTo(map);
  } else {
    userMarker.setLatLng(latLng);
  }

  const accuracy = Number(location.accuracy || 0);
  if (accuracy > 0) {
    if (!accuracyCircle) {
      accuracyCircle = L.circle(latLng, {
        radius: accuracy,
        color: "#0056d6",
        weight: 1,
        fillColor: "#0056d6",
        fillOpacity: 0.08,
        interactive: false,
      }).addTo(map);
    } else {
      accuracyCircle.setLatLng(latLng).setRadius(accuracy);
    }
  }

  map.invalidateSize({ pan: false });
  if (center) map.setView(latLng, 15, { animate: true });
}

export async function drawRoute(origin, destination) {
  clearRouteLayers();
  showCurrentPosition(origin, { center: false });
  map.invalidateSize({ pan: false });

  pointMarker = L.marker([destination.latitude, destination.longitude], {
    icon: destinationIcon,
    zIndexOffset: 900,
  }).addTo(map);

  const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const url = `${APP_CONFIG.OSRM_BASE_URL}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`OSRM HTTP ${response.status}`);

    const data = await response.json();
    const route = data.routes?.[0];
    if (!route) throw new Error("OSRM no devolvió una ruta.");

    routeLayer = L.geoJSON(route.geometry, {
      style: {
        color: "#0056d6",
        weight: 6,
        opacity: 0.9,
        lineCap: "round",
        lineJoin: "round",
      },
    }).addTo(map);

    map.invalidateSize({ pan: false });
    map.fitBounds(routeLayer.getBounds(), {
      padding: window.matchMedia("(max-width: 640px)").matches ? [24, 24] : [40, 40],
      maxZoom: 16,
    });

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
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 });
    throw error;
  }
}

function clearRouteLayers() {
  for (const layer of [pointMarker, routeLayer]) {
    if (layer && map.hasLayer(layer)) map.removeLayer(layer);
  }

  pointMarker = null;
  routeLayer = null;
}

export function buildExternalRouteUrl(origin, destination) {
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${origin.latitude}%2C${origin.longitude}%3B${destination.latitude}%2C${destination.longitude}`;
}
