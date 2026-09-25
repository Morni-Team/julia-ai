# THUMBNAIL_STYLEGUIDE.md – Regeln für Profi-Thumbnails (Julia „Thumbnail-Studio")

> Grundlage: visuelle Analyse aktueller Thumbnails von **BastiGHG, reved, Papaplatte, Zarbex**
> (je Kanal 12 aktuelle Thumbnails lokal geladen & einzeln angesehen) plus Design-Guides
> (1of10, touhfa, ViewsMax, thumbmagic). Ziel: die **Prinzipien** anwenden, nichts 1:1 kopieren.
> Alle Pixelwerte beziehen sich auf die Standardgröße **1280×720 (16:9)**.

## 0. Format & harte Vorgaben
- Größe **1280×720**, Export JPG/PNG < 2 MB.
- **Mini-Test (Pflicht):** Muss auf **168×94 px** (Handy-Feed) in **unter 2 Sekunden** lesbar sein. Wenn Motiv oder Text dort verschwimmen → durchgefallen.
- **Ein** dominantes Motiv. Nicht zwei gleich starke Dinge, die um Aufmerksamkeit kämpfen.
- Max. **3–5 Wörter** Text, oft nur **1–3**. Text und Motiv **überlappen sich nicht**.

## 1. Komposition
- **Drittel-Regel:** Hauptmotiv (Gesicht/Figur) auf einem Drittel-Schnittpunkt, **nicht** mittig – meist Figur links **oder** rechts (~25–35 % von der Kante), Text/Objekt auf der Gegenseite.
- **30–40 % ruhige Fläche** (negative space), damit es nicht überladen wirkt.
- **Blickführung:** Figur schaut/zeigt Richtung Text oder Objekt; Pfeile/Linien lenken den Blick zum Kern.
- **Tiefe durch Ebenen (Layer-Stacking):** Hintergrund (Szene/Foto) → Mittelgrund (Objekt/Gameplay) → Vordergrund (Figur + Text). Vordergrund immer am schärfsten.

## 2. Motiv / Figur (der wichtigste Punkt)

> **GRUNDREGEL (Nutzervorgabe):** Überall, wo sonst ein **Mensch** stünde, kommt der
> **Minecraft-Skin** des Nutzers hin – **keine** realen Personenfotos. Der Skin (aus dem
> Minecraft-Namen, 3D-gerendert mit Alpha) IST das Motiv/„Gesicht" jedes Thumbnails.
> „Emotion" entsteht daher über **Pose, Szene, Effekte und Text**, nicht über ein echtes Gesicht.
> Fremde Personen aus Szenen/Screenshots werden – wo möglich – durch den Skin ersetzt/überdeckt.

- **Freistellen:** der Skin kommt bereits mit Alpha (3D-Render), sauber freigestellt.
- **Groß:** einzelne Figur **70–95 % der Höhe**; ein Gesicht (Reaction) **≥ 30 % der Bildbreite**.
- **Kontur:** **weißer Sticker-Rand 8–14 px** (≈1 % der Breite), gleichmäßig rundherum; optional zusätzlich dünne dunkle Linie außen für Absetzung.
- **Rim-/Glow:** farbiger Schein hinter der Figur (Blur 20–32 px) in der Akzentfarbe → Figur „poppt" vom Hintergrund.
- **Boden-Kontakt:** weicher Schatten-Ellipse unter der Figur, damit sie nicht schwebt.
- **Emotion (bei Gesichtern):** übertrieben – Schock, Freude, Wut, Fokus. Neutrale Gesichter floppen. Gut ausgeleuchtet, scharf.
- **Leichte Neigung** (3–6°) oder Action-Pose gibt Energie (v. a. Gaming).

## 3. Farben
- **Hohe Sättigung, hoher Kontrast.** Helles, kräftiges Motiv gegen dunkleren/entsättigten Hintergrund.
- **2–3 Farben**, davon eine **Akzentfarbe** in Komplementär-Kontrast: Orange↔Türkis, Rot↔Cyan, Lila↔Gelb, Grün↔Magenta.
- **Farb-Grade** über das ganze Bild für Zusammenhalt (reved: warm orange/rot; BastiGHG: kühl blau + Neon-Akzent).
- Hintergrund hinter Text gezielt **abdunkeln** (Verlauf 0→60 % Schwarz) für Textkontrast.
- **Vignette** 30–50 % an den Rändern → Blick zur Mitte.

## 4. Text
- **3–5 Wörter**, GROSSBUCHSTABEN, ein Schlüsselwort ggf. in Akzentfarbe hervorgehoben.
- **Schrift:** sehr fett/schwer – Montserrat ExtraBold/Black, Anton, Bebas Neue, „Arial Black" als Fallback.
- **Größe:** Hauptzeile **90–150 px** (so groß wie möglich, ohne das Motiv zu überdecken).
- **Rand (Stroke):** schwarz **8–16 px**, `lineJoin round`; darunter **Schlagschatten** (Offset ~6 px, Blur ~10 px, 55 % Schwarz).
- **Platzierung:** auf der ruhigen Fläche gegenüber der Figur, auf einem Drittel-Schnittpunkt.
- Kein langer Satz, keine kleine Schrift, keine Serifen-Fließtexte.

## 5. Effekte (sparsam, gezielt)
- Rim-Light an der Figur (heller Kantenlichtsaum, passend zur Szene).
- Pfeile/Kreise (rot/gelb) nur, wenn sie **auf den Kern** zeigen.
- Emojis (❤️😱🔥) als kleine Akzente möglich (reved nutzt Herzen) – nicht überladen.
- Leichte Tiefenunschärfe im Hintergrund, Vordergrund scharf.
- **Nie:** billige Auto-Filter, schiefer Text ohne Grund, mehr als ~4 Elemente.

## 6. Vorlagen-Typen (Presets)
- **Reaction:** großes freigestelltes Gesicht (Schock/Freude) 1 Seite, Gameplay/Szene als Hintergrund, 2–3 Wörter Text, Emoji-Akzent, warmer Grade. (reved-Schule) → Detailschema unten in **§6a**.
- **Gaming-Highlight / Minecraft:** Figur/Skin 3D freigestellt, Item/Gegner/Ziel als Objekt auf der Gegenseite (ggf. mit Rarität-Farbe/Glow), Szenen- oder Foto-Hintergrund, Marken-Logo klein in der Ecke, wenig Text. (BastiGHG-Schule)
- **Challenge / Vergleich:** zwei Zustände gegenübergestellt (z. B. „Normal" vs „Episch") mit Rahmen/Rarität-Farben, Figur reagiert darauf.
- **Cinematic / Entertainment:** ein starkes echtes Foto mit Emotion/Action, dramatisches Licht, wenig bis kein Text. (Papaplatte-Schule)

## 6a. Reaction-Thumbnail – Detailschema (aus reved & Zarbex analysiert)

Reaction ist der wichtigste Typ für diesen Kanal – deshalb genau:

> Statt realer Gesichter kommt hier **immer der Minecraft-Skin** (siehe Grundregel §2).
> „Emotion" = Pose + Glow + Text, nicht Mimik.

**Solo-Reaction (ein Skin):**
- Skin-**Bust** oder **Fullbody** freigestellt, **35–45 % der Bildbreite**, auf **einem Drittel** (links ODER rechts), oben ~5 % Rand.
- **Pose/Energie:** dynamischer Winkel (isometrisch), leichte Neigung; über dem Skin ggf. ein großes **Emoji** (😱🔥❤️) als „Emotions-Ersatz".
- Gegenüber: **Gameplay/Szene** oder das reagierte Objekt; darüber **2–3 Wörter** fetter Text.
- Rim-Glow hinter dem Skin in Kanal-Akzentfarbe, weiße Kontur 8–12 px.

**Duo-Reaction (zwei Skins, reveds Aufbau):**
- **Links UND rechts** je ein Skin-Render (z. B. zweimal derselbe Skin in **verschiedenen Posen**, oder der Skin eines zweiten genannten Spielers), mit gegensätzlicher „Stimmung" (Pose + Emoji: links 🔥, rechts 😱).
- **Mitte:** Gameplay-Ausschnitt als „Fenster".
- **Unten mittig:** großes **Spiel-/Themen-Logo** (weiß, dicker Rand). **Oben rechts:** kleiner Episoden-Marker (z. B. „2/2").
- Beide Skins gleicher Grade/Glow → Serien-Set-Look.

**Emotions-Ersatz für Skins** (da Skins nicht mimisch reagieren): passende **Pose + Overlay-Emoji + Textfarbe** je Stimmung – z. B. Schock→😱 + weite Pose, Hype→🔥 + Sprung/Action, Liebe→❤️, Fokus→ruhige Pose. Der Nutzer muss **kein** Gesichtsfoto liefern; nur seinen **Minecraft-Namen**.

**Shorts-Untertitel-Stil (Zarbex, separat – nur für Hochformat-Shorts):**
- Vertikales Video, 16:9 mit **unscharf gefülltem** Hintergrund derselben Szene.
- **Auto-Caption unten mittig**, GROSS, weiß, ein **Schlüsselwort gelb** hervorgehoben, dünner schwarzer Rand.
- **Neon-Kanal-Logo** oben rechts.
- (Das ist ein Shorts-Muster, KEIN klassisches 16:9-Thumbnail – als eigenes Preset „Short-Caption" führen.)

## 7. Was Creator unterscheidet (Stil bewahren, nicht kopieren)
- **BastiGHG:** wiedererkennbarer „Minecraft-Kopf auf realem Körper", kühl-blaue Marke + Neon-Akzent, viel Objekt-Fokus, sehr wenig Text, saubere UI-Elemente (Score-Pill, Rarität-Boxen).
- **reved:** reale Gesichts-Cutouts (oft **zwei**, mit gegensätzlicher Emotion), warmer Look, Gameplay-Fenster in der Mitte, großes Spiel-Logo unten, Episoden-Marker oben rechts; **wiederverwendbares Serien-Template** (gleicher Aufbau über eine Reihe).
- **Zarbex:** aktuell stark **Shorts** – Untertitel-Stil (ein Wort gelb) + Neon-Logo oben rechts; sein Reaction-Look lebt von echter Mimik am Mikro. Für 16:9-Reaction gilt reveds Schema.
- **Papaplatte:** cinematische Realfotos, Emotion/Action, oft ganz ohne Text.
→ Für **diesen** Kanal: eigener Look aus Kanal-Farben + (falls gesetzt) Minecraft-Skin + eigener Marken-Akzent. Keine fremden Logos/Gesichter.

## 8. Bewertungs-Rubrik (jede Kategorie 1–10, Ziel ≥ 8, ehrlich streng)
1. **Sofort-Lesbarkeit im Mini-Test** (168×94, < 2 s klar)
2. **Fokus** (ein klares Motiv, kein Gewusel)
3. **Motiv-Freistellung & Kontur** (sauber, poppt raus)
4. **Emotion/Energie** (Gesicht/Pose zieht)
5. **Farbkontrast & Sättigung** (Akzent sitzt)
6. **Textwirkung** (kurz, fett, lesbar, gut platziert)
7. **Komposition/Blickführung** (Drittel, Balance, Tiefe)
8. **Gesamt-Klick-Reiz** (würde ICH klicken?)
→ Unter 8 in einer Kategorie: verbessern und neu bewerten. Immer **neben** ein echtes Profi-Thumbnail derselben Art halten.

## 9. Eingaben, die Julia vom Nutzer braucht (sonst nachfragen)
- **Minecraft-Name** (Pflicht) – daraus wird der Skin gerendert und überall als Motiv eingesetzt. **Keine** Gesichtsfotos nötig.
- **Titel/Thema** des Videos + Typ (Reaction/Gaming/Challenge/Cinematic).
- **Screenshots/Szenen** aus dem Video (Gameplay-Moment, Objekt, Gegner) – optional; fehlt Material, generiert Julia den Hintergrund per KI-Bild aus der Beschreibung.
- Optional **Kanal-Farben/Marke** und der **Name eines zweiten Spielers** (für Duo-Reaction).
- Fehlt der Minecraft-Name oder ist ein geliefertes Bild zu klein/dunkel/unscharf → Julia sagt **genau**, was zu liefern ist.

---
*Recherche-Thumbnails liegen nur lokal (Scratchpad `thumb-recherche/`), werden NICHT ins Repo committet. Dieser Styleguide ist die Grundlage für Phase 2 (Pipeline) und Phase 3 (Qualitätsschleife).*
