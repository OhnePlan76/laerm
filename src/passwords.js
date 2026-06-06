const crypto = require("crypto");
const { promisify } = require("util");

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024
};

function safeCompare(left, right) {
  const leftBuffer = Buffer.from(left || "");
  const rightBuffer = Buffer.from(right || "");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);

  return [
    "scrypt",
    "v1",
    String(SCRYPT_OPTIONS.N),
    String(SCRYPT_OPTIONS.r),
    String(SCRYPT_OPTIONS.p),
    salt.toString("base64"),
    derived.toString("base64")
  ].join("$");
}

async function verifyPassword(password, storedHash) {
  const parts = String(storedHash || "").split("$");
  if (parts.length !== 7 || parts[0] !== "scrypt" || parts[1] !== "v1") {
    return false;
  }

  const [, , n, r, p, saltBase64, hashBase64] = parts;
  const salt = Buffer.from(saltBase64, "base64");
  const expected = Buffer.from(hashBase64, "base64");
  const derived = await scrypt(password, salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024
  });

  return safeCompare(derived.toString("base64"), expected.toString("base64"));
}

function validatePassword(password, confirmation, username) {
  const errors = {};
  const value = String(password || "");

  if (value.length < 10) {
    errors.password = "Bitte mindestens 10 Zeichen verwenden.";
  }

  if (value.length > 200) {
    errors.password = "Bitte ein kürzeres Passwort verwenden.";
  }

  if (username && value.toLowerCase().includes(String(username).toLowerCase())) {
    errors.password = "Das Passwort sollte nicht den Benutzernamen enthalten.";
  }

  if (value !== String(confirmation || "")) {
    errors.password_confirmation = "Die Passwörter stimmen nicht überein.";
  }

  return errors;
}

module.exports = {
  hashPassword,
  verifyPassword,
  validatePassword,
  safeCompare
};
