# Haushaltsbuch

Ein gemeinsames Haushalts-Management-System für Aufgaben, Einkaufsliste, Kalender, Rezepte und mehr – als Progressive Web App (PWA).

## Features

- **Aufgabenverwaltung** – Tägliche, wöchentliche und monatliche Aufgaben mit Erinnerungen
- **Einkaufsliste** – Gemeinsame Einkaufsliste mit Echtzeit-Synchronisierung
- **Kalender** – Terminplanung für den Haushalt
- **Rezepte** – Rezeptsammlung mit automatischer Bildsuche
- **Dienstplan** – Wochenplanung für alle Haushaltsmitglieder
- **Push-Benachrichtigungen** – Erinnerungen direkt auf dem Smartphone
- **Admin-Bereich** – Benutzerverwaltung und Auto-Update via GitHub
- **PWA** – Installierbar auf Android und iOS, funktioniert offline

## Technologie

- **Backend:** Node.js, Express, Socket.io
- **Datenbank:** SQLite (sql.js)
- **Frontend:** Vanilla JavaScript, CSS
- **Push:** Web Push API (VAPID)

## Installation

### Voraussetzungen

- Node.js >= 18.0.0
- Git

### Setup

```bash
git clone https://github.com/Airartz/haushaltsbuch.git
cd haushaltsbuch
npm install
npm start
```

Die App ist anschließend unter `http://localhost:3000` erreichbar.

### Erster Start

Beim ersten Start wird automatisch ein Admin-Benutzer angelegt. Die Zugangsdaten werden in der Konsole ausgegeben.

## Umgebungsvariablen

| Variable | Beschreibung | Standard |
|---|---|---|
| `PORT` | Server-Port | `3000` |
| `GITHUB_REPO` | GitHub-Repo für Auto-Updates (z.B. `Airartz/haushaltsbuch`) | – |

## Auto-Update

Im Admin-Bereich unter **Verwaltung → App-Update** kann die App direkt aus GitHub aktualisiert werden. Dafür muss das Projektverzeichnis ein Git-Repository sein.

## Lizenz

MIT
