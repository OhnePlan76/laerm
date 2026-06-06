const PDFDocument = require("pdfkit");

function csvCell(value) {
  const stringValue = value === null || value === undefined ? "" : String(value);
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function row(values) {
  return values.map(csvCell).join(";");
}

function toCsv(entries, summary, filters) {
  const lines = [
    row(["Lärmprotokoll"]),
    row(["Exportiert am", new Date().toLocaleString("de-DE")]),
    row(["Datum von", filters.von || ""]),
    row(["Datum bis", filters.bis || ""]),
    "",
    row(["Zusammenfassung"]),
    row(["Anzahl Vorfälle", summary.total]),
    row(["Anzahl Vorfälle mit geweckt", summary.geweckt]),
    row(["Anzahl Vorfälle zwischen 22:00 und 06:00", summary.nachts]),
    row(["Häufigste Art des Lärms", summary.haeufigste_laermart]),
    row(["Häufigster Wahrnehmungsort", summary.haeufigster_wahrnehmungsort]),
    "",
    row([
      "ID",
      "Datum",
      "Beginn",
      "Ende",
      "Dauer Minuten",
      "Wahrnehmungsort",
      "Lärmart",
      "Intensität",
      "Auswirkung",
      "Vermuteter Ursprung",
      "Zeugen",
      "Notiz",
      "Prüfungshinweis",
      "Erstellt",
      "Aktualisiert"
    ])
  ];

  for (const entry of entries) {
    lines.push(
      row([
        entry.id,
        entry.datum,
        entry.beginn_uhrzeit,
        entry.ende_uhrzeit,
        entry.dauer_minuten,
        entry.wahrnehmungsort,
        entry.laermart,
        entry.intensitaet,
        entry.auswirkung,
        entry.vermuteter_ursprung,
        entry.zeugen,
        entry.notiz,
        entry.pruefungshinweis,
        entry.created_at,
        entry.updated_at
      ])
    );
  }

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function writeKeyValue(doc, label, value) {
  doc.font("Helvetica-Bold").text(`${label}: `, { continued: true });
  doc.font("Helvetica").text(value || "-");
}

function ensurePageSpace(doc, height = 90) {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

function toPdfStream(entries, summary, filters, stream) {
  const doc = new PDFDocument({
    size: "A4",
    margin: 42,
    bufferPages: true,
    info: {
      Title: "Lärmprotokoll",
      Author: "Lärmprotokoll"
    }
  });

  doc.pipe(stream);

  doc.font("Helvetica-Bold").fontSize(22).text("Lärmprotokoll");
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(10).fillColor("#444");
  doc.text(`Exportiert am ${new Date().toLocaleString("de-DE")}`);
  doc.text(`Zeitraum: ${filters.von || "ohne Startdatum"} bis ${filters.bis || "ohne Enddatum"}`);
  doc.moveDown();

  doc.fillColor("#111").font("Helvetica-Bold").fontSize(14).text("Zusammenfassung");
  doc.moveDown(0.4);
  doc.fontSize(10);
  writeKeyValue(doc, "Anzahl Vorfälle", String(summary.total));
  writeKeyValue(doc, "Anzahl Vorfälle mit geweckt", String(summary.geweckt));
  writeKeyValue(doc, "Anzahl Vorfälle zwischen 22:00 und 06:00", String(summary.nachts));
  writeKeyValue(doc, "Häufigste Art des Lärms", summary.haeufigste_laermart);
  writeKeyValue(doc, "Häufigster Wahrnehmungsort", summary.haeufigster_wahrnehmungsort);
  doc.moveDown();

  doc.font("Helvetica-Bold").fontSize(14).text("Einträge");
  doc.moveDown(0.3);

  if (entries.length === 0) {
    doc.font("Helvetica").fontSize(10).text("Keine Einträge im gewählten Zeitraum.");
  }

  for (const entry of entries) {
    ensurePageSpace(doc, 120);
    const startY = doc.y;

    doc
      .roundedRect(doc.page.margins.left, startY, doc.page.width - 84, 1, 0)
      .fill("#d8dee9");
    doc.y = startY + 10;

    doc
      .fillColor("#111")
      .font("Helvetica-Bold")
      .fontSize(12)
      .text(`${entry.datum} · ${entry.beginn_uhrzeit}${entry.ende_uhrzeit ? ` bis ${entry.ende_uhrzeit}` : ""}`);
    doc.font("Helvetica").fontSize(10).fillColor("#222");
    doc.text(`${entry.laermart} · Intensität ${entry.intensitaet}/5 · ${entry.dauer_minuten} Minuten`);
    doc.text(`Wahrnehmungsort: ${entry.wahrnehmungsort}`);
    doc.text(`Auswirkung: ${entry.auswirkung}`);

    if (entry.vermuteter_ursprung) {
      doc.text(`Vermuteter Ursprung: ${entry.vermuteter_ursprung}`);
    }
    if (entry.zeugen) {
      doc.text(`Zeugen: ${entry.zeugen}`);
    }
    if (entry.notiz) {
      doc.moveDown(0.2);
      doc.font("Helvetica-Bold").text("Notiz", { continued: false });
      doc.font("Helvetica").text(entry.notiz);
    }
    if (entry.pruefungshinweis) {
      doc.moveDown(0.2);
      doc.font("Helvetica-Bold").text("Prüfungshinweis", { continued: false });
      doc.font("Helvetica").text(entry.pruefungshinweis);
    }
    doc.moveDown();
  }

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    doc.font("Helvetica").fontSize(8).fillColor("#777");
    doc.text(
      `Seite ${i + 1} von ${range.count}`,
      doc.page.margins.left,
      doc.page.height - 30,
      { align: "right", width: doc.page.width - 84 }
    );
  }

  doc.end();
}

module.exports = {
  toCsv,
  toPdfStream
};
