const crypto = require("crypto");
const { safeCompare } = require("./passwords");

const productionLike = Boolean(
  process.env.NODE_ENV === "production" ||
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.RAILWAY_PROJECT_ID ||
    process.env.RAILWAY_SERVICE_ID
);

function assertSecurityConfig() {
  if (!productionLike) {
    return;
  }

  const missing = [];
  if (!process.env.SESSION_SECRET) missing.push("SESSION_SECRET");

  if (missing.length > 0) {
    throw new Error(
      `Sicherheitskonfiguration fehlt: ${missing.join(", ")}. Bitte als Railway-Variablen setzen.`
    );
  }
}

function newToken() {
  return crypto.randomBytes(32).toString("hex");
}

function safeReturnTo(value) {
  if (!value || typeof value !== "string") {
    return "/";
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

function tokensMatch(left, right) {
  return safeCompare(left || "", right || "");
}

module.exports = {
  productionLike,
  assertSecurityConfig,
  newToken,
  safeReturnTo,
  tokensMatch
};
