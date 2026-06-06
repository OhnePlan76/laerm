require("dotenv").config();

const express = require("express");
const path = require("path");
const { runMigrations } = require("./migrate");
const repository = require("./repository");
const { summarize } = require("./summary");
const { validateEntry, validateFilters } = require("./validation");
const { LAERMARTEN, AUSWIRKUNGEN, WAHRNEHMUNGSORTE } = require("./options");
const { toCsv, toPdfStream } = require("./exporters");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.locals.options = {
  laermarten: LAERMARTEN,
  auswirkungen: AUSWIRKUNGEN,
  wahrnehmungsorte: WAHRNEHMUNGSORTE
};

function emptyEntry() {
  return {
    datum: new Date().toISOString().slice(0, 10),
    beginn_uhrzeit: "",
    ende_uhrzeit: "",
    dauer_minuten: "",
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
        submitLabel: "Eintrag speichern"
      });
    }

    const id = await repository.createEntry(result.data);
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
  await runMigrations();
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
