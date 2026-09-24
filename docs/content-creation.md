# Content-Creation-Modul (in Arbeit)

Ein eigenständiges Julia-Modul, das aus Rohmaterial ein fertig geschnittenes Video
erstellt – **lokal** in den Adobe-Creative-Cloud-Programmen. Es meldet sich wie die
anderen Bereiche im Dashboard an (eigener Menüpunkt „Content", eigener State) und
ist über einen Schalter **unabhängig aktivierbar/deaktivierbar** (`content.aktiv`,
Standard aus). Ist es aus, wird nichts vom Modul geladen.

> Ehrlicher Anspruch: Julia liefert einen **starken, gut strukturierten Rohschnitt**
> (Hook, Tempo, Jumpcuts auf Stille, Untertitel, Musik-Ducking) plus drei
> Thumbnail-Vorschläge, den du im Zuschauen-Modus finishst – kein „Knopf → viral".
> Fremde Logos/Gesichter/Namen/Assets werden nie kopiert; Stile werden nur als
> abstrakte **Stilprofile** (Tempo, Schnittfrequenz, Hook-Länge …) nachgebildet.

## Grundsatz

- Erstellung passiert **lokal** in Premiere Pro (Schnitt), After Effects
  (Animationen), Photoshop (Thumbnails), optional Audition (Audio), Export über
  Media Encoder/Premiere. FFmpeg + XML/EDL sind **nur** Notfall-Fallback.
- **Keine Cloud-Speicherung von Mediendateien.** An die KI (Claude) gehen nur
  **Texte** (Transkripte, Pläne, Beschreibungen).

## Aufbau (Ordner)

```
src/main/content/      Modul-Kern (Hauptprozess)
  index.js             Fassade/Anmeldung
  profile.js           Creator-Profile (reine Logik + lokaler JSON-Speicher)
  schnittplan.js       Schnittplan-Format (Validierung, Entscheidungs-Übersicht)
  analyse.js           Analyse-Entscheidungen (Stille/Sprech-Segmente, Jumpcut-Regel, Hook)
src/renderer/content.js/.css   UI (Tab „Content")
```

Reine Logik (Profil, Schnittplan, Analyse) ist strikt von IO/Adaptern getrennt und
per `node --test` abgesichert (`test/content-*.test.js`).

## Datenformate

- **Creator-Profil** (`profile.js`): dauerhafte Kanal-Daten (Marke, Musik-/SFX-
  Ordner, Regeln, Stilprofile). Lokal als eine JSON-Datei, Im-/Export als JSON.
- **Schnittplan** (`schnittplan.js`): die einzige Wahrheit – Claude gibt ihn als
  JSON aus, das UI zeigt ihn lesbar, die Adapter setzen ihn um, Feedback erzeugt
  eine neue Version.

## Status / Roadmap

Gebaut (erste vertikale Scheibe):

- [x] Modul-Aktivierung + UI-Grundgerüst (Tab „Content", Schalter `content.aktiv`).
- [x] Creator-Profil-Speicher (anlegen, aktiv setzen, löschen, Import/Export).
- [x] Reine Formate/Entscheidungen: Schnittplan-Validierung, Analyse-Regeln.

Als Nächstes (aufbauend):

- [~] Konzept: `konzept.js` baut den (englischen) Prompt aus Profil+Transkript+Stil
      und löst die JSON-Antwort robust zum Schnittplan auf – Modell-Aufruf/UI folgt.
- [~] FFmpeg-Fallback: `rohschnitt.js` baut aus dem Schnittplan den FFmpeg-Befehl
      (Trim+Concat der Clips) – Ausführung/Verdrahtung folgt.
- [ ] Analyse-Pipeline (Whisper-Transkript, Stille/Peaks per FFmpeg) verdrahten.
- [ ] Adapter: Premiere (UXP), Photoshop-Thumbnails (UXP), After Effects (JSX-Vorlagen).
- [ ] Zuschauen-Modus (sichtbar, Tempo-Regler, Pause/Weiter/Abbrechen).
- [ ] Laptop-Worker + Warteschlange (LAN, kein Cloud-Relay), Laptop-Schutz.
- [ ] Feedback-Loop + Versionierung der Schnittpläne.

## Setup (kommt mit den jeweiligen Bausteinen)

Die Adobe-Plugins (Premiere/Photoshop UXP, After-Effects-JSX) verbinden sich lokal
per WebSocket auf `127.0.0.1` (Port `content.bridge_port`). Der Laptop-Worker nutzt
denselben sicheren LAN-Weg wie die Handy-Brücke (`appserver.js`: nur Heimnetz/VPN,
Token, kein offenes Internet). Genaue Installationsanleitungen folgen mit den
jeweiligen Adaptern.
