const { LAERMARTEN, AUSWIRKUNGEN, WAHRNEHMUNGSORTE } = require("./options");

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function isDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

function trim(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEntry(body) {
  return {
    datum: trim(body.datum),
    beginn_uhrzeit: trim(body.beginn_uhrzeit),
    ende_uhrzeit: trim(body.ende_uhrzeit) || null,
    dauer_minuten: Number.parseInt(body.dauer_minuten, 10),
    wahrnehmungsort: trim(body.wahrnehmungsort),
    laermart: trim(body.laermart),
    intensitaet: Number.parseInt(body.intensitaet, 10),
    auswirkung: trim(body.auswirkung),
    vermuteter_ursprung: trim(body.vermuteter_ursprung) || null,
    zeugen: trim(body.zeugen) || null,
    notiz: trim(body.notiz) || null,
    pruefungshinweis: trim(body.pruefungshinweis) || null
  };
}

function validateEntry(body) {
  const data = normalizeEntry(body);
  const errors = {};

  if (!isDate(data.datum)) {
    errors.datum = "Bitte ein gültiges Datum angeben.";
  }

  if (!TIME_PATTERN.test(data.beginn_uhrzeit)) {
    errors.beginn_uhrzeit = "Bitte eine gültige Beginn-Uhrzeit angeben.";
  }

  if (data.ende_uhrzeit && !TIME_PATTERN.test(data.ende_uhrzeit)) {
    errors.ende_uhrzeit = "Bitte eine gültige Ende-Uhrzeit angeben.";
  }

  if (!Number.isInteger(data.dauer_minuten) || data.dauer_minuten < 0) {
    errors.dauer_minuten = "Bitte eine Dauer ab 0 Minuten angeben.";
  }

  if (!WAHRNEHMUNGSORTE.includes(data.wahrnehmungsort)) {
    errors.wahrnehmungsort = "Bitte einen Wahrnehmungsort auswählen.";
  }

  if (!LAERMARTEN.includes(data.laermart)) {
    errors.laermart = "Bitte eine Lärmart auswählen.";
  }

  if (!Number.isInteger(data.intensitaet) || data.intensitaet < 1 || data.intensitaet > 5) {
    errors.intensitaet = "Bitte eine Intensität zwischen 1 und 5 wählen.";
  }

  if (!AUSWIRKUNGEN.includes(data.auswirkung)) {
    errors.auswirkung = "Bitte eine Auswirkung auswählen.";
  }

  return {
    data,
    errors,
    isValid: Object.keys(errors).length === 0
  };
}

function validateFilters(query) {
  const from = trim(query.von);
  const to = trim(query.bis);
  const filters = {
    von: from && isDate(from) ? from : "",
    bis: to && isDate(to) ? to : ""
  };

  return filters;
}

module.exports = {
  validateEntry,
  validateFilters
};
