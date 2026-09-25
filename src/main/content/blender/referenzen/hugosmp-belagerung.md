# Referenz/Szene: „Held lehnt am Server-Logo, von allen Seiten angegriffen"

Wunsch Philip (2026-09-26): MoinMornhart lehnt sich lässig ans hugoSMP-Logo und wird
von vielen Seiten angegriffen (Chill-vs-Chaos-Kontrast).

## Umsetzung (funktioniert)

- **Held**: eigener Skin, `groesse` ~1.12, zentral, `pose lehnen` (Arme locker) +
  `seitneigung` ~−11 zum Schild; entspannt/cool. Größtes Motiv.
- **Schild/Logo**: dunkles Panel (`block`, dünn, hoch) mit **Servername groß als
  Text** (`logo`) + echtem Server-Icon (`logobild`) als Akzent. Held lehnt Schulter an.
- **Angreifer**: 2–3 fremde Skins, `groesse` 0.78–0.9, `pose angreifer`, von links/
  rechts/hinten, zum Held gedreht, mit Schwert/Spitzhacke. Kleiner & weiter hinten.
- **Server-Logo aus dem Netz**: `api.mcsrvstat.us/icon/<host>` liefert das echte
  64×64-Server-Icon (klein/transparent → nur Akzent). Hochauflösendes Logo = TODO.

## Vorlage

Siehe `szenen/belagerung.json` – Bauplan, den `mc_render.py` direkt rendert.

## Offen (OlixP-Politur, morgen)

Dramatisches Licht, Hintergrundtiefe/Vignette, Schlagzeilen-Overlay, Gesichtsausdruck,
hochauflösendes Logo.
