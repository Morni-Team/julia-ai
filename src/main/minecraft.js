'use strict';

const { EventEmitter } = require('events');
const dns = require('dns');
const fs = require('fs');
const net = require('net');
const path = require('path');
const { GRUEN, ROT } = require('./ampel');
const { intern } = require('./webseite');
const { Stimme } = require('./minecraft-stimme');

// Julia spielt Minecraft (Java Edition) mit – als eigene Spielfigur auf deinem
// Server. Alles Schnelle (kämpfen, folgen, ausweichen) läuft hier lokal 20-mal
// pro Sekunde; das Modell gibt nur die Aufgabe vor, sonst wäre Julia viel zu
// langsam.
//
// Von sich aus nur Server auf diesem PC oder im Heimnetz. Einen Server im
// Internet (etwa den eines Freundes) trägt der Nutzer selbst im Minecraft-
// Reiter ein. Große öffentliche Netzwerke nie: Dort sind Bots verboten, das
// wäre Schummeln gegen echte Leute und ein Bann-Grund.
//
// Mit Minecraft-Konto meldet sich der Nutzer selbst im Browser bei Microsoft
// an (Code auf microsoft.com/link) – Julia sieht kein Passwort. Ohne Konto
// geht es auf Servern mit online-mode=false.

const FREMDER_SERVER = 'Von sich aus tritt Julia nur Servern auf diesem PC oder im Heimnetz bei. Einen Server im Internet trägst du selbst im Minecraft-Reiter ein.';
const GROSSES_NETZWERK = 'Auf großen öffentlichen Servern sind Bots verboten – das Konto würde gebannt. Dort spielt Julia nicht mit.';
const GROSSE_NETZWERKE = /(^|\.)(hypixel\.net|mineplex\.com|cubecraft\.net|gommehd\.net|hivemc\.com|playhive\.com|mccentral\.org|minemen\.club|pvp\.land|manacube\.com|jartexnetwork\.com|pika-network\.net|blocksmc\.com|minesaga\.org|wynncraft\.com|mineclub\.com|herobrine\.org|timolia\.de|griefergames\.net|rewinside\.tv|opblocks\.com|purpleprison\.org|lemoncloud\.net|mcprison\.com|2b2t\.org)\.?$/i;
const KONTO_ID = 'julia';
const KONTO_NEU = 'Das Minecraft-Konto muss neu verbunden werden – im Minecraft-Reiter auf „Konto verbinden“.';

// [Schaden, Schläge pro Sekunde] seit 1.9 – danach richtet sich die Waffenwahl.
const WAFFEN = {
  netherite_sword: [8, 1.6], diamond_sword: [7, 1.6], iron_sword: [6, 1.6], stone_sword: [5, 1.6], golden_sword: [4, 1.6], wooden_sword: [4, 1.6],
  netherite_axe: [10, 1], diamond_axe: [9, 1], iron_axe: [9, 0.9], stone_axe: [9, 0.8], golden_axe: [7, 1], wooden_axe: [7, 0.8],
  trident: [9, 1.1],
};
const RUESTUNG = { netherite: 6, diamond: 5, iron: 4, chainmail: 3, turtle: 3, golden: 2, leather: 1 };
const WERKZEUG = { netherite: 6, diamond: 5, iron: 4, stone: 2, golden: 2, wooden: 1 };
const PLATZ = { helmet: 'head', chestplate: 'torso', leggings: 'legs', boots: 'feet' };
const PLATZ_SLOT = { head: 5, torso: 6, legs: 7, feet: 8 };
const HEILEN = ['enchanted_golden_apple', 'golden_apple'];
const ESSEN = ['golden_carrot', 'cooked_beef', 'cooked_porkchop', 'cooked_mutton', 'cooked_salmon', 'cooked_chicken', 'baked_potato', 'bread', 'cooked_cod', 'pumpkin_pie', 'apple', 'carrot', 'sweet_berries', 'melon_slice', 'cookie'];
// Wie Julia die Nahrung im Chat und in Meldungen nennt.
const ESSEN_NAMEN = {
  golden_carrot: 'eine goldene Karotte', cooked_beef: 'ein Steak', cooked_porkchop: 'einen Schweinebraten',
  cooked_mutton: 'einen Hammelbraten', cooked_salmon: 'gebratenen Lachs', cooked_chicken: 'ein Brathähnchen',
  baked_potato: 'eine Ofenkartoffel', bread: 'Brot', cooked_cod: 'gebratenen Kabeljau', pumpkin_pie: 'Kürbiskuchen',
  apple: 'einen Apfel', carrot: 'eine Karotte', sweet_berries: 'Süßbeeren', melon_slice: 'eine Melonenscheibe',
  cookie: 'einen Keks', golden_apple: 'einen Goldapfel', enchanted_golden_apple: 'einen verzauberten Goldapfel',
};
const essenName = (n) => ESSEN_NAMEN[n] || n;
const FEINDE = new Set([
  'zombie', 'husk', 'drowned', 'zombie_villager', 'skeleton', 'stray', 'bogged', 'wither_skeleton', 'creeper', 'spider', 'cave_spider',
  'witch', 'slime', 'magma_cube', 'phantom', 'pillager', 'vindicator', 'evoker', 'vex', 'ravager', 'blaze', 'ghast', 'piglin_brute',
  'hoglin', 'zoglin', 'silverfish', 'endermite', 'guardian', 'elder_guardian', 'breeze',
]);

// Blöcke, in die man nicht hineinlaufen sollte – für die Gefahrenerkennung
// direkt vor der Figur (schnell reagieren, ohne erst die KI zu fragen).
const GEFAHR_VORAUS = {
  lava: 'Lava', fire: 'Feuer', soul_fire: 'Seelenfeuer', magma_block: 'Magmablock',
  cactus: 'Kaktus', sweet_berry_bush: 'Süßbeeren', wither_rose: 'Witherrose',
  powder_snow: 'Pulverschnee', campfire: 'Lagerfeuer', soul_campfire: 'Seelenlagerfeuer',
};

// Deutsche Wörter für häufige Blöcke; sonst gilt der englische Name (oak_log).
// Ein Eintrag mit "_" vorne passt auf alle Namen mit dieser Endung.
const BLOCK_WOERTER = {
  holz: ['_log'], baumstamm: ['_log'], stamm: ['_log'],
  stein: ['stone', 'cobblestone', 'deepslate'], bruchstein: ['cobblestone'],
  erde: ['dirt', 'grass_block'], sand: ['sand'], kies: ['gravel'], ton: ['clay'],
  kohle: ['coal_ore', 'deepslate_coal_ore'], eisen: ['iron_ore', 'deepslate_iron_ore'], kupfer: ['copper_ore', 'deepslate_copper_ore'],
  gold: ['gold_ore', 'deepslate_gold_ore'], diamant: ['diamond_ore', 'deepslate_diamond_ore'], diamanten: ['diamond_ore', 'deepslate_diamond_ore'],
  redstone: ['redstone_ore', 'deepslate_redstone_ore'], smaragd: ['emerald_ore', 'deepslate_emerald_ore'],
};

// Deutsche Wörter für Gegenstände (geben, herstellen); sonst gilt der englische Name.
const ITEM_WOERTER = {
  holz: ['_log'], bretter: ['_planks'], brett: ['_planks'], stock: ['stick'], stoecke: ['stick'], stöcke: ['stick'],
  fackel: ['torch'], werkbank: ['crafting_table'], ofen: ['furnace'], truhe: ['chest'], bett: ['_bed'], leiter: ['ladder'],
  brot: ['bread'], steak: ['cooked_beef'], fleisch: ['cooked_beef', 'cooked_porkchop', 'cooked_mutton', 'cooked_chicken', 'beef', 'porkchop'],
  apfel: ['apple'], goldapfel: ['golden_apple'], karotte: ['carrot'], kartoffel: ['baked_potato', 'potato'], essen: ESSEN,
  eisen: ['iron_ingot'], gold: ['gold_ingot'], diamant: ['diamond'], diamanten: ['diamond'], kohle: ['coal', 'charcoal'], smaragd: ['emerald'],
  stein: ['cobblestone', 'stone'], bruchstein: ['cobblestone'], erde: ['dirt'], sand: ['sand'], glas: ['glass'], wolle: ['_wool'],
  pfeil: ['arrow'], bogen: ['bow'], schild: ['shield'], eimer: ['bucket'], boot: ['_boat'],
  schwert: ['_sword'], spitzhacke: ['_pickaxe'], axt: ['_axe'], schaufel: ['_shovel'], hacke: ['_hoe'],
};

// Tiere, die Essen geben – nur die jagt die Figur.
const TIERE = new Set(['cow', 'pig', 'chicken', 'sheep', 'rabbit', 'mooshroom']);
const TIER_WOERTER = { kuh: 'cow', kuehe: 'cow', kühe: 'cow', schwein: 'pig', schweine: 'pig', huhn: 'chicken', huehner: 'chicken', hühner: 'chicken', schaf: 'sheep', schafe: 'sheep', hase: 'rabbit', hasen: 'rabbit', kaninchen: 'rabbit', pilzkuh: 'mooshroom' };
// Das behält die Figur beim Einräumen: Waffen, Werkzeug, Rüstung, Essen, Fackeln.
const BEHALTEN = /_(sword|axe|pickaxe|shovel|hoe|helmet|chestplate|leggings|boots)$|^(shield|bow|crossbow|trident|arrow|torch)$/;
const HILFE = 'Befehle: !folge · !komm · !beschütze mich · !duell · !stopp · !geh X Y Z · !gib 5 brot · !sammel · !jag 3 kuh · !craft 4 fackel · !bau ab holz 10 · !bau turm 8 · !bau mauer 10 3 · !bau hütte · !bau brücke 12 · !schmelz 8 eisen · !stell werkbank hin · !ess · !rüste dich · !verstau · !schlaf · !steig ein · !steig aus · !spiel durch · !hör auch auf NAME · !hör nur auf mich';
// Brennstoff für den Ofen: Name (oder Endung) und wie viele Dinge eins schafft.
const BRENNSTOFF = [['coal', 8], ['charcoal', 8], ['_planks', 1.5], ['_log', 1.5], ['stick', 0.5]];
// Was die Figur beim Umsehen meldet.
const UMSEHEN = {
  holz: (n) => n.endsWith('_log'),
  stein: (n) => n === 'stone' || n === 'cobblestone',
  kohle: (n) => n.endsWith('coal_ore'),
  eisen: (n) => n.endsWith('iron_ore'),
  kupfer: (n) => n.endsWith('copper_ore'),
  gold: (n) => n.endsWith('gold_ore'),
  redstone: (n) => n.endsWith('redstone_ore'),
  diamant: (n) => n.endsWith('diamond_ore'),
  smaragd: (n) => n.endsWith('emerald_ore'),
  obsidian: (n) => n === 'obsidian',
  wasser: (n) => n === 'water',
  lava: (n) => n === 'lava',
  werkbank: (n) => n === 'crafting_table',
  ofen: (n) => n === 'furnace' || n === 'blast_furnace' || n === 'smoker',
  truhe: (n) => n === 'chest' || n === 'barrel',
  bett: (n) => n.endsWith('_bed'),
};
const DAUERHAFT = ['folgen', 'beschuetzen', 'kaempfen'];

// --- Kleine, prüfbare Bausteine ---

function adresseTeilen(roh, port) {
  let host = String(roh || '').trim() || 'localhost';
  let p = Number(port) || 25565;
  const m = /^([^:[\]]+):(\d{1,5})$/.exec(host);
  if (m) { host = m[1]; p = Number(m[2]); }
  const v6 = /^\[([^\]]+)\](?::(\d{1,5}))?$/.exec(host);
  if (v6) { host = v6[1]; if (v6[2]) p = Number(v6[2]); }
  return { host, port: Math.round(p) };
}

// Löst den Namen einmal auf und verbindet dann mit genau dieser IP – so kann
// ein umgebogener DNS-Eintrag nicht nachträglich auf einen fremden Server zeigen.
// oeffentlich: Die Adresse hat der Nutzer selbst eingetragen – dann darf es
// auch ein Server im Internet sein, nur kein großes Netzwerk.
function hostPruefen(roh) {
  const host = String(roh || '').trim().replace(/^\[|\]$/g, '');
  if (!host || host.length > 253 || !/^[A-Za-z0-9.\-:]+$/.test(host)) throw new Error('Das ist keine gültige Serveradresse.');
  if (GROSSE_NETZWERKE.test(host)) throw new Error(GROSSES_NETZWERK);
  return host;
}

async function adressePruefen(roh, aufloesen = (h) => dns.promises.lookup(h, { all: true }), { oeffentlich = false } = {}) {
  const host = hostPruefen(roh);
  const ips = net.isIP(host) ? [host] : (await aufloesen(host)).map((x) => x.address);
  if (!ips.length) throw new Error(`${host} wurde nicht gefunden.`);
  if (!oeffentlich && !ips.every(intern)) throw new Error(FREMDER_SERVER);
  return ips[0];
}

// Wie das Spiel selbst: Ohne eigenen Port gilt der SRV-Eintrag
// (_minecraft._tcp.NAME) – viele Server liegen nicht dort, wo die Webseite
// liegt. Verbunden wird mit der geprüften IP; im Handshake steht aber der
// Name, den du eingetragen hast, sonst lassen Proxys (BungeeCord, Velocity,
// TCPShield) die Verbindung fallen.
async function zielFinden(roh, port, { aufloesen, srv = (n) => dns.promises.resolveSrv(n), oeffentlich = false } = {}) {
  const host = hostPruefen(roh);
  let ziel = { name: host, port };
  if (port === 25565 && !net.isIP(host) && host !== 'localhost' && host.includes('.')) {
    try {
      const s = (await srv(`_minecraft._tcp.${host}`)).sort((a, b) => a.priority - b.priority || b.weight - a.weight)[0];
      if (s && s.name && s.port) ziel = { name: String(s.name).replace(/\.$/, ''), port: s.port };
    } catch { /* kein SRV-Eintrag: direkt */ }
  }
  const ip = await adressePruefen(ziel.name, aufloesen, { oeffentlich });
  return { host, ip, port: ziel.port };
}

// Speicher für die Microsoft-Anmeldung, im Format von prismarine-auth –
// aber verschlüsselt (Windows DPAPI) in einer Datei statt lesbar im Ordner.
function kontoSpeicher({ datei, krypto }) {
  let alles = null;
  const lesen = () => {
    if (alles) return alles;
    try { alles = JSON.parse(krypto.entschluesseln(fs.readFileSync(datei, 'utf8'))) || {}; } catch { alles = {}; }
    return alles;
  };
  const schreiben = () => {
    fs.mkdirSync(path.dirname(datei), { recursive: true });
    fs.writeFileSync(datei, krypto.verschluesseln(JSON.stringify(alles)), 'utf8');
  };
  const fabrik = ({ cacheName }) => ({
    async reset() { lesen()[cacheName] = {}; schreiben(); return {}; },
    async getCached() { return lesen()[cacheName] || {}; },
    async setCached(wert) { lesen()[cacheName] = wert; schreiben(); },
    async setCachedPartial(wert) {
      const a = lesen();
      a[cacheName] = { ...(a[cacheName] || {}), ...wert };
      schreiben();
    },
  });
  fabrik.vorhanden = () => fs.existsSync(datei);
  fabrik.loeschen = () => {
    alles = {};
    try { fs.unlinkSync(datei); } catch { /* schon weg */ }
  };
  return fabrik;
}

// Derselbe Anmeldeweg wie in minecraft-protocol, damit der Bot die
// gespeicherte Anmeldung wiederfindet.
function kontoFluss(laden = () => require('prismarine-auth')) {
  return { flow: 'live', authTitle: laden().Titles.MinecraftNintendoSwitch, deviceType: 'Nintendo' };
}

// beiCode({ code, adresse, bisMs }): den Code zeigen, den der Nutzer auf
// microsoft.com/link eingibt. Liefert den Namen des Minecraft-Profils.
async function kontoAnmelden({ cache, beiCode, laden = () => require('prismarine-auth') }) {
  const { Authflow } = laden();
  const flow = new Authflow(KONTO_ID, cache, kontoFluss(laden), (r) => beiCode({
    code: r.user_code, adresse: r.verification_uri, bisMs: Date.now() + (r.expires_in || 900) * 1000,
  }));
  let profil;
  try {
    ({ profile: profil } = await flow.getMinecraftJavaToken({ fetchProfile: true }));
  } catch (e) {
    if (/not ?found|own|NOT_FOUND|404/i.test(String(e && e.message))) profil = null;
    else throw new Error(`Anmeldung fehlgeschlagen: ${e && e.message ? e.message : e}`);
  }
  if (!profil || profil.error || !profil.name) {
    if (cache.loeschen) cache.loeschen();
    throw new Error('Zu diesem Microsoft-Konto gibt es kein Minecraft Java. Julia braucht ein eigenes gekauftes Java-Konto.');
  }
  return { name: profil.name, id: profil.id };
}

function waffeWert(name, neuesKampfsystem = true) {
  const w = WAFFEN[name];
  if (!w) return 0;
  // Vor 1.9 machen Äxte weniger Schaden als Schwerter; bei Gleichstand gewinnt das Schwert.
  return neuesKampfsystem ? w[0] * w[1] : w[0] - (name.endsWith('_axe') ? 3.5 : 0);
}

function besteWaffe(items, neuesKampfsystem = true) {
  let beste = null;
  for (const it of items || []) {
    if (waffeWert(it.name, neuesKampfsystem) > (beste ? waffeWert(beste.name, neuesKampfsystem) : 0)) beste = it;
  }
  return beste;
}

// Ticks zwischen zwei Schlägen: seit 1.9 volle Aufladung abwarten, vorher
// einfach schnell klicken (etwa 7 pro Sekunde).
function schlagPause(waffe, neuesKampfsystem = true) {
  if (!neuesKampfsystem) return 3;
  const w = WAFFEN[waffe];
  return Math.ceil(20 / (w ? w[1] : 4));
}

function ruestungTeil(name) {
  const m = /^([a-z]+)_(helmet|chestplate|leggings|boots)$/.exec(String(name || ''));
  return m ? { platz: PLATZ[m[2]], wert: RUESTUNG[m[1]] || 0 } : null;
}

// Nur echte Verbesserungen gegenüber dem, was schon getragen wird.
function besteRuestung(items, getragen = {}) {
  const out = {};
  for (const it of items || []) {
    const r = ruestungTeil(it.name);
    if (!r) continue;
    const jetzt = out[r.platz] || getragen[r.platz];
    const jetztWert = jetzt ? (ruestungTeil(jetzt.name) || { wert: 0 }).wert : 0;
    if (r.wert > jetztWert) out[r.platz] = it;
  }
  for (const [platz, it] of Object.entries(out)) if (getragen[platz] === it) delete out[platz];
  return out;
}

function werkzeugArt(block) {
  const n = String(block || '');
  if (/(_log|_wood|_planks|_stem|_hyphae)$/.test(n)) return 'axe';
  if (/^(dirt|coarse_dirt|grass_block|sand|red_sand|gravel|clay|snow_block|snow|mud|soul_sand|soul_soil|podzol|mycelium|rooted_dirt)$/.test(n)) return 'shovel';
  return 'pickaxe';
}

function besteWerkzeug(items, art) {
  const muster = new RegExp(`^([a-z]+)_${art}$`);
  let beste = null;
  let besterWert = 0;
  for (const it of items || []) {
    const m = muster.exec(it.name);
    const w = m ? WERKZEUG[m[1]] || 0 : 0;
    if (w > besterWert) { beste = it; besterWert = w; }
  }
  return beste;
}

// Erkennt, ob die Figur „feststeckt": Sie will laufen, kommt seit einer Weile
// aber kaum vom Fleck (klassisch: 1 Block hoch, ohne zu springen). Rein
// rechnerisch, damit prüfbar. `anker` ist der zuletzt gemerkte Stand
// { x, z, t(icks) }, `pos` die aktuelle Position. Rückgabe:
//   { neu }            – neuen Anker merken (kommt voran oder erster Aufruf)
//   { springen, neu }  – zu lange festgehangen → Sprung-Impuls, Anker neu
//   {}                 – noch abwarten
// Soll die Hänger-Prüfung überhaupt laufen? Nur wenn sie vorankommen will
// (Wegsuche oder selbst vorwärts) und entweder am Boden steht oder im Wasser
// ist (Issue #28: im Wasser ist onGround immer false).
function haengerAktiv({ wegsuche, selbst, onGround, imWasser }) {
  if (!wegsuche && !selbst) return false;
  return !!(onGround || imWasser);
}

// Wie lange der Sprung-/Schwimm-Impuls gehalten wird: im Wasser länger, damit
// sie sicher aufsteigt.
function haengerDauer(imWasser) {
  return imWasser ? 700 : 350;
}

// Zählt zusätzlich, wie oft in Folge am (nahezu) selben Ort gesprungen wurde
// (`sp` im Anker). Kommt sie voran, wird der Zähler zurückgesetzt. Springt sie
// trotz `maxSpruenge`-facher Impulse weiter nicht weg, ist die Stelle für das
// reine Vorwärts-Laufen unpassierbar → `aufgeben`, damit der Aufrufer das Drücken
// stoppt (kein endloses Springen auf der Stelle / Livelock, Issue #8) und der
// nächste Planungs-Schritt einen neuen Weg sucht.
function haengerStatus(anker, pos, ticks, { minWeit = 0.35, minTicks = 12, maxSpruenge = 4 } = {}) {
  const stand = { x: pos.x, z: pos.z, t: ticks };
  if (!anker) return { neu: { ...stand, sp: 0 } };
  const weit = Math.hypot(pos.x - anker.x, pos.z - anker.z);
  if (weit > minWeit) return { neu: { ...stand, sp: 0 } };
  if (ticks - anker.t >= minTicks) {
    const sp = (anker.sp || 0) + 1;
    const res = { springen: true, neu: { ...stand, sp } };
    if (sp >= maxSpruenge) res.aufgeben = true;
    return res;
  }
  return {};
}

// Hängt die Figur? Kommen seit `grenzeMs` keine Physics-Ticks mehr (der Bot ist
// zwar verbunden, aber eingefroren), gilt das als Hänger → Relog. Rein
// rechnerisch, damit prüfbar.
function haengerErkannt(letzterTickMs, jetztMs, grenzeMs) {
  if (!letzterTickMs) return false;
  return jetztMs - letzterTickMs >= grenzeMs;
}

function blockNamen(wort, alleNamen) {
  const w = String(wort || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (!w) return [];
  if (alleNamen.includes(w)) return [w];
  const muster = BLOCK_WOERTER[w];
  if (muster) return alleNamen.filter((n) => muster.some((m) => (m.startsWith('_') ? n.endsWith(m) : n === m)));
  return alleNamen.filter((n) => n.endsWith(`_${w}`));
}

// Wie blockNamen, für Gegenstände; verzeiht die Mehrzahl ("fackeln", "brote").
function itemNamen(wort, alleNamen) {
  const w = String(wort || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (!w) return [];
  for (const v of [w, w.replace(/(en|n|e|s)$/, ''), w.replace(/n$/, '')]) {
    if (!v) continue;
    if (alleNamen.includes(v)) return [v];
    const muster = ITEM_WOERTER[v] || BLOCK_WOERTER[v];
    if (muster) {
      const treffer = alleNamen.filter((n) => muster.some((m) => (m.startsWith('_') ? n.endsWith(m) : n === m)));
      if (treffer.length) return muster.some((m) => m.startsWith('_')) ? treffer : muster.filter((m) => treffer.includes(m));
    }
  }
  return alleNamen.filter((n) => n.endsWith(`_${w}`));
}

// Koordinaten prüfen: ganze Zahlen innerhalb der Welt; y darf fehlen.
function ortLesen({ x, y, z } = {}) {
  const zahl = (v, max) => {
    const n = Number(v);
    if (!Number.isFinite(n) || Math.abs(n) > max) throw new Error('Das sind keine gültigen Koordinaten – z. B. !geh 100 64 -20.');
    return Math.round(n);
  };
  const ort = { x: zahl(x, 3e7), z: zahl(z, 3e7) };
  if (y !== undefined && y !== null && y !== '') {
    ort.y = zahl(y, 400);
    if (ort.y < -64 || ort.y > 320) throw new Error('Die Höhe liegt zwischen -64 und 320.');
  }
  return ort;
}

const ortText = (o) => (o.y == null ? `${o.x} / ${o.z}` : `${o.x} / ${o.y} / ${o.z}`);

// Gängige Bausteine, in dieser Vorliebe – gebaut wird mit dem, wovon am meisten da ist.
// Blöcke, die Julia beim Abbauen in Ruhe lässt – außer der Nutzer nennt genau
// diesen Block. So reißt sie beim Sammeln nichts Wertvolles oder deine Bauten
// ab: Truhen, Öfen, Betten, Türen, Werkbänke, Spawner, Schilder, Glas, Wolle,
// Fackeln, Blumentöpfe, Amboss, Braustand, Beacon und Ähnliches.
const GESCHUETZT_ABBAU = /(chest|barrel|shulker_box|furnace|smoker|crafting_table|_bed$|_door$|_trapdoor$|spawner|beacon|conduit|enchanting_table|brewing_stand|anvil|lectern|grindstone|smithing_table|cartography_table|fletching_table|loom|hopper|dispenser|dropper|glass|_pane$|torch|lantern|_sign$|hanging_sign|item_frame|painting|_banner$|flower_pot|campfire|respawn_anchor|lodestone|bell|_wool$|_carpet$|jukebox|note_block|cake|beehive|bee_nest|end_portal_frame|bookshelf|glazed_terracotta|_glass$|target|composter|cauldron)/;

const BAUSTOFFE = ['cobblestone', 'cobbled_deepslate', 'dirt', 'stone', 'stone_bricks', 'netherrack', 'oak_planks', 'spruce_planks', 'birch_planks'];
const BAU_NAMEN = { turm: 'einen Turm', mauer: 'eine Mauer', bruecke: 'eine Brücke', huette: 'eine Hütte' };
const bauName = (b) => BAU_NAMEN[b] || 'etwas';

// yaw → ganze Kardinalrichtung (vorne) und die Richtung nach rechts.
function richtungAus(yaw) {
  const sx = -Math.sin(yaw || 0);
  const sz = -Math.cos(yaw || 0);
  let fx = 0;
  let fz = 0;
  if (Math.abs(sx) >= Math.abs(sz)) fx = sx >= 0 ? 1 : -1;
  else fz = sz >= 0 ? 1 : -1;
  return { fx, fz, rx: -fz, rz: fx };
}

// Liste der zu setzenden Blockkoordinaten für eine Bauform, relativ zur Figur.
// Immer von unten nach oben, damit jeder Block einen Nachbarn zum Anlehnen hat.
function bauPlan(bau, dims, start, dir) {
  const { fx, fz, rx, rz } = dir;
  const L = Math.max(1, Math.min(64, Math.round(dims.laenge) || 5));
  const H = Math.max(1, Math.min(16, Math.round(dims.hoehe) || 3));
  const B = Math.max(1, Math.min(32, Math.round(dims.breite) || 5));
  const cells = [];
  const add = (x, y, z) => cells.push({ x, y, z });
  const s = start;
  if (bau === 'mauer') {
    const off = Math.floor(L / 2);
    for (let i = 0; i < L; i++) for (let h = 0; h < H; h++) add(s.x + fx + rx * (i - off), s.y + h, s.z + fz + rz * (i - off));
  } else if (bau === 'bruecke') {
    for (let i = 1; i <= L; i++) add(s.x + fx * i, s.y - 1, s.z + fz * i);
  } else if (bau === 'huette') {
    // Grundriss B breit × L tief, H hohe Wände, Türlücke vorn Mitte (auf vorhandenem Boden).
    const offB = Math.floor(B / 2);
    for (let h = 1; h <= H; h++) {
      for (let d = 0; d < L; d++) {
        for (let w = 0; w < B; w++) {
          if (!(d === 0 || d === L - 1 || w === 0 || w === B - 1)) continue; // nur der Rand
          if (d === 0 && w === offB && h <= 2) continue; // Türlücke
          add(s.x + fx * d + rx * (w - offB), s.y - 1 + h, s.z + fz * d + rz * (w - offB));
        }
      }
    }
  }
  const gesehen = new Set();
  const out = [];
  for (const c of cells) { const k = `${c.x},${c.y},${c.z}`; if (!gesehen.has(k)) { gesehen.add(k); out.push(c); } }
  return out.slice(0, 512);
}

// "5 brot", "brot 5", "ein brot" → { anzahl, sache }
function mengeLesen(roh) {
  const r = String(roh || '').trim().replace(/^(ein|eine|einen|a|an)\s+/i, '');
  let m = /^(\d{1,3})\s*(?:x|stück|stueck)?\s+(.+)$/i.exec(r);
  if (m) return { anzahl: Number(m[1]), sache: m[2].trim() };
  m = /^(.+?)\s+(\d{1,3})$/.exec(r);
  if (m) return { anzahl: Number(m[2]), sache: m[1].trim() };
  return { anzahl: null, sache: r };
}

function istFeind(e) {
  return !!e && e.type !== 'player' && e.isValid !== false && (e.type === 'hostile' || FEINDE.has(e.name));
}

// Darf Julia sich gegen diesen Angreifer wehren? (rein, testbar). Ja bei jedem
// Angreifer MIT Namen – NUR den eigenen Spieler (Besitzer) greift sie nie an, damit
// sie sich nicht gegen ihren eigenen Chef wendet (Nutzerwunsch: wehren, wenn sie von
// jemandem angegriffen wird). Groß/klein egal.
function darfWehren(name, besitzer) {
  const n = String(name || '').trim();
  if (!n) return false;
  return n.toLowerCase() !== String(besitzer || '').trim().toLowerCase();
}

// Reitbare Tiere (mit Sattel). Boote und Loren erkennt man am Namen.
const REITTIERE = new Set(['horse', 'donkey', 'mule', 'skeleton_horse', 'zombie_horse', 'pig', 'strider', 'camel']);
function istFahrzeug(e) {
  if (!e || e.isValid === false || !e.name) return false;
  const n = e.name;
  return n === 'boat' || n === 'chest_boat' || n.endsWith('_boat') || n.endsWith('_chest_boat') || n.includes('minecart') || REITTIERE.has(n);
}

// Fernkämpfer: treffen aus der Distanz, also schon früher darauf reagieren.
const FERNKAEMPFER = new Set(['skeleton', 'stray', 'bogged', 'witch', 'pillager', 'ghast', 'blaze']);

// Welchen Feind zuerst? Ein Creeper ist die größte Gefahr, danach zählt die Nähe.
// Fernkämpfer (Skelett, Hexe) etwas vor gewöhnlichen Nahkämpfern.
function bedrohWert(e, p) {
  const naehe = 30 - Math.min(30, e.position.distanceTo(p));
  let art = 0;
  if (e.name === 'creeper') art = 100;
  else if (FERNKAEMPFER.has(e.name)) art = 20;
  return art + naehe;
}

// Ab welcher Entfernung wehrt sich Julia selbst? Früher reagieren gegen Fern-
// kämpfer (Pfeile/Wurf) und Creeper, damit sie nachts nicht erst reagiert, wenn
// der Mob schon direkt danebensteht (Nutzerwunsch: besser gegen Mobs kämpfen).
function gefahrReichweite(name) {
  if (name === 'creeper') return 9;
  if (FERNKAEMPFER.has(name)) return 12;
  return 7;
}

// Blöcke, von denen Julia nur EINEN braucht und wiederverwenden soll – statt bei
// jeder Herstellung eine neue zu bauen (Nutzerwunsch: sparsamer sein). Wert = wie
// es in der Rückmeldung heißt.
const EINMAL_BLOECKE = { crafting_table: 'eine Werkbank', furnace: 'einen Ofen' };

// Reine Entscheidung fürs Water-MLG (Sturz mit dem Wassereimer abfangen):
// fällt sie schnell genug, schon schädlich tief, ist der Boden nah – und hat sie
// überhaupt einen Wassereimer? Ab ~4 Blöcken Fallhöhe gäbe es sonst Schaden.
function mlgNoetig({ gefallen, geschwindigkeitY, bodenNah, hatWasser }) {
  return !!hatWasser && !!bodenNah && geschwindigkeitY < -0.5 && gefallen >= 4;
}

// Reine Entscheidung: soll Julia hochschwimmen? Nur wenn der Kopf im Wasser ist
// UND ihr die Luft ausgeht (<18) oder sie sinkt – so taucht sie zum Atmen auf und
// bleibt an der Oberfläche, kann aber kurz kontrolliert untertauchen (testbar).
function schwimmHoch({ kopfImWasser, luft, sinkt }) {
  return !!kopfImWasser && (luft < 18 || !!sinkt);
}

// Reine Entscheidung, ob/was Julia essen soll (Überleben, Nutzer-Logs: sie starb
// oft „nichts zum Heilen"). Bei wenig Leben früh einen Goldapfel; sonst die
// Sättigung ≥18 halten, damit sich Leben von selbst regeneriert – so überlebt sie
// das Erkunden/Graben deutlich besser. Gibt 'heilung' | 'essen' | null zurück.
function essenPlan({ food, health, hatEssen, hatHeilung }) {
  if (health <= 10 && hatHeilung) return 'heilung';
  if (food <= 18 && hatEssen) return 'essen';
  return null;
}

// Kampf-Taktik (Issue #93): nicht dumm sterben, bei Unterlegenheit zurückziehen
// und schnell regenerieren. Entscheidet aus Leben, Zahl der nahen Feinde und ob
// etwas zum Heilen dabei ist: 'rueckzug' | 'heilen' | 'kaempfen'.
//  - sehr wenig Leben (≤6): raus – erst heilen wenn möglich, sonst fliehen.
//  - in Unterzahl (≥3 Feinde) und angeschlagen (<14): lieber zurückziehen und
//    regenerieren, statt überrannt zu werden.
//  - Leben knapp (≤8) und Heilung da: erst heilen.
function rueckzugPlan({ health, feinde = 1, hatHeilung = false } = {}) {
  if (health <= 6) return hatHeilung ? 'heilen' : 'rueckzug';
  if (feinde >= 3 && health < 14) return 'rueckzug';
  if (health <= 8 && hatHeilung) return 'heilen';
  return 'kaempfen';
}

// Sparsam mit dem Seltenen (Issue #93 „je rarer, desto besser"): den normalen
// Goldapfel für den Alltag, den verzauberten Goldapfel nur im Notfall (sehr wenig
// Leben) oder wenn kein normaler mehr da ist. `hat` = Map Name→Anzahl. Gibt den
// zu essenden Item-Namen zurück oder null.
function heilWahl(hat = {}, health = 20) {
  const normal = (hat.golden_apple || 0) > 0;
  const selten = (hat.enchanted_golden_apple || 0) > 0;
  if (health <= 6 && selten) return 'enchanted_golden_apple';
  if (normal) return 'golden_apple';
  if (selten) return 'enchanted_golden_apple';
  return null;
}

// Rüstung craften – immer die beste erreichbare Stufe (Issue #93 „full rüssi …
// immer das bessere"). Aus dem Rohstoff-Vorrat (leather/iron_ingot/gold_ingot/
// diamond) für jedes Rüstungsteil die beste craftbare Stufe wählen, die die
// bereits getragene übertrifft; Material wird pro Teil abgezogen (kein
// Doppel-Ausgeben). Gibt eine Liste { slot, item, material, menge } zurück,
// teuerste Teile zuerst (Brustpanzer/Hose), damit knappes Material dort landet.
const RUESTUNG_STUFE = { netherite: 6, diamond: 5, iron: 4, chainmail: 3, turtle: 3, golden: 2, leather: 1 };
const TEIL_KOSTEN = { chestplate: 8, leggings: 7, helmet: 5, boots: 4 };
const CRAFT_STUFEN = [
  { tier: 'diamond', material: 'diamond' },
  { tier: 'iron', material: 'iron_ingot' },
  { tier: 'golden', material: 'gold_ingot' },
  { tier: 'leather', material: 'leather' },
];
function ruestungCraftPlan(vorrat = {}, getragen = {}) {
  const rest = { ...vorrat };
  const plan = [];
  for (const slot of ['chestplate', 'leggings', 'helmet', 'boots']) {
    const kosten = TEIL_KOSTEN[slot];
    const habenStufe = RUESTUNG_STUFE[getragen[slot]] || 0;
    for (const { tier, material } of CRAFT_STUFEN) {
      if (RUESTUNG_STUFE[tier] <= habenStufe) break; // schon gleich gut oder besser getragen
      if ((rest[material] || 0) >= kosten) {
        rest[material] -= kosten;
        plan.push({ slot, item: `${tier}_${slot}`, material, menge: kosten });
        break;
      }
    }
  }
  return plan;
}

// --- Eimer (Wasser/Lava aufnehmen & setzen, Milch trinken) ---
// Reine Zuordnung Aktion → welcher Eimer in die Hand muss, welche Quelle gesucht
// wird und was hinterher im Eimer ist. Getestet; die eigentliche Ausführung
// (anvisieren + benutzen) macht die Methode `eimer()`.
const EIMER = {
  wasser_aufnehmen: { hand: 'bucket', quelle: 'water', ergebnis: 'water_bucket' },
  lava_aufnehmen: { hand: 'bucket', quelle: 'lava', ergebnis: 'lava_bucket' },
  wasser_setzen: { hand: 'water_bucket', setzt: 'Wasser', ergebnis: 'bucket' },
  lava_setzen: { hand: 'lava_bucket', setzt: 'Lava', ergebnis: 'bucket' },
  milch: { hand: 'milk_bucket', trinken: true, ergebnis: 'bucket' },
};
const EIMER_ALIAS = {
  wasser: 'wasser_aufnehmen', water: 'wasser_aufnehmen', wasser_holen: 'wasser_aufnehmen', auffuellen: 'wasser_aufnehmen',
  lava: 'lava_aufnehmen', lava_holen: 'lava_aufnehmen',
  wasser_platzieren: 'wasser_setzen', lava_platzieren: 'lava_setzen',
  milch_trinken: 'milch', milk: 'milch', milch_holen: 'milch',
};
function eimerPlan(aktion) {
  const a = String(aktion || '').toLowerCase().trim().replace(/\s+/g, '_');
  const key = EIMER[a] ? a : EIMER_ALIAS[a];
  if (!key || !EIMER[key]) {
    throw new Error('Sag, was mit dem Eimer: wasser_aufnehmen, lava_aufnehmen, wasser_setzen, lava_setzen oder milch.');
  }
  return { aktion: key, ...EIMER[key] };
}

// Chat geht auf den eigenen Server – trotzdem keine Befehle (/op, /give …)
// und keine Farb- oder Steuerzeichen.
function chatText(text) {
  const s = String(text ?? '').replace(/[\u0000-\u001f\u007f§]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\/+/, '').trim().slice(0, 250);
  if (!s) throw new Error('Leere Chatnachricht.');
  return s;
}

// Minecraft-Namen: 3–16 Zeichen, Buchstaben, Ziffern, Unterstrich.
function botName(wunsch, assistent) {
  for (const k of [wunsch, assistent]) {
    const s = String(k || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 16);
    if (s.length >= 3) return s;
  }
  return 'Julia_Bot';
}

// Befehle im Spielchat: "!folge" oder mit Namen vorne ("Julia, komm her").
// Ist Julia angesprochen? Entweder beginnt die Nachricht mit „!“, oder der Name
// kommt irgendwo als eigenes Wort vor. Zurück kommt der Rest ohne den Namen,
// damit „Julia, folge“ genauso funktioniert wie „folge mir Julia“.
function anrede(text, namen = []) {
  const roh = String(text || '').trim();
  // Ränder säubern, aber ein „?“ am Ende bleibt – das braucht die Frage.
  const saeubern = (s) => s.replace(/\s+/g, ' ').replace(/^[\s,:!]+/, '').replace(/[\s,:]+$/, '').trim();
  if (roh.startsWith('!')) return { ok: true, rest: saeubern(roh.slice(1)) };
  for (const name of namen.filter(Boolean).map(String)) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = new RegExp(`(^|[^\\p{L}\\p{N}_])${esc}([^\\p{L}\\p{N}_]|$)`, 'iu').exec(roh);
    if (m) {
      const start = m.index + m[1].length;
      return { ok: true, rest: saeubern(roh.slice(0, start) + roh.slice(start + name.length)) };
    }
  }
  return { ok: false, rest: '' };
}

// Sie steuern nur die Spielfigur, nie etwas auf dem PC.
function befehlLesen(text, namen = []) {
  const a = anrede(text, namen);
  if (!a.ok) return null;
  const rest = a.rest.replace(/[.!?]+$/, '');
  const s = rest.toLowerCase();
  if (/^(stopp?|halt|warte|hör auf|hoer auf)$/.test(s)) return { aufgabe: 'stopp' };
  if (/^(folg(e|en)?|folge mir|komm mit|follow( me)?)$/.test(s)) return { aufgabe: 'folgen' };
  if (/^(komm( her| zu mir)?|come( here)?)$/.test(s)) return { aufgabe: 'kommen' };
  if (/^(besch(ü|ue)tz(e)?( mich)?|hilf( mir)?|protect( me)?|guard)$/.test(s)) return { aufgabe: 'beschuetzen' };
  const k = /^(?:duell|k(?:ä|ae)mpf(?:e)?|kampf|fight|duel|pvp|attack|greif(?:e)? an)(?:\s+(?:gegen|mit|against|with))?(?:\s+([A-Za-z0-9_]{3,16}))?$/i.exec(rest);
  if (k) return { aufgabe: 'kaempfen', spieler: k[1] && !/^(mich|me)$/i.test(k[1]) ? k[1] : null };
  if (/^(hilfe|help|befehle|commands|\?)$/.test(s)) return { aufgabe: 'hilfe' };
  if (/^(durchspiel(e|en)?|spiel(e|en)?\s+(das\s+)?(spiel\s+|minecraft\s+|mc\s+)?(durch|weiter|allein(e)?|selbst(st)?(ä|ae)ndig|von allein(e)?)|play\s+(it\s+)?through|beat\s+the\s+game)$/.test(s)) return { aufgabe: 'durchspielen' };
  if (/^(sammel|sammle|einsammeln|aufheben|heb auf|pick ?up|collect)( alles| das| ein| auf)*$/.test(s)) return { aufgabe: 'sammeln' };
  if (/^(schlaf(en)?|geh schlafen|ins bett|sleep|bed)$/.test(s)) return { aufgabe: 'schlafen' };
  if (/^(verstau(e|en)?|r(ä|ae)um( das inventar)? ein|einr(ä|ae)umen|store|stash)( alles)?( in die truhe)?$/.test(s)) return { aufgabe: 'verstauen' };
  const g = /^(?:geh|gehe|lauf|laufe|go|goto)(?:\s+(?:zu|nach|to))?\s+(-?\d+)\s+(-?\d+)(?:\s+(-?\d+))?$/.exec(s);
  if (g) return g[3] !== undefined ? { aufgabe: 'gehen', x: Number(g[1]), y: Number(g[2]), z: Number(g[3]) } : { aufgabe: 'gehen', x: Number(g[1]), z: Number(g[2]) };
  const j = /^(?:jag|jage|jagen|hunt)(?:\s+(\d{1,2}))?(?:\s+([a-zäöüß_]+))?(?:\s+(\d{1,2}))?$/.exec(s);
  if (j) return { aufgabe: 'jagen', anzahl: Number(j[1] || j[3]) || null, tier: j[2] || null };
  const abbau = /^(?:bau(?:e)?\s+ab|abbauen|mine|hack(?:e)?)\s+(.+)$/.exec(s);
  if (abbau) { const m = mengeLesen(abbau[1]); return { aufgabe: 'abbauen', block: m.sache, anzahl: m.anzahl }; }
  const bauen = /^(?:bau(?:e)?|build)\s+(?:mir\s+)?(?:ein(?:e|en)?\s+)?(turm|s(?:ä|ae)ule|mauer|wand|br(?:ü|ue)cke|h(?:ü|ue)tte|haus|raum|tower|pillar|wall|bridge|hut|house)(?:\s+(\d{1,3}))?(?:\s+(\d{1,3}))?(?:\s+(\d{1,3}))?$/.exec(s);
  if (bauen) {
    const art = { turm: 'turm', säule: 'turm', saeule: 'turm', tower: 'turm', pillar: 'turm', mauer: 'mauer', wand: 'mauer', wall: 'mauer', brücke: 'bruecke', bruecke: 'bruecke', bridge: 'bruecke', hütte: 'huette', huette: 'huette', haus: 'huette', raum: 'huette', hut: 'huette', house: 'huette' }[bauen[1]];
    const n = [bauen[2], bauen[3], bauen[4]].map((x) => (x ? Number(x) : undefined));
    return { aufgabe: 'bauen', bau: art, zahl1: n[0], zahl2: n[1], zahl3: n[2] };
  }
  const gib = /^(?:gib|gebe|give)(?:\s+(?:mir|me))?\s+(.+)$/.exec(s);
  if (gib) { const m = mengeLesen(gib[1]); return { aufgabe: 'geben', item: m.sache, anzahl: m.anzahl }; }
  if (/^(ess|iss|essen|eat)( was| etwas)?$/.test(s)) return { aufgabe: 'essen' };
  if (/^(steig(e)? (ein|auf)|einsteigen|aufsteigen|ins boot|boot|reit(e|en)?|fahr(e|en)?( los)?|mount|ride|board)$/.test(s)) return { aufgabe: 'einsteigen' };
  if (/^(steig(e)? aus|aussteigen|absteigen|raus aus dem boot|dismount|unmount|get off)$/.test(s)) return { aufgabe: 'aussteigen' };
  const schm = /^(?:schmelz(?:e)?|brat(?:e)?|smelt|cook)\s+(.+)$/.exec(s);
  if (schm) { const m = mengeLesen(schm[1]); return { aufgabe: 'schmelzen', item: m.sache, anzahl: m.anzahl }; }
  const hin = /^(?:stell(?:e)?\s+(.+?)\s+hin|platzier(?:e)?\s+(.+)|place\s+(.+))$/.exec(s);
  if (hin) return { aufgabe: 'platzieren', item: (hin[1] || hin[2] || hin[3]).replace(/^(ein(e|en)?|die|den|das|a|an)\s+/, '') };
  if (/^(?:r(?:ü|ue)st(?:e)?\s+dich(?:\s+aus)?|r(?:ü|ue)st(?:e)?\s+dich\s+voll\s+aus|voll(?:e)?\s+r(?:ü|ue)stung|beste\s+r(?:ü|ue)stung|craft(?:e)?\s+r(?:ü|ue)stung|r(?:ü|ue)stung\s+craften|mach(?:e)?\s+r(?:ü|ue)stung|full\s+armor|craft\s+armor)$/.test(s)) return { aufgabe: 'ruesten' };
  const nimm = /^(?:nimm|r(?:ü|ue)st(?:e)?|equip)\s+(?:(?:dein(?:e|en)?|die|den|das)\s+)?(.+?)(?:\s+aus)?$/.exec(s);
  if (nimm) return { aufgabe: 'ausruesten', item: nimm[1] };
  const cr = /^(?:craft(?:e)?|herstellen|stell(?:e)?(?:\s+mir)?|mach(?:e)?\s+mir)\s+(.+?)(?:\s+her)?$/.exec(s);
  if (cr) { const m = mengeLesen(cr[1]); return { aufgabe: 'herstellen', item: m.sache, anzahl: m.anzahl }; }
  return null;
}

// Eine Frage an Julia im Spielchat: mit "!" oder ihrem Namen irgendwo in der
// Nachricht ("Julia, wo finde ich Diamanten?"). Liefert den Text ohne Anrede.
function frageLesen(text, namen = []) {
  const a = anrede(text, namen);
  if (!a.ok) return null;
  const rest = a.rest.slice(0, 250);
  return rest.length >= 2 ? rest : null;
}

// Darf eine Antwort in den Minecraft-SPIELCHAT geschrieben werden? (rein, Nutzer-
// wunsch): Julia schreibt NICHT alles in den Chat. Erlaubt ist es nur, wenn ihr
// jemand geschrieben hat (`auto=false`, also eine echte Antwort auf einen Spieler)
// ODER wenn „von sich aus mitreden" (mitreden) eingeschaltet ist. Ihre autonome
// Durchspiel-Erzählung (`auto=true`) landet ohne diesen Schalter nur im Fenster.
function darfInChat(auto, mitreden) {
  return !auto || !!mitreden;
}

// Lockere Sozial-/Gruß-Nachricht, auf die Julia auch OHNE Namensnennung antworten
// darf – damit sie z. B. „hallo" im Chat erwidern kann, während sie durchspielt
// (Nutzerwunsch). Nur kurze Nachrichten, die mit einem Gruß/Sozial-Wort anfangen,
// damit nicht auf jeden Satz geantwortet wird. Eine evtl. Anrede wird abgezogen.
const PLAUSCH = /^(hi+|hallo|hey+|moin|servus|yo|hej|hello|na|guten\s+(morgen|tag|abend)|g[nd]8?|gute\s+nacht|good\s+(morning|night)|cya|bye|tsch(ü|ue)ss|ciao|bis\s+(sp(ä|ae)ter|dann|morgen)|wie\s+ge?hts|wie\s+geht'?s|was\s+geht|alles\s+gut|thx|danke|thanks?|ty|gg|glhf|gl\s*hf|wb|welcome|willkommen)\b/i;
function plauschLesen(text, namen = []) {
  const a = anrede(text, namen);
  const roh = (a.ok ? a.rest : String(text || '')).trim();
  if (roh.length < 2 || roh.length > 40) return null; // nur kurze Nachrichten
  return PLAUSCH.test(roh) ? roh.slice(0, 120) : null;
}

// „Hör auf alle“ / „hör nur auf mich“ – gibt 'alle', 'nur' oder null zurück.
function hoerModus(text, namen = []) {
  const a = anrede(text, namen);
  if (!a.ok) return null;
  const s = a.rest.replace(/[.!?]+$/, '').toLowerCase();
  if (/^(h(ö|oe)r(e)? (auf )?(alle|jeden)|(auf )?alle h(ö|oe)ren|reagier(e)? auf alle|listen to (everyone|all))$/.test(s)) return 'alle';
  if (/^(h(ö|oe)r(e)? nur (auf )?mich|nur (auf )?mich( h(ö|oe)ren)?|listen (only )?to me( only)?)$/.test(s)) return 'nur';
  return null;
}

// „Hör auch auf Peter und Anna“ / „hör nicht mehr auf Peter“ – nennt einzelne
// Spieler, auf die Julia zusätzlich zum Besitzer hören soll. Gibt
// { art: 'dazu'|'weg', namen: [...] } oder null zurück.
function hoerName(text, namen = []) {
  const a = anrede(text, namen);
  if (!a.ok) return null;
  const r = a.rest.replace(/[.!?]+$/, '').trim();
  const teile = (s) => String(s || '')
    .split(/\s*(?:,|&|\bund\b|\band\b)\s*|\s+/i)
    .map((x) => x.trim())
    .filter((x) => /^[A-Za-z0-9_]{2,16}$/.test(x) && !/^(auch|bitte|mehr|noch|dazu|auf|den|die|der|spieler|player)$/i.test(x));
  const weg = /^(?:h(?:ö|oe)r(?:e)?|reagier(?:e)?)\s+(?:bitte\s+)?nicht(?:\s+mehr)?\s+auf\s+(.+)$/i.exec(r)
    || /^(?:ignorier(?:e)?|blockier(?:e)?)\s+(.+)$/i.exec(r);
  if (weg) { const ns = teile(weg[1]); return ns.length ? { art: 'weg', namen: ns } : null; }
  const dazu = /^(?:h(?:ö|oe)r(?:e)?|reagier(?:e)?)\s+(?:bitte\s+)?(?:auch\s+)?auf\s+(.+)$/i.exec(r);
  if (dazu) {
    const ziel = dazu[1].trim();
    if (/^(alle|jeden|everyone|all|mich|mir|me)$/i.test(ziel)) return null; // regelt hoerModus
    const ns = teile(ziel);
    return ns.length ? { art: 'dazu', namen: ns } : null;
  }
  return null;
}

// Antworten für den Spielchat: ohne Formatierung, in Stücken bis 240
// Zeichen, höchstens drei Nachrichten – der Rest wird mit … gekürzt.
function chatTeile(text, max = 3) {
  const s = String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`#>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const teile = [];
  let rest = s;
  while (rest) {
    if (teile.length === max) {
      teile[max - 1] = `${teile[max - 1].slice(0, 236)} …`;
      break;
    }
    if (rest.length <= 240) { teile.push(rest); break; }
    let schnitt = Math.max(rest.lastIndexOf('. ', 240), rest.lastIndexOf('! ', 240), rest.lastIndexOf('? ', 240));
    if (schnitt < 80) schnitt = rest.lastIndexOf(' ', 240);
    if (schnitt < 40) schnitt = 239;
    teile.push(rest.slice(0, schnitt + 1).trim());
    rest = rest.slice(schnitt + 1).trim();
  }
  return teile;
}

function klartext(grund) {
  if (typeof grund === 'string') {
    try { return klartext(JSON.parse(grund)); } catch { return grund; }
  }
  if (grund && typeof grund === 'object') {
    return [grund.text || grund.translate || '', ...(grund.extra || []).map(klartext), ...(grund.with || []).map(klartext)].join(' ').trim();
  }
  return String(grund ?? '');
}

function rauswurfText(grund) {
  const t = klartext(grund).replace(/\s+/g, ' ').slice(0, 300);
  if (/verif|authenticat|unverified|premium|online.?mode/i.test(t)) {
    return 'Der Server verlangt ein Microsoft-Konto (online-mode=true). Julia loggt sich nie ein – stell in server.properties online-mode=false ein. Solche Server nur im Heimnetz betreiben, nie offen im Internet.';
  }
  if (/fly(ing)?\b.*(not|nicht)|kicked for flying|fliegen/i.test(t)) return 'Rausgeworfen wegen „Fliegen“ – meist schlägt der Anti-Cheat bei Bots an. Auf eigenen Servern hilft allow-flight=true in server.properties.';
  if (/\bbann?ed\b|gebannt|gesperrt/i.test(t)) return `Die Spielfigur ist auf diesem Server gebannt: ${t}`;
  if (/too many packets|spam|flood|zu schnell/i.test(t)) return 'Der Spam-Schutz des Servers hat die Figur rausgeworfen (zu viele Nachrichten oder Aktionen).';
  if (/logged in from another location|duplicate.?login|anderen ort|already connected|bereits (verbunden|online)/i.test(t)) return 'Mit demselben Konto hat sich jemand anderes angemeldet – Julia braucht ein eigenes Minecraft-Konto.';
  if (/timed? ?out|keep.?alive|zeitüberschreitung/i.test(t)) return 'Der Server hat keine Antwort mehr bekommen (Zeitüberschreitung).';
  if (/server (closed|is restarting|stopp)|shutting down|restart|neustart|wird neu gestartet/i.test(t)) return 'Der Server wurde beendet oder neu gestartet.';
  if (/kicked by an? (operator|admin)|you (have been|were) kicked/i.test(t)) return `Ein Admin hat die Figur rausgeworfen${t ? `: ${t}` : '.'}`;
  if (/white.?list/i.test(t)) return 'Der Server hat eine Whitelist – trag die Spielfigur dort ein (/whitelist add NAME).';
  if (/outdated|incompatible|version/i.test(t)) return `Die Versionen passen nicht zusammen: ${t}`;
  return `Vom Server getrennt: ${t || 'ohne Grund'}`;
}

// Nach einem Rauswurf (Kick) wieder verbinden? JA bei vorübergehenden Gründen
// (Zeitüberschreitung, Anti-Bot/Spam-Schutz, Neustart, „Fliegen", unklar) – so
// kommt die Figur nach einem periodischen Timeout-/Anti-Bot-Kick von selbst
// zurück (Nutzerwunsch). NEIN, wenn es nichts bringt: Bann, fehlende Whitelist,
// Online-Mode/Verifizierung, Versionskonflikt oder Doppel-Login (eigenes Konto
// nötig). Arbeitet auf dem bereits übersetzten Grund-Text (rauswurfText/endeText).
function kickWiederverbinden(grund) {
  const t = String(grund || '').toLowerCase();
  // Kein Reconnect, wenn er nichts bringt oder sich sofort wiederholt: Bann,
  // Whitelist, Online-Mode/Verifizierung, Versionskonflikt, Doppel-Login sowie
  // der Anti-Cheat-Kick „Fliegen" (die Figur würde gleich wieder fliegen).
  if (/gebannt|\bbann?ed\b|gesperrt|whitelist|white.?list|online-mode|microsoft-konto|verlangt ein|versionen passen nicht|duplicate|eigenes minecraft-konto|jemand anderes|fliegen|flying/i.test(t)) return false;
  return true;
}

// Verbindung ohne Rauswurf zu Ende: mineflayer nennt einen kurzen Grund
// ("socketClosed", "keepAliveError"), dazu kommt der letzte Fehler.
function endeText(grund, fehler, server) {
  const g = String(grund || '');
  const f = String(fehler || '');
  if (/keep.?alive|timeout|timed out/i.test(g) || /ETIMEDOUT|timed out/i.test(f)) return `${server} hat nicht mehr geantwortet (Zeitüberschreitung).`;
  if (/ECONNRESET/i.test(f)) return `${server} hat die Verbindung abrupt getrennt.`;
  if (!g || /socketClosed|^end$/i.test(g)) return `Die Verbindung zu ${server} ist abgebrochen.`;
  return `Die Verbindung zu ${server} wurde beendet (${g}).`;
}

function fehlerText(e, server) {
  if (e && e.code === 'ECONNREFUSED') return `Unter ${server} läuft kein Minecraft-Server (Verbindung abgelehnt). Läuft der Server, und stimmt der Port?`;
  if (e && ['ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH'].includes(e.code)) return `${server} ist nicht erreichbar.`;
  if (e && (e.code === 'ECONNRESET' || /closed before the server sent/i.test(e.message || ''))) {
    return `${server} hat die Verbindung sofort getrennt – meist ein Schutz gegen Bots oder eine Minecraft-Version, die Julia noch nicht kennt.`;
  }
  return `Verbindung fehlgeschlagen: ${e && e.message ? e.message : e}`;
}

// --- Die Spielfigur ---

class Minecraft extends EventEmitter {
  // wiederPausen: Wartezeiten vor den automatischen Wiederversuchen (ms).
  constructor({ laden, aufloesen, srv, logbuch = null, wiederPausen = [5000, 15000, 30000] } = {}) {
    super();
    this.wiederPausen = wiederPausen;
    this.logbuch = logbuch; // tägliches Spiel-Logbuch (überlebt Abstürze); optional
    this.trennung = null; // warum die Figur zuletzt vom Server geflogen ist
    this.laden = laden || (() => ({ mineflayer: require('mineflayer'), pf: require('mineflayer-pathfinder') }));
    this.aufloesen = aufloesen;
    this.srv = srv;
    this.bot = null;
    this.auftrag = null;
    this.chatVerlauf = [];
    this.ticks = 0;
    this.letzterSchlag = 0;
    this.pause = 5;
    this.jagt = null;
    this.isst = false;
    this.selbstschutz = null; // id des Feindes, gegen den sie sich gerade selbst wehrt
    this.angreifer = null; // { id, bis }: Spieler/Wesen, das Julia gerade angegriffen hat – solange wehrt sie sich
    this.jeder = false; // auf alle Spieler hören statt nur auf den Besitzer
    this.erlaubte = new Map(); // zusätzlich erlaubte Spieler: kleingeschrieben → Anzeigename
    this.fortschrittInChat = false; // ihre Status-/Fortschritts-Meldungen (z. B. „16× stick hergestellt") NICHT in den Spielchat, nur ins Fenster (Nutzerwunsch, per Schalter)
  }

  // Schalter: sollen Julias Status-/Fortschritts-Meldungen auch in den SPIELCHAT?
  // Standard aus – sie erscheinen dann nur im Julia-Fenster. Normale Antworten an
  // Spieler bleiben davon unberührt (Nutzerwunsch: nur EIN/AUS für den Fortschritt).
  setFortschrittInChat(an) {
    this.fortschrittInChat = !!an;
  }

  get verbunden() {
    return !!(this.bot && this.bot.entity);
  }

  // gruppe: { name, passwort } – dieser Voice-Chat-Gruppe von selbst beitreten.
  async verbinden({ adresse, port = 25565, botname, besitzer, assistent, version, oeffentlich = false, konto = null, stimme = false, gruppe = null, jeder = false, erlaubte = [] } = {}) {
    clearTimeout(this.wiederTimer);
    this.absichtlichWeg = false; // neuer, gewollter Beitritt → automatisches Wiederverbinden wieder erlaubt
    this._botWeg();
    this.letzteOptionen = { adresse, port, botname, besitzer, assistent, version, oeffentlich, konto, stimme, gruppe, jeder, erlaubte };
    this.autoGruppe = gruppe;
    this.jeder = !!jeder;
    this.setErlaubte(erlaubte);
    const p = Math.round(Number(port) || 25565);
    if (p < 1 || p > 65535) throw new Error('Der Port liegt zwischen 1 und 65535.');
    const ziel = await zielFinden(adresse, p, { aufloesen: this.aufloesen, srv: this.srv, oeffentlich });
    const ip = ziel.ip;
    const { mineflayer, pf } = this.laden();
    this.pf = pf;
    this.server = `${adresse}:${p}`;
    this.besitzer = besitzer || '';
    this.assistent = assistent || '';
    this.chatVerlauf = [];
    // Mit Konto: die verschlüsselt gespeicherte Anmeldung (wird bei Bedarf
    // still erneuert). Ohne: offline, nur für Server mit online-mode=false.
    const anmeldung = konto
      ? {
        auth: 'microsoft', username: KONTO_ID, profilesFolder: konto.cache, ...kontoFluss(),
        onMsaCode: () => { throw new Error(KONTO_NEU); },
      }
      : { auth: 'offline', username: botName(botname, assistent) };
    const bot = mineflayer.createBot({
      host: ziel.host, port: p, connect: (c) => c.setSocket(net.connect(ziel.port, ip)), ...anmeldung, version: version || false, hideErrors: true, logErrors: false, checkTimeoutInterval: 30000,
    });
    this.bot = bot;
    this.letzterTickZeit = Date.now();
    this._wacheStarten();
    bot.on('error', (e) => { this.letzterFehler = e && e.message; }); // ohne Zuhörer würde ein Fehler die App beenden
    bot.loadPlugin(pf.pathfinder);
    try {
      await new Promise((ok, nein) => {
        const zeit = setTimeout(() => nein(new Error(`Keine Antwort von ${this.server} – läuft der Server, und stimmt der Port?`)), 25000);
        const ende = (f) => (x) => { clearTimeout(zeit); f(x); };
        bot.once('spawn', ende(ok));
        bot.once('kicked', ende((g) => nein(new Error(rauswurfText(g)))));
        bot.once('error', ende((e) => nein(new Error(fehlerText(e, this.server)))));
        bot.once('end', ende(() => nein(new Error(`Verbindung zu ${this.server} beendet.`))));
      });
    } catch (e) {
      this._botWeg();
      throw e;
    }
    this.trennung = null;
    this.verbundenSeit = Date.now();
    this.letzterFehler = null;
    this._einrichten(bot);
    if (this.logbuch) { try { this.logbuch.eintrag('start', `Auf ${this.server} eingeloggt als ${bot.username}.`); } catch { /* egal */ } }
    if (stimme) this._stimmeStarten(bot, ip);
    return this.status();
  }

  // Simple Voice Chat: zuhören (nur dem Besitzer) und mit Stimme antworten.
  _stimmeStarten(bot, ip) {
    const s = new Stimme({
      client: bot._client,
      host: ip,
      gruppe: this.autoGruppe,
      besitzerUuid: () => {
        const k = Object.keys(bot.players).find((n) => n.toLowerCase() === String(this.besitzer || '').toLowerCase());
        return k ? bot.players[k].uuid : null;
      },
    });
    s.on('sprache', (d) => this.emit('stimme', d));
    s.on('status', () => this.emit('stimmeStatus', s.status()));
    this.stimme = s;
    s.starten();
  }

  get stimmeAktiv() {
    return !!(this.stimme && this.stimme.verbunden);
  }

  stimmeGruppeBeitreten(id, passwort) {
    if (!this.stimmeAktiv) throw new Error('Der Voice-Chat ist nicht verbunden – ohne ihn gibt es keine Gruppen.');
    return this.stimme.gruppeBeitreten(id, passwort);
  }

  stimmeGruppeVerlassen() {
    if (!this.stimmeAktiv) throw new Error('Der Voice-Chat ist nicht verbunden.');
    this.stimme.gruppeVerlassen();
  }

  stimmeSprechen(pcm) {
    if (!this.stimmeAktiv) return Promise.reject(new Error('Der Voice-Chat ist nicht verbunden.'));
    return this.stimme.sprechen(pcm);
  }

  _stimmeStoppen() {
    if (this.stimme) this.stimme.stoppen();
    this.stimme = null;
  }

  _einrichten(bot) {
    const bewegung = new this.pf.Movements(bot);
    // Sie darf sich durch natürliches Gelände graben (aus Löchern klettern, Wege
    // bahnen) und mit günstigen Blöcken hochklettern – aber NIE Wertvolles oder
    // Gebautes anfassen. Der Pathfinder bevorzugt ohnehin Wege ohne Graben.
    bewegung.canDig = true;
    bewegung.allowParkour = true;
    bewegung.allow1by1towers = true;
    const reg = bot.registry && bot.registry.blocksByName;
    if (reg && bewegung.blocksCantBreak) {
      // Alles, was typischerweise gebaut/wertvoll ist: nie abbauen (auch nicht zum Weg).
      const schutz = /(chest|barrel|shulker_box|furnace|smoker|crafting_table|_bed$|_door$|_trapdoor$|_fence_gate$|spawner|beacon|conduit|enchanting_table|brewing_stand|anvil|lectern|grindstone|smithing_table|cartography_table|fletching_table|loom|hopper|dispenser|dropper|glass|_pane$|torch|lantern|_sign$|hanging_sign|item_frame|painting|_banner$|flower_pot|campfire|respawn_anchor|lodestone|bell|_wool$|_carpet$|jukebox|note_block|cake|beehive|bee_nest|end_portal_frame|bookshelf|glazed_terracotta|target|composter|cauldron|_stairs$|_slab$|_fence$|_wall$|_planks$|bricks|concrete|terracotta|iron_bars|chain|ladder|scaffolding|_button$|_pressure_plate$|_rail$|^rail$|obsidian|budding_amethyst|reinforced_deepslate|bedrock)/;
      for (const name of Object.keys(reg)) if (schutz.test(name)) bewegung.blocksCantBreak.add(reg[name].id);
      // Zum Hochklettern setzt sie günstige Blöcke, statt zu graben.
      const gerust = ['dirt', 'cobblestone', 'cobbled_deepslate', 'netherrack', 'stone', 'andesite', 'diorite', 'granite', 'oak_planks', 'spruce_planks', 'birch_planks'];
      const items = bot.registry.itemsByName || {};
      if (Array.isArray(bewegung.scafoldingBlocks)) for (const n of gerust) if (items[n] && !bewegung.scafoldingBlocks.includes(items[n].id)) bewegung.scafoldingBlocks.push(items[n].id);
    }
    bot.pathfinder.setMovements(bewegung);
    // Wegsuche in kleinen Happen (Standard: 40 ms je Tick) – sonst stockt
    // Julia neben dem Spiel.
    bot.pathfinder.tickTimeout = 10;
    const v = bot.registry && bot.registry.version;
    this.neuesKampfsystem = v && typeof v['>='] === 'function' ? v['>=']('1.9') : true;
    this.pause = schlagPause(null, this.neuesKampfsystem);
    bot.on('physicsTick', () => {
      this.ticks++;
      this.letzterTickZeit = Date.now(); // Lebenszeichen für die Hänger-Wache
      try { this._tick(); } catch (e) { this.letzterFehler = e.message; }
    });
    bot.on('chat', (von, text) => this._chat(von, text));
    // Wird Julia verletzt, wehrt sie sich – auch gegen einen SPIELER, der sie
    // angreift (Nutzerwunsch). Wer der Angreifer ist, verrät das Event nicht, also
    // nehmen wir den nächsten Spieler in Schlagreichweite. Mobs regelt die
    // bestehende Monster-Verteidigung separat.
    bot.on('entityHurt', (e) => { try { if (e === bot.entity) this._angegriffen(); } catch (err) { this.letzterFehler = err && err.message; } });
    bot.on('death', () => this._gestorben());
    bot.on('entityDead', (e) => this._tot(e));
    bot.on('kicked', (g) => { this.grund = rauswurfText(g); });
    // Unerwartet weg: für den Crash-Screen merken, warum. Nur die Verbindung
    // verloren (kein Rauswurf)? Dann versucht die Figur selbst, zurückzukommen.
    bot.on('end', (grund) => {
      if (this.bot !== bot) return; // selbst getrennt
      const a = this.auftrag;
      this.bot = null;
      this.auftrag = null;
      this.jagt = null;
      this._stimmeStoppen();
      const rauswurf = !!this.grund;
      const text = this.grund || endeText(grund, this.letzterFehler, this.server);
      this.trennung = {
        zeit: Date.now(), grund: text, rauswurf, server: this.server,
        dauerS: Math.max(0, Math.round((Date.now() - (this.verbundenSeit || Date.now())) / 1000)),
        aufgabe: a ? a.art : null, fehler: this.letzterFehler || null, versuch: 0, naechsterVersuch: null, aufgegeben: false,
      };
      this.grund = null;
      this._melden('getrennt', text);
      // Verbindungsverlust: immer neu versuchen. Rauswurf (Kick): nur wenn es
      // Sinn ergibt (Timeout/Anti-Bot/Neustart …), nicht bei Bann/Whitelist etc.
      // – so kommt die Figur nach dem periodischen ~7,5-min-Kick von selbst zurück.
      if (!rauswurf || kickWiederverbinden(text)) this._wiederVerbinden();
    });
  }

  // Server verlassen, weil du es willst – kein Crash-Screen, kein Wiederversuch.
  // Das Flag stellt sicher, dass sie NICHT von selbst wieder joint (nur ein neuer
  // Beitritt oder ein echter Crash/Kick verbindet wieder) – Nutzerwunsch.
  trennen() {
    clearTimeout(this.wiederTimer);
    this.absichtlichWeg = true;
    this.trennung = null;
    this._botWeg();
  }

  trennungVergessen() {
    clearTimeout(this.wiederTimer);
    this.trennung = null;
  }

  _botWeg() {
    const bot = this.bot;
    this.bot = null;
    this.auftrag = null;
    this.jagt = null;
    this._wacheStoppen();
    this._stimmeStoppen();
    if (bot) {
      try { bot.quit(); } catch { /* schon weg */ }
    }
  }

  // Hänger-Wache: Prüft unabhängig von den Physics-Ticks (eigener Timer), ob der
  // Bot zwar verbunden ist, aber seit einer Weile keine Ticks mehr liefert –
  // dann ist er eingefroren und wird per Relog neu verbunden.
  _wacheStarten() {
    this._wacheStoppen();
    this.wache = setInterval(() => { try { this._haengerWache(); } catch (e) { this.letzterFehler = e && e.message; } }, 5000);
    if (this.wache.unref) this.wache.unref();
  }

  _wacheStoppen() {
    if (this.wache) { clearInterval(this.wache); this.wache = null; }
  }

  _haengerWache() {
    if (!this.bot) { this._wacheStoppen(); return; }
    if (haengerErkannt(this.letzterTickZeit, Date.now(), this.haengerGrenzeMs || 30000)) {
      this._relog('keine Reaktion mehr (eingefroren)');
    }
  }

  // Aktueller Zustand als schlichtes JSON – zum Prüfen/Loggen und für den Relog.
  zustand() {
    const bot = this.bot;
    const p = bot && bot.entity && bot.entity.position;
    return {
      verbunden: this.verbunden,
      server: this.server || null,
      position: p ? { x: Math.round(p.x), y: Math.round(p.y), z: Math.round(p.z) } : null,
      leben: bot && typeof bot.health === 'number' ? Math.round(bot.health) : null,
      hunger: bot && typeof bot.food === 'number' ? bot.food : null,
      aufgabe: this.auftrag ? this.auftrag.art : null,
      seitLetztemTickMs: this.letzterTickZeit ? Date.now() - this.letzterTickZeit : null,
    };
  }

  // Erzwingt eine Neuverbindung, wenn der Bot hängt – der Zustand wird vorher ins
  // Logbuch geschrieben. Läuft danach über den normalen Wiederverbinden-Weg.
  _relog(grund) {
    const bot = this.bot;
    if (!bot) return;
    const zustand = this.zustand();
    if (this.logbuch) { try { this.logbuch.eintrag('haenger', `Relog wegen ${grund}`, { zustand }); } catch { /* Logbuch optional */ } }
    const a = this.auftrag;
    this._wacheStoppen();
    this.bot = null;
    this.auftrag = null;
    this.jagt = null;
    this._stimmeStoppen();
    try { bot.removeAllListeners('end'); } catch { /* egal */ } // kein doppeltes Wiederverbinden
    try { bot.quit(); } catch { /* schon weg */ }
    this._melden('haenger', `Ich hing fest (${grund}) – ich verbinde mich neu.`);
    this.trennung = {
      zeit: Date.now(), grund: `Hänger: ${grund}`, rauswurf: false, server: this.server,
      dauerS: 0, aufgabe: a ? a.art : null, fehler: null, versuch: 0, naechsterVersuch: null, aufgegeben: false,
    };
    if (this.letzteOptionen) this._wiederVerbinden();
  }

  _wiederVerbinden() {
    if (this.absichtlichWeg) return; // per „Verlassen" gewollt getrennt → nicht von selbst zurück
    const t = this.trennung;
    if (!t || !this.letzteOptionen) return;
    if (t.versuch >= this.wiederPausen.length) {
      t.naechsterVersuch = null;
      t.aufgegeben = true;
      this.emit('geaendert');
      return;
    }
    const warte = this.wiederPausen[t.versuch];
    t.versuch += 1;
    t.naechsterVersuch = Date.now() + warte;
    this.emit('geaendert');
    clearTimeout(this.wiederTimer);
    this.wiederTimer = setTimeout(async () => {
      if (this.trennung !== t || this.bot) return;
      t.naechsterVersuch = null;
      try {
        await this.verbinden(this.letzteOptionen);
        this._melden('zurueck', `Wieder da auf ${this.server}.`);
      } catch (e) {
        if (this.bot) return;
        this.trennung = t;
        t.fehler = e.message;
        this._wiederVerbinden();
      }
    }, warte);
    if (this.wiederTimer.unref) this.wiederTimer.unref();
  }

  chat(text) {
    if (!this.verbunden) throw new Error('Julia ist mit keinem Minecraft-Server verbunden.');
    this.bot.chat(chatText(text));
    return 'Gesendet.';
  }

  aufgabe({ aufgabe: art, spieler, block, anzahl, item, x, y, z, tier, bau, zahl1, zahl2, zahl3 } = {}) {
    if (!this.verbunden) throw new Error('Julia ist mit keinem Minecraft-Server verbunden.');
    if (art === 'hilfe') return HILFE; // hält nichts an
    const bot = this.bot;
    const { GoalFollow, GoalNear } = this.pf.goals;
    const name = spieler || this.besitzer;
    const brauchtName = () => {
      if (!name) throw new Error('Mit wem? Nenn den Spielernamen oder trag deinen in den Einstellungen unter Minecraft ein.');
    };
    // Erst prüfen, dann anhalten – ein Tippfehler soll nichts abbrechen.
    const ort = art === 'gehen' ? ortLesen({ x, y, z }) : null;
    this._anhalten();
    switch (art) {
      case 'stopp':
        return 'Angehalten.';
      case 'folgen': {
        brauchtName();
        const e = this._spielerFigur(name);
        this.auftrag = { art, spieler: name, ziel: e };
        if (e) bot.pathfinder.setGoal(new GoalFollow(e, 2), true);
        return e ? `Ich folge ${e.username}.` : `Ich sehe ${name} gerade nicht – sobald du in der Nähe bist, folge ich.`;
      }
      case 'kommen': {
        brauchtName();
        const e = this._spielerFigur(name);
        if (!e) throw new Error(`Ich sehe ${name} gerade nicht. Komm näher, dann laufe ich los.`);
        this.auftrag = { art, spieler: name };
        bot.pathfinder.setGoal(new GoalNear(e.position.x, e.position.y, e.position.z, 1.5));
        return 'Bin unterwegs.';
      }
      case 'beschuetzen':
        brauchtName();
        this._ausruesten();
        this.auftrag = { art, spieler: name };
        return `Ich passe auf ${name} auf.`;
      case 'kaempfen':
        brauchtName();
        this._ausruesten();
        this.auftrag = { art, spieler: name, ab: this.ticks + 60 };
        return `Duell gegen ${name} – los in 3 Sekunden!`;
      case 'abbauen':
        return this._abbauen(block, anzahl);
      case 'gehen':
        return this._gehen(ort);
      case 'geben':
        brauchtName();
        return this._geben(item || block, anzahl, name);
      case 'sammeln':
        return this._sammeln();
      case 'schlafen':
        return this._schlafen();
      case 'jagen':
        return this._jagen(tier, anzahl);
      case 'herstellen':
        return this._herstellen(item || block, anzahl);
      case 'verstauen':
        return this._verstauen();
      case 'schmelzen':
        return this._schmelzen(item || block, anzahl);
      case 'platzieren':
        return this._platzieren(item || block);
      case 'ausruesten':
        return this._ausruestenMit(item || block);
      case 'ruesten':
        return this._ruestungCraften();
      case 'essen': {
        if (bot.food >= 20 && bot.health >= 20) return 'Ich bin satt.';
        const gegessen = this._essen([...ESSEN, ...HEILEN]);
        if (!gegessen) throw new Error('Ich habe nichts zu essen dabei.');
        return `Ich esse ${essenName(gegessen)}.`;
      }
      case 'einsteigen':
        return this._einsteigen();
      case 'aussteigen':
        return this._aussteigen();
      case 'bauen':
        return this._bauen({ bau, zahl1, zahl2, zahl3, item });
      case 'durchspielen': {
        // Eigenständig weiterspielen: als Auftrag an die KI, die sich über
        // minecraft_fortschritt und die Spiel-Werkzeuge Etappe für Etappe
        // vorarbeitet. Das Logbuch hält den Weg fest (überlebt Abstürze).
        const auftrag = 'Spiele Minecraft ab jetzt eigenständig weiter – Schritt für Schritt Richtung Enderdrache. Rufe zuerst minecraft_fortschritt auf, erfülle die dort genannte aktuelle Etappe mit den Minecraft-Werkzeugen (umsehen, abbauen, herstellen, schmelzen, jagen, bauen, warten), prüfe dann erneut den Fortschritt und mach weiter. Achte auf Leben und Hunger. Kommst du nicht weiter, sag kurz warum.';
        this.emit('frage', { von: this.besitzer || 'Spieler', text: auftrag, auto: true });
        if (this.logbuch) { try { this.logbuch.eintrag('info', 'Auftrag: eigenständig weiterspielen.'); } catch { /* egal */ } }
        return 'Alles klar – ich spiele selbstständig weiter und arbeite mich Etappe für Etappe zum Enderdrachen vor.';
      }
      default:
        throw new Error(`Unbekannte Aufgabe "${art}".`);
    }
  }

  // Mit dem Eimer umgehen: Wasser/Lava aufnehmen oder setzen, Milch trinken.
  // Läuft asynchron (anvisieren + benutzen) und liefert eine kurze Rückmeldung.
  async eimer(aktion) {
    if (!this.verbunden) throw new Error('Julia ist mit keinem Minecraft-Server verbunden.');
    const bot = this.bot;
    const plan = eimerPlan(aktion);
    const inHand = bot.inventory.items().find((i) => i.name === plan.hand);
    if (!inHand) {
      const klartext = { bucket: 'einen leeren Eimer', water_bucket: 'einen Wassereimer', lava_bucket: 'einen Lavaeimer', milk_bucket: 'einen Milcheimer' }[plan.hand] || plan.hand;
      throw new Error(`Dafür brauche ich ${klartext} im Inventar.`);
    }
    this._anhalten();
    await bot.equip(inHand, 'hand');

    // Milch: einfach trinken (hebt Effekte auf).
    if (plan.trinken) {
      await bot.consume();
      return 'Ich habe die Milch getrunken.';
    }

    // Aufnehmen: die Quelle (Wasser/Lava) in der Nähe suchen, anschauen, benutzen.
    if (plan.quelle) {
      const quelle = bot.findBlock({ matching: (b) => b && b.name === plan.quelle, maxDistance: 4 });
      if (!quelle) throw new Error(`Ich sehe ${plan.quelle === 'water' ? 'kein Wasser' : 'keine Lava'} in Reichweite (max. 4 Blöcke).`);
      await bot.lookAt(quelle.position.offset(0.5, 0.5, 0.5), true);
      await bot.activateItem();
      await new Promise((r) => setTimeout(r, 250));
      const ok = bot.inventory.items().some((i) => i.name === plan.ergebnis);
      return ok
        ? (plan.quelle === 'water' ? 'Ich habe Wasser aufgenommen.' : 'Ich habe Lava aufgenommen.')
        : 'Ich habe es versucht – hat aber nicht sauber geklappt, bitte kurz prüfen.';
    }

    // Setzen: den anvisierten Block (bzw. den Block vor/unter mir) anschauen und
    // den Eimer leeren. Wo nichts anvisiert ist, hilft ein Blick leicht nach unten.
    const ziel = bot.blockAtCursor && bot.blockAtCursor(4);
    if (ziel) await bot.lookAt(ziel.position.offset(0.5, 1, 0.5), true);
    else await bot.look(bot.entity.yaw, 1.0, true); // nach unten schauen
    await bot.activateItem();
    await new Promise((r) => setTimeout(r, 250));
    return `${plan.setzt} gesetzt.`;
  }

  status() {
    if (!this.verbunden) return { verbunden: false, trennung: this.trennung ? { ...this.trennung } : null };
    const bot = this.bot;
    const p = bot.entity.position;
    const spieler = Object.values(bot.players)
      .filter((s) => s.username !== bot.username)
      .map((s) => ({ name: s.username, abstand: s.entity ? Math.round(s.entity.position.distanceTo(p)) : null }));
    const feinde = {};
    for (const e of Object.values(bot.entities)) {
      if (istFeind(e) && e.position.distanceTo(p) < 24) feinde[e.name] = (feinde[e.name] || 0) + 1;
    }
    const inventar = {};
    for (const i of bot.inventory.items()) inventar[i.name] = (inventar[i.name] || 0) + i.count;
    const a = this.auftrag;
    return {
      verbunden: true,
      server: this.server,
      version: bot.version,
      name: bot.username,
      leben: Math.round(bot.health),
      hunger: Math.round(bot.food),
      essbar: this._essbar(),
      faehrt: bot.vehicle ? (bot.vehicle.name || 'Fahrzeug') : null,
      jeder: this.jeder,
      erlaubte: this.erlaubteListe(),
      position: { x: Math.round(p.x), y: Math.round(p.y), z: Math.round(p.z) },
      spielmodus: bot.game && bot.game.gameMode,
      aufgabe: a ? { art: a.art, spieler: a.spieler, block: a.block || a.item, geschafft: a.geschafft, ziel: a.anzahl, ort: a.ort } : null,
      spieler,
      feinde_nah: feinde,
      inventar: Object.fromEntries(Object.entries(inventar).slice(0, 24)),
      chat: this.chatVerlauf.slice(-10).map((c) => `${c.von}: ${c.text}`),
      stimme: this.stimme ? this.stimme.status() : { zustand: 'aus' },
    };
  }

  // --- intern ---

  _melden(art, text) {
    this.letzteMeldung = { art, text, zeit: Date.now() };
    // Ins Tagebuch, damit bei einem Absturz nichts verloren geht.
    if (this.logbuch) {
      const artLog = /gestorben|niederlage/.test(art) ? 'tod' : /fehler|getrennt/.test(art) ? 'fehler' : /fertig|sieg|erreicht/.test(art) ? 'ziel' : 'info';
      try { this.logbuch.eintrag(artLog, text, { herkunft: art }); } catch { /* Logbuch darf nie das Spiel stören */ }
    }
    this.emit('ereignis', { art, text });
  }

  // Normalisierter Zustand fürs Durchspielen: Inventar, Dimension, Drache.
  spielZustand() {
    if (!this.verbunden) return { items: {}, dimension: null };
    const items = {};
    for (const i of this.bot.inventory.items()) items[i.name] = (items[i.name] || 0) + i.count;
    const dim = String(this.bot.game && this.bot.game.dimension || '');
    const dimension = /nether/.test(dim) ? 'nether' : /end/.test(dim) ? 'end' : 'overworld';
    return { items, dimension, dracheBesiegt: !!this.dracheBesiegt };
  }

  // Wo steht Julia im Spiel? Schreibt den Stand auch ins Logbuch.
  fortschritt() {
    const plan = require('./minecraft-plan');
    const z = this.spielZustand();
    const f = plan.fortschritt(z);
    if (this.logbuch) {
      try { this.logbuch.eintrag('fortschritt', plan.fortschrittText(z), { aktuell: f.aktuell ? f.aktuell.name : null, prozent: f.prozent, erreicht: f.erreicht.length }); } catch { /* egal */ }
    }
    return { ...f, text: plan.fortschrittText(z) };
  }

  _spielerFigur(name) {
    if (!name || !this.bot) return null;
    const key = Object.keys(this.bot.players).find((n) => n.toLowerCase() === String(name).toLowerCase());
    return key ? this.bot.players[key].entity || null : null;
  }

  _anhalten() {
    this.auftrag = null;
    this.jagt = null;
    this.flieht = null;
    if (!this.bot) return;
    this.bot.pathfinder.setGoal(null);
    this.bot.clearControlStates();
  }

  // Auf alle Spieler hören oder nur auf den Besitzer (auch zur Laufzeit).
  aufAlleHoeren(an) {
    this.jeder = !!an;
  }

  // Einzelne Spieler zur Erlaubnisliste hinzufügen oder entfernen.
  hoerenAuf(namen, an) {
    for (const n of Array.isArray(namen) ? namen : [namen]) {
      const k = String(n || '').trim().toLowerCase();
      if (!k) continue;
      if (an) this.erlaubte.set(k, String(n).trim()); else this.erlaubte.delete(k);
    }
  }

  // Die ganze Erlaubnisliste setzen (z. B. beim Verbinden aus der Konfiguration).
  setErlaubte(namen) {
    this.erlaubte = new Map((namen || []).map((n) => [String(n).trim().toLowerCase(), String(n).trim()]).filter(([k]) => k));
  }

  erlaubteListe() {
    return [...this.erlaubte.values()];
  }

  // Darf Julia auf diesen Spieler hören? Besitzer immer, sonst „alle“ oder Liste.
  _darfHoeren(von, istBesitzer) {
    return istBesitzer || this.jeder || this.erlaubte.has(String(von).toLowerCase());
  }

  _chat(von, text) {
    if (!this.bot || von === this.bot.username) return;
    this.chatVerlauf.push({ von, text: String(text).slice(0, 200) });
    if (this.chatVerlauf.length > 30) this.chatVerlauf.shift();
    // Für das soziale Gedächtnis (Issue #94, BETA): jede gehörte Spieler-Nachricht
    // melden – ob sie ausgewertet wird, entscheidet der Hauptprozess (nur wenn der
    // BETA-Schalter an ist). Hier immer harmlos (nur ein Event, keine Speicherung).
    this.emit('spielerNachricht', { von, text: String(text).slice(0, 200) });
    const namen = [this.bot.username, this.assistent];
    const istBesitzer = !this.besitzer || String(von).toLowerCase() === this.besitzer.toLowerCase();
    // Umstellen, auf wen Julia hört, darf nur der Besitzer.
    const modus = hoerModus(text, namen);
    if (modus && istBesitzer) {
      this.jeder = modus === 'alle';
      if (modus === 'nur') this.erlaubte.clear();
      this.emit('einstellung', { jeder: this.jeder, erlaubte: this.erlaubteListe() });
      try { this.chat(this.jeder ? 'Ich höre jetzt auf alle Spieler.' : 'Ich höre nur noch auf dich.'); } catch { /* getrennt */ }
      return;
    }
    // Einzelne Spieler erlauben oder wieder ausschließen – nur der Besitzer.
    const liste = hoerName(text, namen);
    if (liste && istBesitzer) {
      this.hoerenAuf(liste.namen, liste.art === 'dazu');
      this.emit('einstellung', { jeder: this.jeder, erlaubte: this.erlaubteListe() });
      try {
        this.chat(liste.art === 'dazu'
          ? `Alles klar, ich höre jetzt auch auf ${liste.namen.join(', ')}.`
          : `Okay, auf ${liste.namen.join(', ')} höre ich nicht mehr.`);
      } catch { /* getrennt */ }
      return;
    }
    // Sonst: nur der Besitzer und ausdrücklich erlaubte Spieler (oder „auf alle“).
    if (!this._darfHoeren(von, istBesitzer)) return;
    const b = befehlLesen(text, namen);
    if (b) {
      try {
        this.chat(this.aufgabe({ ...b, spieler: b.spieler || von }));
      } catch (e) {
        try { this.chat(e.message); } catch { /* getrennt */ }
      }
      return;
    }
    // Sonst eine Frage an Julia – oder eine lockere Gruß-/Sozial-Nachricht wie
    // „hallo", auf die sie auch ohne Namensnennung antworten darf (damit sie beim
    // Durchspielen mitreden kann). Höchstens alle vier Sekunden (Kosten, Spam).
    // Ohne eingetragenen Besitzer nur, wenn „auf alle hören“ an ist.
    const frage = frageLesen(text, namen) || plauschLesen(text, namen);
    if (!frage || (!this.besitzer && !this.jeder && this.erlaubte.size === 0)) return;
    if (Date.now() - (this.letzteFrage || 0) < 4000) return;
    this.letzteFrage = Date.now();
    this.emit('frage', { von, text: frage });
  }

  // Antwort der KI in den Spielchat – in kleinen Stücken mit kurzer Pause,
  // damit der Spam-Schutz des Servers nicht anschlägt.
  async antworten(text) {
    const teile = chatTeile(text);
    for (let i = 0; i < teile.length; i++) {
      if (!this.verbunden) return;
      if (i) await new Promise((r) => setTimeout(r, 800));
      this.chat(teile[i]);
    }
  }

  _tick() {
    const bot = this.bot;
    if (!bot || !bot.entity || this.isst) return;
    this._mlgWasser(); // Sturz mit dem Wassereimer abfangen (MLG) – höchste Priorität
    if (this._schwimmen()) return; // Ertrinken droht → erst auftauchen, alles andere wartet
    this._gefahrWache();
    this._antiHaenger();
    const a = this.auftrag;
    const imDuell = a && a.art === 'kaempfen';
    // Immer verteidigen: läuft gerade kein Kampfauftrag und ist ein Monster dicht
    // dran, wehrt sich Julia selbst (bei wenig Leben zieht der Kampf sich zurück).
    const kampfArt = a && (a.art === 'kaempfen' || a.art === 'beschuetzen' || a.art === 'jagen');
    if (!kampfArt) {
      const feind = this._naheGefahr();
      if (feind) { this._selbstschutz(feind); return; }
      // Kein Monster in Reichweite – wehrt sich Julia noch gegen einen Angreifer
      // (z. B. einen Spieler, der sie schlägt), kämpft sie zurück, bis das Fenster
      // abläuft oder der Angreifer weg ist.
      const angreifer = this._angreiferFigur();
      if (angreifer) { this._selbstschutz(angreifer); return; }
      if (this.selbstschutz != null) { this.selbstschutz = null; this._kampfPause(); this._aufgabeFortsetzen(); }
    }
    // Hunger von selbst stillen, sobald der Balken sinkt – nur nicht mitten im
    // Duell (das regelt der Kampf). Ist das Leben knapp, hilft ein Goldapfel.
    if (!imDuell && this.ticks % 40 === 0) {
      const plan = essenPlan({ food: bot.food, health: bot.health, hatEssen: this._hat(ESSEN), hatHeilung: this._hat(HEILEN) });
      if (plan === 'heilung') { const g = this._essen(HEILEN); if (g) { this._essenMelden(g); return; } }
      else if (plan === 'essen') { const g = this._essen(ESSEN); if (g) { this._essenMelden(g); return; } }
    }
    if (!a) return;
    const { GoalFollow } = this.pf.goals;
    if (a.art === 'folgen') {
      if (!a.ziel || a.ziel.isValid === false) {
        const e = this._spielerFigur(a.spieler);
        if (e) { a.ziel = e; bot.pathfinder.setGoal(new GoalFollow(e, 2), true); }
      }
    } else if (a.art === 'kommen') {
      const e = this._spielerFigur(a.spieler);
      if (!e || bot.entity.position.distanceTo(e.position) < 2.5) this._anhalten();
    } else if (a.art === 'kaempfen') {
      if (this.ticks < a.ab) return;
      const e = this._spielerFigur(a.spieler);
      if (e) this._kampf(e);
      else if (this.jagt !== null) this._kampfPause();
    } else if (a.art === 'beschuetzen') {
      const chef = this._spielerFigur(a.spieler);
      const mitte = chef ? chef.position : bot.entity.position;
      const feind = this._bedrohung(mitte);
      if (feind) {
        a.folgt = false;
        this._kampf(feind);
      } else if (!a.folgt && chef) {
        this._kampfPause();
        bot.pathfinder.setGoal(new GoalFollow(chef, 3), true);
        a.folgt = true;
      }
    } else if (a.art === 'jagen') {
      let ziel = a.zielId != null ? bot.entities[a.zielId] : null;
      if (!ziel || ziel.isValid === false) {
        ziel = bot.nearestEntity((e) => a.tiere.includes(e.name) && e.position.distanceTo(bot.entity.position) < 48);
        a.zielId = ziel ? ziel.id : null;
      }
      if (!ziel || this.ticks > a.bis) {
        this._kampfPause();
        if (a.geschafft) this._jagdEnde(a);
        else this._fertig(a, 'Hier sind keine Tiere zum Jagen.');
        return;
      }
      this._kampf(ziel);
    }
  }

  // Ein Monster ist nah genug, dass Julia sich wehren sollte – Fernkämpfer und
  // Creeper früher. Von allen Bedrohungen in Reichweite wird die GEFÄHRLICHSTE
  // gewählt (nicht bloß die nächste), damit sie nachts in einer Gruppe zuerst den
  // schlimmsten Mob (Creeper/Schütze) angeht, statt sich vom nächstbesten
  // überrennen zu lassen.
  _naheGefahr() {
    const bot = this.bot;
    const p = bot.entity.position;
    const feinde = Object.values(bot.entities).filter((e) => istFeind(e) && e.position
      && e.position.distanceTo(p) < gefahrReichweite(e.name));
    if (!feinde.length) return null;
    return feinde.sort((x, y) => bedrohWert(y, p) - bedrohWert(x, p))[0];
  }

  // Julia wurde verletzt: den nächsten Spieler in Schlagreichweite als Angreifer
  // merken und sich eine Weile gegen ihn wehren. Den eigenen Spieler (Besitzer)
  // greift sie nie an. Ist kein Spieler nah, war es vermutlich ein Mob (regelt die
  // Monster-Verteidigung) oder Sturz/Lava – dann nichts tun.
  _angegriffen() {
    const bot = this.bot;
    if (!bot || !bot.entity) return;
    const p = bot.entity.position;
    // Nur Spieler in Schlagreichweite, gegen die sie sich wehren DARF (nie den
    // eigenen Chef) – von denen der nächste ist der wahrscheinliche Angreifer.
    const spieler = Object.values(bot.entities)
      .filter((e) => e && e.type === 'player' && e !== bot.entity && e.isValid !== false && e.position
        && e.position.distanceTo(p) < 5 && darfWehren(e.username || e.name, this.besitzer))
      .sort((x, y) => x.position.distanceTo(p) - y.position.distanceTo(p));
    if (!spieler.length) return;
    const naechster = spieler[0];
    const name = naechster.username || naechster.name || 'jemand';
    const neu = this.angreifer == null || this.angreifer.id !== naechster.id;
    this.angreifer = { id: naechster.id, bis: this.ticks + 200 }; // ~10 s Vergeltungsfenster
    if (neu) this._melden('gefahr', `${name} greift mich an – ich wehre mich!`);
  }

  // Der aktuelle Angreifer, gegen den sich Julia gerade wehrt – oder null, wenn das
  // Fenster abgelaufen ist oder der Angreifer nicht mehr (erreichbar) da ist.
  _angreiferFigur() {
    if (!this.angreifer) return null;
    if (this.ticks > this.angreifer.bis) { this.angreifer = null; return null; }
    const e = this.bot.entities[this.angreifer.id];
    if (!e || e.isValid === false || !e.position) { this.angreifer = null; return null; }
    if (e.position.distanceTo(this.bot.entity.position) > 16) return null; // gerade zu weit – Fenster bleibt
    return e;
  }

  // Selbstverteidigung: Waffe/Rüstung an und den Feind bekämpfen (Kampf regelt
  // Rückzug bei wenig Leben und Abstand zu Creepern selbst).
  _selbstschutz(feind) {
    if (this.selbstschutz == null) this._ausruesten();
    this.selbstschutz = feind.id;
    this._kampf(feind);
  }

  // Nach der Verteidigung die unterbrochene Aufgabe wieder aufnehmen.
  _aufgabeFortsetzen() {
    const a = this.auftrag;
    if (!a || !this.bot) return;
    const { GoalFollow, GoalNear } = this.pf.goals;
    if (a.art === 'folgen') {
      const e = this._spielerFigur(a.spieler);
      if (e) { a.ziel = e; this.bot.pathfinder.setGoal(new GoalFollow(e, 2), true); }
    } else if (a.art === 'kommen') {
      const e = this._spielerFigur(a.spieler);
      if (e) this.bot.pathfinder.setGoal(new GoalNear(e.position.x, e.position.y, e.position.z, 1.5));
    }
    // abbauen/gehen/bauen laufen über ihre eigenen Schleifen von selbst weiter.
  }

  // Wähle den gefährlichsten Feind in der Nähe (Creeper zuerst, dann der nächste).
  _bedrohung(mitte) {
    const bot = this.bot;
    const p = bot.entity.position;
    const feinde = Object.values(bot.entities).filter((e) => istFeind(e) && e.position && e.position.distanceTo(mitte) < 12 && e.position.distanceTo(p) < 20);
    if (!feinde.length) return null;
    return feinde.sort((x, y) => bedrohWert(y, p) - bedrohWert(x, p))[0];
  }

  _hat(liste) {
    return this.bot.inventory.items().some((i) => liste.includes(i.name));
  }

  // Wie viele Goldäpfel welcher Art dabei sind (für die sparsame Heil-Wahl).
  _heilVorrat() {
    return {
      golden_apple: this._anzahlImInventar('golden_apple'),
      enchanted_golden_apple: this._anzahlImInventar('enchanted_golden_apple'),
    };
  }

  // Zahl der Monster in unmittelbarer Nähe (für die Unterzahl-Erkennung im Kampf).
  _feindeNah(reichweite = 10) {
    const p = this.bot.entity.position;
    return Object.values(this.bot.entities).filter((e) => istFeind(e) && e.position && e.position.distanceTo(p) < reichweite).length;
  }

  // Wie viele Stück eines Gegenstands (nach internem Namen) im Inventar liegen.
  _anzahlImInventar(name) {
    return this.bot.inventory.items().reduce((s, i) => (i.name === name ? s + i.count : s), 0);
  }

  // Water-MLG: einen tiefen Sturz mit dem Wassereimer abfangen. Läuft als Reflex
  // in jedem Tick – setzt kurz vor dem Aufprall Wasser und nimmt es danach wieder
  // auf, damit nichts überflutet.
  _mlgWasser() {
    const bot = this.bot;
    const e = bot.entity;
    if (!e) return;
    // Nach dem Fall (kaum noch vertikale Bewegung): gesetztes Wasser aufnehmen.
    if (this.mlgWasser && !this.mlgBusy && e.velocity.y > -0.2) { this._mlgWasserAufnehmen(); return; }
    if (e.onGround) { this.fallStartY = null; return; }
    if (this.fallStartY == null || e.position.y > this.fallStartY) this.fallStartY = e.position.y;
    if (this.mlgWasser || this.mlgBusy) return;
    const gefallen = this.fallStartY - e.position.y;
    const fuss = e.position.floored();
    let bodenNah = false;
    for (let d = 1; d <= 3; d++) {
      const b = bot.blockAt(fuss.offset(0, -d, 0));
      if (b && b.boundingBox === 'block') { bodenNah = true; break; }
    }
    if (mlgNoetig({ gefallen, geschwindigkeitY: e.velocity.y, bodenNah, hatWasser: this._hat(['water_bucket']) })) {
      this._mlgWasserSetzen();
    }
  }

  async _mlgWasserSetzen() {
    const bot = this.bot;
    this.mlgBusy = true;
    try {
      const eimer = bot.inventory.items().find((i) => i.name === 'water_bucket');
      if (!eimer) return;
      await bot.equip(eimer, 'hand');
      await bot.look(bot.entity.yaw, Math.PI / 2, true); // gerade nach unten schauen
      await bot.activateItem();
      this.mlgWasser = { zeit: this.ticks };
    } catch { /* im Fall lieber still scheitern als crashen */ } finally { this.mlgBusy = false; }
  }

  // Schwimmen/Auftauchen: Ist der Kopf unter Wasser und geht die Luft aus (oder
  // sinkt sie), hält sie „springen" = schwimmt hoch. So ertrinkt sie nicht und
  // quert Wasser an der Oberfläche. Gibt true zurück, wenn Ertrinken droht
  // (Luft ≤ 6) – dann soll der Tick sonst nichts weiter tun (erst auftauchen).
  _schwimmen() {
    const bot = this.bot;
    const e = bot.entity;
    if (!e) return false;
    const kopf = bot.blockAt(e.position.offset(0, 1, 0));
    const kopfImWasser = !!kopf && kopf.name === 'water';
    if (!kopfImWasser) {
      if (this._schwimmJump) { bot.setControlState('jump', false); this._schwimmJump = false; }
      return false;
    }
    const luft = typeof bot.oxygenLevel === 'number' ? bot.oxygenLevel : 20;
    const sinkt = !e.onGround && e.velocity.y < -0.02;
    if (schwimmHoch({ kopfImWasser, luft, sinkt })) {
      bot.setControlState('jump', true);
      this._schwimmJump = true;
    }
    return luft <= 6; // Notfall: gleich ertrunken → auftauchen hat Vorrang
  }

  async _mlgWasserAufnehmen() {
    const bot = this.bot;
    this.mlgBusy = true;
    try {
      this.mlgWasser = null;
      const leer = bot.inventory.items().find((i) => i.name === 'bucket');
      if (!leer) return;
      const wasser = bot.findBlock({ matching: (b) => b && b.name === 'water', maxDistance: 3 });
      if (!wasser) return;
      await bot.equip(leer, 'hand');
      await bot.lookAt(wasser.position.offset(0.5, 0.5, 0.5), true);
      await bot.activateItem();
    } catch { /* egal */ } finally { this.mlgBusy = false; }
  }

  // Vom Ziel wegflüchten (zu wenig Leben, oder Abstand zum Creeper halten).
  _weg(ziel) {
    const bot = this.bot;
    const { GoalFollow, GoalInvert } = this.pf.goals;
    bot.setControlState('sprint', false);
    if (GoalInvert && GoalFollow) {
      if (this.flieht !== ziel.id) {
        bot.clearControlStates();
        bot.pathfinder.setGoal(new GoalInvert(new GoalFollow(ziel, 8)), true);
        this.flieht = ziel.id;
        this.jagt = null;
      }
    } else {
      bot.clearControlStates();
      bot.setControlState('back', true);
    }
  }

  _zurueckziehen(ziel) {
    if (this.ticks - (this.letzteRueckzugMeldung || -1000) > 100) {
      this.letzteRueckzugMeldung = this.ticks;
      this._melden('rueckzug', 'Zu wenig Leben und nichts zum Heilen – ich ziehe mich zurück.');
    }
    this._weg(ziel);
  }

  // Creeper nicht umarmen: Abstand halten, kurz reinschlagen, sofort wieder weg.
  _creeper(ziel, d) {
    const bot = this.bot;
    const { GoalFollow } = this.pf.goals;
    const blick = bot.lookAt(ziel.position.offset(0, 1.4, 0), true);
    if (blick && blick.catch) blick.catch(() => {});
    if (this.ticks < (this.creeperRueckzug || 0) || d < 3.2) { this._weg(ziel); return; }
    if (d > 3.0) {
      if (this.jagt !== ziel.id) { bot.clearControlStates(); bot.pathfinder.setGoal(new GoalFollow(ziel, 3), true); this.jagt = ziel.id; this.flieht = null; }
      return;
    }
    if (this.jagt !== null) { bot.pathfinder.setGoal(null); this.jagt = null; }
    if (this.ticks - this.letzterSchlag >= this.pause) {
      bot.attack(ziel);
      this.letzterSchlag = this.ticks;
      this.creeperRueckzug = this.ticks + 14; // nach dem Schlag sofort zurück
    }
  }

  // Ein Tick Kampf: hinlaufen, anvisieren, im richtigen Moment zuschlagen.
  _kampf(ziel) {
    const bot = this.bot;
    const { GoalFollow } = this.pf.goals;
    const d = bot.entity.position.distanceTo(ziel.position);
    // Taktik (Issue #93): bei wenig Leben / Unterzahl nicht dumm sterben.
    // Sparsam mit dem verzauberten Goldapfel (nur im Notfall), sonst normaler.
    const heilItem = heilWahl(this._heilVorrat(), bot.health);
    const plan = rueckzugPlan({ health: bot.health, feinde: this._feindeNah(), hatHeilung: !!heilItem });
    if (plan === 'rueckzug') { this._zurueckziehen(ziel); return; }
    if (plan === 'heilen' && heilItem) { const g = this._essen([heilItem]); if (g) { this._essenMelden(g); return; } }
    // Creeper braucht eine andere Taktik: auf Abstand bleiben.
    if (ziel.name === 'creeper') { this._creeper(ziel, d); return; }
    // Feind noch weit weg und Hunger? Kurz auffüllen, solange es sicher ist.
    if (d > 7 && bot.food <= 14) { const g = this._essen(ESSEN); if (g) { this._essenMelden(g); return; } }
    const blick = bot.lookAt(ziel.position.offset(0, (ziel.height || 1.8) * 0.85, 0), true);
    if (blick && blick.catch) blick.catch(() => {});
    if (d > 3.4) {
      if (this.jagt !== ziel.id) {
        bot.clearControlStates();
        bot.pathfinder.setGoal(new GoalFollow(ziel, 1), true);
        this.jagt = ziel.id;
        this.flieht = null;
      }
      bot.setControlState('sprint', true);
      return;
    }
    if (this.jagt !== null) { bot.pathfinder.setGoal(null); this.jagt = null; }
    const seit = this.ticks - this.letzterSchlag;
    // Nah dran: selbst steuern – ran, seitlich pendeln, springen für kritische
    // Treffer. Sprint kurz loslassen nach dem Schlag gibt mehr Rückstoß.
    bot.setControlState('forward', d > 1.8);
    bot.setControlState('sprint', d > 1.8 && seit > 1);
    // Gefahr voraus (Lava, Abgrund): nicht weiter vorlaufen, nur noch schlagen.
    const eingefroren = this.ticks < (this.gefahrStopp || 0);
    if (eingefroren) { bot.setControlState('forward', false); bot.setControlState('sprint', false); }
    const links = Math.floor(this.ticks / 18) % 2 === 0;
    bot.setControlState('left', links);
    bot.setControlState('right', !links);
    bot.setControlState('jump', this.neuesKampfsystem && bot.entity.onGround && seit >= this.pause - 6 && d < 3.2);
    const faellt = !bot.entity.onGround && bot.entity.velocity.y < -0.05;
    if (d <= 3.0 && seit >= this.pause && (!this.neuesKampfsystem || faellt || seit >= this.pause + 5)) {
      bot.attack(ziel);
      this.letzterSchlag = this.ticks;
    }
  }

  _kampfPause() {
    this.jagt = null;
    this.flieht = null;
    this.bot.pathfinder.setGoal(null);
    this.bot.clearControlStates();
  }

  _tot(e) {
    // Enderdrache besiegt – das große Ziel des Durchspielens.
    if (e && (e.name === 'ender_dragon' || e.name === 'enderdragon')) {
      this.dracheBesiegt = true;
      this._melden('erreicht', 'Der Enderdrache ist besiegt – das Spiel ist durchgespielt! 🐉');
    }
    const a = this.auftrag;
    if (a && a.art === 'jagen' && e && e.id === a.zielId) {
      a.geschafft += 1;
      a.zielId = null;
      if (a.geschafft >= a.anzahl) { this._kampfPause(); this._jagdEnde(a); }
      return;
    }
    if (!a || a.art !== 'kaempfen' || !e || e.type !== 'player') return;
    if (String(e.username || '').toLowerCase() !== String(a.spieler).toLowerCase()) return;
    this._anhalten();
    this._melden('sieg', `Duell gegen ${a.spieler} gewonnen.`);
    try { this.chat('GG!'); } catch { /* getrennt */ }
  }

  _gestorben() {
    const a = this.auftrag;
    this._anhalten();
    if (a && a.art === 'kaempfen') {
      this._melden('niederlage', `Duell gegen ${a.spieler} verloren.`);
      try { this.chat('GG – Revanche?'); } catch { /* getrennt */ }
    } else if (a) {
      this._melden('gestorben', 'Die Spielfigur ist gestorben, die Aufgabe ist beendet.');
    }
  }

  async _ausruesten() {
    const bot = this.bot;
    if (!bot) return;
    const items = bot.inventory.items();
    const waffe = besteWaffe(items, this.neuesKampfsystem);
    this.pause = schlagPause(waffe && waffe.name, this.neuesKampfsystem);
    const getragen = {};
    for (const [platz, slot] of Object.entries(PLATZ_SLOT)) getragen[platz] = bot.inventory.slots[slot] || null;
    try {
      if (waffe && (!bot.heldItem || bot.heldItem.name !== waffe.name)) await bot.equip(waffe, 'hand');
      for (const [platz, it] of Object.entries(besteRuestung(items, getragen))) await bot.equip(it, platz);
    } catch (e) {
      this.letzterFehler = e.message;
    }
  }

  // Volle Rüstung craften – immer die beste erreichbare Stufe (Issue #93).
  // Plant aus dem Rohstoff-Vorrat (leather/iron/gold/diamant) für jedes noch nicht
  // optimal besetzte Teil die beste craftbare Stufe, stellt sie an der nächsten
  // Werkbank her und legt sie an. Defensiv (jede Stufe in try/catch – nie ein
  // Crash), best-effort (an einem echten Server nicht durchgetestet).
  _ruestungCraften() {
    const bot = this.bot;
    const vorrat = {
      diamond: this._anzahlImInventar('diamond'),
      iron_ingot: this._anzahlImInventar('iron_ingot'),
      gold_ingot: this._anzahlImInventar('gold_ingot'),
      leather: this._anzahlImInventar('leather'),
    };
    const getragen = {};
    for (const [platz, slot] of Object.entries(PLATZ_SLOT)) {
      const it = bot.inventory.slots[slot];
      const m = it && /^(netherite|diamond|iron|chainmail|turtle|golden|leather)_(helmet|chestplate|leggings|boots)$/.exec(it.name);
      if (m) getragen[m[2]] = m[1];
    }
    const plan = ruestungCraftPlan(vorrat, getragen);
    if (!plan.length) {
      const komplett = Object.values(PLATZ_SLOT).every((slot) => bot.inventory.slots[slot]);
      return komplett ? 'Ich trage schon die beste Rüstung, die ich craften kann.' : 'Mir fehlt Material für bessere Rüstung (Leder, Eisen, Gold oder Diamant).';
    }
    const a = { art: 'ruesten' };
    this.auftrag = a;
    (async () => {
      const gemacht = [];
      try {
        const { GoalNear } = this.pf.goals;
        const tischBlock = bot.registry.blocksByName.crafting_table;
        const tisch = tischBlock ? bot.findBlock({ matching: tischBlock.id, maxDistance: 32 }) : null;
        if (!tisch) { this._fertig(a, 'Für Rüstung brauche ich eine Werkbank in der Nähe.'); return; }
        await bot.pathfinder.goto(new GoalNear(tisch.position.x, tisch.position.y, tisch.position.z, 2));
        for (const teil of plan) {
          if (this.auftrag !== a) return;
          const item = bot.registry.itemsByName[teil.item];
          if (!item) continue;
          const r = bot.recipesFor(item.id, null, 1, tisch)[0];
          if (!r) continue;
          const vorher = this._anzahlImInventar(teil.item);
          try {
            await bot.craft(r, 1, tisch);
          } catch {
            await new Promise((res) => setTimeout(res, 400)); // Lag: am Inventar prüfen statt blind scheitern
          }
          if (this._anzahlImInventar(teil.item) > vorher) gemacht.push(teil.item);
        }
        await this._ausruesten(); // das Beste anlegen
        this._fertig(a, gemacht.length ? `Rüstung gecraftet und angelegt: ${gemacht.join(', ')}.` : 'Ich konnte keine bessere Rüstung herstellen (Material/Werkbank).');
      } catch (e) {
        this._fertig(a, `Beim Rüsten ging etwas schief: ${e.message}`);
      }
    })();
    return `Ich craft mir die beste Rüstung, die geht (${plan.map((p) => p.item).join(', ')}), und lege sie an.`;
  }

  // Isst das erste vorhandene Nahrungsmittel aus der Liste und gibt seinen
  // englischen Namen zurück – oder null, wenn nichts davon dabei ist.
  _essen(liste) {
    const bot = this.bot;
    const items = bot.inventory.items();
    const it = liste.map((n) => items.find((i) => i.name === n)).find(Boolean);
    if (!it) return null;
    const gegessen = it.name;
    this.isst = true;
    bot.clearControlStates();
    (async () => {
      try {
        await bot.equip(it, 'hand');
        await bot.consume();
      } catch { /* satt oder unterbrochen */ } finally {
        this.isst = false;
        this._ausruesten();
      }
    })();
    return gegessen;
  }

  // Was hat Julia zu essen dabei? Für den Status und die KI.
  _essbar() {
    if (!this.bot) return [];
    const items = this.bot.inventory.items();
    const out = [];
    for (const n of [...HEILEN, ...ESSEN]) {
      const it = items.find((i) => i.name === n);
      if (it) out.push({ was: essenName(n), anzahl: it.count });
    }
    return out;
  }

  // Auto-Essen im Chat melden – aber nicht ständig.
  _essenMelden(name) {
    if (this.ticks - (this.letzteEssenMeldung || -1000) < 200) return;
    this.letzteEssenMeldung = this.ticks;
    this._melden('essen', `Ich esse ${essenName(name)}.`);
  }

  // Blickrichtung waagerecht als Vektor (yaw 0 zeigt nach -Z).
  _vorne() {
    const { Vec3 } = require('vec3');
    const yaw = this.bot.entity.yaw || 0;
    return new Vec3(-Math.sin(yaw), 0, -Math.cos(yaw));
  }

  // Gefahr direkt vor der Figur: Lava, Feuer & Co. auf Fuß-, Kopf- oder
  // Bodenhöhe, oder ein Abgrund (vor den Füßen und mehrere Blöcke darunter frei).
  _gefahrVoraus() {
    const bot = this.bot;
    if (!bot || !bot.entity) return null;
    const vor = this._vorne();
    const fuss = bot.entity.position.offset(vor.x, 0.2, vor.z).floored();
    for (const v of [fuss, fuss.offset(0, 1, 0), fuss.offset(0, -1, 0)]) {
      const b = bot.blockAt(v);
      if (b && GEFAHR_VORAUS[b.name]) return { art: GEFAHR_VORAUS[b.name], block: b.name, ort: { x: v.x, y: v.y, z: v.z } };
    }
    const frei = (v) => { const b = bot.blockAt(v); return !!b && b.boundingBox === 'empty' && b.name !== 'water'; };
    if ([0, -1, -2, -3].every((dy) => frei(fuss.offset(0, dy, 0)))) {
      return { art: 'Abgrund', block: null, ort: { x: fuss.x, y: fuss.y, z: fuss.z } };
    }
    return null;
  }

  // Was liegt vor mir? Für die KI (umsehen) – Block in Blickrichtung, was sie
  // gerade anschaut, das nächste Wesen voraus und eine etwaige Gefahr.
  _voraus() {
    const bot = this.bot;
    const vor = this._vorne();
    const fuss = bot.entity.position.offset(vor.x, 0.2, vor.z).floored();
    const name = (v) => { const b = bot.blockAt(v); return b ? b.name : null; };
    let angeschaut = null;
    try {
      const b = bot.blockAtCursor ? bot.blockAtCursor(5) : null;
      if (b) angeschaut = { block: b.name, ort: { x: b.position.x, y: b.position.y, z: b.position.z } };
    } catch { /* nichts in Reichweite */ }
    let wesen = null;
    const p = bot.entity.position;
    if (bot.nearestEntity) {
      const e = bot.nearestEntity((x) => x.position && x.position.distanceTo(p) < 6 && vor.dot(x.position.minus(p).normalize()) > 0.6);
      if (e) wesen = { was: e.name || e.username || 'etwas', feind: istFeind(e), abstand: Math.round(e.position.distanceTo(p)) };
    }
    return {
      schaut_auf: angeschaut,
      vor_fuessen: name(fuss),
      ueber_kopf_vorn: name(fuss.offset(0, 1, 0)),
      boden_vorn: name(fuss.offset(0, -1, 0)),
      wesen_voraus: wesen,
      gefahr: this._gefahrVoraus(),
    };
  }

  // Läuft die Figur selbst (Kampf) oder per Wegsuche vorwärts und liegt Gefahr
  // direkt voraus, sofort bremsen und einmal warnen – schneller als über die KI.
  // Anti-Hänger: Will die Figur laufen (Wegfindung aktiv oder selbst vorwärts),
  // steht sie aber am Boden fest, gibt es einen kurzen Sprung-Impuls – so kommt
  // sie über 1 Block hohe Kanten, statt endlos davorzukleben. Springt sie gerade
  // ohnehin (nicht am Boden), passiert nichts.
  _antiHaenger() {
    const bot = this.bot;
    if (!bot.entity) return;
    const wegsuche = bot.pathfinder && bot.pathfinder.isMoving && bot.pathfinder.isMoving();
    const selbst = bot.getControlState && (bot.getControlState('forward') || bot.getControlState('sprint'));
    // Auch im Wasser eingreifen (Issue #28): dort ist onGround immer false, ein
    // 1 Block hohes Hindernis oder ein Block über dem Kopf ließ sie sonst ewig
    // festhängen. Im Wasser bedeutet „springen" = hochschwimmen (immer sicher,
    // sie steigt nur; kein Block wird abgebaut).
    const imWasser = !!bot.entity.isInWater;
    if (!haengerAktiv({ wegsuche, selbst, onGround: bot.entity.onGround, imWasser })) { this._haenger = null; return; }
    const s = haengerStatus(this._haenger, bot.entity.position, this.ticks);
    if (s.neu) this._haenger = s.neu;
    if (s.springen && bot.setControlState) {
      bot.setControlState('jump', true);
      // Im Wasser länger halten, damit sie sicher an die Oberfläche schwimmt.
      setTimeout(() => { try { bot.setControlState('jump', false); } catch { /* getrennt */ } }, haengerDauer(imWasser));
    }
    // Trotz mehrerer Sprünge kein Vorankommen beim SELBST-Laufen (nicht Wegfindung):
    // aufhören vorwärtszudrücken, sonst springt sie endlos gegen das Hindernis
    // (Livelock, Issue #8). Bei aktiver Wegfindung nicht eingreifen – der Pathfinder
    // steuert selbst und weicht aus.
    if (s.aufgeben && bot.setControlState) {
      if (!wegsuche) {
        // Selbst-Laufen: Vorwärts-Drücken stoppen, sonst springt sie endlos gegen
        // das Hindernis (Livelock, Issue #8); der nächste Schritt sucht neu.
        try {
          bot.setControlState('forward', false);
          bot.setControlState('sprint', false);
        } catch { /* getrennt */ }
      } else {
        // Wegfindung klemmt (z. B. am Baumstamm) trotz Sprüngen. Den Pathfinder
        // den Weg NEU berechnen lassen (dynamisch, ohne die laufende Aufgabe
        // abzubrechen), damit er außenrum plant statt ewig anzustoßen.
        try {
          const ziel = bot.pathfinder && bot.pathfinder.goal;
          if (ziel && bot.pathfinder.setGoal) bot.pathfinder.setGoal(ziel, true);
        } catch { /* egal */ }
      }
      // Steck-Stelle lokal festhalten (überlebt Abstürze), damit sich solche
      // Punkte im Logbuch gezielt nachvollziehen lassen (Issue #8).
      if (this.logbuch) {
        try {
          const p = bot.entity.position;
          this.logbuch.eintrag('haenger', wegsuche
            ? 'Wegfindung klemmte – Weg neu berechnet.'
            : 'Beim Vorlaufen nicht vorangekommen – Vorwärts gestoppt, plane neu.', {
            x: Math.round(p.x), y: Math.round(p.y), z: Math.round(p.z), imWasser, wegsuche: !!wegsuche,
          });
        } catch { /* Logbuch darf nie das Spiel stören */ }
      }
      this._haenger = null;
    }
  }

  _gefahrWache() {
    const bot = this.bot;
    // Während der Wegfindung NICHT eingreifen: der Pathfinder weicht Lava und
    // Abgründen selbst aus. Griffe die Wache hier ein, würde sie das Vorwärts-
    // Gehen des Pathfinders immer wieder abbrechen und sich am Rand endlos
    // einfrieren (statt außenrum zu laufen). Sie gilt nur fürs selbstgesteuerte
    // Vorlaufen aus der Wahrnehmung.
    const wegsuche = bot.pathfinder && bot.pathfinder.isMoving && bot.pathfinder.isMoving();
    if (wegsuche) { this.gefahrStopp = 0; return; }
    const selbst = bot.getControlState && (bot.getControlState('forward') || bot.getControlState('sprint'));
    if (this.ticks % 5 === 0 && selbst) {
      const g = this._gefahrVoraus();
      if (g) {
        this.gefahrStopp = this.ticks + 15;
        if (this.ticks - (this.letzteGefahrMeldung || -1000) > 100) {
          this.letzteGefahrMeldung = this.ticks;
          this._melden('gefahr', `Vorsicht, ${g.art} direkt vor mir – ich halte an.`);
        }
      }
    }
    if (this.ticks < (this.gefahrStopp || 0) && bot.setControlState) {
      bot.setControlState('forward', false);
      bot.setControlState('sprint', false);
    }
  }

  _abbauen(block, anzahl) {
    const bot = this.bot;
    const namen = blockNamen(block, Object.keys(bot.registry.blocksByName));
    if (!namen.length) throw new Error(`Einen Block "${block}" kenne ich nicht. Englische Namen wie oak_log gehen immer.`);
    const ids = namen.map((n) => bot.registry.blocksByName[n].id);
    // Nur wenn der Nutzer genau einen Blocktyp nennt, darf der auch geschützt sein
    // (z. B. „bau ab truhe"); bei allgemeinen Wörtern bleiben geschützte Blöcke tabu.
    const explizit = namen.length === 1;
    const ziel = Math.max(1, Math.min(64, Math.round(Number(anzahl) || 16)));
    const a = { art: 'abbauen', block, anzahl: ziel, geschafft: 0 };
    this.auftrag = a;
    const { GoalNear } = this.pf.goals;
    const unerreichbar = new Set();
    (async () => {
      while (this.auftrag === a && a.geschafft < ziel) {
        const pos = bot.findBlocks({ matching: ids, maxDistance: 32, count: 40 }).find((v) => {
          if (unerreichbar.has(v.toString())) return false;
          const bl = bot.blockAt(v);
          // Geschützte Blöcke (Truhen, Öfen, Türen, deine Bauten …) nur, wenn ausdrücklich genannt.
          if (bl && !explizit && GESCHUETZT_ABBAU.test(bl.name)) { unerreichbar.add(v.toString()); return false; }
          return true;
        });
        if (!pos) break;
        try {
          await bot.pathfinder.goto(new GoalNear(pos.x, pos.y, pos.z, 3));
          if (this.auftrag !== a) break;
          const b = bot.blockAt(pos);
          if (!b || !ids.includes(b.type)) continue;
          if (!explizit && GESCHUETZT_ABBAU.test(b.name)) { unerreichbar.add(pos.toString()); continue; }
          const werkzeug = besteWerkzeug(bot.inventory.items(), werkzeugArt(b.name));
          if (werkzeug) await bot.equip(werkzeug, 'hand');
          await bot.dig(b);
          a.geschafft++;
          // Das Fallengelassene einsammeln.
          await new Promise((r) => setTimeout(r, 300));
          const drop = bot.nearestEntity((e) => e.name === 'item' && e.position.distanceTo(pos) < 5);
          if (drop && this.auftrag === a) await bot.pathfinder.goto(new GoalNear(drop.position.x, drop.position.y, drop.position.z, 0.5)).catch(() => {});
        } catch {
          if (this.auftrag !== a) break;
          unerreichbar.add(pos.toString());
        }
      }
    })().finally(() => {
      if (this.auftrag !== a) return;
      this.auftrag = null;
      this._melden('fertig', a.geschafft ? `${a.geschafft}× ${block} abgebaut.` : `Kein erreichbarer Block "${block}" in der Nähe.`);
    });
    return `Ich baue bis zu ${ziel}× ${block} ab.`;
  }

  // Aufgabe erledigt (oder gescheitert): melden und im Spiel Bescheid sagen.
  _fertig(a, text) {
    if (this.auftrag !== a) return;
    this.auftrag = null;
    this._melden('fertig', text);
    // Fortschritts-/Status-Meldung nur in den Spielchat, wenn der Schalter an ist
    // (Nutzerwunsch: das „48× oak_planks hergestellt"-Gespamme im Chat abschaltbar).
    // Im Fenster ist es über _melden immer sichtbar.
    if (this.fortschrittInChat) { try { this.chat(text); } catch { /* getrennt */ } }
  }

  _gehen(ort) {
    const { GoalNear, GoalXZ } = this.pf.goals;
    const a = { art: 'gehen', ort: ortText(ort) };
    this.auftrag = a;
    const ziel = ort.y == null ? new GoalXZ(ort.x, ort.z) : new GoalNear(ort.x, ort.y, ort.z, 1);
    this.bot.pathfinder.goto(ziel).then(
      () => this._fertig(a, `Angekommen bei ${a.ort}.`),
      () => this._fertig(a, `Ich komme nicht bis ${a.ort} durch.`),
    );
    return `Ich laufe zu ${a.ort}.`;
  }

  // In ein Boot, eine Lore oder auf ein reitbares Tier in der Nähe steigen.
  _einsteigen() {
    const bot = this.bot;
    if (bot.vehicle) return 'Ich sitze schon in etwas.';
    const p = bot.entity.position;
    const e = bot.nearestEntity((x) => istFahrzeug(x) && x.position && x.position.distanceTo(p) < 16);
    if (!e) throw new Error('Ich sehe kein Boot, keine Lore und kein Reittier in der Nähe.');
    const { GoalNear } = this.pf.goals;
    const a = { art: 'einsteigen', zielId: e.id };
    this.auftrag = a;
    (async () => {
      try {
        if (e.position.distanceTo(p) > 2) await bot.pathfinder.goto(new GoalNear(e.position.x, e.position.y, e.position.z, 1));
        if (this.auftrag !== a) return;
        bot.mount(e);
        this._fertig(a, bot.vehicle ? 'Eingestiegen.' : 'Ich bin am Fahrzeug – steige ein.');
      } catch {
        this._fertig(a, 'Ich komme nicht ans Fahrzeug heran.');
      }
    })();
    return 'Ich steige ein.';
  }

  _aussteigen() {
    const bot = this.bot;
    if (!bot.vehicle) return 'Ich sitze in keinem Fahrzeug.';
    bot.dismount();
    return 'Ich steige aus.';
  }

  _geben(item, anzahl, name) {
    const bot = this.bot;
    const namen = itemNamen(item, Object.keys(bot.registry.itemsByName));
    if (!namen.length) throw new Error(`Einen Gegenstand "${item}" kenne ich nicht. Englische Namen wie bread gehen immer.`);
    const vorrat = bot.inventory.items().filter((i) => namen.includes(i.name));
    if (!vorrat.length) throw new Error(`Ich habe kein ${item} dabei.`);
    const art = vorrat[0].name;
    const da = vorrat.filter((i) => i.name === art).reduce((s, i) => s + i.count, 0);
    const n = Math.max(1, Math.min(da, Math.round(Number(anzahl) || da)));
    const e = this._spielerFigur(name);
    if (!e) throw new Error(`Ich sehe ${name} gerade nicht. Komm näher, dann bringe ich es dir.`);
    const { GoalNear } = this.pf.goals;
    const a = { art: 'geben', spieler: name, item: art };
    this.auftrag = a;
    (async () => {
      try {
        await bot.pathfinder.goto(new GoalNear(e.position.x, e.position.y, e.position.z, 2));
        if (this.auftrag !== a) return;
        await bot.lookAt(e.position.offset(0, 1.6, 0), true);
        await bot.toss(vorrat[0].type, null, n);
        this._fertig(a, `Hier, ${n}× ${art} für dich.`);
      } catch (err) {
        this._fertig(a, `Das Geben hat nicht geklappt: ${err.message}`);
      }
    })();
    return `Ich bringe ${name} ${n}× ${art}.`;
  }

  _sammeln() {
    const bot = this.bot;
    const { GoalNear } = this.pf.goals;
    const a = { art: 'sammeln', geschafft: 0 };
    this.auftrag = a;
    const bis = Date.now() + 60 * 1000;
    const istDrop = (e) => e.name === 'item' || e.name === 'Item' || e.objectType === 'Item';
    (async () => {
      const versucht = new Set();
      while (this.auftrag === a && Date.now() < bis && a.geschafft < 40) {
        const drop = bot.nearestEntity((e) => istDrop(e) && !versucht.has(e.id) && e.position.distanceTo(bot.entity.position) < 16);
        if (!drop) break;
        versucht.add(drop.id);
        try {
          await bot.pathfinder.goto(new GoalNear(drop.position.x, drop.position.y, drop.position.z, 0.5));
          a.geschafft += 1;
        } catch {
          if (this.auftrag !== a) return;
        }
      }
      this._fertig(a, a.geschafft ? `${a.geschafft}× eingesammelt.` : 'Hier liegt nichts zum Einsammeln.');
    })();
    return 'Ich sammle ein, was hier herumliegt.';
  }

  _schlafen() {
    const bot = this.bot;
    const ids = Object.keys(bot.registry.blocksByName).filter((n) => n.endsWith('_bed')).map((n) => bot.registry.blocksByName[n].id);
    const { GoalNear } = this.pf.goals;
    const a = { art: 'schlafen' };
    this.auftrag = a;
    (async () => {
      try {
        let bett = bot.findBlock({ matching: ids, maxDistance: 32 });
        // Kein Bett da, aber eins im Inventar? Dann selbst hinstellen und darin schlafen.
        if (!bett) {
          const bettItem = bot.inventory.items().find((i) => i.name.endsWith('_bed'));
          if (!bettItem) { this._fertig(a, 'Hier ist kein Bett – und ich habe auch keins dabei.'); return; }
          const boden = bot.blockAt(bot.entity.position.offset(0, -1, 0));
          const platz = boden ? boden.position.offset(0, 1, 0) : null;
          if (platz && await this._setzeBlock({ x: platz.x, y: platz.y, z: platz.z }, bettItem.name).catch(() => false)) {
            await new Promise((r) => setTimeout(r, 400));
          }
          bett = bot.findBlock({ matching: ids, maxDistance: 8 });
          if (!bett) { this._fertig(a, 'Ich konnte hier kein Bett aufstellen (zu wenig Platz?).'); return; }
        }
        await bot.pathfinder.goto(new GoalNear(bett.position.x, bett.position.y, bett.position.z, 2));
        if (this.auftrag !== a) return;
        await bot.sleep(bett);
        this._fertig(a, 'Gute Nacht – ich liege im Bett.');
      } catch (e) {
        const m = e.message || '';
        this._fertig(a,
          /night|thunder|nacht/i.test(m) ? 'Schlafen geht nur nachts oder bei Gewitter.'
            : /monster|not safe|too far/i.test(m) ? 'Ich kann gerade nicht schlafen – Monster sind zu nah.'
              : /occupied/i.test(m) ? 'Das Bett ist schon belegt.'
                : `Schlafen klappt nicht: ${m}`);
      }
    })();
    return 'Ich gehe schlafen.';
  }

  _jagen(tier, anzahl) {
    let tiere = [...TIERE];
    if (tier) {
      const w = String(tier).toLowerCase();
      const t = TIER_WOERTER[w] || w;
      if (!TIERE.has(t)) throw new Error('Jagen geht auf Kühe, Schweine, Hühner, Schafe und Hasen.');
      tiere = [t];
    }
    this._ausruesten();
    const n = Math.max(1, Math.min(10, Math.round(Number(anzahl) || 3)));
    this.auftrag = { art: 'jagen', tiere, anzahl: n, geschafft: 0, zielId: null, bis: this.ticks + 20 * 180 };
    return `Ich jage ${n}× ${tier || 'Tiere'} fürs Essen.`;
  }

  // Nach der Jagd das Fleisch aufsammeln.
  _jagdEnde(a) {
    if (this.auftrag !== a) return;
    this.auftrag = null;
    this._melden('fertig', `${a.geschafft} Tiere erlegt – ich sammle das Essen ein.`);
    this._sammeln();
  }

  _herstellen(item, anzahl) {
    const bot = this.bot;
    const namen = itemNamen(item, Object.keys(bot.registry.itemsByName));
    if (!namen.length) throw new Error(`Einen Gegenstand "${item}" kenne ich nicht. Englische Namen wie torch gehen immer.`);
    const wunsch = Math.max(1, Math.min(64, Math.round(Number(anzahl) || 1)));
    // Sparsam: Werkbank/Ofen nicht doppelt bauen. Liegt schon eine im Inventar
    // oder steht eine in der Nähe, die vorhandene nutzen statt Holz/Stein zu
    // verschwenden (der Nutzer merkte an, dass Julia sich jedes Mal eine neue baut).
    const wieder = namen.find((n) => EINMAL_BLOECKE[n]);
    if (wieder) {
      if (this._anzahlImInventar(wieder) > 0) return `Ich habe schon ${EINMAL_BLOECKE[wieder]} dabei – ich nutze die statt eine neue zu bauen.`;
      const blk = bot.registry.blocksByName[wieder];
      if (blk && bot.findBlock({ matching: blk.id, maxDistance: 6 })) return `Hier steht schon ${EINMAL_BLOECKE[wieder]} in der Nähe – die nutze ich.`;
    }
    const { GoalNear } = this.pf.goals;
    const a = { art: 'herstellen', item };
    this.auftrag = a;
    (async () => {
      try {
        const tischBlock = bot.registry.blocksByName.crafting_table;
        const tisch = tischBlock ? bot.findBlock({ matching: tischBlock.id, maxDistance: 32 }) : null;
        // Erst im Inventar (2×2), sonst an der nächsten Werkbank.
        let wahl = null;
        for (const mitTisch of [null, tisch]) {
          if (wahl || (mitTisch === null ? false : !mitTisch)) continue;
          for (const n of namen) {
            const r = bot.recipesFor(bot.registry.itemsByName[n].id, null, 1, mitTisch)[0];
            if (r) { wahl = { r, n, tisch: mitTisch }; break; }
          }
        }
        if (!wahl) {
          this._fertig(a, tisch ? `Für ${item} fehlen mir die Zutaten.` : `Für ${item} fehlen mir die Zutaten – oder es braucht eine Werkbank in der Nähe.`);
          return;
        }
        if (wahl.tisch) {
          await bot.pathfinder.goto(new GoalNear(wahl.tisch.position.x, wahl.tisch.position.y, wahl.tisch.position.z, 2));
          if (this.auftrag !== a) return;
        }
        let geschafft = 0;
        let letzterFehler = null;
        while (geschafft < wunsch && this.auftrag === a) {
          const r = bot.recipesFor(wahl.r.result.id, null, 1, wahl.tisch)[0];
          if (!r) break;
          const vorher = this._anzahlImInventar(wahl.n);
          try {
            await bot.craft(r, 1, wahl.tisch || undefined);
          } catch (e) {
            // „updateSlot … did not fire within timeout" heißt oft NUR, dass die
            // Server-Bestätigung ausblieb (Lag/kurzer Disconnect) – das Item ist
            // meist trotzdem hergestellt. Deshalb am Inventar prüfen statt blind
            // zu scheitern (sonst versucht es die KI 4× je 20 s erneut).
            await new Promise((res) => setTimeout(res, 400));
            if (this._anzahlImInventar(wahl.n) <= vorher) { letzterFehler = e; break; }
          }
          const dazu = this._anzahlImInventar(wahl.n) - vorher;
          geschafft += dazu > 0 ? dazu : (r.result.count || 1);
        }
        if (!geschafft && letzterFehler) { this._fertig(a, `Herstellen hat nicht geklappt: ${letzterFehler.message}`); return; }
        this._fertig(a, geschafft ? `${geschafft}× ${wahl.n} hergestellt.` : `Für ${item} fehlen mir die Zutaten.`);
      } catch (e) {
        this._fertig(a, `Herstellen hat nicht geklappt: ${e.message}`);
      }
    })();
    return `Ich stelle ${wunsch}× ${item} her.`;
  }

  _verstauen() {
    const bot = this.bot;
    const ids = ['chest', 'trapped_chest', 'barrel'].map((n) => bot.registry.blocksByName[n]).filter(Boolean).map((b) => b.id);
    const truhe = bot.findBlock({ matching: ids, maxDistance: 32 });
    if (!truhe) throw new Error('Hier in der Nähe ist keine Truhe.');
    const { GoalNear } = this.pf.goals;
    const a = { art: 'verstauen', geschafft: 0 };
    this.auftrag = a;
    (async () => {
      try {
        await bot.pathfinder.goto(new GoalNear(truhe.position.x, truhe.position.y, truhe.position.z, 2));
        if (this.auftrag !== a) return;
        const kiste = await bot.openContainer(truhe);
        try {
          for (const it of bot.inventory.items()) {
            if (this.auftrag !== a) break;
            if (BEHALTEN.test(it.name) || ESSEN.includes(it.name) || HEILEN.includes(it.name)) continue;
            try {
              await kiste.deposit(it.type, null, it.count);
              a.geschafft += it.count;
            } catch {
              break; // Truhe voll
            }
          }
        } finally {
          kiste.close();
        }
        this._fertig(a, a.geschafft ? `${a.geschafft} Sachen in die Truhe gelegt – Waffen, Werkzeug und Essen behalte ich.` : 'Es gab nichts zum Einräumen.');
      } catch (e) {
        this._fertig(a, `Einräumen hat nicht geklappt: ${e.message}`);
      }
    })();
    return 'Ich räume das Inventar in die Truhe.';
  }

  // Im Ofen schmelzen oder braten: Brennstoff und Ware rein, Ergebnis wieder raus.
  _schmelzen(item, anzahl) {
    const bot = this.bot;
    const namen = itemNamen(item, Object.keys(bot.registry.itemsByName));
    if (!namen.length) throw new Error(`Einen Gegenstand "${item}" kenne ich nicht. Englische Namen wie raw_iron gehen immer.`);
    // "eisen" meint zum Schmelzen das Roheisen, "steak" das rohe Fleisch – nicht das fertige Ergebnis.
    const roh = namen.flatMap((n) => [n, `raw_${n.replace(/_ingot$/, '')}`, n.replace(/^cooked_/, '')]).filter((n) => bot.registry.itemsByName[n]);
    const vorrat = bot.inventory.items().filter((i) => roh.includes(i.name) || namen.includes(i.name));
    if (!vorrat.length) throw new Error(`Ich habe kein ${item} zum Schmelzen dabei.`);
    const items = bot.inventory.items();
    const brenn = BRENNSTOFF.map(([n, schafft]) => ({ it: items.find((i) => (n.startsWith('_') ? i.name.endsWith(n) : i.name === n)), schafft })).find((b) => b.it);
    if (!brenn) throw new Error('Mir fehlt Brennstoff – Kohle, Holzkohle, Bretter oder Holz.');
    const ofenBlock = bot.registry.blocksByName.furnace;
    const ofen = ofenBlock ? bot.findBlock({ matching: ofenBlock.id, maxDistance: 32 }) : null;
    if (!ofen) throw new Error('Hier ist kein Ofen. Stell einen hin (!stell ofen hin) – oder lass mich erst einen herstellen.');
    const ware = vorrat[0];
    const n = Math.max(1, Math.min(64, ware.count, Math.round(Number(anzahl) || ware.count)));
    const { GoalNear } = this.pf.goals;
    const a = { art: 'schmelzen', item, geschafft: 0, anzahl: n };
    this.auftrag = a;
    (async () => {
      try {
        await bot.pathfinder.goto(new GoalNear(ofen.position.x, ofen.position.y, ofen.position.z, 2));
        if (this.auftrag !== a) return;
        const f = await bot.openFurnace(ofen);
        try {
          if (!f.fuelItem()) await f.putFuel(brenn.it.type, null, Math.min(brenn.it.count, Math.ceil(n / brenn.schafft)));
          await f.putInput(ware.type, null, n);
          const bis = Date.now() + (n * 10 + 20) * 1000; // zehn Sekunden je Stück
          while (this.auftrag === a && Date.now() < bis) {
            await new Promise((r) => setTimeout(r, 2000));
            const aus = f.outputItem();
            if (aus && aus.count) {
              a.geschafft += aus.count;
              await f.takeOutput();
            }
            if (!f.inputItem() && !f.outputItem()) break;
          }
        } finally {
          f.close();
        }
        this._fertig(a, a.geschafft ? `${a.geschafft}× fertig aus dem Ofen.` : 'Im Ofen ist nichts fertig geworden – fehlt Brennstoff?');
      } catch (e) {
        this._fertig(a, `Schmelzen hat nicht geklappt: ${e.message}`);
      }
    })();
    return `Ich schmelze ${n}× ${ware.name}.`;
  }

  // Einen Block aus dem Inventar direkt neben sich hinstellen (Werkbank, Ofen, Truhe …).
  _platzieren(item) {
    const bot = this.bot;
    const namen = itemNamen(item, Object.keys(bot.registry.itemsByName));
    const it = bot.inventory.items().find((i) => namen.includes(i.name) && bot.registry.blocksByName[i.name]);
    if (!it) throw new Error(`Ich habe kein ${item} zum Hinstellen dabei.`);
    const { Vec3 } = require('vec3');
    const fuesse = bot.entity.position.floored();
    let ziel = null;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const ort = fuesse.offset(dx, 0, dz);
      const boden = bot.blockAt(ort.offset(0, -1, 0));
      const frei = bot.blockAt(ort);
      if (boden && boden.boundingBox === 'block' && frei && frei.name === 'air') { ziel = { ort, boden }; break; }
    }
    if (!ziel) throw new Error('Hier ist kein freier Platz auf festem Boden.');
    const a = { art: 'platzieren', item };
    this.auftrag = a;
    (async () => {
      try {
        await bot.equip(it, 'hand');
        await bot.placeBlock(ziel.boden, new Vec3(0, 1, 0));
        this._fertig(a, `${it.name} steht bei ${ortText(ziel.ort)}.`);
      } catch (e) {
        this._fertig(a, `Hinstellen hat nicht geklappt: ${e.message}`);
      } finally {
        this._ausruesten();
      }
    })();
    return `Ich stelle ${it.name} hin.`;
  }

  // Welcher Block wird verbaut? Ein genannter, sonst der größte Stapel eines
  // gängigen Baustoffs, den sie dabeihat.
  _bauMaterial(item) {
    const bot = this.bot;
    const items = bot.inventory.items();
    const platzierbar = (n) => !!bot.registry.blocksByName[n];
    if (item) {
      const namen = itemNamen(item, Object.keys(bot.registry.itemsByName));
      const it = items.find((i) => namen.includes(i.name) && platzierbar(i.name));
      return it ? it.name : null;
    }
    const zaehle = (n) => items.filter((i) => i.name === n).reduce((s, i) => s + i.count, 0);
    for (const n of BAUSTOFFE) if (zaehle(n)) return n;
    // Kein klassischer Baustoff? Dann der größte Blockstapel, aber nichts Wertvolles.
    const bloecke = items.filter((i) => platzierbar(i.name) && !/diamond|emerald|gold|netherite|beacon|_ore$|spawner|shulker/.test(i.name));
    bloecke.sort((a, b) => b.count - a.count);
    return bloecke.length ? bloecke[0].name : null;
  }

  // Einen einzelnen Block an einer Weltposition setzen: hingehen, einen festen
  // Nachbarn als Anlehnfläche finden, ausrüsten, platzieren.
  async _setzeBlock(ort, itemName) {
    const bot = this.bot;
    const { Vec3 } = require('vec3');
    const ziel = new Vec3(ort.x, ort.y, ort.z);
    const da = bot.blockAt(ziel);
    if (da && da.boundingBox === 'block') return true; // steht schon
    if (bot.entity.position.distanceTo(ziel) > 4 && this.pf.goals && this.pf.goals.GoalNear) {
      try { await bot.pathfinder.goto(new this.pf.goals.GoalNear(ort.x, ort.y, ort.z, 3)); } catch { /* nah genug versuchen */ }
    }
    const it = bot.inventory.items().find((i) => i.name === itemName);
    if (!it) return false;
    for (const [dx, dy, dz] of [[0, -1, 0], [0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) {
      const ref = bot.blockAt(ziel.offset(dx, dy, dz));
      if (ref && ref.boundingBox === 'block') {
        try {
          await bot.equip(it, 'hand');
          await bot.placeBlock(ref, new Vec3(-dx, -dy, -dz));
          return true;
        } catch { return false; }
      }
    }
    return false;
  }

  // Bauen nach Ansage: Turm, Mauer, Hütte oder Brücke aus vorhandenem Material.
  _bauen({ bau, zahl1, zahl2, zahl3, item }) {
    const bot = this.bot;
    if (!bau) throw new Error('Diese Bauform kenne ich nicht. Ich kann Turm, Mauer, Hütte und Brücke.');
    const material = this._bauMaterial(item);
    if (!material) throw new Error(item ? `Ich habe kein ${item} zum Bauen dabei.` : 'Ich habe keine Bausteine dabei – gib mir z. B. Bruchstein, Holz oder Erde.');
    if (bau === 'turm') return this._turm(Math.max(1, Math.min(64, zahl1 || 5)), material);
    const dims = bau === 'mauer' ? { laenge: zahl1, hoehe: zahl2 }
      : bau === 'bruecke' ? { laenge: zahl1 }
        : { breite: zahl1, laenge: zahl2, hoehe: zahl3 }; // huette
    const dir = richtungAus(bot.entity.yaw || 0);
    const plan = bauPlan(bau, dims, bot.entity.position.floored(), dir);
    if (!plan.length) throw new Error('Diese Bauform kenne ich nicht.');
    const a = { art: 'bauen', bau, anzahl: plan.length, geschafft: 0 };
    this.auftrag = a;
    (async () => {
      try {
        for (const c of plan) {
          if (this.auftrag !== a) return;
          if (!this._bauMaterial(item)) break; // Material alle
          if (await this._setzeBlock(c, material).catch(() => false)) a.geschafft += 1;
        }
        this._fertig(a, a.geschafft
          ? `${bauName(bau)} gebaut – ${a.geschafft} von ${plan.length} Blöcken gesetzt${a.geschafft < plan.length ? ' (Rest ging nicht oder Material war alle)' : ''}.`
          : 'Ich konnte hier keinen Block setzen – zu wenig Platz oder Material.');
      } catch (e) {
        this._fertig(a, `Bauen hat nicht geklappt: ${e.message}`);
      } finally {
        this._ausruesten();
      }
    })();
    return `Ich baue ${bauName(bau)}.`;
  }

  // Turm: unter sich Block setzen und hochspringen, Schicht für Schicht.
  _turm(hoehe, material) {
    const bot = this.bot;
    const { Vec3 } = require('vec3');
    const a = { art: 'bauen', bau: 'turm', anzahl: hoehe, geschafft: 0 };
    this.auftrag = a;
    (async () => {
      try {
        for (let i = 0; i < hoehe; i++) {
          if (this.auftrag !== a) return;
          const it = bot.inventory.items().find((x) => x.name === material);
          if (!it) break;
          const unten = bot.blockAt(bot.entity.position.floored().offset(0, -1, 0));
          if (!unten) break;
          await bot.equip(it, 'hand');
          bot.setControlState('jump', true);
          await new Promise((r) => setTimeout(r, 130));
          try { await bot.placeBlock(unten, new Vec3(0, 1, 0)); a.geschafft += 1; } catch { /* Sprung zu früh/spät */ }
          bot.setControlState('jump', false);
          await new Promise((r) => setTimeout(r, 180));
        }
        this._fertig(a, a.geschafft ? `Turm gebaut – ${a.geschafft} Blöcke hoch.` : 'Der Turm ging hier nicht – zu wenig Platz oder Material.');
      } catch (e) {
        this._fertig(a, `Bauen hat nicht geklappt: ${e.message}`);
      } finally {
        bot.setControlState('jump', false);
        this._ausruesten();
      }
    })();
    return 'Ich baue einen Turm.';
  }

  // Etwas Bestimmtes in die Hand nehmen oder anziehen.
  _ausruestenMit(item) {
    const bot = this.bot;
    const namen = itemNamen(item, Object.keys(bot.registry.itemsByName));
    const it = bot.inventory.items().find((i) => namen.includes(i.name));
    if (!it) throw new Error(`Ich habe kein ${item} dabei.`);
    const teil = ruestungTeil(it.name);
    bot.equip(it, teil ? teil.platz : 'hand').catch((e) => { this.letzterFehler = e.message; });
    return teil ? `Ich ziehe ${it.name} an.` : `Ich nehme ${it.name} in die Hand.`;
  }

  // Für die KI: warten, bis die laufende Aufgabe fertig ist – dann das Ergebnis.
  async warten(sekunden = 60) {
    if (!this.verbunden) throw new Error('Julia ist mit keinem Minecraft-Server verbunden.');
    const bis = Date.now() + Math.max(1, Math.min(180, Number(sekunden) || 60)) * 1000;
    const vorher = this.letzteMeldung;
    while (this.verbunden && this.auftrag && !DAUERHAFT.includes(this.auftrag.art) && Date.now() < bis) {
      await new Promise((r) => setTimeout(r, 400));
    }
    const a = this.auftrag;
    let hinweis = null;
    if (a && DAUERHAFT.includes(a.art)) hinweis = 'Diese Aufgabe läuft dauerhaft, bis eine neue kommt.';
    else if (a) hinweis = 'Noch nicht fertig – später noch einmal warten.';
    return {
      fertig: !a,
      laeuft_noch: a ? a.art : null,
      hinweis,
      ergebnis: this.letzteMeldung && this.letzteMeldung !== vorher ? this.letzteMeldung.text : null,
      status: this.verbunden ? this.status() : { verbunden: false },
    };
  }

  // Was es im Umkreis gibt: Bäume, Erze, Wasser, Werkbank … – jeweils Anzahl und der nächste.
  umsehen() {
    if (!this.verbunden) throw new Error('Julia ist mit keinem Minecraft-Server verbunden.');
    const bot = this.bot;
    const p = bot.entity.position;
    const alle = Object.keys(bot.registry.blocksByName);
    const bloecke = {};
    for (const [was, passt] of Object.entries(UMSEHEN)) {
      const ids = alle.filter(passt).map((n) => bot.registry.blocksByName[n].id);
      if (!ids.length) continue;
      const orte = bot.findBlocks({ matching: ids, maxDistance: 32, count: 40 });
      if (!orte.length) continue;
      const n = orte.reduce((b, v) => (v.distanceTo(p) < b.distanceTo(p) ? v : b));
      bloecke[was] = { anzahl: orte.length >= 40 ? '40+' : orte.length, naechster: { x: n.x, y: n.y, z: n.z, abstand: Math.round(n.distanceTo(p)) } };
    }
    const tiere = {};
    const feinde = {};
    for (const e of Object.values(bot.entities)) {
      if (!e.position || e.position.distanceTo(p) > 32) continue;
      if (TIERE.has(e.name)) tiere[e.name] = (tiere[e.name] || 0) + 1;
      else if (istFeind(e)) feinde[e.name] = (feinde[e.name] || 0) + 1;
    }
    return {
      position: { x: Math.round(p.x), y: Math.round(p.y), z: Math.round(p.z) },
      dimension: bot.game && bot.game.dimension,
      tageszeit: bot.time ? (bot.time.isDay ? 'Tag' : 'Nacht') : null,
      voraus: this._voraus(),
      bloecke,
      tiere,
      feinde,
    };
  }
}

// --- Werkzeuge für das Modell ---

function gruen(beschreibung) {
  return { stufe: GRUEN, kategorie: null, grund: '', ...(beschreibung ? { beschreibung } : {}) };
}

function brauchtMinecraft(ctx) {
  if (!ctx.minecraft) throw new Error('Minecraft ist hier nicht verfügbar.');
  return ctx.minecraft;
}

function fremd(quelle, text) {
  return require('./hilfen').fremd(quelle, text);
}

// Wohin? Was im Minecraft-Reiter steht, hat der Nutzer selbst eingetragen –
// nur dorthin darf es auch ein Server im Internet sein.
function zielVon(e, ctx) {
  const c = (ctx && ctx.config && ctx.config.get('minecraft')) || {};
  const { host, port } = adresseTeilen(e.adresse || c.adresse, e.port || c.port);
  const eingetragen = !!c.adresse && host.toLowerCase() === String(c.adresse).toLowerCase();
  return { c, host, port, eingetragen };
}

const WERKZEUGE = [
  {
    name: 'minecraft_verbinden',
    fremd: true,
    description: 'Als eigene Spielfigur einem Minecraft-Server (Java Edition) beitreten, um mit dem Nutzer zu spielen. Ohne Angaben gilt, was im Minecraft-Reiter steht (sonst localhost:25565); ist dort ein Minecraft-Konto verbunden, spielt die Figur damit. Server im Internet nur, wenn der Nutzer die Adresse selbst im Reiter eingetragen hat; große öffentliche Netzwerke (Hypixel usw.) nie.',
    input_schema: {
      type: 'object',
      properties: {
        adresse: { type: 'string', description: 'z. B. localhost oder 192.168.1.20, auch mit :Port' },
        port: { type: 'number' },
        spieler: { type: 'string', description: 'Spielername des Nutzers in Minecraft' },
        botname: { type: 'string', description: 'Name der eigenen Spielfigur, 3–16 Zeichen' },
      },
    },
    einstufen(e, ctx) {
      const z = zielVon(e, ctx);
      if (GROSSE_NETZWERKE.test(z.host)) return { stufe: ROT, kategorie: null, grund: GROSSES_NETZWERK };
      if (net.isIP(z.host) && !intern(z.host) && !z.eingetragen) return { stufe: ROT, kategorie: null, grund: FREMDER_SERVER };
      return gruen(`Minecraft-Server ${z.host}:${z.port} beitreten`);
    },
    async ausfuehren(e, ctx) {
      const mc = brauchtMinecraft(ctx);
      const z = zielVon(e, ctx);
      const s = await mc.verbinden({
        adresse: z.host,
        port: z.port,
        botname: e.botname || z.c.botname,
        besitzer: e.spieler || z.c.spieler,
        assistent: ctx.config.get('assistent.name'),
        oeffentlich: z.eingetragen,
        konto: ctx.minecraftKonto ? ctx.minecraftKonto() : null,
        stimme: z.c.stimme !== false,
        gruppe: ctx.minecraftGruppe ? ctx.minecraftGruppe() : null,
        jeder: z.c.jeder === true,
      });
      return `Verbunden als ${s.name} (Minecraft ${s.version}). Im Spiel nennt „!hilfe“ alle Befehle.\n${fremd('dem Minecraft-Server', JSON.stringify(s))}`;
    },
  },
  {
    name: 'minecraft_aufgabe',
    description: 'Der eigenen Spielfigur in Minecraft eine Aufgabe geben; sie läuft danach selbstständig in Echtzeit und meldet sich, wenn sie fertig ist. folgen: dem Spieler hinterher. kommen: zum Spieler laufen. beschuetzen: Monster in der Nähe des Spielers bekämpfen. kaempfen: Duell gegen einen Spieler – nur, wenn der Nutzer das will; Waffe und Rüstung legt die Figur selbst an. abbauen: Blöcke abbauen und einsammeln (block z. B. oak_log, stone, iron_ore oder holz, stein, eisen, kohle, diamant; anzahl bis 64). gehen: zu Koordinaten laufen (x, z, optional y). geben: dem Spieler etwas aus dem Inventar bringen (item, anzahl). sammeln: herumliegende Gegenstände aufheben. jagen: Tiere für Essen jagen (tier: kuh, schwein, huhn, schaf, hase; anzahl bis 10). herstellen: etwas craften (item z. B. fackel, werkbank, bretter, stock oder torch; anzahl) – im Inventar oder an einer Werkbank in der Nähe. verstauen: Inventar in die nächste Truhe legen (Waffen, Werkzeug, Essen bleiben). schlafen: ins nächste Bett. schmelzen: im Ofen in der Nähe schmelzen oder braten (item z. B. eisen, raw_iron, beef; anzahl) – Brennstoff nimmt die Figur selbst. platzieren: einen Block aus dem Inventar neben sich hinstellen (item z. B. werkbank, ofen, truhe). ausruesten: ein bestimmtes Teil in die Hand nehmen oder anziehen. essen: sofort etwas essen. einsteigen/aussteigen: in ein Boot, eine Lore oder auf ein Reittier in der Nähe steigen bzw. wieder aussteigen. bauen: eine einfache Struktur aus vorhandenem Material errichten (bau: turm, mauer, huette oder bruecke; Maße über zahl1/zahl2/zahl3 – turm: Höhe; mauer: Länge, Höhe; bruecke: Länge; huette: Breite, Tiefe, Höhe; optional item als Baustoff). stopp: alles anhalten. Ohne spieler gilt der Spielername aus den Einstellungen. Nach Aufgaben, die dauern, mit minecraft_warten auf das Ergebnis warten, bevor der nächste Schritt kommt.',
    input_schema: {
      type: 'object',
      properties: {
        aufgabe: { type: 'string', enum: ['folgen', 'kommen', 'beschuetzen', 'kaempfen', 'abbauen', 'gehen', 'geben', 'sammeln', 'jagen', 'herstellen', 'verstauen', 'schlafen', 'schmelzen', 'platzieren', 'ausruesten', 'essen', 'einsteigen', 'aussteigen', 'bauen', 'stopp'] },
        spieler: { type: 'string' },
        block: { type: 'string' },
        item: { type: 'string', description: 'für geben und herstellen, z. B. brot, fackel, diamant, oak_planks' },
        anzahl: { type: 'number' },
        x: { type: 'number' },
        y: { type: 'number' },
        z: { type: 'number' },
        tier: { type: 'string', description: 'für jagen: kuh, schwein, huhn, schaf oder hase' },
        bau: { type: 'string', enum: ['turm', 'mauer', 'huette', 'bruecke'], description: 'für bauen: die Bauform' },
        zahl1: { type: 'number', description: 'für bauen: erstes Maß (turm=Höhe, mauer=Länge, bruecke=Länge, huette=Breite)' },
        zahl2: { type: 'number', description: 'für bauen: zweites Maß (mauer=Höhe, huette=Tiefe)' },
        zahl3: { type: 'number', description: 'für bauen: drittes Maß (huette=Höhe)' },
      },
      required: ['aufgabe'],
    },
    einstufen: () => gruen(),
    async ausfuehren(e, ctx) {
      const mc = brauchtMinecraft(ctx);
      const text = mc.aufgabe(e);
      if (e.aufgabe === 'kaempfen') try { mc.chat(text); } catch { /* egal */ }
      return text;
    },
  },
  {
    name: 'minecraft_eimer',
    description: 'Mit dem Eimer umgehen. aktion: wasser_aufnehmen (leeren Eimer an Wasser in der Nähe füllen), lava_aufnehmen (an Lava), wasser_setzen (Wasser aus dem Wassereimer platzieren – z. B. zum sicheren Runterkommen, zum Löschen oder für Farmen), lava_setzen, milch (Milch trinken – hebt Vergiftung/Effekte auf). Der passende Eimer muss im Inventar sein; beim Aufnehmen muss die Quelle in Reichweite sein (max. 4 Blöcke).',
    input_schema: { type: 'object', properties: { aktion: { type: 'string', enum: ['wasser_aufnehmen', 'lava_aufnehmen', 'wasser_setzen', 'lava_setzen', 'milch'] } }, required: ['aktion'] },
    einstufen: () => gruen(),
    async ausfuehren(e, ctx) {
      return brauchtMinecraft(ctx).eimer(e.aktion);
    },
  },
  {
    name: 'minecraft_chat',
    description: 'Eine Nachricht in den Minecraft-Chat schreiben. Keine Befehle mit /.',
    input_schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    nachAussen: () => true,
    einstufen: (e) => gruen(`In den Minecraft-Chat schreiben: ${String(e.text || '').slice(0, 250)}`),
    async ausfuehren(e, ctx) {
      return brauchtMinecraft(ctx).chat(e.text);
    },
  },
  {
    name: 'minecraft_status',
    fremd: true,
    description: 'Wie es der Spielfigur in Minecraft geht: Leben, Hunger, Position, Aufgabe, Spieler und Monster in der Nähe, Inventar, letzte Chatzeilen.',
    input_schema: { type: 'object', properties: {} },
    einstufen: () => gruen(),
    async ausfuehren(_e, ctx) {
      return fremd('dem Minecraft-Server', JSON.stringify(brauchtMinecraft(ctx).status()));
    },
  },
  {
    name: 'minecraft_warten',
    fremd: true,
    description: 'Warten, bis die laufende Aufgabe der Spielfigur fertig ist (höchstens sekunden, Standard 60, bis 180) – danach das Ergebnis und der Status. Nach jeder Aufgabe, die dauert (abbauen, gehen, herstellen, schmelzen, jagen …), aufrufen, bevor der nächste Schritt kommt.',
    input_schema: { type: 'object', properties: { sekunden: { type: 'number' } } },
    einstufen: () => gruen(),
    async ausfuehren(e, ctx) {
      return fremd('dem Minecraft-Server', JSON.stringify(await brauchtMinecraft(ctx).warten(e.sekunden)));
    },
  },
  {
    name: 'minecraft_umsehen',
    fremd: true,
    description: 'Was es im Umkreis von 32 Blöcken gibt: Bäume, Stein, Erze (Kohle, Eisen, Kupfer, Gold, Redstone, Diamant, Smaragd), Obsidian, Wasser, Lava, Werkbank, Ofen, Truhe, Bett – jeweils Anzahl und der nächste mit Koordinaten; dazu Tiere, Monster, Tageszeit und Dimension. Zum Planen vor größeren Zielen.',
    input_schema: { type: 'object', properties: {} },
    einstufen: () => gruen(),
    async ausfuehren(_e, ctx) {
      return fremd('dem Minecraft-Server', JSON.stringify(brauchtMinecraft(ctx).umsehen()));
    },
  },
  {
    name: 'minecraft_trennen',
    description: 'Die Spielfigur verlässt den Minecraft-Server.',
    input_schema: { type: 'object', properties: {} },
    einstufen: () => gruen(),
    async ausfuehren(_e, ctx) {
      const mc = brauchtMinecraft(ctx);
      const war = mc.verbunden;
      mc.trennen();
      return war ? 'Server verlassen.' : 'War mit keinem Server verbunden.';
    },
  },
  {
    name: 'minecraft_fortschritt',
    description: 'Wo steht Julia beim Durchspielen? Liefert den Tech-Baum-Stand (erreichte Etappen, aktuelle Etappe mit konkretem nächsten Schritt, Prozent) vom ersten Holz bis zum Enderdrachen. Nutze das, um selbstständig weiterzuspielen: Etappe für Etappe die vorhandenen Minecraft-Werkzeuge (abbauen, herstellen, schmelzen, jagen, bauen, umsehen) einsetzen, bis die aktuelle Etappe erfüllt ist, dann erneut prüfen.',
    input_schema: { type: 'object', properties: {} },
    einstufen: () => gruen(),
    async ausfuehren(_e, ctx) {
      const mc = brauchtMinecraft(ctx);
      if (!mc.verbunden) throw new Error('Julia ist mit keinem Minecraft-Server verbunden.');
      const f = mc.fortschritt();
      return fremd('dem Minecraft-Server', JSON.stringify(f));
    },
  },
  {
    name: 'minecraft_logbuch',
    description: 'Das tägliche Spiel-Logbuch lesen (überlebt Abstürze, eine Datei pro Tag). Ohne datum die Zusammenfassung von heute; mit datum "JJJJ-MM-TT" ein anderer Tag; mit voll=true die vollständigen Einträge des Tages. Damit sieht man, was Julia geschafft hat und wo sie hängen blieb.',
    input_schema: { type: 'object', properties: { datum: { type: 'string' }, voll: { type: 'boolean' } } },
    einstufen: () => gruen(),
    async ausfuehren(e, ctx) {
      const mc = brauchtMinecraft(ctx);
      if (!mc.logbuch) return 'Für Minecraft gibt es hier kein Logbuch.';
      const datum = e.datum && /^\d{4}-\d{2}-\d{2}$/.test(e.datum) ? e.datum : undefined;
      if (e.voll) {
        const eintraege = mc.logbuch.lesen(datum);
        return fremd('dem Minecraft-Logbuch', eintraege.length ? JSON.stringify(eintraege.slice(-200), null, 1) : 'Für diesen Tag gibt es kein Logbuch.');
      }
      const tage = mc.logbuch.tage();
      return fremd('dem Minecraft-Logbuch', `${mc.logbuch.zusammenfassung(datum)}${tage.length ? `\n\nVorhandene Tage: ${tage.slice(0, 10).join(', ')}.` : ''}`);
    },
  },
];

// Welche Minecraft-Ereignis-Arten eine Windows-Benachrichtigung wert sind
// (Standard „wichtige"). Routine wie Bauen-fertig/Essen/Hänger pusht NICHT, damit
// man nicht ständig benachrichtigt wird, während Julia baut (Nutzerwunsch).
const MC_WICHTIGE = new Set(['getrennt', 'gestorben', 'gefahr', 'erreicht', 'rueckzug', 'niederlage']);

// Reine Entscheidung: soll dieses Ereignis (art) beim gewählten Modus pushen?
//   'keine'   → nie; 'alle' → immer; 'wichtige' → nur die wichtigen Arten.
function sollBenachrichtigen(art, modus = 'wichtige') {
  if (modus === 'keine') return false;
  if (modus === 'alle') return true;
  return MC_WICHTIGE.has(String(art || ''));
}

module.exports = {
  Minecraft, WERKZEUGE, GROSSE_NETZWERKE, MC_WICHTIGE, sollBenachrichtigen, kickWiederverbinden, bedrohWert, gefahrReichweite, FERNKAEMPFER, eimerPlan, mlgNoetig, EINMAL_BLOECKE, schwimmHoch, essenPlan, rueckzugPlan, heilWahl, ruestungCraftPlan,
  kontoSpeicher, kontoAnmelden,
  adresseTeilen, adressePruefen, zielFinden, besteWaffe, schlagPause, besteRuestung, werkzeugArt, besteWerkzeug, blockNamen,
  istFeind, darfWehren, chatText, botName, anrede, befehlLesen, rauswurfText, frageLesen, plauschLesen, darfInChat, hoerModus, hoerName, chatTeile, richtungAus, bauPlan, GESCHUETZT_ABBAU,
  itemNamen, ortLesen, mengeLesen, endeText, HILFE, haengerStatus, haengerAktiv, haengerDauer, haengerErkannt,
};
