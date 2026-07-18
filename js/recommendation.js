const CHANNEL_BY_ACTION = Object.freeze({
  withdrawal: "atm_site",
  deposit: "office",
  payment: "office",
  transfer: "office",
});

export function getChannelForAction(action) {
  return CHANNEL_BY_ACTION[action] || "";
}

export function buildRecommendationReason(action, point) {
  const labels = {
    withdrawal: "retiro",
    deposit: "depósito",
    payment: "pago",
    transfer: "transferencia",
  };

  const operation = labels[action] || "operación";
  return `Es el punto compatible más cercano encontrado para tu ${operation}, según la distancia vial estimada.`;
}

export function validateParsedIntent(parsed) {
  if (!parsed || parsed.action === "unknown") {
    return "No pude identificar la operación. Indica si necesitas retirar, depositar, pagar o transferir.";
  }

  if (parsed.needs_clarification) {
    return "Necesito un poco más de información para interpretar la solicitud.";
  }

  return "";
}
