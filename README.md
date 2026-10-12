# Opening GLOW 2026 · RSVP

Uitnodiging met aanmeldformulier voor de opening van GLOW met relaties van ParkingYou (zaterdag 7 november 2026). Eén statische pagina; aanmeldingen komen via een Google Apps Script in een Google Sheet.

| Bestand | Wat |
|---|---|
| `index.html` | De uitnodiging en het formulier (ParkingYou-huisstijl, Ubuntu). Instellingen staan in `CONFIG` onderaan het bestand. |
| `apps-script/Code.gs` | Koppeling met Google Sheets: slaat aanmeldingen op, bewaakt de 30 kaarten en houdt een wachtlijst bij. |
| `assets/` | Logo, favicon en foto. |

## Zo zet je het live

### 1. Google Sheet koppelen

1. Maak een lege Google Sheet (of gebruik *GLOW opening 2026 · RSVP* in Drive).
2. Ga naar **Extensies → Apps Script**, vervang de inhoud van `Code.gs` door [`apps-script/Code.gs`](apps-script/Code.gs) en sla op.
3. Kies bovenin de functie **`setup`** en klik op **Uitvoeren**. Geef toestemming als Google erom vraagt. Je krijgt dan:
   - een tabblad **RSVP** met kolommen, statuskleuren en Rick, Do, Murat en Bram als *Intern*;
   - een tabblad **Overzicht** met bezet, vrij, wachtlijst en afmeldingen.
4. **Implementeren → Nieuwe implementatie → type Web-app**
   - Uitvoeren als: *ikzelf*
   - Wie heeft toegang: *iedereen*
5. Kopieer de **web-app-URL** (eindigt op `/exec`).

### 2. URL in de pagina zetten

Plak de URL in `index.html` bij `CONFIG.scriptUrl`:

```js
scriptUrl: 'https://script.google.com/macros/s/…/exec',
```

Zolang dit leeg is, draait de pagina in **demo-modus** (oranje balkje onderin) en wordt er niets opgeslagen.

### 3. Online zetten

De repository is openbaar, dus GitHub Pages werkt gratis: **Settings → Pages → Deploy from a branch**, kies de branch en map `/ (root)`. De pagina staat dan op `https://rick040.github.io/py-glow-rsvp/`. Netlify of Vercel kan ook: het is één statische map.

Test daarna één keer zelf: meld je aan, controleer de rij in de Sheet en verwijder die rij weer.

## Hoe het werkt

- **30 kaarten.** Rijen met status *Komt* of *Intern* bezetten een plek (een introducé telt als extra plek). Na kaart 30 komen nieuwe aanmeldingen op de **wachtlijst**; het formulier laat dat ook zien.
- **Wijzigen of afmelden.** Wie opnieuw invult met hetzelfde e-mailadres, werkt de eigen regel bij in plaats van een nieuwe toe te voegen. Bij een afmelding komt de plek direct vrij.
- **Iemand van de wachtlijst laten doorschuiven:** zet de status in de Sheet op *Komt* en laat het de gast weten.
- **Schaarste tonen.** Bij 8 of minder vrije plekken toont het formulier "Nog maar X plekken beschikbaar".
- **Agenda.** Na aanmelden kan de gast de avond in de agenda zetten (.ics voor Apple en Outlook, of Google Agenda).
- **Spam.** Een verborgen veld houdt simpele bots tegen, en invoer kan geen formules in de Sheet uitvoeren.

## Instellingen

| Waar | Instelling | Standaard |
|---|---|---|
| `index.html` → `CONFIG` | `scriptUrl`: web-app-URL van het script | leeg (demo) |
| | `plusOne`: gasten mogen een introducé meenemen | `false` |
| | `showSeatsBelow`: vanaf hoeveel vrije plekken het aantal zichtbaar wordt | `8` |
| | `contactEmail`: adres in de footer en bij foutmeldingen | `info@parkingyou.nl` |
| `Code.gs` → `CONFIG` | `CAPACITY`: totaal aantal kaarten, inclusief intern | `30` |
| | `NOTIFY_EMAIL`: mail bij elke aanmelding | leeg (uit) |
| | `INTERNAL_GUESTS`: wie `setup()` als *Intern* toevoegt | Rick, Do, Murat, Bram |

Datum, tijden en adressen staan als tekst in `index.html` (programma, locaties, `EVENT` voor de agenda).

**Script aangepast?** Sla op en kies **Implementeren → Implementaties beheren → potloodje → Versie: Nieuwe versie**. Zo blijft de URL hetzelfde.

## Persoonlijke links

Je kunt naam, bedrijf en e-mail vooraf invullen via de link. De uitnodiging toont dan ook de naam:

```
https://rick040.github.io/py-glow-rsvp/?naam=Jan%20Jansen&bedrijf=Acme&email=jan@acme.nl
```
