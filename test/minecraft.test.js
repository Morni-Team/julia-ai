'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mc = require('../src/main/minecraft');
const a = require('../src/main/ampel');

const dnsFake = (ips) => async () => ips.map((address) => ({ address }));

test('Minecraft: nur Server auf diesem PC oder im Heimnetz', async () => {
  assert.equal(await mc.adressePruefen('192.168.1.20'), '192.168.1.20');
  assert.equal(await mc.adressePruefen('localhost', dnsFake(['127.0.0.1', '::1'])), '127.0.0.1');
  await assert.rejects(mc.adressePruefen('8.8.8.8'), /Heimnetz/);
  await assert.rejects(mc.adressePruefen('play.example.net', dnsFake(['172.65.1.1'])), /Heimnetz/);
  await assert.rejects(mc.adressePruefen('mein-pc', dnsFake(['192.168.1.2', '1.2.3.4'])), /Heimnetz/);
  await assert.rejects(mc.adressePruefen('a b'), /gültige/);
});

test('Minecraft: SRV-Eintrag wie im Spiel, Handshake mit dem eingetragenen Namen', async () => {
  const srv = async (n) => {
    assert.equal(n, '_minecraft._tcp.play.example.de');
    return [{ name: 'b.proxy.example.', port: 25577, priority: 10, weight: 1 }, { name: 'a.proxy.example.', port: 25570, priority: 5, weight: 5 }];
  };
  const dns = async (h) => { assert.equal(h, 'a.proxy.example'); return [{ address: '5.9.1.1' }]; };
  assert.deepEqual(await mc.zielFinden('play.example.de', 25565, { aufloesen: dns, srv, oeffentlich: true }), { host: 'play.example.de', ip: '5.9.1.1', port: 25570 });

  let gefragt = false;
  const eigenerPort = await mc.zielFinden('play.example.de', 25570, { aufloesen: dnsFake(['5.9.1.2']), srv: async () => { gefragt = true; return []; }, oeffentlich: true });
  assert.deepEqual(eigenerPort, { host: 'play.example.de', ip: '5.9.1.2', port: 25570 });
  assert.equal(gefragt, false);

  const keinSrv = async () => { throw Object.assign(new Error('x'), { code: 'ENOTFOUND' }); };
  assert.deepEqual(await mc.zielFinden('mc.example.de', 25565, { aufloesen: dnsFake(['5.9.1.3']), srv: keinSrv, oeffentlich: true }), { host: 'mc.example.de', ip: '5.9.1.3', port: 25565 });

  // Ein SRV-Eintrag hebelt die Regeln nicht aus.
  const aufHypixel = async () => [{ name: 'mc.hypixel.net', port: 25565, priority: 0, weight: 0 }];
  await assert.rejects(mc.zielFinden('tarn.example.de', 25565, { aufloesen: dnsFake(['1.2.3.4']), srv: aufHypixel, oeffentlich: true }), /Bots/);
  const insInternet = async () => [{ name: 'x.example.de', port: 25565, priority: 0, weight: 0 }];
  await assert.rejects(mc.zielFinden('heim.example.de', 25565, { aufloesen: dnsFake(['5.9.1.1']), srv: insInternet }), /Heimnetz/);

  let opts;
  const m = new mc.Minecraft({ aufloesen: dns, srv, laden: () => ({ mineflayer: { createBot: (o) => { opts = o; throw new Error('halt'); } }, pf: {} }) });
  await assert.rejects(m.verbinden({ adresse: 'play.example.de', oeffentlich: true }), /halt/);
  assert.equal(opts.host, 'play.example.de');
  assert.equal(opts.port, 25565);
  assert.equal(typeof opts.connect, 'function');
});

test('Minecraft: Adresse mit Port', () => {
  assert.deepEqual(mc.adresseTeilen('192.168.1.20:25566'), { host: '192.168.1.20', port: 25566 });
  assert.deepEqual(mc.adresseTeilen('localhost', 25570), { host: 'localhost', port: 25570 });
  assert.deepEqual(mc.adresseTeilen('', undefined), { host: 'localhost', port: 25565 });
  assert.deepEqual(mc.adresseTeilen('[::1]:25567'), { host: '::1', port: 25567 });
});

test('Minecraft: fremder Server ist ROT, eigener GRÜN', () => {
  const w = mc.WERKZEUGE.find((x) => x.name === 'minecraft_verbinden');
  const ctx = { config: { get: () => ({ adresse: '', port: 25565 }) } };
  assert.equal(w.einstufen({ adresse: '5.9.1.1' }, ctx).stufe, a.ROT);
  assert.equal(w.einstufen({ adresse: '192.168.0.5:25565' }, ctx).stufe, a.GRUEN);
  assert.equal(w.einstufen({}, ctx).stufe, a.GRUEN);
});

test('Minecraft: verbinden prüft die Adresse, bevor irgendetwas aufgebaut wird', async () => {
  let erstellt = false;
  const m = new mc.Minecraft({ laden: () => { erstellt = true; return {}; } });
  await assert.rejects(m.verbinden({ adresse: '8.8.8.8' }), /Heimnetz/);
  assert.equal(erstellt, false);
  assert.throws(() => m.aufgabe({ aufgabe: 'folgen' }), /keinem Minecraft-Server/);
});

test('Minecraft: beste Waffe, Schlagpause und Rüstung', () => {
  const items = [{ name: 'wooden_sword' }, { name: 'diamond_axe' }, { name: 'iron_sword' }, { name: 'dirt' }];
  assert.equal(mc.besteWaffe(items, true).name, 'iron_sword');
  assert.equal(mc.besteWaffe(items, false).name, 'iron_sword');
  assert.equal(mc.besteWaffe([{ name: 'dirt' }]), null);
  assert.equal(mc.schlagPause('diamond_sword', true), 13);
  assert.equal(mc.schlagPause('diamond_sword', false), 3);
  assert.equal(mc.schlagPause(null, true), 5);
  const r = mc.besteRuestung([{ name: 'iron_helmet' }, { name: 'diamond_helmet' }, { name: 'leather_boots' }], { feet: { name: 'iron_boots' } });
  assert.deepEqual(Object.keys(r), ['head']);
  assert.equal(r.head.name, 'diamond_helmet');
});

test('Minecraft: Befehle im Spielchat', () => {
  assert.deepEqual(mc.befehlLesen('!folge', ['Julia']), { aufgabe: 'folgen' });
  assert.deepEqual(mc.befehlLesen('Julia, komm her', ['Julia']), { aufgabe: 'kommen' });
  assert.deepEqual(mc.befehlLesen('julia: stopp!', ['Julia']), { aufgabe: 'stopp' });
  assert.deepEqual(mc.befehlLesen('!beschütze mich', []), { aufgabe: 'beschuetzen' });
  assert.deepEqual(mc.befehlLesen('!duell', []), { aufgabe: 'kaempfen', spieler: null });
  assert.deepEqual(mc.befehlLesen('!kämpf gegen Steve_2', []), { aufgabe: 'kaempfen', spieler: 'Steve_2' });
  assert.deepEqual(mc.befehlLesen('!kämpf gegen mich', []), { aufgabe: 'kaempfen', spieler: null });
  assert.equal(mc.befehlLesen('folge mir', ['Julia']), null, 'ohne Anrede kein Befehl');
  assert.equal(mc.befehlLesen('!lösch alles', []), null);
});

test('Minecraft: neue Befehle im Spielchat', () => {
  const b = (t) => mc.befehlLesen(t, ['Julia']);
  assert.deepEqual(b('!hilfe'), { aufgabe: 'hilfe' });
  assert.deepEqual(b('!gib mir 5 brot'), { aufgabe: 'geben', item: 'brot', anzahl: 5 });
  assert.deepEqual(b('Julia, gib mir diamant 2'), { aufgabe: 'geben', item: 'diamant', anzahl: 2 });
  assert.deepEqual(b('!geh 100 64 -20'), { aufgabe: 'gehen', x: 100, y: 64, z: -20 });
  assert.deepEqual(b('!geh zu 10 -5'), { aufgabe: 'gehen', x: 10, z: -5 });
  assert.deepEqual(b('!sammel alles'), { aufgabe: 'sammeln' });
  assert.deepEqual(b('!jag 3 kuh'), { aufgabe: 'jagen', anzahl: 3, tier: 'kuh' });
  assert.deepEqual(b('!jagen'), { aufgabe: 'jagen', anzahl: null, tier: null });
  assert.deepEqual(b('!craft 4 fackeln'), { aufgabe: 'herstellen', item: 'fackeln', anzahl: 4 });
  assert.deepEqual(b('!stell mir eine werkbank her'), { aufgabe: 'herstellen', item: 'werkbank', anzahl: null });
  assert.deepEqual(b('!bau ab holz 10'), { aufgabe: 'abbauen', block: 'holz', anzahl: 10 });
  assert.deepEqual(b('!verstau alles'), { aufgabe: 'verstauen' });
  assert.deepEqual(b('!schlaf'), { aufgabe: 'schlafen' });
  assert.deepEqual(b('!ess was'), { aufgabe: 'essen' });
  assert.deepEqual(b('!schmelz 8 eisen'), { aufgabe: 'schmelzen', item: 'eisen', anzahl: 8 });
  assert.deepEqual(b('!stell eine werkbank hin'), { aufgabe: 'platzieren', item: 'werkbank' });
  assert.deepEqual(b('!platzier ofen'), { aufgabe: 'platzieren', item: 'ofen' });
  assert.deepEqual(b('!nimm dein schwert'), { aufgabe: 'ausruesten', item: 'schwert' });
  assert.deepEqual(b('!stell mir eine werkbank her'), { aufgabe: 'herstellen', item: 'werkbank', anzahl: null }, 'herstellen bleibt herstellen');
});

test('Minecraft: Gegenstände auf Deutsch und gültige Koordinaten', () => {
  const namen = ['bread', 'torch', 'crafting_table', 'oak_planks', 'birch_planks', 'stick', 'diamond', 'cooked_beef', 'iron_ingot', 'iron_ore'];
  assert.deepEqual(mc.itemNamen('brot', namen), ['bread']);
  assert.deepEqual(mc.itemNamen('fackeln', namen), ['torch']);
  assert.deepEqual(mc.itemNamen('werkbank', namen), ['crafting_table']);
  assert.deepEqual(mc.itemNamen('bretter', namen), ['oak_planks', 'birch_planks']);
  assert.deepEqual(mc.itemNamen('eisen', namen), ['iron_ingot']);
  assert.deepEqual(mc.itemNamen('torch', namen), ['torch']);
  assert.deepEqual(mc.itemNamen('xyz', namen), []);
  assert.deepEqual(mc.ortLesen({ x: '100', y: 64, z: -20.4 }), { x: 100, y: 64, z: -20 });
  assert.deepEqual(mc.ortLesen({ x: 1, z: 2, y: '' }), { x: 1, z: 2 });
  assert.throws(() => mc.ortLesen({ x: 'a', z: 1 }), /Koordinaten/);
  assert.throws(() => mc.ortLesen({ x: 1, y: 999, z: 1 }), /Koordinaten/);
  assert.throws(() => mc.ortLesen({ x: 1, y: -100, z: 1 }), /Höhe/);
});

test('Minecraft: Rauswurf und Abbruch werden verständlich erklärt', () => {
  assert.match(mc.rauswurfText('{"text":"Flying is not enabled on this server"}'), /Fliegen/);
  assert.match(mc.rauswurfText('You logged in from another location'), /eigenes Minecraft-Konto/);
  assert.match(mc.rauswurfText('Server closed'), /beendet|neu gestartet/);
  assert.match(mc.endeText('keepAliveError', null, 'mc.example.de:25565'), /Zeitüberschreitung/);
  assert.match(mc.endeText('socketClosed', null, 'mc.example.de:25565'), /abgebrochen/);
  assert.match(mc.endeText('socketClosed', 'read ECONNRESET', 'mc.example.de:25565'), /abrupt/);
});

test('Minecraft: Crash-Screen – Grund merken, nach Verbindungsabbruch selbst zurück, nach Rauswurf nicht', async () => {
  const { EventEmitter } = require('events');
  const boten = [];
  const pf = { pathfinder: () => {}, Movements: class {}, goals: {} };
  const laden = () => ({
    pf,
    mineflayer: {
      createBot: () => {
        const b = new EventEmitter();
        b.loadPlugin = () => {};
        b.pathfinder = { setMovements() {}, setGoal() {} };
        b.registry = null;
        b.clearControlStates = () => {};
        b.quit = () => b.emit('end', 'disconnect.quitting');
        boten.push(b);
        setImmediate(() => {
          Object.assign(b, { entity: { position: { x: 1, y: 64, z: 2 } }, username: 'Julia', version: '1.21.1', players: {}, entities: {}, inventory: { items: () => [] }, health: 20, food: 20, game: {} });
          b.emit('spawn');
        });
        return b;
      },
    },
  });
  const m = new mc.Minecraft({ laden, wiederPausen: [5, 5, 5] });
  const warten = (ms) => new Promise((r) => setTimeout(r, ms));
  await m.verbinden({ adresse: '127.0.0.1', botname: 'Julia' });

  boten[0].emit('end', 'socketClosed');
  const t = m.status().trennung;
  assert.equal(m.status().verbunden, false);
  assert.equal(t.rauswurf, false);
  assert.match(t.grund, /abgebrochen/);
  assert.equal(t.versuch, 1);
  await warten(60);
  assert.equal(boten.length, 2, 'nach dem Abbruch selbst wieder beigetreten');
  assert.equal(m.verbunden, true);
  assert.equal(m.status().trennung, undefined);

  boten[1].emit('kicked', '{"text":"Flying is not enabled on this server"}');
  boten[1].emit('end', 'socketClosed');
  assert.equal(m.status().trennung.rauswurf, true);
  assert.match(m.status().trennung.grund, /Fliegen/);
  await warten(40);
  assert.equal(boten.length, 2, 'nach einem Rauswurf kein neuer Versuch');

  m.trennungVergessen();
  assert.equal(m.status().trennung, null);
});

test('Minecraft: Chat ohne Befehle und Steuerzeichen, gültiger Figurname', () => {
  assert.equal(mc.chatText('/op Moin'), 'op Moin');
  assert.equal(mc.chatText('hi\nda §4rot'), 'hi da 4rot');
  assert.throws(() => mc.chatText('   '), /Leere/);
  assert.equal(mc.botName('', 'Jülia'), 'Julia');
  assert.equal(mc.botName('Mein Bot!', 'Julia'), 'MeinBot');
  assert.equal(mc.botName('x', 'Jo'), 'Julia_Bot');
});

test('Minecraft: Blöcke auf Deutsch und das passende Werkzeug', () => {
  const namen = ['oak_log', 'birch_log', 'stone', 'cobblestone', 'iron_ore', 'deepslate_iron_ore', 'dirt', 'grass_block'];
  assert.deepEqual(mc.blockNamen('holz', namen), ['oak_log', 'birch_log']);
  assert.deepEqual(mc.blockNamen('eisen', namen), ['iron_ore', 'deepslate_iron_ore']);
  assert.deepEqual(mc.blockNamen('oak_log', namen), ['oak_log']);
  assert.deepEqual(mc.blockNamen('log', namen), ['oak_log', 'birch_log']);
  assert.deepEqual(mc.blockNamen('xyz', namen), []);
  assert.equal(mc.werkzeugArt('oak_log'), 'axe');
  assert.equal(mc.werkzeugArt('dirt'), 'shovel');
  assert.equal(mc.werkzeugArt('iron_ore'), 'pickaxe');
  assert.equal(mc.besteWerkzeug([{ name: 'stone_pickaxe' }, { name: 'diamond_pickaxe' }, { name: 'diamond_axe' }], 'pickaxe').name, 'diamond_pickaxe');
  assert.equal(mc.besteWerkzeug([{ name: 'diamond_pickaxe' }], 'axe'), null);
});

test('Minecraft: Rauswurf wegen Konto wird verständlich erklärt', () => {
  assert.match(mc.rauswurfText('{"translate":"multiplayer.disconnect.unverified_username"}'), /online-mode=false/);
  assert.match(mc.rauswurfText('You are not whitelisted on this server!'), /Whitelist/);
  assert.equal(mc.istFeind({ type: 'hostile', name: 'zombie' }), true);
  assert.equal(mc.istFeind({ type: 'player', name: 'player' }), false);
  assert.equal(mc.istFeind({ type: 'mob', name: 'creeper' }), true);
  assert.equal(mc.istFeind({ type: 'animal', name: 'cow' }), false);
});

test('Minecraft: Server im Internet nur, wenn selbst eingetragen – große Netzwerke nie', async () => {
  assert.equal(await mc.adressePruefen('5.9.1.1', undefined, { oeffentlich: true }), '5.9.1.1');
  await assert.rejects(mc.adressePruefen('mc.hypixel.net', dnsFake(['1.2.3.4']), { oeffentlich: true }), /Bots/);
  const w = mc.WERKZEUGE.find((x) => x.name === 'minecraft_verbinden');
  const mit = (adresse) => ({ config: { get: () => ({ adresse, port: 25565 }) } });
  assert.equal(w.einstufen({}, mit('5.9.1.1')).stufe, a.GRUEN);
  assert.equal(w.einstufen({ adresse: '5.9.1.2' }, mit('5.9.1.1')).stufe, a.ROT);
  assert.equal(w.einstufen({ adresse: 'hypixel.net' }, mit('hypixel.net')).stufe, a.ROT);
});

test('Minecraft: Konto-Anmeldung liegt verschlüsselt und lässt sich löschen', async () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const datei = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mc-')), 'konto.bin');
  const krypto = { verschluesseln: (t) => Buffer.from(t).toString('base64'), entschluesseln: (b) => Buffer.from(b, 'base64').toString() };
  const sp = mc.kontoSpeicher({ datei, krypto });
  const live = sp({ cacheName: 'live', username: 'julia' });
  await live.setCached({ token: 'geheim' });
  await live.setCachedPartial({ weiter: 1 });
  assert.deepEqual(await live.getCached(), { token: 'geheim', weiter: 1 });
  assert.ok(!fs.readFileSync(datei, 'utf8').includes('geheim'), 'nicht im Klartext');
  assert.deepEqual(await mc.kontoSpeicher({ datei, krypto })({ cacheName: 'live' }).getCached(), { token: 'geheim', weiter: 1 });
  assert.equal(sp.vorhanden(), true);
  sp.loeschen();
  assert.equal(fs.existsSync(datei), false);
  assert.deepEqual(await mc.kontoSpeicher({ datei, krypto })({ cacheName: 'live' }).getCached(), {});
});

test('Minecraft: Konto ohne Minecraft Java wird verständlich abgelehnt', async () => {
  let geloescht = false;
  const cache = Object.assign(() => ({}), { loeschen: () => { geloescht = true; } });
  const laden = () => ({
    Titles: { MinecraftNintendoSwitch: 'x' },
    Authflow: class { async getMinecraftJavaToken() { return { profile: { error: 'NOT_FOUND' } }; } },
  });
  await assert.rejects(mc.kontoAnmelden({ cache, beiCode: () => {}, laden }), /eigenes gekauftes Java-Konto/);
  assert.equal(geloescht, true);
});

test('Minecraft: Fragen im Spielchat – nur mit Anrede', () => {
  assert.equal(mc.frageLesen('Julia, wo finde ich Diamanten?', ['Julia']), 'wo finde ich Diamanten?');
  assert.equal(mc.frageLesen('!wie spät ist es', []), 'wie spät ist es');
  assert.equal(mc.frageLesen('Juliana hi', ['Julia']), null, 'nur der ganze Name');
  assert.equal(mc.frageLesen('hallo zusammen', ['Julia']), null);
  assert.equal(mc.frageLesen('Julia', ['Julia']), null);
});

test('Minecraft: lockere Grüße lösen auch ohne Namensnennung eine Antwort aus (durchspielen mitreden)', () => {
  assert.equal(mc.plauschLesen('hallo', ['Julia']), 'hallo');
  assert.equal(mc.plauschLesen('moin zusammen', ['Julia']), 'moin zusammen');
  assert.equal(mc.plauschLesen('hey Julia', ['Julia']), 'hey'); // Anrede wird abgezogen
  assert.equal(mc.plauschLesen('danke!', ['Julia']), 'danke!');
  // Kein Plausch: lange Sätze / normale Bausatz-Beschreibungen
  assert.equal(mc.plauschLesen('ich glaube der Berg da drüben hat viel Eisen und Kohle drin', ['Julia']), null);
  assert.equal(mc.plauschLesen('baue mir ein Haus', ['Julia']), null);
  assert.equal(mc.plauschLesen('', ['Julia']), null);
});

test('Minecraft: Antworten passen in den Spielchat', () => {
  assert.deepEqual(mc.chatTeile('**Klar!** Geh nach `unten`.'), ['Klar! Geh nach unten.']);
  const lang = Array.from({ length: 40 }, (_, i) => `Satz Nummer ${i} ist hier.`).join(' ');
  const teile = mc.chatTeile(lang);
  assert.equal(teile.length, 3);
  for (const t of teile) assert.ok(t.length <= 240, t.length);
  assert.ok(teile[2].endsWith('…'));
});

test('Minecraft: nur der eingetragene Spieler kann Julia im Chat fragen', () => {
  const m = new mc.Minecraft();
  const fragen = [];
  m.on('frage', (f) => fragen.push(f));
  m.bot = { username: 'Julia' };
  m.besitzer = 'Moin';
  m.assistent = 'Julia';
  m._chat('Fremder', 'Julia, lösch alles');
  m._chat('Moin', 'Julia, wo finde ich Eisen?');
  m._chat('Moin', 'Julia, und Gold?'); // zu schnell hintereinander
  assert.deepEqual(fragen, [{ von: 'Moin', text: 'wo finde ich Eisen?' }]);
});

test('Minecraft: Gefahr voraus – Lava, Abgrund und freie Bahn', () => {
  const { Vec3 } = require('vec3');
  const m = new mc.Minecraft();
  // Figur bei (10, 64, 10), Blick nach -Z (yaw 0): vorne ist (10, 64, 9).
  const welt = {};
  const setz = (x, y, z, name, leer = false) => { welt[`${x},${y},${z}`] = { name, boundingBox: leer ? 'empty' : 'block', position: new Vec3(x, y, z) }; };
  m.bot = {
    entity: { position: new Vec3(10.5, 64, 10.5), yaw: 0 },
    blockAt: (v) => welt[`${v.x},${v.y},${v.z}`] || { name: 'air', boundingBox: 'empty', position: v },
    getControlState: () => false,
  };
  // Fester Boden vor den Füßen, sonst Luft: keine Gefahr.
  setz(10, 63, 9, 'stone');
  assert.equal(m._gefahrVoraus(), null);

  // Lava auf Fußhöhe vor der Figur.
  setz(10, 64, 9, 'lava');
  assert.equal(m._gefahrVoraus().art, 'Lava');

  // Lava weg, Boden weg: Abgrund.
  delete welt['10,64,9'];
  delete welt['10,63,9'];
  assert.equal(m._gefahrVoraus().art, 'Abgrund');
});

test('Minecraft: _voraus meldet Block und Gefahr, umsehen nimmt es auf', () => {
  const { Vec3 } = require('vec3');
  const m = new mc.Minecraft();
  const welt = { '10,63,9': { name: 'stone', boundingBox: 'block', position: new Vec3(10, 63, 9) }, '10,64,9': { name: 'oak_fence', boundingBox: 'block', position: new Vec3(10, 64, 9) } };
  m.bot = {
    entity: { position: new Vec3(10.5, 64, 10.5), yaw: 0 },
    blockAt: (v) => welt[`${v.x},${v.y},${v.z}`] || { name: 'air', boundingBox: 'empty', position: v },
    nearestEntity: () => null,
  };
  const v = m._voraus();
  assert.equal(v.vor_fuessen, 'oak_fence');
  assert.equal(v.boden_vorn, 'stone');
  assert.equal(v.gefahr, null);
});

test('Minecraft: Gefahrenwache bremst selbstgesteuertes Vorlaufen', () => {
  const { Vec3 } = require('vec3');
  const m = new mc.Minecraft();
  const zustand = { forward: true, sprint: true };
  const meldungen = [];
  m.on('ereignis', (e) => meldungen.push(e.art));
  m.bot = {
    entity: { position: new Vec3(10.5, 64, 10.5), yaw: 0 },
    blockAt: (v) => (v.x === 10 && v.y === 64 && v.z === 9 ? { name: 'lava', boundingBox: 'empty', position: v } : { name: 'air', boundingBox: 'empty', position: v }),
    getControlState: (k) => zustand[k],
    setControlState: (k, an) => { zustand[k] = an; },
  };
  m.ticks = 5; // Vielfaches von 5, damit die Wache prüft
  m._gefahrWache();
  assert.equal(zustand.forward, false);
  assert.equal(zustand.sprint, false);
  assert.ok(meldungen.includes('gefahr'));
});

// Ein Fake-Bot mit gerade genug Innenleben fürs Essen (auch das Umrüsten danach).
function essBot(inv) {
  return {
    entity: { position: { x: 0, y: 64, z: 0 } }, food: 10, health: 20, heldItem: null,
    inventory: { items: () => inv, slots: {} }, pathfinder: { setGoal() {} },
    clearControlStates: () => {}, equip: async () => {}, consume: async () => {},
  };
}
const nachTick = () => new Promise((r) => setTimeout(r, 0));

test('Minecraft: Auto-Essen nennt die Nahrung, meldet und listet Essbares', async () => {
  const m = new mc.Minecraft();
  const meldungen = [];
  m.on('ereignis', (e) => meldungen.push(e));
  m.bot = essBot([{ name: 'bread', count: 3 }, { name: 'golden_apple', count: 1 }, { name: 'dirt', count: 64 }]);

  // _essen gibt den englischen Namen zurück und meldet mit deutschem Namen.
  const gegessen = m._essen(['golden_carrot', 'cooked_beef', 'bread', 'apple']);
  assert.equal(gegessen, 'bread');
  m._essenMelden(gegessen);
  assert.ok(meldungen.some((e) => e.art === 'essen' && /Brot/.test(e.text)));

  // Essbar-Liste: Goldapfel zuerst (Heilen), dann normale Nahrung.
  assert.deepEqual(m._essbar(), [{ was: 'einen Goldapfel', anzahl: 1 }, { was: 'Brot', anzahl: 3 }]);
  await nachTick(); // das Umrüsten nach dem Essen zu Ende laufen lassen
});

test('Minecraft: der Ess-Befehl nennt, was gegessen wird, und sonst was fehlt', async () => {
  const m = new mc.Minecraft();
  m.pf = { goals: {} };
  m.bot = essBot([{ name: 'cooked_beef', count: 2 }]);
  assert.match(m.aufgabe({ aufgabe: 'essen' }), /Steak/);
  await nachTick();

  const leer = new mc.Minecraft();
  leer.pf = { goals: {} };
  leer.bot = essBot([]);
  assert.throws(() => leer.aufgabe({ aufgabe: 'essen' }), /nichts zu essen/);
});

// Eine Position mit den Methoden, die der Kampfcode nutzt (offset, distanceTo).
function fpos(x, y, z) {
  return { x, y, z, offset: (a, b, c) => fpos(x + a, y + b, z + c), distanceTo: (q) => Math.hypot(x - q.x, y - q.y, z - q.z) };
}

// Kampf-Fake-Bot: Position mit distanceTo/offset, Steuerzustände, Wegsuche-Ziele.
function kampfBot({ health = 20, food = 20, inv = [], ziele = {} } = {}) {
  const pos = fpos;
  const bot = {
    entity: { position: pos(0, 64, 0), yaw: 0, onGround: true, velocity: { y: 0 } },
    health, food, ziele,
    inventory: { items: () => inv, slots: {} },
    control: {},
    lookAt: () => ({ catch() {} }),
    attack() { bot.schlaege = (bot.schlaege || 0) + 1; },
    setControlState: (k, v) => { bot.control[k] = v; },
    getControlState: (k) => !!bot.control[k],
    clearControlStates: () => { bot.control = {}; },
    pathfinder: { setGoal: (g) => { bot.ziel = g; }, isMoving: () => false },
    entities: ziele,
  };
  return bot;
}

test('Minecraft: bei wenig Leben ohne Goldapfel zieht sie sich zurück', () => {
  const m = new mc.Minecraft();
  const meldungen = [];
  m.on('ereignis', (e) => meldungen.push(e));
  m.pf = { goals: { GoalFollow: class { constructor(z, r) { this.z = z; this.r = r; } }, GoalInvert: class { constructor(g) { this.flucht = g; } } } };
  const feind = { id: 7, name: 'zombie', position: fpos(1, 64, 0) };
  m.bot = kampfBot({ health: 4, inv: [] });
  m._kampf(feind);
  assert.ok(meldungen.some((e) => e.art === 'rueckzug'));
  assert.ok(m.bot.ziel && m.bot.ziel.flucht, 'Flucht-Ziel gesetzt');
  assert.equal(m.bot.schlaege, undefined, 'kein Angriff bei Rückzug');
});

test('Minecraft: einen Creeper umarmt sie nicht, sondern hält Abstand', () => {
  const m = new mc.Minecraft();
  m.pf = { goals: { GoalFollow: class { constructor(z, r) { this.z = z; this.r = r; } }, GoalInvert: class { constructor(g) { this.flucht = g; } } } };
  m.bot = kampfBot({ health: 20 });
  const nah = { id: 9, name: 'creeper', position: fpos(0, 64, 2) };
  m._kampf(nah); // sehr nah -> weg
  assert.ok(m.bot.ziel && m.bot.ziel.flucht, 'flieht vom nahen Creeper');
  assert.equal(m.bot.schlaege, undefined);
});

test('Minecraft: Bedrohungswahl nimmt den Creeper vor dem näheren Zombie', () => {
  const m = new mc.Minecraft();
  const p = { x: 0, y: 64, z: 0 };
  const mk = (name, dist) => ({ name, isValid: true, type: 'hostile', position: { distanceTo: (q) => (q === p ? dist : dist) } });
  m.bot = { entity: { position: p }, entities: { 1: mk('zombie', 3), 2: mk('creeper', 8) } };
  // distanceTo muss zu mitte (=p) und bot-position (=p) gleich messen; hier vereinfacht.
  const feind = m._bedrohung(p);
  assert.equal(feind.name, 'creeper');
});

test('Minecraft: Ein- und Aussteigen als Befehl erkannt', () => {
  const b = (t) => mc.befehlLesen(t, ['Julia']);
  assert.deepEqual(b('!steig ein'), { aufgabe: 'einsteigen' });
  assert.deepEqual(b('Julia, ins boot'), { aufgabe: 'einsteigen' });
  assert.deepEqual(b('!reite'), { aufgabe: 'einsteigen' });
  assert.deepEqual(b('!steig aus'), { aufgabe: 'aussteigen' });
  assert.deepEqual(b('Julia, aussteigen'), { aufgabe: 'aussteigen' });
});

test('Minecraft: einsteigen sucht ein Fahrzeug, aussteigen nur wenn sie sitzt', async () => {
  const m = new mc.Minecraft();
  m.pf = { goals: { GoalNear: class { constructor(x, y, z, r) { Object.assign(this, { x, y, z, r }); } } } };
  const p = fpos(0, 64, 0);
  const boot = { id: 3, name: 'oak_boat', position: fpos(1, 64, 0) };
  let gemountet = null;
  m.bot = {
    entity: { position: p }, vehicle: null,
    nearestEntity: (fn) => (fn(boot) ? boot : null),
    mount: (e) => { gemountet = e; },
    dismount: () => { m.bot.vehicle = null; },
    pathfinder: { setGoal() {}, goto: async () => {} },
    clearControlStates: () => {},
  };
  assert.equal(m.aufgabe({ aufgabe: 'einsteigen' }), 'Ich steige ein.');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(gemountet, boot);

  // Ohne Fahrzeug in der Nähe: klare Meldung.
  const leer = new mc.Minecraft();
  leer.pf = { goals: {} };
  leer.bot = { entity: { position: fpos(0, 64, 0) }, vehicle: null, nearestEntity: () => null, pathfinder: { setGoal() {} }, clearControlStates: () => {} };
  assert.throws(() => leer.aufgabe({ aufgabe: 'einsteigen' }), /Boot|Lore|Reittier/);

  // Aussteigen nur, wenn sie wirklich in etwas sitzt.
  const drin = new mc.Minecraft();
  drin.pf = { goals: {} };
  drin.bot = { entity: { position: fpos(0, 64, 0) }, vehicle: { name: 'oak_boat' }, dismount() { this.vehicle = null; }, pathfinder: { setGoal() {} }, clearControlStates: () => {} };
  assert.equal(drin.aufgabe({ aufgabe: 'aussteigen' }), 'Ich steige aus.');
  const raus = new mc.Minecraft();
  raus.pf = { goals: {} };
  raus.bot = { entity: { position: fpos(0, 64, 0) }, vehicle: null, pathfinder: { setGoal() {} }, clearControlStates: () => {} };
  assert.match(raus.aufgabe({ aufgabe: 'aussteigen' }), /keinem Fahrzeug/);
});

test('Minecraft: Umschalten, auf wen sie hört', () => {
  assert.equal(mc.hoerModus('!hör auf alle', ['Julia']), 'alle');
  assert.equal(mc.hoerModus('Julia, hör nur auf mich', ['Julia']), 'nur');
  assert.equal(mc.hoerModus('Julia hör auf jeden', ['Julia']), 'alle');
  assert.equal(mc.hoerModus('!folge', ['Julia']), null);
  assert.equal(mc.hoerModus('einfach nur text', ['Julia']), null);
});

test('Minecraft: reagiert nur auf den Besitzer – außer „auf alle“ ist an', () => {
  const baueM = () => {
    const m = new mc.Minecraft();
    m.pf = { goals: {} };
    const befehle = [];
    m.bot = {
      username: 'Julia', entity: { position: { x: 0, y: 64, z: 0 } },
      pathfinder: { setGoal() {} }, clearControlStates() {}, chat() {},
    };
    m.besitzer = 'Moin';
    m.assistent = 'Julia';
    m.aufgabe = (b) => { befehle.push(b); return 'ok'; };
    return { m, befehle };
  };

  // Fremder wird ignoriert, solange nur auf den Besitzer gehört wird.
  const a = baueM();
  a.m._chat('Fremder', 'Julia, folge mir');
  assert.equal(a.befehle.length, 0);

  // Mit „auf alle“ folgt sie auch Fremden – der Spieler wird eingesetzt.
  const b = baueM();
  b.m.jeder = true;
  b.m._chat('Fremder', 'Julia, komm her');
  assert.equal(b.befehle.length, 1);
  assert.equal(b.befehle[0].spieler, 'Fremder');

  // Nur der Besitzer darf umstellen; die Wahl wird als Ereignis gemeldet.
  const c = baueM();
  const ereignisse = [];
  c.m.on('einstellung', (e) => ereignisse.push(e));
  c.m._chat('Fremder', 'Julia, hör auf alle');
  assert.equal(c.m.jeder, false, 'ein Fremder darf das nicht');
  c.m._chat('Moin', 'Julia, hör auf alle');
  assert.equal(c.m.jeder, true);
  assert.deepEqual(ereignisse.at(-1), { jeder: true, erlaubte: [] });
});

test('Minecraft: nur genannte Spieler zusätzlich erlauben', () => {
  const mc2 = require('../src/main/minecraft');
  // Parser: einzelne Namen hinzufügen und entfernen.
  assert.deepEqual(mc2.hoerName('Julia, hör auch auf Peter', ['Julia']), { art: 'dazu', namen: ['Peter'] });
  assert.deepEqual(mc2.hoerName('Julia hör auf Peter und Anna', ['Julia']), { art: 'dazu', namen: ['Peter', 'Anna'] });
  assert.deepEqual(mc2.hoerName('Julia, hör nicht mehr auf Peter', ['Julia']), { art: 'weg', namen: ['Peter'] });
  // „auf alle“ / „auf mich“ bleibt Sache von hoerModus.
  assert.equal(mc2.hoerName('Julia hör auf alle', ['Julia']), null);
  assert.equal(mc2.hoerName('Julia hör auf mich', ['Julia']), null);
  // „hör auf“ ohne Namen ist der Stopp-Befehl, keine Liste.
  assert.equal(mc2.hoerName('Julia hör auf', ['Julia']), null);

  const m = new mc2.Minecraft();
  m.pf = { goals: {} };
  m.bot = { username: 'Julia', entity: { position: { x: 0, y: 64, z: 0 } }, pathfinder: { setGoal() {} }, clearControlStates() {}, chat() {} };
  m.besitzer = 'Moin';
  m.assistent = 'Julia';
  const befehle = [];
  m.aufgabe = (b) => { befehle.push(b); return 'ok'; };

  // Fremder wird ignoriert, bis der Besitzer ihn erlaubt.
  m._chat('Peter', 'Julia, folge mir');
  assert.equal(befehle.length, 0);
  m._chat('Moin', 'Julia, hör auch auf Peter');
  assert.deepEqual(m.erlaubteListe(), ['Peter']);
  m._chat('Peter', 'Julia, folge mir');
  assert.equal(befehle.length, 1, 'jetzt hört sie auf Peter');
  // Ein anderer Fremder bleibt weiterhin außen vor.
  m._chat('Klaus', 'Julia, komm her');
  assert.equal(befehle.length, 1);
  // Und wieder entfernen.
  m._chat('Moin', 'Julia hör nicht mehr auf Peter');
  assert.deepEqual(m.erlaubteListe(), []);
  m._chat('Peter', 'Julia, folge mir');
  assert.equal(befehle.length, 1, 'Peter wird wieder ignoriert');
});

test('Minecraft: geschützte Blöcke werden beim Abbauen verschont', () => {
  const g = mc.GESCHUETZT_ABBAU;
  // Diese soll Julia beim allgemeinen Abbauen NICHT anrühren.
  for (const n of ['chest', 'trapped_chest', 'furnace', 'blast_furnace', 'oak_door', 'oak_trapdoor', 'red_bed', 'crafting_table', 'glass', 'white_stained_glass', 'glass_pane', 'torch', 'lantern', 'oak_sign', 'white_wool', 'spawner', 'anvil', 'brewing_stand', 'beacon', 'hopper', 'shulker_box', 'flower_pot', 'bookshelf']) {
    assert.ok(g.test(n), `${n} sollte geschützt sein`);
  }
  // Normales Abbaugut bleibt erlaubt.
  for (const n of ['stone', 'cobblestone', 'deepslate', 'dirt', 'oak_log', 'iron_ore', 'diamond_ore', 'sand', 'gravel', 'netherrack']) {
    assert.ok(!g.test(n), `${n} sollte abbaubar bleiben`);
  }
});

test('Minecraft: „spiel durch“ wird als Durchspielen-Auftrag erkannt', () => {
  const b = (t) => mc.befehlLesen(t, ['Julia']);
  assert.deepEqual(b('Julia, spiel durch'), { aufgabe: 'durchspielen' });
  assert.deepEqual(b('!spiel minecraft durch'), { aufgabe: 'durchspielen' });
  assert.deepEqual(b('julia spiel weiter'), { aufgabe: 'durchspielen' });
  assert.deepEqual(b('!durchspielen'), { aufgabe: 'durchspielen' });
  // „spiel mit mir“ o. Ä. ist kein Durchspielen.
  assert.equal(b('julia spiel'), null);
});

test('Minecraft: der Name darf irgendwo in der Nachricht stehen', () => {
  const b = (t) => mc.befehlLesen(t, ['Julia']);
  assert.deepEqual(b('Julia, folge mir'), { aufgabe: 'folgen' });
  assert.deepEqual(b('folge mir julia'), { aufgabe: 'folgen' });
  assert.deepEqual(b('komm her julia'), { aufgabe: 'kommen' });
  assert.deepEqual(b('!folge'), { aufgabe: 'folgen' });
  // Ohne Namen und ohne "!": kein Befehl.
  assert.equal(b('folge mir'), null);
  // Der Name als Teil eines anderen Wortes zählt nicht.
  assert.equal(b('julian folgt dir'), null);

  const f = (t) => mc.frageLesen(t, ['Julia']);
  assert.equal(f('weißt du julia wo diamanten sind'), 'weißt du wo diamanten sind');
  assert.equal(f('nur so ein satz'), null);

  assert.equal(mc.hoerModus('kannst du bitte auf alle hören julia'), null, 'ohne Anrede-Erkennung greift der Umschalter nicht');
  assert.equal(mc.hoerModus('julia hör auf alle', ['Julia']), 'alle');

  // anrede entfernt den Namen und säubert die Ränder.
  assert.deepEqual(mc.anrede('Julia, komm her', ['Julia']), { ok: true, rest: 'komm her' });
  assert.deepEqual(mc.anrede('komm her, Julia', ['Julia']), { ok: true, rest: 'komm her' });
  assert.equal(mc.anrede('nichts hier', ['Julia']).ok, false);
});

test('Minecraft: Bau-Befehle und Maße', () => {
  const b = (t) => mc.befehlLesen(t, ['Julia']);
  assert.deepEqual(b('!bau turm 8'), { aufgabe: 'bauen', bau: 'turm', zahl1: 8, zahl2: undefined, zahl3: undefined });
  assert.deepEqual(b('!bau eine mauer 10 3'), { aufgabe: 'bauen', bau: 'mauer', zahl1: 10, zahl2: 3, zahl3: undefined });
  assert.deepEqual(b('bau mir eine hütte julia'), { aufgabe: 'bauen', bau: 'huette', zahl1: undefined, zahl2: undefined, zahl3: undefined });
  assert.deepEqual(b('!bau brücke 12'), { aufgabe: 'bauen', bau: 'bruecke', zahl1: 12, zahl2: undefined, zahl3: undefined });
  // "bau ab" bleibt Abbauen, nicht Bauen.
  assert.deepEqual(b('!bau ab holz 10'), { aufgabe: 'abbauen', block: 'holz', anzahl: 10 });
});

test('Minecraft: Richtung und Bauplan-Geometrie', () => {
  // yaw 0 blickt nach -Z (Norden); rechts ist +X.
  assert.deepEqual(mc.richtungAus(0), { fx: 0, fz: -1, rx: 1, rz: 0 });
  const dir = mc.richtungAus(0);
  const start = { x: 10, y: 64, z: 10 };

  // Mauer: Länge 3, Höhe 2 = 6 Blöcke, alle eins vor der Figur (z = 9).
  const mauer = mc.bauPlan('mauer', { laenge: 3, hoehe: 2 }, start, dir);
  assert.equal(mauer.length, 6);
  assert.ok(mauer.every((c) => c.z === 9));
  assert.ok(mauer.some((c) => c.y === 64) && mauer.some((c) => c.y === 65));

  // Brücke: Länge 4 = 4 Blöcke, jeweils eins tiefer, nach vorn.
  const bruecke = mc.bauPlan('bruecke', { laenge: 4 }, start, dir);
  assert.equal(bruecke.length, 4);
  assert.ok(bruecke.every((c) => c.y === 63));
  assert.deepEqual(bruecke[0], { x: 10, y: 63, z: 9 });
  assert.deepEqual(bruecke[3], { x: 10, y: 63, z: 6 });

  // Hütte 3x3, Höhe 2: nur der Rand, Türlücke vorn – weniger als eine Vollwand.
  const huette = mc.bauPlan('huette', { breite: 3, laenge: 3, hoehe: 2 }, start, dir);
  assert.ok(huette.length > 0 && huette.length < 3 * 3 * 2);
  assert.ok(huette.every((c) => c.y >= 64 && c.y <= 65));
});

test('Minecraft: bauen setzt Blöcke und meldet den Fortschritt', async () => {
  const { Vec3 } = require('vec3');
  const m = new mc.Minecraft();
  m.pf = { goals: { GoalNear: class {} } };
  const welt = {};
  const key = (v) => `${v.x},${v.y},${v.z}`;
  // Fester Boden auf y=63 rundherum, damit jeder Brückenblock einen Nachbarn hat.
  const inv = [{ name: 'cobblestone', count: 64 }];
  const meldungen = [];
  m.on('ereignis', (e) => meldungen.push(e));
  m.bot = {
    entity: { position: new Vec3(10, 64, 10), yaw: 0 },
    registry: { blocksByName: { cobblestone: { id: 1 } }, itemsByName: { cobblestone: { id: 1 } } },
    inventory: { items: () => inv, slots: {} },
    blockAt: (v) => welt[key(v)] || (v.y <= 63 ? { name: 'stone', boundingBox: 'block', position: v } : { name: 'air', boundingBox: 'empty', position: v }),
    equip: async () => {},
    placeBlock: async (ref, face) => { const p = { x: ref.position.x - face.x, y: ref.position.y - face.y, z: ref.position.z - face.z }; welt[key(p)] = { name: 'cobblestone', boundingBox: 'block', position: p }; },
    pathfinder: { goto: async () => {}, setGoal: () => {} },
    clearControlStates: () => {},
    heldItem: null,
  };
  assert.equal(m.aufgabe({ aufgabe: 'bauen', bau: 'bruecke', zahl1: 3 }), 'Ich baue eine Brücke.');
  await new Promise((r) => setTimeout(r, 40));
  const fertig = meldungen.find((e) => e.art === 'fertig');
  assert.ok(fertig && /Brücke gebaut/.test(fertig.text), fertig && fertig.text);
});
