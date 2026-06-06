require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const session = require("express-session");
const path = require("path");
const { runMigrations } = require("./migrate");
const repository = require("./repository");
const { summarize } = require("./summary");
const { validateEntry, validateFilters } = require("./validation");
const { LAERMARTEN, AUSWIRKUNGEN, WAHRNEHMUNGSORTE } = require("./options");
const { toCsv, toPdfStream } = require("./exporters");
const {
  productionLike,
  assertSecurityConfig,
  newToken,
  safeReturnTo,
  tokensMatch
} = require("./security");
const {
  authenticateUser,
  getUserById,
  setPassword,
  verifyCurrentPassword,
  ensureBootstrapUsers
} = require("./users");
const { validatePassword } = require("./passwords");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", "data:"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"]
      }
    }
  })
);

app.use((req, res, next) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  next();
});

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.use(
  session({
    name: "lp.sid",
    secret: process.env.SESSION_SECRET || "dev-only-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: productionLike,
      maxAge: 12 * 60 * 60 * 1000
    }
  })
);

app.locals.options = {
  laermarten: LAERMARTEN,
  auswirkungen: AUSWIRKUNGEN,
  wahrnehmungsorte: WAHRNEHMUNGSORTE
};
app.locals.isAuthenticated = false;
app.locals.csrfToken = "";
app.locals.currentUser = null;

function ensureCsrfToken(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = newToken();
  }

  res.locals.csrfToken = req.session.csrfToken;
  res.locals.isAuthenticated = Boolean(req.session.authenticated);
  res.locals.currentUser = req.session.user || null;
  next();
}

function csrfProtection(req, res, next) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return next();
  }

  if (!tokensMatch(req.body._csrf, req.session.csrfToken)) {
    return res.status(403).render("error", {
      title: "Sicherheitsprüfung fehlgeschlagen",
      message: "Die Anfrage konnte nicht bestätigt werden. Bitte Seite neu laden und erneut versuchen."
    });
  }

  return next();
}

function requireAuth(req, res, next) {
  if (!req.session.authenticated || !req.session.user) {
    return res.redirect(`/login?returnTo=${encodeURIComponent(req.originalUrl)}`);
  }

  req.currentUser = req.session.user;
  res.locals.currentUser = req.currentUser;
  return next();
}

function requirePasswordReady(req, res, next) {
  if (!req.currentUser || !req.currentUser.mustChangePassword) {
    return next();
  }

  return res.redirect("/password/change");
}

app.use(ensureCsrfToken);
app.use(csrfProtection);

app.get("/login", (req, res) => {
  if (req.session.authenticated) {
    return res.redirect("/");
  }

  return res.render("login", {
    title: "Anmeldung",
    error: "",
    returnTo: safeReturnTo(req.query.returnTo)
  });
});

app.post(
  "/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false
  }),
  asyncRoute(async (req, res, next) => {
    const returnTo = safeReturnTo(req.body.returnTo);
    const user = await authenticateUser(req.body.username, req.body.password);

    if (!user) {
      return res.status(401).render("login", {
        title: "Anmeldung",
        error: "Benutzername oder Passwort ist falsch.",
        returnTo
      });
    }

    return req.session.regenerate((error) => {
      if (error) {
        return next(error);
      }

      req.session.authenticated = true;
      req.session.user = user;
      req.session.csrfToken = newToken();
      return res.redirect(user.mustChangePassword ? "/password/change" : returnTo);
    });
  })
);

app.use(requireAuth);

app.post("/logout", (req, res, next) => {
  req.session.destroy((error) => {
    if (error) {
      return next(error);
    }

    res.clearCookie("lp.sid");
    return res.redirect("/login");
  });
});

app.get("/password/change", (req, res) => {
  res.render("password", {
    title: req.currentUser.mustChangePassword ? "Passwort festlegen" : "Passwort ändern",
    errors: {},
    mustChangePassword: req.currentUser.mustChangePassword
  });
});

app.post(
  "/password/change",
  asyncRoute(async (req, res) => {
    const mustChangePassword = req.currentUser.mustChangePassword;
    const errors = validatePassword(
      req.body.password,
      req.body.password_confirmation,
      req.currentUser.username
    );

    if (!mustChangePassword) {
      const currentMatches = await verifyCurrentPassword(req.currentUser.id, req.body.current_password);
      if (!currentMatches) {
        errors.current_password = "Das aktuelle Passwort ist falsch.";
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(422).render("password", {
        title: mustChangePassword ? "Passwort festlegen" : "Passwort ändern",
        errors,
        mustChangePassword
      });
    }

    const user = await setPassword(req.currentUser.id, req.body.password);
    req.session.user = user;
    return res.redirect("/");
  })
);

app.use(requirePasswordReady);

function emptyEntry() {
  return {
    datum: new Date().toISOString().slice(0, 10),
    beginn_uhrzeit: "",
    ende_uhrzeit: "",
    dauer_minuten: null,
    wahrnehmungsort: "Wohnung",
    laermart: "Trampeln",
    intensitaet: "3",
    auswirkung: "nur wahrgenommen",
    vermuteter_ursprung: "",
    zeugen: "",
    notiz: "",
    pruefungshinweis: ""
  };
}

function asId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

app.get(
  "/",
  asyncRoute(async (req, res) => {
    const filters = validateFilters(req.query);
    const entries = await repository.listEntries(filters);
    const summary = summarize(entries);

    res.render("index", {
      title: "Lärmprotokoll",
      entries,
      filters,
      summary
    });
  })
);

app.get("/entries/new", (req, res) => {
  res.render("form", {
    title: "Neuen Eintrag erfassen",
    heading: "Neuen Eintrag erfassen",
    action: "/entries",
    entry: emptyEntry(),
    errors: {},
    dirtyOnLoad: false,
    submitLabel: "Eintrag speichern"
  });
});

app.post(
  "/entries",
  asyncRoute(async (req, res) => {
    const result = validateEntry(req.body);

    if (!result.isValid) {
      return res.status(422).render("form", {
        title: "Neuen Eintrag erfassen",
        heading: "Neuen Eintrag erfassen",
        action: "/entries",
        entry: result.data,
        errors: result.errors,
        dirtyOnLoad: true,
        submitLabel: "Eintrag speichern"
      });
    }

    const id = await repository.createEntry(result.data, req.currentUser.id);
    return res.redirect(`/entries/${id}`);
  })
);

app.get(
  "/entries/:id",
  asyncRoute(async (req, res, next) => {
    const id = asId(req.params.id);
    if (!id) {
      return next();
    }

    const entry = await repository.getEntry(id);
    if (!entry) {
      return next();
    }

    return res.render("detail", {
      title: `Eintrag #${entry.id}`,
      entry
    });
  })
);

app.get(
  "/entries/:id/edit",
  asyncRoute(async (req, res, next) => {
    const id = asId(req.params.id);
    if (!id) {
      return next();
    }

    const entry = await repository.getEntry(id);
    if (!entry) {
      return next();
    }

    return res.render("form", {
      title: `Eintrag #${entry.id} bearbeiten`,
      heading: `Eintrag #${entry.id} bearbeiten`,
      action: `/entries/${entry.id}`,
      entry,
      errors: {},
      dirtyOnLoad: false,
      submitLabel: "Änderungen speichern"
    });
  })
);

app.post(
  "/entries/:id",
  asyncRoute(async (req, res, next) => {
    const id = asId(req.params.id);
    if (!id) {
      return next();
    }

    const result = validateEntry(req.body);
    if (!result.isValid) {
      return res.status(422).render("form", {
        title: `Eintrag #${id} bearbeiten`,
        heading: `Eintrag #${id} bearbeiten`,
        action: `/entries/${id}`,
        entry: { id, ...result.data },
        errors: result.errors,
        dirtyOnLoad: true,
        submitLabel: "Änderungen speichern"
      });
    }

    const updated = await repository.updateEntry(id, result.data);
    if (!updated) {
      return next();
    }

    return res.redirect(`/entries/${id}`);
  })
);

app.post(
  "/entries/:id/delete",
  asyncRoute(async (req, res, next) => {
    const id = asId(req.params.id);
    if (!id) {
      return next();
    }

    const deleted = await repository.deleteEntry(id);
    if (!deleted) {
      return next();
    }

    return res.redirect("/");
  })
);

app.get(
  "/export.csv",
  asyncRoute(async (req, res) => {
    const filters = validateFilters(req.query);
    const entries = await repository.listEntries(filters);
    const summary = summarize(entries);
    const csv = toCsv(entries, summary, filters);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="laermprotokoll.csv"');
    res.send(csv);
  })
);

app.get(
  "/export.pdf",
  asyncRoute(async (req, res) => {
    const filters = validateFilters(req.query);
    const entries = await repository.listEntries(filters);
    const summary = summarize(entries);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="laermprotokoll.pdf"');
    toPdfStream(entries, summary, filters, res);
  })
);

app.use((req, res) => {
  res.status(404).render("error", {
    title: "Nicht gefunden",
    message: "Diese Seite wurde nicht gefunden."
  });
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) {
    return next(error);
  }
  return res.status(500).render("error", {
    title: "Fehler",
    message: "Es ist ein Fehler aufgetreten. Bitte später erneut versuchen."
  });
});

async function start() {
  assertSecurityConfig();
  await runMigrations();
  await ensureBootstrapUsers();
  app.listen(PORT, () => {
    console.log(`Lärmprotokoll läuft auf Port ${PORT}`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error("Start fehlgeschlagen:", error);
    process.exit(1);
  });
}

module.exports = app;
