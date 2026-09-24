'use strict';

const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

// Node-Seite des PowerShell-Hilfsprozesses (worker.ps1). Ein Prozess für
// alles, damit nicht jeder Klick eine Sekunde Startzeit kostet.

class PsWorker {
  constructor() {
    this.proc = null;
    this.naechsteId = 1;
    this.offen = new Map();
    this.fehlerAusgabe = '';
  }

  _starten() {
    // In der installierten Fassung liegt das Skript entpackt neben app.asar,
    // weil PowerShell nicht in das Archiv hineinsehen kann.
    const skript = path.join(__dirname, 'worker.ps1').replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
    this.proc = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', skript], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const proc = this.proc;
    readline.createInterface({ input: proc.stdout }).on('line', (zeile) => {
      let a;
      try { a = JSON.parse(zeile); } catch { return; }
      const o = this.offen.get(a.id);
      if (!o) return;
      this.offen.delete(a.id);
      clearTimeout(o.timer);
      if (a.ok) o.resolve(a.daten);
      else o.reject(new Error(a.fehler || 'Unbekannter Fehler im Windows-Hilfsprozess.'));
    });
    proc.stderr.on('data', (d) => { this.fehlerAusgabe = (this.fehlerAusgabe + d).slice(-4000); });
    proc.on('exit', () => {
      if (this.proc === proc) this.proc = null;
      for (const o of this.offen.values()) {
        clearTimeout(o.timer);
        o.reject(new Error('Der Windows-Hilfsprozess wurde beendet. ' + this.fehlerAusgabe.trim().slice(-300)));
      }
      this.offen.clear();
    });
  }

  ausfuehren(skript, timeoutMs = 20000) {
    if (!this.proc) this._starten();
    const id = this.naechsteId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.offen.delete(id);
        reject(new Error('Zeitüberschreitung im Windows-Hilfsprozess.'));
        this.beenden();
      }, timeoutMs);
      this.offen.set(id, { resolve, reject, timer });
      this.proc.stdin.write(JSON.stringify({ id, skript: Buffer.from(skript, 'utf8').toString('base64') }) + '\n');
    });
  }

  beenden() {
    if (this.proc) {
      this.proc.kill();
      this.proc = null;
    }
  }
}

const worker = new PsWorker();

// Übergibt Werte als JSON, damit nichts aus Nutzereingaben als Code gelesen wird.
function mitArgs(args, rumpf) {
  const json = JSON.stringify(args).replace(/'/g, "''");
  return `$a = '${json}' | ConvertFrom-Json\n${rumpf}`;
}

function liste(x) {
  return x == null ? [] : [].concat(x);
}

async function aufwaermen() {
  await worker.ausfuehren('$true', 30000);
}

async function fensterAuflisten() {
  const d = await worker.ausfuehren(`
$namen = @{}
Get-Process | ForEach-Object { $namen[[int]$_.Id] = $_.ProcessName }
[JuliaWin]::Fenster() | ForEach-Object {
  $t = $_ -split [char]9, 5
  [pscustomobject]@{ id = [int64]$t[0]; pid = [int]$t[1]; minimiert = ($t[2] -eq '1'); aktiv = ($t[3] -eq '1'); programm = $namen[[int]$t[1]]; titel = $t[4] }
}`);
  return liste(d);
}

async function vordergrund() {
  return worker.ausfuehren(`
$t = [JuliaWin]::Vordergrund() -split [char]9, 3
$p = Get-Process -Id ([int]$t[0]) -ErrorAction SilentlyContinue
@{ pid = [int]$t[0]; klasse = $t[1]; titel = $t[2]; programm = $(if ($p) { $p.ProcessName } else { '' }) }`);
}

// Vordergrund mit Programmpfad – für die Spielerkennung (Overlay von selbst).
// Bei geschützten Prozessen (Anti-Cheat) bleibt der Pfad leer.
async function vordergrundInfo() {
  return worker.ausfuehren(`
$t = [JuliaWin]::Vordergrund() -split [char]9, 3
$p = Get-Process -Id ([int]$t[0]) -ErrorAction SilentlyContinue
$pfad = ''
if ($p) { try { $pfad = [string]$p.Path } catch { $pfad = '' } }
@{ pid = [int]$t[0]; titel = $t[2]; programm = $(if ($p) { $p.ProcessName } else { '' }); pfad = $pfad }`);
}

async function prozesse(anzahl = 15, sortierung = 'ram') {
  return worker.ausfuehren(mitArgs({ anzahl, sortierung }, `
$last = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
$os = Get-CimInstance Win32_OperatingSystem
$feld = if ($a.sortierung -eq 'cpu') { 'CPU' } else { 'WorkingSet64' }
$top = Get-Process | Sort-Object $feld -Descending | Select-Object -First ([int]$a.anzahl) | ForEach-Object {
  [pscustomobject]@{ name = $_.ProcessName; pid = $_.Id; ram_mb = [math]::Round($_.WorkingSet64 / 1MB); cpu_sekunden = [math]::Round([double]$_.CPU, 1) }
}
@{
  cpu_last_prozent = $last
  ram_gesamt_gb = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
  ram_frei_gb = [math]::Round($os.FreePhysicalMemory / 1MB, 1)
  prozesse = @($top)
}`), 30000);
}

async function systemStatus() {
  return worker.ausfuehren(`
$os = Get-CimInstance Win32_OperatingSystem
$akku = @(Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue)[0]
$platten = Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | ForEach-Object {
  [pscustomobject]@{ laufwerk = $_.DeviceID; groesse_gb = [math]::Round($_.Size / 1GB, 1); frei_gb = [math]::Round($_.FreeSpace / 1GB, 1); frei_prozent = [math]::Round(100 * [double]$_.FreeSpace / [math]::Max([double]1, [double]$_.Size)) }
}
$up = (Get-Date) - $os.LastBootUpTime
@{
  akku = $(if ($akku) { @{ prozent = $akku.EstimatedChargeRemaining; am_netz = ($akku.BatteryStatus -eq 2) } } else { $null })
  ram_gesamt_gb = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
  ram_frei_gb = [math]::Round($os.FreePhysicalMemory / 1MB, 1)
  betriebszeit = ('{0} Tage {1} Std {2} Min' -f $up.Days, $up.Hours, $up.Minutes)
  laufwerke = @($platten)
}`, 30000);
}

// Programme, deren Fenster im Screenshot komplett geschwärzt werden, wenn sie
// im Vordergrund sind (Prozessname ohne .exe, klein geschrieben).
const SENSIBLE_PROGRAMME = [
  'keepass', 'keepassxc', '1password', 'bitwarden', 'dashlane', 'lastpass', 'keeper', 'nordpass',
  'enpass', 'roboform', 'protonpass', 'signal', 'threema', 'credentialuibroker',
];
// Private Browserfenster erkennt man am Titel.
const PRIVAT_TITEL = '(InPrivate|Inkognito|Incognito|Privates Fenster|Private Browsing|Privater Modus)';

// Bereiche im Vordergrundfenster, die im Screenshot geschwärzt werden
// (physische Pixel, der Hilfsprozess ist DPI-bewusst):
// - das ganze Fenster bei Passwortmanagern, Messengern, privaten Browserfenstern
// - sonst Passwortfelder, gefunden über zwei Wege: das Win32-Stilbit ES_PASSWORD
//   (klassische Programme) und UI Automation (Browser, WPF, moderne Apps).
// Nur das Vordergrundfenster, damit die Suche schnell bleibt.
async function passwortFelder() {
  const d = await worker.ausfuehren(mitArgs({ sensibel: SENSIBLE_PROGRAMME, privat: PRIVAT_TITEL }, `
$ergebnis = New-Object System.Collections.ArrayList
function Rechteck($text, $grund) {
  $t = $text -split [char]9
  if ($t.Count -eq 4) { [void]$ergebnis.Add([pscustomobject]@{ x = [int]$t[0]; y = [int]$t[1]; w = [int]$t[2]; h = [int]$t[3]; grund = $grund }) }
}
$h = [JuliaWin]::GetForegroundWindow()
if ($h -ne [IntPtr]::Zero) {
  $v = [JuliaWin]::Vordergrund() -split [char]9, 3
  $prozess = Get-Process -Id ([int]$v[0]) -ErrorAction SilentlyContinue
  $name = if ($prozess) { $prozess.ProcessName.ToLower() } else { '' }
  if (($a.sensibel -contains $name) -or ($v[2] -match $a.privat)) {
    Rechteck ([JuliaWin]::FensterRechteck($h)) 'fenster'
  } else {
    foreach ($z in [JuliaWin]::PasswortFelderWin32($h)) { Rechteck $z 'feld' }
    try {
      $wurzel = [System.Windows.Automation.AutomationElement]::FromHandle($h)
      $bedingung = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::IsPasswordProperty, $true)
      foreach ($f in $wurzel.FindAll([System.Windows.Automation.TreeScope]::Descendants, $bedingung)) {
        $r = $f.Current.BoundingRectangle
        if (-not $r.IsEmpty -and $r.Width -gt 0 -and $r.Height -gt 0) {
          [void]$ergebnis.Add([pscustomobject]@{ x = [int]$r.X; y = [int]$r.Y; w = [int]$r.Width; h = [int]$r.Height; grund = 'feld' })
        }
      }
    } catch {}
  }
}
$ergebnis`), 10000);
  return liste(d);
}

// Für Tests: dieselbe Suche, aber in einem bestimmten Fenster statt im Vordergrund.
async function passwortFelderIn(hwnd) {
  const d = await worker.ausfuehren(mitArgs({ hwnd }, `
$h = [IntPtr]([int64]$a.hwnd)
[JuliaWin]::PasswortFelderWin32($h)`), 10000);
  return liste(d);
}

async function klick(x, y, taste = 'links', doppelt = false) {
  await worker.ausfuehren(mitArgs({ x, y, taste, doppelt }, '[JuliaWin]::Klick([int]$a.x, [int]$a.y, [string]$a.taste, [bool]$a.doppelt)'));
}

async function scrollen(x, y, schritte) {
  await worker.ausfuehren(mitArgs({ x, y, schritte }, '[JuliaWin]::Scrollen([int]$a.x, [int]$a.y, [int]$a.schritte)'));
}

// Prüft vor dem Tippen, ob der Fokus in einem Passwortfeld liegt. Wenn ja,
// wird nichts getippt.
async function tippen(text) {
  return worker.ausfuehren(mitArgs({ text }, `
$el = $null
try { $el = [System.Windows.Automation.AutomationElement]::FocusedElement } catch {}
if ($el -ne $null) {
  $pw = $false
  try { $pw = $el.Current.IsPassword } catch {}
  if ($pw) { return @{ passwortfeld = $true } }
}
[JuliaWin]::Tippen([string]$a.text)
@{ passwortfeld = $false }`), 120000);
}

const VK = {
  ctrl: 0x11, strg: 0x11, control: 0x11,
  alt: 0x12, altgr: 0xA5,
  shift: 0x10, umschalt: 0x10,
  win: 0x5B, windows: 0x5B, meta: 0x5B,
  enter: 0x0D, eingabe: 0x0D, return: 0x0D,
  tab: 0x09, tabulator: 0x09,
  esc: 0x1B, escape: 0x1B,
  space: 0x20, leertaste: 0x20, leer: 0x20,
  backspace: 0x08, ruecktaste: 0x08,
  delete: 0x2E, del: 0x2E, entf: 0x2E,
  insert: 0x2D, einfg: 0x2D,
  home: 0x24, pos1: 0x24,
  end: 0x23, ende: 0x23,
  pageup: 0x21, bildauf: 0x21,
  pagedown: 0x22, bildab: 0x22,
  left: 0x25, links: 0x25,
  up: 0x26, hoch: 0x26, oben: 0x26,
  right: 0x27, rechts: 0x27,
  down: 0x28, runter: 0x28, unten: 0x28,
  printscreen: 0x2C, druck: 0x2C,
  capslock: 0x14,
  menu: 0x5D, apps: 0x5D, kontextmenue: 0x5D,
  plus: 0xBB, komma: 0xBC, minus: 0xBD, punkt: 0xBE,
  // Medientasten (Play/Pause, Titel, Lautstärke).
  medien_playpause: 0xB3, medien_weiter: 0xB0, medien_zurueck: 0xB1, medien_stopp: 0xB2,
  lauter: 0xAF, leiser: 0xAE, stumm: 0xAD,
};

function vkCodes(kombination) {
  const teile = String(kombination || '').toLowerCase().replace(/\s+/g, '').split('+').filter(Boolean);
  if (!teile.length) throw new Error('Leere Tastenkombination.');
  return teile.map((t) => {
    if (t in VK) return VK[t];
    if (/^f([1-9]|1\d|2[0-4])$/.test(t)) return 0x6F + Number(t.slice(1));
    if (/^[a-z]$/.test(t)) return t.toUpperCase().charCodeAt(0);
    if (/^[0-9]$/.test(t)) return t.charCodeAt(0);
    throw new Error(`Unbekannte Taste "${t}".`);
  });
}

async function taste(kombination) {
  const vks = vkCodes(kombination);
  await worker.ausfuehren(mitArgs({ vks }, '[JuliaWin]::Kombination([uint16[]]@($a.vks))'));
}

// Für den Hotkey "markierter Text": warten, bis Alt, Umschalt und Windows-Taste
// losgelassen sind (sonst käme Strg+Alt+C an), dann Strg+C an das Vordergrundfenster.
async function kopierenNachHotkey() {
  await worker.ausfuehren('[JuliaWin]::KopierenNachHotkey()', 5000);
}

async function fokussieren(id) {
  return worker.ausfuehren(mitArgs({ id }, '[JuliaWin]::Fokus([int64]$a.id)'));
}

const FENSTER_SEITEN = ['links', 'rechts', 'oben', 'unten', 'oben_links', 'oben_rechts', 'unten_links', 'unten_rechts', 'mitte', 'maximieren', 'wiederherstellen'];
async function fensterAnordnen(id, seite) {
  if (!FENSTER_SEITEN.includes(seite)) throw new Error(`Unbekannte Anordnung "${seite}".`);
  return worker.ausfuehren(mitArgs({ id, seite }, '[JuliaWin]::Anordnen([int64]$a.id, [string]$a.seite)'));
}

async function programmOeffnen(name, argumente) {
  await worker.ausfuehren(mitArgs({ name, argumente: argumente || '' }, `
if ($a.argumente) { Start-Process -FilePath $a.name -ArgumentList $a.argumente } else { Start-Process -FilePath $a.name }
$true`), 30000);
}

// Eine installierte App per (unscharfem) Namen öffnen – unabhängig vom
// Installationspfad. Nutzt Get-StartApps (alle Startmenü-Apps: Win32 + Store) und
// startet den besten Treffer über shell:AppsFolder\<AppID>. So lassen sich auch
// Schnittprogramme wie „DaVinci Resolve", „Adobe Premiere Pro" oder „CapCut"
// starten, die nicht im PATH liegen. Gibt den gefundenen App-Namen zurück oder ''.
async function appOeffnen(suche) {
  const q = String(suche || '').replace(/[^\p{L}\p{N} .+_-]/gu, '').trim();
  if (!q) throw new Error('Kein App-Name angegeben.');
  const name = await worker.ausfuehren(mitArgs({ suche: q }, `
$q = $a.suche
$treffer = Get-StartApps | Where-Object { $_.Name -like "*$q*" }
$app = $treffer | Sort-Object { $_.Name.Length } | Select-Object -First 1
if (-not $app) { '' } else { Start-Process ("shell:AppsFolder\\" + $app.AppID); $app.Name }`), 30000);
  return String(name || '').trim();
}

// Eine Medientaste drücken (playpause, weiter, zurueck, stopp, lauter, leiser, stumm).
async function medien(aktion) {
  const name = `medien_${aktion}`;
  const taste = { playpause: 'medien_playpause', weiter: 'medien_weiter', zurueck: 'medien_zurueck', stopp: 'medien_stopp', lauter: 'lauter', leiser: 'leiser', stumm: 'stumm' }[aktion];
  if (!taste) throw new Error(`Unbekannte Medienaktion "${aktion}".`);
  await worker.ausfuehren(mitArgs({ vk: VK[taste] }, '[JuliaWin]::Kombination([uint16[]]@([uint16]$a.vk))'));
  return name;
}

// Ein Programm sauber schließen: an alle Fenster des Prozesses das Schließen-
// Signal schicken (CloseMainWindow), damit es noch nach dem Speichern fragen kann.
async function programmSchliessen(name) {
  const roh = String(name || '').trim().replace(/\.exe$/i, '').replace(/[^\w.\-]/g, '');
  if (!roh) throw new Error('Kein Programmname angegeben.');
  const n = await worker.ausfuehren(mitArgs({ name: roh }, `
$ps = Get-Process -Name $a.name -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }
$z = 0
foreach ($p in $ps) { if ($p.CloseMainWindow()) { $z++ } }
$z`), 15000);
  return Number(n) || 0;
}

// Prozesse, die NIE gebremst/entlastet werden dürfen (Issue #19/#26): Windows-
// Kernprozesse (ein Einfrieren/Verlangsamen würde den PC lahmlegen) und Julia
// selbst inkl. ihrer Kind-/GPU-Prozesse. Namen kleingeschrieben, ohne .exe.
const SPERRLISTE_BREMSEN = new Set([
  'system', 'registry', 'idle', 'system idle process', 'memory compression',
  'csrss', 'wininit', 'winlogon', 'services', 'lsass', 'smss', 'svchost',
  'explorer', 'dwm', 'fontdrvhost', 'sihost', 'ctfmon', 'taskhostw',
  'lsaiso', 'conhost', 'wudfhost', 'spoolsv', 'audiodg', 'powershell', 'pwsh',
  'julia ai', 'julia', 'electron',
]);

// Reine, testbare Prüfung: darf dieser Prozess (nach Name) entlastet werden?
function darfBremsen(name) {
  const n = String(name || '').trim().replace(/\.exe$/i, '').toLowerCase();
  if (!n) return false;
  return !SPERRLISTE_BREMSEN.has(n);
}

// Einen Prozess „entlasten" = seine Priorität auf Idle senken (er läuft dann nur
// noch, wenn sonst nichts die CPU braucht) bzw. wieder auf Normal setzen. Bewusst
// KEIN echtes Suspendieren: ein eingefrorener System-naher Prozess könnte den PC
// zum Deadlock bringen. Umkehrbar, und die Sperrliste greift zusätzlich in
// PowerShell, falls die pid nicht zum erwarteten Namen passt.
async function prozessBremsen(pid, name, bremsen) {
  const id = Number(pid);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Ungültige Prozess-Kennung.');
  if (!darfBremsen(name)) throw new Error('Dieser Prozess ist geschützt und wird nicht verändert.');
  const roh = String(name || '').trim().replace(/\.exe$/i, '').replace(/[^\w.\- ]/g, '');
  const sperr = [...SPERRLISTE_BREMSEN].map((s) => `'${s}'`).join(',');
  const ok = await worker.ausfuehren(mitArgs({ id, name: roh, bremsen: !!bremsen }, `
$sperr = @(${sperr})
$p = Get-Process -Id ([int]$a.id) -ErrorAction SilentlyContinue
if (-not $p) { throw 'Prozess nicht gefunden.' }
if ($p.ProcessName.ToLower() -ne $a.name.ToLower()) { throw 'Prozess passt nicht zur Kennung.' }
if ($sperr -contains $p.ProcessName.ToLower()) { throw 'Prozess ist geschützt.' }
$p.PriorityClass = if ($a.bremsen) { [System.Diagnostics.ProcessPriorityClass]::Idle } else { [System.Diagnostics.ProcessPriorityClass]::Normal }
$true`), 15000);
  return !!ok;
}

module.exports = {
  worker, aufwaermen, fensterAuflisten, vordergrund, vordergrundInfo, prozesse, systemStatus, passwortFelder, passwortFelderIn, SENSIBLE_PROGRAMME,
  klick, scrollen, tippen, taste, vkCodes, fokussieren, fensterAnordnen, FENSTER_SEITEN, programmOeffnen, appOeffnen, programmSchliessen, medien, kopierenNachHotkey,
  prozessBremsen, darfBremsen, SPERRLISTE_BREMSEN,
};
