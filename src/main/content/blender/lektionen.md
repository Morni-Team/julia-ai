# Blender-Thumbnail-Lektionen (Julia)

Kurz, datiert, neueste oben. Jede Zeile: Fehler/Trick · Ursache · Lösung.
Diese Datei VOR jeder Blender-Aufgabe lesen.

## Lektionen

- **2026-09-26 · Held sah aus, als würge er sich selbst** · Die `lehnen`-Pose drehte
  den rechten Arm um die Y-Achse (−92°), dadurch klappte er quer vor Brust/Hals.
  · Lösung: Arme beim Anlehnen locker hängen lassen und die ganze Figur per
  `seitneigung` (negativ ≈ −11) zum Schild kippen, Schulter berührt das Schild.
  Kein Quer-Arm über den Körper. (Pose `posen/lehnen.json` korrigiert.)

- **2026-09-26 · Server-Logo unkenntlich (winziger Fleck)** · Das über die
  Server-Status-API (`api.mcsrvstat.us/icon/<host>`) geladene Server-Icon ist nur
  64×64 px und meist größtenteils transparent → als großes Element ein unscharfer
  Klecks. · Lösung: für ein großes, klares Logo den **Servernamen als Text** groß
  setzen und das echte Icon nur als kleinen Akzent; für echte Logo-Qualität ein
  **hochauflösendes Logo von der Server-Website** holen (TODO).

- **2026-09-26 · Angreifer wirkten verkrümmt/hunched** · Die `attack`-Pose hebt den
  Arm auf −150° (hinter den Kopf); zusammen mit der Drehung zur Zielfigur sah der
  Körper geknickt aus. · Lösung: neue Pose `angreifer` – Arm auf −128°, Rumpf per
  `spine`/`neigung` +12° nach vorn (stürmt), Beine in Ausfallschritt. Wirkt bedrohlich
  und aufrecht.

- **2026-09-26 · Angreifer größer als der Held** · Manuell platzierte Nebenfiguren
  standen näher an der Kamera → größer als das Hauptmotiv (falsch). · Lösung: Held
  zentral, `groesse` 1.1–1.2; Angreifer `groesse` 0.78–0.9 und weiter hinten/außen.
  Der Held muss IMMER das größte, klarste Motiv sein.

- **2026-09-26 · Blender löst relative Pfade zum Blend-Ordner (C:\\) auf** · Skins/
  Ausgabe landeten unter `C:\\...` (Permission denied). · Lösung: im Skript
  `os.path.abspath` für `out`/`itemdir` und `_pfad()` löst Skin-/Item-/Textur-Pfade
  gegen `itemdir`/Spec-Ordner auf. Aufrufer sollten absolute Pfade übergeben.

- **2026-09-26 · Logo-Bild (PNG mit Alpha) fast unsichtbar** · `alpha_mode
  CHANNEL_PACKED` + `blend_method CLIP` verschluckte halbtransparente Bereiche.
  · Lösung: `alpha_mode STRAIGHT` + `blend_method HASHED`; in Cycles kommt die echte
  Transparenz ohnehin über den Alpha-Eingang.

- **2026-09-26 · Schlagzeilen-Text in Blender wurde riesig/abgeschnitten** · Die
  kamerafeste 3D-Text-Platzierung ist heikel (Größe/Abstand). · Entscheidung: die
  große **Schlagzeile („TAG 1" o. ä.) als 2D-Overlay in der App** rendern (schärfer,
  zuverlässig), nicht als 3D-Text in der Szene. In Blender bleibt der 3D-Aufbau.

## Offene Punkte (morgen / OlixP-Stil)

- Dramatisches Licht statt Flachlicht: warmes Key-Licht aufs Gesicht, Rim-/Backlight,
  dunklere Umgebung, Vignette, Hintergrund mit Tiefe/Unschärfe (OlixP-Prinzip).
- Hochauflösendes Server-Logo von der Website (nicht nur 64×64-Icon).
- Schlagzeilen-Overlay (2D) in der App: Minecraft-Font, weiß, dicker schwarzer Rand,
  oberes Drittel.
- Gesichtsausdruck: austauschbare Gesichts-Textur (schockiert/wütend/cool) auf die
  Kopf-Vorderseite legen, damit die Emotion zur Szene passt.
- Grundausstattung Posen als getestete JSON vervollständigen (stehen, rennen, springen,
  jubeln, schockiert, ängstlich, wütend, nachdenklich, sitzen, abbauen …).
