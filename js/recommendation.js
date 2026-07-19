const CHANNEL_BY_ACTION = Object.freeze({
  withdrawal: "atm_site",
  deposit: "office",
  payment: "office",
  transfer: "office",
});

export function getChannelForAction(action) {
  return CHANNEL_BY_ACTION[action] || "";
}

export function buildRecommendationReason(action) {
  const labels = {
    withdrawal: "Retiro",
    deposit: "Depósito",
    payment: "Pago",
    transfer: "Transferencia",
  };

  return `${labels[action] || "Operación"} disponible en este punto.`;
}

export function validateParsedIntent(parsed) {
  if (!parsed || parsed.action === "unknown") {
    return "Indica si quieres retirar, depositar, pagar o transferir.";
  }

  if (parsed.needs_clarification) {
    return "Indica la operación y el monto.";
  }

  return "";
}
