import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Linking, Platform, Pressable,
  SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, useColorScheme, View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Speech from 'expo-speech';
import * as Zugriff from './modules/julia-zugriff';
import * as Bildschirm from './src/bildschirm';
import { antwortStreamen, antwortHolen, ANBIETER } from './src/anbieter';
import { frage as pcFrage, koppeln as pcKoppeln } from './src/pc';
import {
  einstellungenLesen, einstellungenSpeichern, gespraechLesen, gespraechSpeichern,
  kostenAddieren, kostenLesen, pcTokenLesen, pcTokenSpeichern, schluesselLesen, schluesselSpeichern,
} from './src/speicher';

const sprache = (code) => (code === 'en' ? 'en-US' : 'de-DE');

export default function App() {
  const dunkel = useColorScheme() === 'dark';
  const f = farben(dunkel);
  const [ansicht, setAnsicht] = useState('chat');
  const [einst, setEinst] = useState(null);
  const [schluesselDa, setSchluesselDa] = useState(false);
  const [nachrichten, setNachrichten] = useState([]);
  const [kosten, setKosten] = useState({ usd: 0, anfragen: 0 });
  const [bereit, setBereit] = useState(false);

  useEffect(() => {
    (async () => {
      const e = await einstellungenLesen();
      setEinst(e);
      setNachrichten(await gespraechLesen());
      setSchluesselDa(!!(await schluesselLesen(e.anbieter)));
      setKosten(await kostenLesen());
      setBereit(true);
    })();
  }, []);

  if (!bereit || !einst) {
    return <View style={[s.mitte, { backgroundColor: f.grund }]}><ActivityIndicator color={f.akzent} /></View>;
  }

  return (
    <SafeAreaView style={[s.flaeche, { backgroundColor: f.grund }]}>
      <StatusBar style={dunkel ? 'light' : 'dark'} />
      <View style={[s.kopf, { borderColor: f.linie }]}>
        <Text style={[s.titel, { color: f.text }]}>{einst.name || 'Julia'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          {kosten.anfragen > 0 && <Text style={{ color: f.schwach, fontSize: 12 }}>${kosten.usd.toFixed(3)} · {kosten.anfragen}</Text>}
          {ansicht === 'chat' && nachrichten.length > 0 && (
            <Pressable onPress={async () => { setNachrichten([]); await gespraechSpeichern([]); }} hitSlop={12}>
              <Text style={[s.kopfKnopf, { color: f.akzent }]}>Neu</Text>
            </Pressable>
          )}
          <Pressable onPress={() => setAnsicht(ansicht === 'chat' ? 'einstellungen' : 'chat')} hitSlop={12}>
            <Text style={[s.kopfKnopf, { color: f.akzent }]}>{ansicht === 'chat' ? '⚙︎' : '‹ Chat'}</Text>
          </Pressable>
        </View>
      </View>
      {ansicht === 'chat' && (
        <Chat
          f={f} einst={einst} schluesselDa={schluesselDa} nachrichten={nachrichten}
          setNachrichten={setNachrichten} setKosten={setKosten}
          zuEinstellungen={() => setAnsicht('einstellungen')}
        />
      )}
      {ansicht === 'einstellungen' && (
        <Einstellungen
          f={f} einst={einst}
          zuSteuerung={() => setAnsicht('steuerung')}
          beiSpeichern={async (neu, neuerSchluessel) => {
            setEinst(neu);
            await einstellungenSpeichern(neu);
            if (neuerSchluessel !== null) await schluesselSpeichern(neu.anbieter, neuerSchluessel);
            setSchluesselDa(!!(await schluesselLesen(neu.anbieter)));
            setAnsicht('chat');
          }}
        />
      )}
      {ansicht === 'steuerung' && <Steuerung f={f} einst={einst} />}
    </SafeAreaView>
  );
}

function Chat({ f, einst, schluesselDa, nachrichten, setNachrichten, setKosten, zuEinstellungen }) {
  const [text, setText] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState('');
  const liste = useRef(null);
  const xhrRef = useRef(null);

  function vorlesen(inhalt) {
    try { Speech.stop(); Speech.speak(inhalt, { language: sprache(einst.sprachcode) }); } catch { /* TTS nicht verfügbar */ }
  }

  function stopp() {
    if (xhrRef.current) { try { xhrRef.current.abort(); } catch { /* schon fertig */ } }
    try { Speech.stop(); } catch { /* egal */ }
  }

  async function senden() {
    const inhalt = text.trim();
    if (!inhalt || laeuft) return;
    setFehler('');
    // Nutzer-Nachricht plus leere Assistenten-Blase, die sich beim Streamen füllt.
    const basis = [...nachrichten, { rolle: 'user', text: inhalt }];
    setNachrichten([...basis, { rolle: 'assistant', text: '' }]);
    setText('');
    setLaeuft(true);
    const setzeAntwort = (t) => setNachrichten([...basis, { rolle: 'assistant', text: t }]);
    // Direkt über den KI-Anbieter – geht immer, auch wenn der PC aus ist.
    const direkt = async () => {
      const schluessel = await schluesselLesen(einst.anbieter);
      const r = await antwortStreamen({
        anbieter: einst.anbieter, modell: einst.modell, schluessel, einstellungen: einst, verlauf: basis,
        beiText: (t) => setzeAntwort(t),
        beiXHR: (x) => { xhrRef.current = x; },
      });
      setKosten(await kostenAddieren(r.usd || 0));
      return r.text;
    };
    try {
      let antwortText;
      if (einst.pcModus) {
        // Erst über den PC (dortige Julia samt Ampel). Ist der PC aus oder nicht
        // erreichbar, antwortet die App direkt weiter – so geht sie immer.
        try {
          const token = await pcTokenLesen();
          if (!token) throw new Error('nicht gekoppelt');
          antwortText = await pcFrage(einst.pcAdresse, token, inhalt);
          setzeAntwort(antwortText);
        } catch (pcErr) {
          if (await schluesselLesen(einst.anbieter)) {
            antwortText = await direkt(); // PC aus: nahtlos direkt weiter
          } else {
            throw new Error(`PC nicht erreichbar (${pcErr.message}) und kein API-Schlüssel hinterlegt.`);
          }
        }
      } else {
        antwortText = await direkt();
      }
      const neu = [...basis, { rolle: 'assistant', text: antwortText }];
      setNachrichten(neu);
      await gespraechSpeichern(neu);
      if (einst.vorlesen) vorlesen(antwortText);
    } catch (e) {
      if (e && e.abgebrochen) {
        // Abgebrochen: das bereits Gestreamte behalten, wenn vorhanden.
        setNachrichten((akt) => {
          const letzte = akt[akt.length - 1];
          const behalten = letzte && letzte.rolle === 'assistant' && letzte.text ? akt : basis;
          gespraechSpeichern(behalten);
          return behalten;
        });
      } else {
        setNachrichten(basis);
        await gespraechSpeichern(basis);
        setFehler(e.message || 'Etwas ist schiefgelaufen.');
      }
    } finally {
      xhrRef.current = null;
      setLaeuft(false);
    }
  }

  return (
    <KeyboardAvoidingView style={s.flaeche} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {!schluesselDa && (
        <Pressable onPress={zuEinstellungen} style={[s.hinweis, { backgroundColor: f.hinweis }]}>
          <Text style={{ color: f.text }}>Noch kein API-Schlüssel – hier eintragen, dann kann {einst.name} antworten.</Text>
        </Pressable>
      )}
      <FlatList
        ref={liste}
        style={s.flaeche}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        data={nachrichten}
        keyExtractor={(_, i) => String(i)}
        onContentSizeChange={() => liste.current && liste.current.scrollToEnd({ animated: true })}
        ListEmptyComponent={<Text style={{ color: f.schwach, textAlign: 'center', marginTop: 40 }}>Schreib {einst.name} etwas.</Text>}
        renderItem={({ item }) => {
          const ich = item.rolle === 'user';
          return (
            <View style={[s.blase, ich ? { backgroundColor: f.akzent, alignSelf: 'flex-end' } : { backgroundColor: f.karte, alignSelf: 'flex-start' }]}>
              <Text style={{ color: ich ? '#fff' : f.text }}>{item.text}</Text>
              {!ich && (
                <Pressable onPress={() => vorlesen(item.text)} hitSlop={8} style={{ marginTop: 4, alignSelf: 'flex-start' }}>
                  <Text style={{ color: f.schwach, fontSize: 12 }}>🔊 vorlesen</Text>
                </Pressable>
              )}
            </View>
          );
        }}
      />
      {laeuft && <ActivityIndicator style={{ marginBottom: 6 }} color={f.akzent} />}
      {!!fehler && <Text style={{ color: '#e5484d', paddingHorizontal: 12, paddingBottom: 6 }}>{fehler}</Text>}
      <View style={[s.eingabe, { borderColor: f.linie }]}>
        <TextInput
          style={[s.feld, { color: f.text }]}
          placeholder={`${einst.name} etwas fragen …`}
          placeholderTextColor={f.schwach}
          value={text}
          onChangeText={setText}
          multiline
        />
        {laeuft
          ? (
            <Pressable onPress={stopp} style={[s.senden, { backgroundColor: '#e5484d' }]}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>Stopp</Text>
            </Pressable>
          )
          : (
            <Pressable onPress={senden} disabled={!text.trim()} style={[s.senden, { backgroundColor: text.trim() ? f.akzent : f.karte }]}>
              <Text style={{ color: text.trim() ? '#fff' : f.schwach, fontWeight: '600' }}>Senden</Text>
            </Pressable>
          )}
      </View>
    </KeyboardAvoidingView>
  );
}

function Einstellungen({ f, einst, beiSpeichern, zuSteuerung }) {
  const [name, setName] = useState(einst.name);
  const [nutzer, setNutzer] = useState(einst.nutzer);
  const [sprachcode, setSprachcode] = useState(einst.sprachcode);
  const [anbieter, setAnbieter] = useState(einst.anbieter);
  const [modell, setModell] = useState(einst.modell);
  const [vorlesen, setVorlesen] = useState(einst.vorlesen !== false);
  const [schluessel, setSchluessel] = useState('');
  const [schluesselGeaendert, setSchluesselGeaendert] = useState(false);
  const [pcAdresse, setPcAdresse] = useState(einst.pcAdresse || '');
  const [pcModus, setPcModus] = useState(!!einst.pcModus);
  const [pcCode, setPcCode] = useState('');
  const [pcMeldung, setPcMeldung] = useState('');
  const aktiv = ANBIETER.find((a) => a.id === anbieter) || ANBIETER[0];

  async function pcKoppelnTun() {
    setPcMeldung('Verbinde …');
    try {
      const token = await pcKoppeln(pcAdresse.trim(), pcCode.trim());
      await pcTokenSpeichern(token);
      setPcCode('');
      setPcMeldung('Gekoppelt ✓');
    } catch (e) {
      setPcMeldung(e.message || 'Koppeln fehlgeschlagen.');
    }
  }

  // Anbieter gewechselt: den bisher gespeicherten Schlüssel dieses Anbieters laden (maskiert bleibt er leer).
  useEffect(() => { setSchluessel(''); setSchluesselGeaendert(false); }, [anbieter]);

  return (
    <ScrollView style={s.flaeche} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Feld f={f} label="Name der KI" wert={name} setWert={setName} platz="Julia" />
      <Feld f={f} label="Dein Name (optional)" wert={nutzer} setWert={setNutzer} platz="z. B. Morni" />

      <View style={{ gap: 6 }}>
        <Text style={[s.label, { color: f.schwach }]}>Anbieter</Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {ANBIETER.map((a) => (
            <Pressable key={a.id} onPress={() => { setAnbieter(a.id); setModell(a.standardModell); }} style={[s.wahl, { borderColor: f.linie }, anbieter === a.id && { backgroundColor: f.akzent, borderColor: f.akzent }]}>
              <Text style={{ color: anbieter === a.id ? '#fff' : f.text }}>{a.name}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Feld f={f} label="Modell" wert={modell} setWert={setModell} platz={aktiv.standardModell} />

      <View style={{ gap: 6 }}>
        <Text style={[s.label, { color: f.schwach }]}>Sprache</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[['de', 'Deutsch'], ['en', 'English']].map(([code, t]) => (
            <Pressable key={code} onPress={() => setSprachcode(code)} style={[s.wahl, { borderColor: f.linie }, sprachcode === code && { backgroundColor: f.akzent, borderColor: f.akzent }]}>
              <Text style={{ color: sprachcode === code ? '#fff' : f.text }}>{t}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[s.reihe, { borderColor: f.linie }]}>
        <Text style={{ color: f.text, fontSize: 16 }}>Antworten vorlesen</Text>
        <Switch value={vorlesen} onValueChange={setVorlesen} trackColor={{ true: f.akzent }} />
      </View>

      <View style={{ gap: 6 }}>
        <Text style={[s.label, { color: f.schwach }]}>API-Schlüssel ({aktiv.name})</Text>
        <TextInput
          style={[s.feld1, { color: f.text, borderColor: f.linie }]}
          placeholder={aktiv.schluesselHinweis}
          placeholderTextColor={f.schwach}
          value={schluessel}
          onChangeText={(t) => { setSchluessel(t); setSchluesselGeaendert(true); }}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
        <Text style={{ color: f.schwach, fontSize: 12 }}>Sicher im Android-Keystore, je Anbieter getrennt. Leer lassen ändert den gespeicherten Schlüssel nicht.</Text>
      </View>

      <View style={[s.reihe, { borderColor: f.linie }]}>
        <Text style={{ color: f.text, fontSize: 16 }}>Über den PC statt direkt</Text>
        <Switch value={pcModus} onValueChange={setPcModus} trackColor={{ true: f.akzent }} />
      </View>
      <View style={{ gap: 6 }}>
        <Text style={[s.label, { color: f.schwach }]}>Mit PC verbinden</Text>
        <TextInput style={[s.feld1, { color: f.text, borderColor: f.linie }]} value={pcAdresse} onChangeText={setPcAdresse} placeholder="192.168.1.20:8770 (oder VPN-IP)" placeholderTextColor={f.schwach} autoCapitalize="none" autoCorrect={false} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput style={[s.feld1, { flex: 1, color: f.text, borderColor: f.linie }]} value={pcCode} onChangeText={setPcCode} placeholder="Code vom PC" placeholderTextColor={f.schwach} autoCapitalize="characters" autoCorrect={false} />
          <Pressable onPress={pcKoppelnTun} disabled={!pcAdresse.trim() || !pcCode.trim()} style={[s.senden, { backgroundColor: pcAdresse.trim() && pcCode.trim() ? f.akzent : f.karte, justifyContent: 'center' }]}>
            <Text style={{ color: pcAdresse.trim() && pcCode.trim() ? '#fff' : f.schwach, fontWeight: '600' }}>Koppeln</Text>
          </Pressable>
        </View>
        {!!pcMeldung && <Text style={{ color: f.schwach, fontSize: 12 }}>{pcMeldung}</Text>}
        <Text style={{ color: f.schwach, fontSize: 12 }}>Am PC: Einstellungen → Verbindungen → Android-App → Code anzeigen. Nur Heimnetz/VPN.</Text>
      </View>

      <Pressable
        onPress={() => beiSpeichern(
          { ...einst, name: name.trim() || 'Julia', nutzer: nutzer.trim(), sprachcode, anbieter, modell: modell.trim() || aktiv.standardModell, vorlesen, pcAdresse: pcAdresse.trim(), pcModus },
          schluesselGeaendert ? schluessel.trim() : null,
        )}
        style={[s.speichern, { backgroundColor: f.akzent }]}
      >
        <Text style={{ color: '#fff', fontWeight: '700' }}>Speichern</Text>
      </Pressable>

      {Platform.OS === 'android' && (
        <Pressable onPress={zuSteuerung} style={[s.reihe, { borderColor: f.linie, marginTop: 4 }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: f.text, fontSize: 16 }}>Handy-Steuerung (BETA)</Text>
            <Text style={{ color: f.schwach, fontSize: 12, marginTop: 2 }}>Bildschirm lesen &amp; über die Bedienungshilfen steuern – jede Aktion nur mit Freigabe.</Text>
          </View>
          <Text style={{ color: f.akzent, fontSize: 18 }}>›</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

// Handy-Steuerung (Issue #6): nutzt die JS↔Native-Brücke (modules/julia-zugriff)
// zum AccessibilityService. Nur-Lesen (Bildschirm als Elementliste) ist harmlos;
// jede STEUERNDE Aktion läuft über eine ausdrückliche Freigabe (Bestätigungs-
// dialog) – dasselbe Prinzip wie die Ampel am PC. Ist der Dienst nicht in den
// Android-Bedienungshilfen eingeschaltet, führt hier nichts etwas aus.
function Steuerung({ f, einst }) {
  const [aktiv, setAktiv] = useState(false);
  const [elemente, setElemente] = useState([]);
  const [meldung, setMeldung] = useState('');
  const [ziel, setZiel] = useState('');
  const [denkt, setDenkt] = useState(false);

  function statusPruefen() {
    try { setAktiv(Zugriff.dienstLaeuft()); } catch { setAktiv(false); }
  }
  useEffect(() => { statusPruefen(); }, []);

  // Eine geparste Aktion tatsächlich ausführen (nach Freigabe). Bildet die knappe
  // KI-Aktion auf die native Brücke ab: bevorzugt per Text (robuster), sonst per
  // Koordinate. Gibt eine kurze Rückmeldung.
  function ausfuehren(aktion, digest) {
    const e = aktion.n ? digest.find((d) => d.n === aktion.n) : null;
    try {
      let ok = false;
      switch (aktion.art) {
        case 'klick':
          if (!e) { setMeldung(`Element ${aktion.n} gibt es nicht.`); return; }
          ok = e.hatText ? Zugriff.klickText(e.label) : Zugriff.klickKoordinaten(e.x, e.y);
          break;
        case 'tippe': ok = Zugriff.textEingeben(aktion.text || ''); break;
        case 'scroll': ok = Zugriff.scrollen(!!aktion.vorwaerts); break;
        case 'zurueck': ok = Zugriff.zurueck(); break;
        case 'start': ok = Zugriff.startseite(); break;
        case 'apps': ok = Zugriff.letzteApps(); break;
        default: setMeldung('Unbekannte Aktion – nichts getan.'); return;
      }
      setMeldung(ok ? `Ausgeführt: ${Bildschirm.aktionText(aktion, digest)}` : `Nicht möglich: ${Bildschirm.aktionText(aktion, digest)}`);
    } catch (err) {
      setMeldung('Fehler: ' + (err && err.message ? err.message : 'unbekannt'));
    }
  }

  // Ein KI-Schritt: Bildschirm lesen → verdichten → KI fragt EIN Kommando → nach
  // Freigabe ausführen. Jeder steuernde Schritt bleibt hinter der Ampel.
  async function naechsterSchritt() {
    if (!aktiv) { setMeldung('Erst den Dienst in den Bedienungshilfen einschalten.'); return; }
    if (!ziel.trim()) { setMeldung('Sag zuerst, was Julia tun soll (Ziel eingeben).'); return; }
    setDenkt(true);
    setMeldung('Julia schaut auf den Bildschirm …');
    try {
      const roh = Zugriff.bildschirmLesen();
      const digest = Bildschirm.verdichten(Array.isArray(roh) ? roh : []);
      setElemente(digest);
      const schluessel = await schluesselLesen(einst.anbieter);
      if (!schluessel) { setMeldung('Kein API-Schlüssel hinterlegt – in den Einstellungen eintragen.'); return; }
      const r = await antwortHolen({
        anbieter: einst.anbieter, modell: einst.modell, schluessel, einstellungen: einst,
        system: Bildschirm.steuerPrompt({ sprachcode: einst.sprachcode }),
        verlauf: [{ rolle: 'user', text: `Ziel: ${ziel.trim()}\n\nBildschirm:\n${Bildschirm.alsText(digest)}` }],
      });
      const aktion = Bildschirm.aktionLesen(r.text);
      if (aktion.art === 'fertig') { setMeldung('Julia: ' + (aktion.text || 'fertig.')); return; }
      if (aktion.art === 'unbekannt') { setMeldung('Julia war unklar: ' + (r.text || '').slice(0, 120)); return; }
      Alert.alert(
        'Aktion freigeben',
        `${Bildschirm.aktionText(aktion, digest)}\n\nJulia führt diese Steuerung nur mit deiner Freigabe aus.`,
        [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Freigeben', onPress: () => ausfuehren(aktion, digest) },
        ],
      );
    } catch (err) {
      setMeldung('Fehler: ' + (err && err.message ? err.message : 'unbekannt'));
    } finally {
      setDenkt(false);
    }
  }

  function bedienungshilfenOeffnen() {
    // Direkt zur Android-Bedienungshilfen-Seite; dort „Julia" einschalten.
    Linking.sendIntent('android.settings.ACCESSIBILITY_SETTINGS').catch(() => {
      Linking.openSettings().catch(() => setMeldung('Konnte die Einstellungen nicht öffnen.'));
    });
  }

  function lesen() {
    try {
      const roh = Zugriff.bildschirmLesen();
      const digest = Bildschirm.verdichten(Array.isArray(roh) ? roh : []);
      setElemente(digest);
      setMeldung(`${digest.length} bedienbare Elemente erkannt.`);
    } catch (err) {
      setElemente([]);
      setMeldung('Lesen nicht möglich' + (err && err.message ? `: ${err.message}` : '.'));
    }
  }

  // Eine steuernde Aktion nur nach ausdrücklicher Freigabe ausführen (Ampel-Prinzip).
  function mitFreigabe(was, tun) {
    if (!aktiv) { setMeldung('Erst den Dienst in den Bedienungshilfen einschalten.'); return; }
    Alert.alert(
      'Aktion freigeben',
      `${was}\n\nJulia führt diese Steuerung nur mit deiner Freigabe aus.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Freigeben',
          onPress: () => {
            try {
              const ok = tun();
              setMeldung(ok ? `„${was}" ausgeführt.` : `„${was}" war nicht möglich.`);
            } catch (err) {
              setMeldung('Fehler: ' + (err && err.message ? err.message : 'unbekannt'));
            }
          },
        },
      ],
    );
  }

  return (
    <ScrollView style={s.flaeche} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <View style={[s.reihe, { borderColor: f.linie }]}>
        <Text style={{ color: f.text, fontSize: 16 }}>Dienst {aktiv ? 'aktiv ✓' : 'aus'}</Text>
        <Pressable onPress={statusPruefen} hitSlop={10}><Text style={{ color: f.akzent, fontWeight: '600' }}>Aktualisieren</Text></Pressable>
      </View>

      {!aktiv && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: f.schwach }}>Schalte in den Android-Bedienungshilfen den Dienst „Julia" ein, dann kann sie den Bildschirm lesen und (nur mit Freigabe) steuern.</Text>
          <Pressable onPress={bedienungshilfenOeffnen} style={[s.speichern, { backgroundColor: f.akzent }]}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Bedienungshilfen öffnen</Text>
          </Pressable>
        </View>
      )}

      {/* KI-gesteuert (Issue #6): Ziel sagen → Julia liest den Bildschirm und
          schlägt EINE Aktion vor, die erst nach Freigabe ausgeführt wird. */}
      <View style={{ gap: 8 }}>
        <Text style={[s.label, { color: f.schwach }]}>Julia steuern lassen</Text>
        <TextInput
          style={[s.feld1, { color: f.text, borderColor: f.linie }]}
          placeholder="Was soll Julia tun? z. B. Öffne die Einstellungen"
          placeholderTextColor={f.schwach}
          value={ziel}
          onChangeText={setZiel}
        />
        <Pressable onPress={naechsterSchritt} disabled={denkt} style={[s.speichern, { backgroundColor: denkt ? f.karte : f.akzent }]}>
          <Text style={{ color: denkt ? f.schwach : '#fff', fontWeight: '700' }}>{denkt ? 'Julia denkt …' : 'Nächster Schritt'}</Text>
        </Pressable>
        <Text style={{ color: f.schwach, fontSize: 12 }}>Julia schlägt jeweils einen Schritt vor; jede steuernde Aktion musst du einzeln freigeben. Danach erneut „Nächster Schritt".</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Pressable onPress={lesen} style={[s.wahl, { borderColor: f.akzent, backgroundColor: f.akzent }]}><Text style={{ color: '#fff' }}>Bildschirm lesen</Text></Pressable>
        <Pressable onPress={() => mitFreigabe('Zurück', () => Zugriff.zurueck())} style={[s.wahl, { borderColor: f.linie }]}><Text style={{ color: f.text }}>Zurück</Text></Pressable>
        <Pressable onPress={() => mitFreigabe('Startseite', () => Zugriff.startseite())} style={[s.wahl, { borderColor: f.linie }]}><Text style={{ color: f.text }}>Startseite</Text></Pressable>
        <Pressable onPress={() => mitFreigabe('Nach unten scrollen', () => Zugriff.scrollen(true))} style={[s.wahl, { borderColor: f.linie }]}><Text style={{ color: f.text }}>Scrollen ↓</Text></Pressable>
      </View>

      {!!meldung && <Text style={{ color: f.schwach, fontSize: 13 }}>{meldung}</Text>}

      {elemente.map((e, i) => (
        <View key={i} style={[s.blase, { backgroundColor: f.karte, alignSelf: 'stretch', maxWidth: '100%' }]}>
          <Text style={{ color: f.text }} numberOfLines={2}>{e.n}. {e.label}</Text>
          <Text style={{ color: f.schwach, fontSize: 11, marginTop: 2 }}>
            {e.rolle}{e.hatText ? '' : ' · per Koordinate'} · {e.x},{e.y}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

function Feld({ f, label, wert, setWert, platz }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={[s.label, { color: f.schwach }]}>{label}</Text>
      <TextInput style={[s.feld1, { color: f.text, borderColor: f.linie }]} value={wert} onChangeText={setWert} placeholder={platz} placeholderTextColor={f.schwach} autoCapitalize="none" />
    </View>
  );
}

function farben(dunkel) {
  return dunkel
    ? { grund: '#0e0f13', karte: '#1b1d24', hinweis: '#2a2410', text: '#f2f3f5', schwach: '#8a8f98', linie: '#2a2d36', akzent: '#6b5cff' }
    : { grund: '#f6f7f9', karte: '#ffffff', hinweis: '#fff7e0', text: '#14161a', schwach: '#6b7280', linie: '#e3e5ea', akzent: '#6b5cff' };
}

const s = StyleSheet.create({
  flaeche: { flex: 1 },
  mitte: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  kopf: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  titel: { fontSize: 18, fontWeight: '700' },
  kopfKnopf: { fontSize: 16, fontWeight: '600' },
  hinweis: { padding: 12, margin: 12, borderRadius: 10 },
  blase: { maxWidth: '86%', padding: 10, borderRadius: 14 },
  eingabe: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 8, borderTopWidth: StyleSheet.hairlineWidth },
  feld: { flex: 1, maxHeight: 120, paddingHorizontal: 12, paddingVertical: 8, fontSize: 16 },
  senden: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  label: { fontSize: 13, fontWeight: '600' },
  feld1: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  wahl: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  reihe: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  speichern: { padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
});
