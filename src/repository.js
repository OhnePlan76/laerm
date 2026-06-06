const db = require("./db");

const ENTRY_FIELDS = `
  laermereignisse.id,
  to_char(laermereignisse.datum, 'YYYY-MM-DD') AS datum,
  to_char(laermereignisse.beginn_uhrzeit, 'HH24:MI') AS beginn_uhrzeit,
  CASE WHEN laermereignisse.ende_uhrzeit IS NULL THEN NULL ELSE to_char(laermereignisse.ende_uhrzeit, 'HH24:MI') END AS ende_uhrzeit,
  laermereignisse.dauer_minuten,
  laermereignisse.wahrnehmungsort,
  laermereignisse.laermart,
  laermereignisse.intensitaet,
  laermereignisse.auswirkung,
  laermereignisse.vermuteter_ursprung,
  laermereignisse.zeugen,
  laermereignisse.notiz,
  laermereignisse.pruefungshinweis,
  app_users.display_name AS created_by_name,
  to_char(laermereignisse.created_at AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD HH24:MI') AS created_at,
  to_char(laermereignisse.updated_at AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD HH24:MI') AS updated_at
`;

function buildFilterWhere(filters = {}) {
  const clauses = [];
  const params = [];

  if (filters.von) {
    params.push(filters.von);
    clauses.push(`laermereignisse.datum >= $${params.length}`);
  }

  if (filters.bis) {
    params.push(filters.bis);
    clauses.push(`laermereignisse.datum <= $${params.length}`);
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
      LEFT JOIN app_users ON app_users.id = laermereignisse.created_by_user_id
      ${where}
      ORDER BY laermereignisse.datum DESC, laermereignisse.beginn_uhrzeit DESC, laermereignisse.id DESC
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
      LEFT JOIN app_users ON app_users.id = laermereignisse.created_by_user_id
      WHERE laermereignisse.id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function createEntry(data, userId) {
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
        pruefungshinweis,
        created_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
      userId
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
