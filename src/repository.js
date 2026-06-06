const db = require("./db");

const ENTRY_FIELDS = `
  id,
  to_char(datum, 'YYYY-MM-DD') AS datum,
  to_char(beginn_uhrzeit, 'HH24:MI') AS beginn_uhrzeit,
  CASE WHEN ende_uhrzeit IS NULL THEN NULL ELSE to_char(ende_uhrzeit, 'HH24:MI') END AS ende_uhrzeit,
  dauer_minuten,
  wahrnehmungsort,
  laermart,
  intensitaet,
  auswirkung,
  vermuteter_ursprung,
  zeugen,
  notiz,
  pruefungshinweis,
  to_char(created_at AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD HH24:MI') AS created_at,
  to_char(updated_at AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD HH24:MI') AS updated_at
`;

function buildFilterWhere(filters = {}) {
  const clauses = [];
  const params = [];

  if (filters.von) {
    params.push(filters.von);
    clauses.push(`datum >= $${params.length}`);
  }

  if (filters.bis) {
    params.push(filters.bis);
    clauses.push(`datum <= $${params.length}`);
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params
  };
}

async function listEntries(filters) {
  const { where, params } = buildFilterWhere(filters);
  const result = await db.query(
    `
      SELECT ${ENTRY_FIELDS}
      FROM laermereignisse
      ${where}
      ORDER BY datum DESC, beginn_uhrzeit DESC, id DESC
    `,
    params
  );

  return result.rows;
}

async function getEntry(id) {
  const result = await db.query(
    `
      SELECT ${ENTRY_FIELDS}
      FROM laermereignisse
      WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function createEntry(data) {
  const result = await db.query(
    `
      INSERT INTO laermereignisse (
        datum,
        beginn_uhrzeit,
        ende_uhrzeit,
        dauer_minuten,
        wahrnehmungsort,
        laermart,
        intensitaet,
        auswirkung,
        vermuteter_ursprung,
        zeugen,
        notiz,
        pruefungshinweis
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `,
    [
      data.datum,
      data.beginn_uhrzeit,
      data.ende_uhrzeit,
      data.dauer_minuten,
      data.wahrnehmungsort,
      data.laermart,
      data.intensitaet,
      data.auswirkung,
      data.vermuteter_ursprung,
      data.zeugen,
      data.notiz,
      data.pruefungshinweis
    ]
  );

  return result.rows[0].id;
}

async function updateEntry(id, data) {
  const result = await db.query(
    `
      UPDATE laermereignisse
      SET
        datum = $1,
        beginn_uhrzeit = $2,
        ende_uhrzeit = $3,
        dauer_minuten = $4,
        wahrnehmungsort = $5,
        laermart = $6,
        intensitaet = $7,
        auswirkung = $8,
        vermuteter_ursprung = $9,
        zeugen = $10,
        notiz = $11,
        pruefungshinweis = $12
      WHERE id = $13
      RETURNING id
    `,
    [
      data.datum,
      data.beginn_uhrzeit,
      data.ende_uhrzeit,
      data.dauer_minuten,
      data.wahrnehmungsort,
      data.laermart,
      data.intensitaet,
      data.auswirkung,
      data.vermuteter_ursprung,
      data.zeugen,
      data.notiz,
      data.pruefungshinweis,
      id
    ]
  );

  return result.rowCount > 0;
}

async function deleteEntry(id) {
  const result = await db.query("DELETE FROM laermereignisse WHERE id = $1", [id]);
  return result.rowCount > 0;
}

module.exports = {
  listEntries,
  getEntry,
  createEntry,
  updateEntry,
  deleteEntry
};
