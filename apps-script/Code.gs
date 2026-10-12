/**
 * RSVP opening GLOW 2026: slaat aanmeldingen op in deze Google Sheet.
 *
 * Installeren: open de spreadsheet → Extensies → Apps Script, plak dit bestand,
 * voer één keer setup() uit en publiceer via Implementeren → Nieuwe implementatie
 * → Web-app (Uitvoeren als: ikzelf, Toegang: iedereen). Zie README.md.
 */

const CONFIG = {
  SHEET_NAME: 'RSVP',
  // Totaal aantal kaarten, inclusief de interne gasten (rijen met status "Intern").
  CAPACITY: 30,
  // Optioneel: ontvang bij elke aanmelding een mail, bijvoorbeeld 'naam@parkingyou.nl'. Leeg = uit.
  NOTIFY_EMAIL: '',
  // Interne gasten; setup() zet ze als "Intern" in de lijst, zodat ze een kaart bezetten.
  INTERNAL_GUESTS: ['Rick', 'Do', 'Murat', 'Bram'],
};

const HEADERS = ['Tijdstip', 'Status', 'Naam', 'Bedrijf', 'E-mail', 'Personen', 'Introducé', 'Dieetwensen', 'Opmerking'];
const COL = { STATUS: 1, EMAIL: 4, PERSONS: 5 }; // 0-based kolomindexen in HEADERS
const HOLDS_SEAT = ['Komt', 'Intern'];

/** Eenmalig uitvoeren vanuit de editor: zet de tabbladen RSVP en Overzicht klaar. Veilig om opnieuw te draaien. */
function setup() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = sheet_();

  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
    .setFontWeight('bold').setBackground('#192AA2').setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);
  sheet.getRange('A2:A').setNumberFormat('dd-mm-yyyy hh:mm');
  sheet.getRange('F2:F').setHorizontalAlignment('center');
  [140, 110, 170, 170, 220, 80, 150, 220, 300].forEach((width, i) => sheet.setColumnWidth(i + 1, width));

  const status = sheet.getRange('B2:B');
  status.setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(['Komt', 'Komt niet', 'Wachtlijst', 'Intern'], true).setAllowInvalid(true).build());
  sheet.setConditionalFormatRules([['Komt', '#D9F2E3'], ['Wachtlijst', '#FFE5CC'], ['Komt niet', '#EEEEEE'], ['Intern', '#D6F6FA']]
    .map(([text, color]) => SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(text).setBackground(color).setRanges([status]).build()));

  if (sheet.getLastRow() === 1 && CONFIG.INTERNAL_GUESTS.length) {
    const team = CONFIG.INTERNAL_GUESTS.map((name) => ['', 'Intern', name, 'ParkingYou', '', 1, '', '', '']);
    sheet.getRange(2, 1, team.length, HEADERS.length).setValues(team);
  }

  const overview = spreadsheet.getSheetByName('Overzicht') || spreadsheet.insertSheet('Overzicht', 0);
  const name = CONFIG.SHEET_NAME;
  overview.getRange('A1:B9').setValues([
    ['Opening GLOW 2026, stand van de aanmeldingen', ''],
    ['Rekent automatisch mee met het tabblad ' + name + '.', ''],
    ['', ''],
    ['Kaarten totaal', CONFIG.CAPACITY],
    ['Bezet (komt + intern)', `=SUMIFS(${name}!F2:F,${name}!B2:B,"Komt")+SUMIFS(${name}!F2:F,${name}!B2:B,"Intern")`],
    ['Waarvan relaties', `=SUMIFS(${name}!F2:F,${name}!B2:B,"Komt")`],
    ['Nog vrij', '=MAX(0,B4-B5)'],
    ['Wachtlijst', `=COUNTIF(${name}!B2:B,"Wachtlijst")`],
    ['Afgemeld', `=COUNTIF(${name}!B2:B,"Komt niet")`],
  ]);
  overview.getRange('A1').setFontSize(14).setFontWeight('bold');
  overview.getRange('A2').setFontStyle('italic').setFontColor('#666666');
  overview.getRange('A4:A9').setFontWeight('bold');
  overview.getRange('B4:B9').setHorizontalAlignment('center');
  overview.getRange('B4').setNote('Komt uit CONFIG.CAPACITY in het Apps Script. Pas het daar aan en draai setup() opnieuw.');
  overview.setColumnWidth(1, 300);

  // Het lege standaardtabblad (Blad1/Sheet1) is niet meer nodig.
  spreadsheet.getSheets()
    .filter((s) => s.getName() !== name && s.getName() !== 'Overzicht' && s.getLastRow() === 0 && s.getLastColumn() === 0)
    .forEach((s) => spreadsheet.deleteSheet(s));
}

/** GET: hoeveel plekken zijn er nog vrij? */
function doGet() {
  return json_(Object.assign({ ok: true }, seats_(rows_(sheet_()))));
}

/** POST: een aanmelding of afmelding opslaan. Hetzelfde e-mailadres werkt de bestaande regel bij. */
function doPost(e) {
  let input;
  try {
    input = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'Ongeldige aanvraag.' });
  }
  // Honeypot: bots vullen het verborgen veld in en krijgen een nep-bevestiging.
  if (input.website) return json_({ ok: true, status: 'Komt' });

  const rsvp = clean_(input);
  if (rsvp.error) return json_({ ok: false, error: rsvp.error });

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = sheet_();
    const rows = rows_(sheet);
    const index = rows.findIndex((r) => String(r[COL.EMAIL]).trim().toLowerCase() === rsvp.email);
    const others = rows.filter((r, i) => i !== index);

    let status = rsvp.attending ? 'Komt' : 'Komt niet';
    if (rsvp.attending && seats_(others).taken + rsvp.persons > CONFIG.CAPACITY) status = 'Wachtlijst';

    const row = [
      new Date(), status, rsvp.name, rsvp.company, rsvp.email,
      rsvp.attending ? rsvp.persons : 0, rsvp.guest, rsvp.diet, rsvp.note,
    ];
    const values = [row.map(safe_)];
    if (index >= 0) sheet.getRange(index + 2, 1, 1, row.length).setValues(values);
    else sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues(values);

    notify_(row, index >= 0);
    return json_(Object.assign({ ok: true, status: status, updated: index >= 0 }, seats_(others.concat([row]))));
  } finally {
    lock.releaseLock();
  }
}

function clean_(input) {
  const line = (value, max) => String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
  const rsvp = {
    attending: input.attending === true,
    name: line(input.name, 120),
    company: line(input.company, 120),
    email: line(input.email, 160).toLowerCase(),
    guest: line(input.guest, 120),
    diet: line(input.diet, 300),
    note: String(input.note == null ? '' : input.note).trim().slice(0, 1000),
  };
  if (!rsvp.name || !rsvp.company) return { error: 'Vul je naam en bedrijf in.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rsvp.email)) return { error: 'Vul een geldig e-mailadres in.' };
  if (!rsvp.attending) {
    rsvp.guest = '';
    rsvp.diet = '';
  }
  rsvp.persons = rsvp.guest ? 2 : 1;
  return rsvp;
}

/** Bezette plekken: alle rijen met status Komt of Intern, opgeteld per aantal personen. */
function seats_(rows) {
  const taken = rows
    .filter((r) => HOLDS_SEAT.indexOf(String(r[COL.STATUS]).trim()) >= 0)
    .reduce((sum, r) => sum + (Number(r[COL.PERSONS]) || 1), 0);
  const remaining = Math.max(0, CONFIG.CAPACITY - taken);
  return { capacity: CONFIG.CAPACITY, taken: taken, remaining: remaining, full: remaining === 0 };
}

function sheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME) || spreadsheet.insertSheet(CONFIG.SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function rows_(sheet) {
  const last = sheet.getLastRow();
  return last < 2 ? [] : sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
}

/** Voorkom dat invoer die met = + - of @ begint als formule wordt uitgevoerd. */
function safe_(value) {
  return typeof value === 'string' && /^[=+\-@]/.test(value) ? "'" + value : value;
}

function notify_(row, updated) {
  if (!CONFIG.NOTIFY_EMAIL) return;
  const labels = HEADERS.slice(1);
  const lines = row.slice(1).map((value, i) => labels[i] + ': ' + (value === '' ? '-' : value));
  try {
    MailApp.sendEmail({
      to: CONFIG.NOTIFY_EMAIL,
      subject: 'GLOW RSVP: ' + row[2] + ' (' + row[3] + '): ' + row[1] + (updated ? ' (gewijzigd)' : ''),
      body: lines.join('\n') + '\n\n' + SpreadsheetApp.getActiveSpreadsheet().getUrl(),
    });
  } catch (err) {
    console.error('Notificatie versturen mislukt', err);
  }
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
