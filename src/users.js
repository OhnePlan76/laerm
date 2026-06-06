const db = require("./db");
const { hashPassword, verifyPassword } = require("./passwords");

const DEFAULT_USERS = [
  { username: "michael", displayName: "Michael", env: "BOOTSTRAP_PASSWORD_MICHAEL" },
  { username: "andrea", displayName: "Andrea", env: "BOOTSTRAP_PASSWORD_ANDREA" },
  { username: "franka", displayName: "Franka", env: "BOOTSTRAP_PASSWORD_FRANKA" }
];

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function publicUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    mustChangePassword: row.must_change_password,
    active: row.active
  };
}

async function getUserByUsername(username) {
  const result = await db.query(
    `
      SELECT id, username, display_name, password_hash, must_change_password, active
      FROM app_users
      WHERE username_normalized = $1
    `,
    [normalizeUsername(username)]
  );

  return result.rows[0] || null;
}

async function getUserById(id) {
  const result = await db.query(
    `
      SELECT id, username, display_name, must_change_password, active
      FROM app_users
      WHERE id = $1
    `,
    [id]
  );

  return publicUser(result.rows[0]);
}

async function authenticateUser(username, password) {
  const user = await getUserByUsername(username);
  if (!user || !user.active) {
    return null;
  }

  const matches = await verifyPassword(password, user.password_hash);
  if (!matches) {
    return null;
  }

  await db.query("UPDATE app_users SET last_login_at = NOW() WHERE id = $1", [user.id]);
  return publicUser(user);
}

async function setPassword(userId, password) {
  const passwordHash = await hashPassword(password);
  const result = await db.query(
    `
      UPDATE app_users
      SET password_hash = $1, must_change_password = FALSE
      WHERE id = $2 AND active = TRUE
      RETURNING id, username, display_name, must_change_password, active
    `,
    [passwordHash, userId]
  );

  return publicUser(result.rows[0]);
}

async function verifyCurrentPassword(userId, password) {
  const result = await db.query(
    `
      SELECT password_hash
      FROM app_users
      WHERE id = $1 AND active = TRUE
    `,
    [userId]
  );

  if (!result.rows[0]) {
    return false;
  }

  return verifyPassword(password, result.rows[0].password_hash);
}

async function ensureBootstrapUsers() {
  const missing = [];
  const created = [];

  for (const user of DEFAULT_USERS) {
    const existing = await getUserByUsername(user.username);
    if (existing) {
      continue;
    }

    const bootstrapPassword = process.env[user.env];
    if (!bootstrapPassword) {
      missing.push(user.env);
      continue;
    }

    const passwordHash = await hashPassword(bootstrapPassword);
    await db.query(
      `
        INSERT INTO app_users (
          username,
          username_normalized,
          display_name,
          password_hash,
          must_change_password,
          active
        )
        VALUES ($1, $2, $3, $4, TRUE, TRUE)
      `,
      [user.username, normalizeUsername(user.username), user.displayName, passwordHash]
    );
    created.push(user.displayName);
  }

  if (missing.length > 0) {
    throw new Error(
      `Bootstrap-Passwörter fehlen für noch nicht angelegte Benutzer: ${missing.join(", ")}`
    );
  }

  if (created.length > 0) {
    console.log(`Benutzer angelegt: ${created.join(", ")}`);
  }
}

module.exports = {
  DEFAULT_USERS,
  normalizeUsername,
  authenticateUser,
  getUserById,
  setPassword,
  verifyCurrentPassword,
  ensureBootstrapUsers
};
