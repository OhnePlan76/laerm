# Lärmprotokoll

Einfache Node.js/Express-Webapp zur schriftlichen Dokumentation von Lärmereignissen in einem Mehrparteienhaus. Die App speichert Einträge in PostgreSQL und kann gefilterte Protokolle als CSV oder PDF exportieren.

Es gibt bewusst keine Audio- oder Videoaufnahmefunktion.

## Funktionen

- Liste aller Lärmeinträge
- Eintrag erfassen, ansehen, bearbeiten und löschen
- automatische Dauerberechnung aus Beginn und Ende
- Filter nach Datum von/bis
- CSV-Export
- PDF-Export als druckbares Lärmprotokoll
- Export-Zusammenfassung mit:
  - Anzahl Vorfälle
  - Anzahl Vorfälle mit `geweckt`
  - Anzahl Vorfälle zwischen 22:00 und 06:00
  - häufigster Art des Lärms
  - häufigstem Wahrnehmungsort

## Technik

- Node.js und Express
- EJS für serverseitige HTML-Templates
- PostgreSQL über `DATABASE_URL`
- SQL-Migrationen im Ordner `migrations`
- Automatischer Migrationslauf beim App-Start
- Benutzerkonten für Michael, Andrea und Franka
- Erstlogin über Railway-Startpasswörter mit erzwungenem Passwortwechsel
- Sessions mit CSRF-Schutz für Formularaktionen
- Security-Headers und Rate-Limit
- Schlichtes responsives HTML/CSS ohne UI-Library

## Lokale Entwicklung

Voraussetzungen:

- Node.js 20 oder neuer
- PostgreSQL

Installation:

```bash
npm install
cp .env.example .env
```

Passe in `.env` die Variable `DATABASE_URL` an:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/laermprotokoll
PORT=3000
SESSION_SECRET=bitte-langen-zufaelligen-wert-setzen
BOOTSTRAP_PASSWORD_MICHAEL=erstlogin-michael-aendern
BOOTSTRAP_PASSWORD_ANDREA=erstlogin-andrea-aendern
BOOTSTRAP_PASSWORD_FRANKA=erstlogin-franka-aendern
```

Migrationen manuell ausführen:

```bash
npm run migrate
```

App starten:

```bash
npm run dev
```

Die App läuft lokal unter `http://localhost:3000`.

## Railway Deployment

1. Repository zu GitHub pushen.
2. In Railway ein neues Projekt aus dem GitHub-Repository erstellen.
3. Eine PostgreSQL-Datenbank im selben Railway-Projekt hinzufügen.
4. Im Webservice diese Variablen setzen:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
SESSION_SECRET=ein-langer-zufaelliger-geheimer-wert
BOOTSTRAP_PASSWORD_MICHAEL=startpasswort-fuer-michael
BOOTSTRAP_PASSWORD_ANDREA=startpasswort-fuer-andrea
BOOTSTRAP_PASSWORD_FRANKA=startpasswort-fuer-franka
```

5. Deploy starten. Die App nutzt `process.env.PORT` und startet über `npm run start`.

In Railway/Produktion startet die App absichtlich nicht, wenn `SESSION_SECRET` fehlt. Beim ersten Start müssen außerdem die drei `BOOTSTRAP_PASSWORD_*`-Variablen gesetzt sein, damit die Benutzer Michael, Andrea und Franka angelegt werden können.

Nach dem ersten Login muss jede Person ein eigenes Passwort setzen. Bestehende Benutzer werden beim Start nicht überschrieben. Die Startpasswort-Variablen können später stehen bleiben oder nach erfolgreichem Erstlogin entfernt werden.

Die Datei `railway.json` setzt den Start-Command auf `npm run start`. Railway kann Node-Projekte auch automatisch erkennen; die explizite Einstellung macht das Deployment hier eindeutig.

Nützliche Railway-Dokumentation:

- [PostgreSQL auf Railway](https://docs.railway.com/databases/postgresql/)
- [Railway Variablen](https://docs.railway.com/variables)
- [Railway Start Command](https://docs.railway.com/guides/start-command)

## Sicherheit und Datenschutz

- Die App ist nach dem Deploy durch Login geschützt.
- Passwörter werden nicht im Klartext gespeichert, sondern mit `scrypt` und individuellem Salt gehasht.
- Alle schreibenden Formulare verwenden CSRF-Tokens.
- `helmet` setzt HTTP-Sicherheitsheader.
- Ein Rate-Limit reduziert einfache automatisierte Angriffe.
- `X-Robots-Tag` und Meta-Robots verhindern Suchmaschinenindexierung.
- Die Datenbankverbindung und Passwörter gehören nur in Railway-Variablen, nicht ins Repository.

## Datenbank

Die Tabelle `laermereignisse` wird durch `migrations/001_init.sql` angelegt. Beim Start führt die App alle noch nicht angewendeten `.sql`-Dateien aus dem Ordner `migrations` aus und protokolliert sie in der Tabelle `migrations`.

Wichtige Spalten:

- `datum`
- `beginn_uhrzeit`
- `ende_uhrzeit`
- `dauer_minuten`
- `wahrnehmungsort`
- `laermart`
- `intensitaet`
- `auswirkung`
- `vermuteter_ursprung`
- `zeugen`
- `notiz`
- `pruefungshinweis`
- `created_at`
- `updated_at`

## Start in Produktion

```bash
npm run start
```
