# Changelog

## 6.8.1 – 2026-09-24
- Updates gehen wieder - die Update-Pruefung lief ueber die rate-limitierte GitHub-API und schlug mit 403 fehl (keine Updates/Patches mehr); jetzt laeuft Pruefung und Download ueber die nicht limitierte Release-Download-URL, der Installer wird weiter per Pruefsumme abgesichert

## 6.8.0 – 2026-09-24
- Minecraft-Persoenlichkeit menschlicher (BETA) - die KI nebenbei antwortet im Spielchat wie ein echter Mitspieler: kurz, locker, spiegelt Ton und Slang, keine KI-Floskeln oder Belehrungen mehr, darf frech kontern oder Nein sagen

## 6.7.0 – 2026-09-23
- App-Anbindungen entfernt - die Integrationen der eigenen Apps (ToDoch, Streamo, VibeWork/VibeWorks, Patchfeld, Codewerk, Content-Helper) samt apps-Werkzeug, VibeWorks-Login und zugehoerigen Einstellungen sind komplett raus; MCP-Server-Support und Handy-App-Verbindung bleiben

## 6.6.1 – 2026-09-23
- Minecraft-Chat entspammt - Julia schreibt beim autonomen Durchspielen nicht mehr ihre ganze Erzaehlung in den Spielchat, sondern antwortet dort standardmaessig nur, wenn ihr jemand schreibt; mit neuem Schalter Von sich aus im Spielchat mitreden

## 6.6.0 – 2026-09-23
- Updates mit doppeltem Boden - nach einem Update prueft Julia, ob die neue Version wirklich laeuft, wiederholt die Installation notfalls einmal automatisch und haelt den Installer der letzten funktionierenden Version als Backup fuer einen Rollback bereit

## 6.5.0 – 2026-09-23
- Leeres Fenster nach Updates behoben (GPU-Prozess wird notfalls komplett abgeschaltet, wenn selbst der Software-Modus abstuerzt) und Julia kann jetzt beim Durchspielen parallel im Chat mitreden - kurze Gruesse wie hallo beantwortet sie auch ohne Namensnennung, ohne die laufende Aufgabe zu unterbrechen

## 6.4.0 – 2026-09-23
- Minecraft-Grenzen, Budget und Ruhezeiten (BETA) - Julia macht bei zu nervigen Spielern eine Pause und ignoriert sie eine Weile, haelt ein einstellbares Token-Limit fuers Plaudern ein und verabschiedet sich beim Erreichen, kann selbstgesetzte Ruhezeiten haben und merkt sich sparsam die Base eines Spielers

## 6.3.1 – 2026-09-23
- Updates zuverlaessiger - neuer Knopf in den Einstellungen traegt Julias eigene Ordner als Windows-Defender-Ausnahme ein (mit Admin-Nachfrage), damit das Auto-Update nicht mehr an gesperrten Dateien scheitert

## 6.3.0 – 2026-09-23
- Minecraft-Persoenlichkeit und Beziehungen (BETA) - Julia merkt sich pro Spieler wie nett oder gemein jemand war, baut Vertrauen auf, ist skeptisch bei unrealistischer Prahlerei oder Cheat-Verdacht, laesst sich nicht ausnutzen und darf freundlich, kuehl oder auch mal nein reagieren; Grundton waehlbar, standardmaessig aus

## 6.2.0 – 2026-09-23
- Minecraft klueger im Kampf - Julia zieht sich bei Unterzahl oder wenig Leben zurueck und regeneriert statt dumm zu sterben, spart den seltenen verzauberten Goldapfel fuer Notfaelle, craftet auf Zuruf volle Ruestung in der besten Stufe, und eine leichte KI nebenbei beantwortet Fragen im Spielchat auch waehrend sie baut oder kaempft

## 6.1.0 – 2026-09-22
- Wissensgraph als strukturiertes Langzeit-Gedaechtnis - Julia merkt sich Bausteine (Personen, Projekte, Apps) mit Notizen und Verknuepfungen zwischen ihnen und kann Zusammenhaenge gezielt nachschlagen und ergaenzen (rein lokal, keine Zugangsdaten)

## 6.0.3 – 2026-09-20
- Mikro sagt jetzt Bescheid, wenn nichts verstanden wurde (klarer Hinweis statt stillem Zurueckspringen), und faellt bei leerem Whisper-Ergebnis auf die Windows-Erkennung zurueck statt den Satz zu verwerfen

## 6.0.2 – 2026-09-20
- Mikro blockiert nicht mehr dauerhaft - haengt die Spracherkennung, gibt Julia das Mikro nach kurzer Zeit von selbst wieder frei; zusaetzlich genaue Mikro-Diagnose ins Start-Logbuch, um das Problem gezielt einzukreisen

## 6.0.1 – 2026-09-20
- Mikro schneidet dich nicht mehr mitten im Satz ab - bei einer kurzen Denkpause endete die Aufnahme bisher schon nach 1 Sekunde; Julia wartet jetzt laenger (Standard 1,6 s) und die Sprechpause ist in den Sprach-Einstellungen einstellbar

## 6.0.0 – 2026-09-19
- Julia ueberlebt in Minecraft laenger - sie isst rechtzeitig und haelt die Saettigung hoch, damit sich Leben regeneriert (Goldapfel frueher), und sucht beim Jagen in groesserem Umkreis nach Tieren

## 5.9.9 – 2026-09-19
- Im Minecraft-Tab lassen sich jetzt einzelne Spieler eintragen, auf die Julia zusaetzlich hoert (Hinzufuegen und Entfernen, gilt sofort), und die Chat-Nachrichten im Tab per Schalter ausblenden

## 5.9.8 – 2026-09-19
- Julia kann in Minecraft schwimmen (taucht bei wenig Luft von selbst auf, ertrinkt nicht mehr) und bleibt beim Laufen seltener haengen - klemmt sie an einem Hindernis, berechnet sie den Weg neu und laeuft aussenrum

## 5.9.7 – 2026-09-19
- Julia geht in Minecraft sparsamer mit Werkbank und Ofen um - hat sie schon eine dabei oder steht eine in der Naehe, nutzt sie die statt jedes Mal eine neue zu bauen

## 5.9.6 – 2026-09-19
- Julia faengt in Minecraft tiefe Stuerze mit dem Wassereimer ab (Water-MLG) und zeigt das Inventar jetzt als eigenen, uebersichtlichen Bereich mit Gegenstaenden als Chips

## 5.9.5 – 2026-09-19
- Julia bleibt beim Herstellen in Minecraft nicht mehr haengen - nach einem Server-Timeout prueft sie am Inventar, ob der Gegenstand doch hergestellt wurde, und macht weiter statt es mehrfach je 20 Sekunden zu wiederholen

## 5.9.4 – 2026-09-19
- Julia kann in Minecraft mit dem Eimer umgehen (Wasser/Lava aufnehmen und setzen, Milch trinken) und bleibt nach dem Verlassen-Knopf sicher weg - von selbst kommt sie nur nach echtem Absturz oder Rauswurf zurueck

## 5.9.3 – 2026-09-19
- Minecraft-Tab zeigt jetzt Julias Inventar (was sie dabeihat) neben Leben, Hunger, Ort und Aufgabe

## 5.9.2 – 2026-09-19
- Minecraft kaempft besser gegen Mobs - reagiert frueher auf Gegner (Fernkaempfer wie Skelette/Hexen aus groesserer Entfernung, Creeper frueh) und geht in einer Gruppe zuerst den gefaehrlichsten Mob an statt nur den naechsten

## 5.9.1 – 2026-09-19
- Schnitt-Tab (frueher Video) oeffnet sich jetzt - er war beim Anklicken leer, weil der Bereich intern nicht registriert war; Tab in Schnitt umbenannt

## 5.9.0 – 2026-09-19
- Video-Schneiden funktioniert jetzt wirklich - der Video-Tab laedt ffmpeg bei Bedarf einmalig herunter (~79 MB, mit Fortschritt und Pruefsumme) statt es in den Installer zu packen; danach gehen Schneiden und Thumbnails offline

## 5.8.1 – 2026-09-18
- Mikro-Hotkey und Weckwort Hey Julia gehen wieder zuverlaessig (haengengebliebener Vorleser-Zaehler machte Julia dauerhaft zu spricht gerade); Google-Fehler 403 access_denied erklaert jetzt den Testnutzer-Schritt statt nur abgelehnt

## 5.8.0 – 2026-09-18
- Eigener Video-Tab zum Schneiden - Videos schneiden und Thumbnails gibt es jetzt als eigenen Bereich (Datei waehlen, Von-Bis, Schneiden, Thumbnail, Ergebnisliste mit Im-Ordner-zeigen), komplett lokal ueber ffmpeg statt nur im Chat

## 5.7.1 – 2026-09-18
- Minecraft-Antworten und -Aktionen erscheinen nicht mehr im Gaming-Overlay und der schwebenden Blase, sondern bleiben im Fenster (Chat/Minecraft-Tab); wichtige Rueckfragen bleiben sichtbar

## 5.7.0 – 2026-09-18
- Automatische Updates gehen wieder (Projekt-Umzug auf Morni-Team/julia-ai nachgezogen); Minecraft verbindet sich nach einem Rauswurf/Kick von selbst neu, ausser bei Bann/Whitelist/Version/Fliegen; Outlook-Anmeldung erklaert AADSTS90072 klar und weist versehentlich eingetragene Microsoft-eigene App-IDs (z. B. Azure-Portal) ab

## 5.6.0 – 2026-09-18
- Nicht mehr staendig Benachrichtigungen beim Minecraft-Bauen - Julia meldet standardmaessig nur noch Wichtiges (getrennt, gestorben, Gefahr, Ziel erreicht); im Minecraft-Bereich umstellbar auf Alle/Nur Wichtiges/Keine, die Ansicht zeigt weiter alles live

## 5.5.4 – 2026-09-18
- Doppelte MCP-Server werden entdoppelt (z. B. VibeWorks stand doppelt) - beim Hinzufuegen/Import und einmalig beim Start

## 5.5.3 – 2026-09-18
- Anzeigefehler behoben - im Overlay/Titel stand woertlich {name} statt des Assistenten-Namens (Nachwirkung der Not-Fuellung); der Platzhalter wird jetzt korrekt durch den Namen ersetzt

## 5.5.2 – 2026-09-18
- Leeres Fenster wirklich behoben - die mitgelieferten Texte erreichten im gepackten Build das (gesandboxte) Fenster nicht, weshalb die Beschriftungen leer blieben und Julia falschlich Neustart/FATAL ausloeste; die Texte kommen jetzt zuverlaessig per IPC, die Oberflaeche wird notfalls selbst gefuellt, und ein Verdacht auf leere Beschriftungen loest nie mehr Neustart oder die Meldung Oberflaeche bleibt leer aus

## 5.5.1 – 2026-09-18
- Leeres Fenster endgueltig geloest - die Oberflaeche wird notfalls direkt aus den mitgelieferten Texten gefuellt (im Preload, unabhaengig von der empfindlichen Renderer-Kette), sofort beim Laden und noch einmal bevor ueberhaupt ein leeres Fenster angenommen wird; damit ist das Fenster beschriftet, selbst wenn auf dem PC sonst etwas hakt - keine Neustart-Schleife mehr

## 5.5.0 – 2026-09-18
- Grosses Robustheits-Update - Julia startet jetzt auch auf schwaecheren/zickigen PCs sicher: ein globaler Fangschirm faengt unerwartete Fehler ab (beim Start klare Meldung statt stummem Absturz, im Betrieb laeuft Julia weiter statt ganz abzustuerzen), und bei gesperrtem Datenordner weicht sie automatisch auf einen Ersatzordner aus, statt am Start zu scheitern

## 5.4.1 – 2026-09-17
- Die Gedanken-Box erscheint jetzt sofort beim Antwortstart und fuellt sich live (verschwindet wieder, wenn kein Denk-Schritt kommt); zusaetzlich laesst sich der Denkaufwand jetzt auch bei OpenAI-kompatiblen Anbietern einstellen (als reasoning_effort, mit automatischem Weglassen, wenn ein Modell ihn nicht kennt)

## 5.4.0 – 2026-09-17
- Ein einziges Merk-System - Gedaechtnis und Lern-Notizen sind zu EINER Werkzeug-Gruppe zusammengefuehrt (6 Werkzeuge auf 3): standard global, mit Schalter projekt die projektbezogenen Notizen; weniger Werkzeuge, schneller und tokenschonender, ohne Datenverlust

## 5.3.2 – 2026-09-17
- Auto-Update laeuft wieder zuverlaessig (der Installer schoss sich beim harten Beenden nicht mehr selbst mit ab) und der Denk-Schritt erscheint jetzt auch bei OpenAI-kompatiblen Anbietern, die Reasoning mitsenden

## 5.3.1 – 2026-09-17
- Leeres Fenster endgueltig behoben - die Beschriftungen werden jetzt sofort beim Start aus mitgelieferten Texten gesetzt, unabhaengig von IPC/Init; damit bleibt das Fenster auf keinem PC mehr leer und die Neustart-Schleife ist weg

## 5.3.0 – 2026-09-17
- Videos schneiden und Thumbnails - Julia kann auf Zuruf Videos schneiden/trimmen, mehrere zusammenfuegen und Standbilder (Thumbnails) erstellen; lokal per ffmpeg, jede neue Datei einmal freigeben, in der abschaltbaren Kategorie Videos

## 5.2.1 – 2026-09-17
- Leeres Fenster auf langsamen PCs behoben - Julia holt die zwei Start-Infos jetzt parallel (schneller startklar) und wartet laenger, bevor sie ein leeres Fenster annimmt; das beendet die Neustart-Schleife auf langsamen oder grafiktreiber-zickigen Rechnern

## 5.2.0 – 2026-09-17
- MCP-Server per Drag-and-Drop hinzufuegen - zieh eine mcp.json in die MCP-Einstellungen (oder klick zum Auswaehlen), Julia erkennt die enthaltenen Server (mcpServers-Stil, lokale Programme und Web-Adressen) und uebernimmt sie; alles weiter ueber die Ampel

## 5.1.0 – 2026-09-17
- Werkzeuge abschalten macht Julia wirklich schneller - abgeschaltete Werkzeuge gehen gar nicht mehr ans Modell (vorher nur die Nutzung blockiert), und du kannst jetzt ganze Gruppen auf einmal ab-/anschalten; weniger Werkzeuge = schnellere, tokenschonendere Antworten

## 5.0.1 – 2026-09-17
- Julia antwortet spuerbar schneller - der Standard-Denkaufwand ist jetzt mittel statt hoch (gute Antworten, deutlich flotter); wer mehr Tiefe will, stellt den Denkaufwand in den Einstellungen wieder hoeher

## 5.0.0 – 2026-09-17
- Denk-Schritt sichtbar - waehrend Julia nachdenkt, erscheint eine eingeklappte Box mit ihrem Reasoning (zum Aufklappen), statt nur arbeitet; wie viel sie nachdenkt, stellst du ueber den Denkaufwand in den Einstellungen ein

## 4.9.3 – 2026-09-17
- Minecraft - Steck-Stellen landen im lokalen Logbuch; gibt Julia an einem Hindernis auf, notiert sie die Stelle mit Koordinaten, damit sich solche Punkte hinterher gezielt nachvollziehen lassen

## 4.9.2 – 2026-09-17
- Minecraft - kein endloses Springen an einer Stelle mehr; bleibt Julia beim selbst Vorlaufen an einem Hindernis haengen und kommt nach mehreren Spruengen nicht voran, hoert sie auf zu druecken statt endlos auf der Stelle zu springen, und der naechste Schritt sucht einen neuen Weg

## 4.9.1 – 2026-09-17
- Absturz beim Start behoben - auf manchen Rechnern lud die Oberflaeche nicht mehr, weil sich zwei Skripte im Chatfenster denselben Namen teilten (doppeltes mitZeitlimit/md) und das Haupt-Skript abbrach; zusaetzlich ein Test, der solche Skript-Kollisionen kuenftig verhindert

## 4.9.0 – 2026-09-17
- VibeWorks-Anmeldung per Konto ohne Schluessel-Kopieren - Julia holt sich per Geraete-Anmeldung selbst einen Code, du erlaubst den Zugriff einmal auf der VibeWorks-Seite, fertig; der Zugang liegt nur verschluesselt auf dem PC und wird der KI nie gezeigt

## 4.8.1 – 2026-09-17
- VibeWorks-Anmeldung friert nicht mehr ein - haengt der Server, bricht Julia die Schluessel-Pruefung nach kurzer Zeit sauber ab und zeigt einen Netz-Hinweis, statt dass die Anmelde-Box ewig laedt

## 4.8.0 – 2026-09-17
- Agenten mit Pruefer-Schleife (BETA): Julia kann eine Aufgabe im Zusammenspiel zweier Rollen loesen - eine Ersteller-Rolle macht einen Entwurf, eine Pruefer-Rolle kritisiert ihn gegen das Ziel, es wird nachgebessert, bis der Pruefer zufrieden ist oder die kleine Rundenzahl erreicht ist; beide Rollen denken nur, kein PC-Zugriff, nur bei eingeschalteten BETA-Agenten

## 4.7.0 – 2026-09-17
- Agenten-Rollen delegieren (BETA): Julia kann eine fokussierte Teilaufgabe an eine deiner Rollen abgeben (z. B. Kritiker oder Rechercheur um eine Zweitmeinung bitten) und deren Antwort nutzen - der Rollen-Agent denkt nur nach, hat keinen PC-Zugriff und keine Werkzeuge, und das Werkzeug gibt es nur bei eingeschalteten BETA-Agenten

## 4.6.0 – 2026-09-17
- Agenten-Rollen als BETA-Feature: im BETA-Bereich lassen sich eigene, spezialisierte Julias anlegen (Name + Zusatz-Anweisung, z. B. Coder oder Rechercheur); die aktive Rolle praegt das Verhalten zusaetzlich - komplett versteckt wenn BETA aus, Sicherheit/Ampel unberuehrt, und die KI kann Rollen nicht selbst anlegen oder aktivieren

## 4.5.1 – 2026-09-17
- Sicherheit erneut nachgeschaerft nach einem Repo-Check: unsichtbare Steuerzeichen stehen im Quelltext nur noch als lesbare Escapes, und das Aendern von Einstellungen ist zusaetzlich gegen manipulierte Sonderschluessel abgesichert

## 4.5.0 – 2026-09-16
- Mehrstufige Grafik-Rettung bei zickigen Treibern: bleibt das Fenster leer, probiert Julia automatisch nacheinander andere Grafik-Verfahren durch (aeltere/vertraeglichere Treiber, OpenGL, reiner Software-Renderer, zuletzt ganz ohne GPU) und merkt sich das funktionierende - kein eigener Renderer noetig, das ist der professionelle Weg

## 4.4.2 – 2026-09-16
- Behebt die Neustart-Schleife bei leerem Fenster (die Selbstheilung wartet jetzt, bis die Oberflaeche sich zur Not mit Ersatz-Beschriftungen aufbauen konnte; echte Texte werden im Hintergrund nachgeladen) und macht die Einstellungen wieder mit dem Mausrad scrollbar

## 4.4.1 – 2026-09-16
- Treiber-Hinweis bei Grafikproblemen: meldet die Grafikkarte keine Treiber-Infos, zeigt Julia in der Reparatur-Sektion einen Link zur offiziellen Treiberseite des Herstellers (NVIDIA/AMD/Intel) - installiert wird nichts von selbst, du entscheidest

## 4.4.0 – 2026-09-16
- Ein-Klick-Grafik-Reparatur in den Einstellungen: bleibt das Fenster leer oder flackert es, stellt Julia auf deinen Klick auf Software-Grafik um und startet neu (umkehrbar, ohne Eingriff ins System) - der Rettungsanker, den Technik-Profis mit --disable-gpu machen

## 4.3.2 – 2026-09-16
- Die woechentliche Selbstpruefung erkennt jetzt auch Grafikprobleme (leere Fenster, degradierte Grafiktreiber), nicht nur Abstuerze - gemeldet weiter nur mit Zustimmung und bereinigt, nie IP oder Tokens

## 4.3.1 – 2026-09-16
- Leeres Fenster heilt sich jetzt auch bei Grafik-Problemen selbst: bleibt die Oberflaeche leer (ohne gemeldeten Absturz), stellt Julia automatisch auf Software-Grafik um und startet einmal neu - plus deutlich mehr Start-Logging, um solche Faelle schneller einzugrenzen

## 4.3.0 – 2026-09-16
- Sehr lange Gespraeche bleiben schlank: Julia behaelt automatisch nur die juengsten Runden im aktiven Kontext (uralte fallen weg), damit die Kosten nicht immer weiter steigen - an einer sicheren Stelle, sodass keine laufende Aktion durcheinandergeraet

## 4.2.0 – 2026-09-16
- Bei eigenen (OpenAI-kompatiblen) Anbietern schickt Julia in langen Gespraechen nur noch die letzten Screenshots mit statt jedes Mal alle alten Bilder - das spart spuerbar Tokens und Kosten, ohne den Gespraechsfaden zu verlieren

## 4.1.0 – 2026-09-16
- Julia kann beim Einrichten jetzt nach einem geheimen Wert fragen (z. B. fuer einen Dienst): eine Eingabe-Box holt ihn, der Wert wird verschluesselt gespeichert und die KI bekommt ihn nie zu sehen - nur die Bestaetigung, dass er hinterlegt wurde

## 4.0.1 – 2026-09-16
- Die KI darf jetzt unkritische Einstellungen (Design, Brainstorming, Lernen) mit Bestaetigung aendern - Anbieter und Anbieter-Adresse sind dabei gesperrt, damit kein vergifteter Chat das Gespraech auf einen fremden Server umbiegen kann

## 4.0.0 – 2026-09-16
- Julia erkennt jetzt echte Zugangs-Tokens vieler Anbieter (und generell sehr lange, zufaellige Schluessel) und laesst keinen Token als Namen eines Geheimnisses zu - so kann kein Schluessel dort landen, wo die KI nur den Namen sieht

## 3.9.0 – 2026-09-16
- VibeWorks laesst sich jetzt in den Einstellungen anbinden: mit deinem API-Schluessel anmelden, danach stehen die VibeWorks-Werkzeuge bereit - der Schluessel liegt nur verschluesselt auf dem PC und wird der KI nie gezeigt

## 3.8.0 – 2026-09-16
- Im Boost-Tab lassen sich CPU-Fresser jetzt gezielt entlasten: auf Klick senkt Julia die Prioritaet eines Programms (umkehrbar mit Zuruecksetzen) - nur auf deinen Klick, System- und Julia-eigene Prozesse gesperrt, nichts wird hart eingefroren, und die KI kann es nicht selbst ausloesen

## 3.7.2 – 2026-09-16
- Minecraft kommt jetzt aus dem Wasser wieder frei: blieb sie mit einem Block ueber dem Kopf im Wasser haengen, schwimmt sie selbst nach oben statt festzustecken

## 3.7.1 – 2026-09-16
- Sicherheit nachgeschaerft nach einem automatischen Repo-Check: Einstellungen werden beim Zusammenfuehren gegen manipulierte Sonderschluessel abgesichert, und im Quelltext stehen keine unsichtbaren Zeichen mehr - Verhalten bleibt gleich, nur robuster

## 3.7.0 – 2026-09-16
- Die Oberflaeche bleibt jetzt auch dann bedienbar, wenn beim Start eine Antwort im Hintergrund ausbleibt - statt eines leeren Fensters ohne Knoepfe zeigt Julia sie notfalls mit Ersatz an, haelt den Haenger im Logbuch fest und laedt bei Bedarf einmal neu

## 3.6.0 – 2026-09-16
- Neuer BETA-Bereich in den Einstellungen für experimentelle Funktionen: freischalten nur durch genaues Ausschreiben einer Bestätigung, Standard aus, und die KI kann diese Schalter nicht selbst einschalten (erster Eintrag: Selbst-Programmieren, kommt schrittweise)

## 3.5.0 – 2026-09-16
- Neuer Brainstorming-Modus in den Einstellungen: bei Ideen-, Optionen- und Planungsfragen antwortet Julia dann offener und ideenreicher (mehrere Vorschläge mit Abwägungen), bei einfachen Faktenfragen normal

## 3.4.0 – 2026-09-16
- Geheimnisse (Passwörter/Schlüssel) lassen sich jetzt in den Einstellungen verwalten: nur verschlüsselt auf dem PC gespeichert, nach dem Speichern nicht mehr angezeigt, und die KI bekommt die Werte nie zu sehen

## 3.3.0 – 2026-09-16
- Neuer Boost-Tab mit System-Überblick: Arbeitsspeicher, Laufwerke, Betriebszeit, die größten Ressourcen-Fresser (nach RAM oder CPU) und ein Finder für doppelte Dateien – rein informativ, es wird nichts verändert oder gelöscht

## 3.2.0 – 2026-09-16
- Werkzeuge lassen sich jetzt in den Einstellungen einzeln abschalten: ein abgeschaltetes Werkzeug darf die KI nicht mehr benutzen und bekommt einen klaren Hinweis, dass es aus ist (Standard: alles an)

## 3.1.0 – 2026-09-16
- Neuer Selbstcheck der Oberfläche: bleibt ein Fenster nach dem Start leer oder ohne Layout, merkt Julia das, hält es im Logbuch fest und lädt die Oberfläche einmal automatisch neu

## 3.0.1 – 2026-09-16
- Läuft Julia schon im Hintergrund, öffnet ein erneuter Start jetzt zuverlässig das Fenster (und legt es notfalls neu an), statt scheinbar nichts zu tun

## 3.0.0 – 2026-09-16
- Werkzeug- und MCP-Aufrufe im Chat lassen sich jetzt aufklappen: ein Tipp auf { } zeigt als lesbares JSON, was genau mit welchen Parametern aufgerufen wurde – so ist nachvollziehbar, was im Hintergrund passiert

## 2.9.0 – 2026-09-16
- Unter dem Chat-Eingabefeld steht jetzt ein dezenter Hinweis, dass KI-Antworten Fehler enthalten können und wichtige Dinge geprüft werden sollten; ruft die KI ein nicht vorhandenes oder abgeschaltetes Werkzeug auf, bekommt sie das klar zurückgemeldet

## 2.8.1 – 2026-09-16
- Sicherheits-Update: die gemeldete Schwachstelle im Paket uuid ist geschlossen (auf eine geprüfte, sichere Version angehoben), ohne Downgrade anderer Pakete – npm audit meldet keine Lücken mehr

## 2.8.0 – 2026-09-16
- Fehler in der Oberfläche werden jetzt protokolliert: bleibt ein Fenster leer oder lädt die UI nicht, landet der zugrunde liegende Fehler im Start-Logbuch, damit sich so ein Problem nachvollziehen lässt (bleibt lokal auf dem PC)

## 2.7.1 – 2026-09-16
- Julia erholt sich jetzt auch von wiederholten Grafik-/Renderer-Abstürzen nach dem Start selbst: sie stellt automatisch auf Software-Grafik um und startet neu, statt mit einem toten Fenster hängenzubleiben

## 2.7.0 – 2026-09-16
- Der Chat stellt Tabellen jetzt richtig dar: Markdown-Tabellen mit senkrechten Strichen werden sauber als Tabelle mit Spalten-Ausrichtung gerendert, statt nur als Textzeilen

## 2.6.0 – 2026-09-16
- Zeitlimit für Shell-Befehle ist jetzt in den Einstellungen selbst einstellbar (Standard und Maximum); das Maximum begrenzt jeden Befehl, damit hängende Konsolen-Befehle sicher abbrechen statt endlos zu laufen

## 2.5.0 – 2026-09-16
- Julia merkt sich Modelle, die keine Bilder verstehen: meldet ein Anbieter Vision-Deaktiviert, schickt sie diesem Modell keine Screenshots mehr und wiederholt den Schritt automatisch ohne Bild, statt am selben Fehler zu scheitern

## 2.4.0 – 2026-09-16
- Die Anweisungen und der System-Prompt der KI laufen jetzt intern einheitlich auf Englisch; für dich bleibt alles gleich, Julia antwortet weiter in deiner App-Sprache

## 2.3.1 – 2026-09-16
- Update installiert jetzt zuverlässig über eine laufende Version: der Installer beendet eine geöffnete Julia samt Hintergrundprozessen hart und zeigt keinen hängenden Bitte-schliessen-Dialog mehr, damit auch das automatische Update durchläuft

## 2.3.0 – 2026-09-16
- Julia erkennt in Minecraft jetzt, wenn die Spielfigur einfriert (verbunden, aber ohne Reaktion), sichert ihren Zustand ins Logbuch und verbindet sich automatisch neu, statt endlos still zu stehen

## 2.2.0 – 2026-09-16
- Julia kann sich jetzt dauerhafte Lern-Notizen anlegen – als versteckte Dateien im Ordner .julia-memos in ihrem Arbeitsordner, damit sie sich Vorlieben, Projekt-Fakten und Lösungen merkt; in den Einstellungen unter Lernen an- und abschaltbar

## 2.1.0 – 2026-09-16
- Julia kann jetzt doppelte (inhaltsgleiche) Dateien in einem Ordner aufspüren und zeigen, wie viel Platz die Kopien unnötig belegen – rein lesend, gelöscht wird nichts

## 2.0.1 – 2026-09-16
- Julia bleibt in Minecraft nicht mehr an einer Stufe hängen – will sie laufen, kommt aber nicht vom Fleck, springt sie jetzt automatisch drüber und kommt beim Erkunden und Durchspielen flüssiger voran

## 2.0.0 – 2026-09-16
- Julia kann jetzt auch Dateien nach Namen finden – als Teiltext (config → config.js) oder als Muster mit Sternchen und Fragezeichen (z. B. *.test.js); ergänzt die Projekt-Textsuche

## 1.9.0 – 2026-09-16
- Julia kann jetzt schnell im Projekt nach Text suchen und bekommt nur die Fundstellen als datei:zeile zurück, statt viele Dateien einzeln zu lesen – das spart Zeit und Tokens (node_modules, .git und Build-Ordner werden übersprungen)

## 1.8.0 – 2026-09-16
- Neuer Nur-in-diesem-Ordner-Modus: schaltest du ihn ein und wählst einen Ordner, darf Julia Dateien nur dort lesen, schreiben, verschieben und auflisten – alles außerhalb ist gesperrt (Standard aus)

## 1.7.0 – 2026-09-16
- Einstellungen lassen sich jetzt durchsuchen: ein Suchfeld oben filtert die Abschnitte live nach Stichwort (z. B. Stimme, Blase, Diagnose), unabhängig von Groß-/Kleinschreibung und Umlauten

## 1.6.1 – 2026-09-16
- Installer und automatisches Update laufen jetzt auch, wenn Julia gerade geöffnet ist: der Assistent schließt eine laufende Julia vorher automatisch (erst sanft, dann notfalls hart), statt mit einem Datei-in-Benutzung-Fehler abzubrechen

## 1.6.0 – 2026-09-16
- PC-Steuerung: Julia führt jetzt ein lokales Leistungs-Logbuch (Dauer und eigener CPU-Verbrauch je Aktion, ohne Inhalte) – so lässt sich eine CPU-Spitze dem Verursacher zuordnen; an den Entwickler geht davon nur eine bereinigte Zusammenfassung, und nur bei eingeschalteter Diagnose

## 1.5.0 – 2026-09-16
- Handy-App gibt es jetzt als fertige Android-APK zum direkten Herunterladen und Installieren – GitHub baut sie automatisch (kein Expo-Konto nötig), du findest sie beim Release android-latest

## 1.4.3 – 2026-09-15
- Weniger CPU-/GPU-Last durch die Blase: die animierte Kugel läuft jetzt mit gedeckelter Bildrate (30 statt rund 60 Bilder pro Sekunde) – sieht gleich aus, spart aber spürbar Rechenleistung, wenn die Blase an ist

## 1.4.2 – 2026-09-15
- Klarere Meldung, wenn ein Modell ohne Bild-Unterstützung einen Screenshot bekommt: statt eines kryptischen Fehlers sagt Julia jetzt, dass das Modell keine Bilder versteht und man ein Bild-fähiges Modell wählen oder ohne Screenshots arbeiten soll

## 1.4.1 – 2026-09-15
- Abhängigkeiten aktualisiert: @anthropic-ai/sdk auf 0.126.0 und Electron auf 44.4.0 (kleinere, geprüfte Updates)

## 1.4.0 – 2026-09-15
- Julia prüft sich jetzt einmal pro Woche selbst: sie schaut ohne KI-Kosten ins Start-Logbuch, ob es zuletzt Abstürze oder Grafikprobleme gab, hält das fest und meldet es nur, wenn du die Diagnose-Meldung ausdrücklich eingeschaltet hast (bereinigt, ohne IP oder Tokens)

## 1.3.3 – 2026-09-15
- Eigene KI-Adresse funktioniert jetzt auch, wenn du die volle Endpunkt-URL einträgst (…/v1/chat/completions): Julia kürzt sie automatisch auf die Basis, damit der Aufruf nicht doppelt zusammengesetzt wird

## 1.3.2 – 2026-09-15
- Besserer Installer: statt der stillen Ein-Klick-Installation führt jetzt ein Assistent durch die Einrichtung – mit Zielordner-Auswahl, Lizenz und Verknüpfungen (wie bei größeren Programmen)

## 1.3.1 – 2026-09-15
- Reparatur-Start gegen schwarze Fenster: Julia lässt sich mit 'Julia AI.exe --reparatur' zwingend mit Software-Grafik starten, wenn die Grafikkarte beim Start Probleme macht

## 1.3.0 – 2026-09-15
- Neue opt-in Diagnose: Julia kann bei Grafik- oder Startproblemen einen rein technischen, bereinigten Bericht an VibeWork melden – niemals mit IP-Adressen, Tokens oder persönlichen Daten; einzuschalten unter Einstellungen → System, standardmäßig aus

## 1.2.2 – 2026-09-15
- Julia heilt einen Grafik-Absturz beim Start jetzt selbst: statt schwarzem Fenster stellt sie automatisch auf Software-Grafik um und startet einmal neu; crasht es auch damit, kommt eine klare Meldung statt einer Endlosschleife

## 1.2.1 – 2026-09-15
- Julia bleibt in Minecraft nicht mehr an Abgründen hängen: die Gefahrenwache friert sie nicht mehr mitten in der Wegfindung ein, sondern lässt den Pathfinder selbst um Lava und Abgründe herumlaufen

## 1.2.0 – 2026-09-15
- Julia kommt in Minecraft jetzt aus Löchern und zwei Blöcke hoch (sie setzt dafür Blöcke, statt deine Bauten abzureißen), verteidigt sich immer selbst gegen Monster und schläft zuverlässig – stellt notfalls ein Bett aus dem Inventar auf

## 1.1.2 – 2026-09-15
- Beim Abbauen lässt Julia jetzt Truhen, Öfen, Türen, Werkbänke, Betten, Glas, Fackeln und andere wertvolle oder gebaute Blöcke in Ruhe – sie reißt nicht mehr aus Versehen deine Bauten ab; nur wenn du genau diesen Block nennst, baut sie ihn ab, und sie sucht etwas näher statt quer durch die Basis

## 1.1.1 – 2026-09-15
- Die Spracherkennung versteht wieder genau: Julia schreibt mit der präzisen Beam-Suche auf (statt der schnellen, aber ungenauen Variante) und wartet am Satzende wieder etwas länger, damit sie dich nicht mitten im Satz abschneidet

## 1.1.0 – 2026-09-15
- Jarvis lässt sich jetzt auch per Sprache einschalten (sag einfach 'Jarvis', 'Julia' zurück); im Jarvis-Modus reicht 'Jarvis' als Weckwort und Julia spricht mit einer anderen, männlichen Stimme

## 1.0.1 – 2026-09-15
- Grafikkarte und Treiber werden beim Start ins Logbuch geschrieben, und es gibt jetzt eine CLAUDE.md mit Fehler-Journal und klaren Datenschutzregeln fürs Logging (nie IP oder Tokens)

## 1.0.0 – 2026-09-15
- Julia arbeitet jetzt auch mit deinen Apps Patchfeld, Codewerk und dem Content-Helper zusammen – Lern-Sessions starten, Fortschritt abfragen, Beiträge planen und Ideen holen, alles über die API deiner App

## 0.9.1 – 2026-09-15
- Deine eigenen Apps ToDoch, Streamo und VibeWork werden jetzt einheitlich mit Domain und Anmeldedaten/API-Key verbunden (vorher waren ToDoch und Streamo versehentlich an fremde Dienste angebunden)

## 0.9.0 – 2026-09-15
- Julia arbeitet jetzt auch mit VibeWork: sie legt auf Ansage Projekte an, lädt Leute zu einem Projekt ein und holt den letzten Commit – über die VibeWork-API, die du mit Adresse und Token in den Einstellungen verbindest

## 0.8.2 – 2026-09-15
- Die Aufgaben-App heißt jetzt überall richtig ToDoch (Einstellungen, Julias Antworten, Anleitung)

## 0.8.1 – 2026-09-15
- Die Streaming-App heißt jetzt überall richtig Streamo, die Apps-Karte in den Einstellungen ist übersichtlicher (Logos, Status, Öffnen-Knöpfe), es gibt einen Knopf zum direkten Öffnen des Minecraft-Logbuchs, und dazu eine Schritt-für-Schritt-Anleitung samt Entwickler-Erklärung, wie Julia Minecraft spielt

## 0.8.0 – 2026-09-15
- Julia arbeitet jetzt mit Todoist und Stremio zusammen (z. B. 'Füg Iron Man zu meiner Stremio-Liste hinzu'), spielt Minecraft auf Ansage eigenständig durch – mit Tech-Baum bis zum Enderdrachen und täglichem Logbuch, das Abstürze übersteht – hört im Spiel nur auf Leute, die du ihr nennst, und der Jarvis-Modus fühlt sich mit echtem HUD-Look und 'Sir'-Anrede wie J.A.R.V.I.S. an

## 0.7.0 – 2026-09-15
- Kleines Easter-Egg: Tippe 'jarvis' in den Chat für einen kompletten Jarvis-Look samt Sprechweise, 'julia' schaltet zurück; dazu aufgefrischte README mit sichtbarer Android-/iOS-App

## 0.6.0 – 2026-09-15
- Julia lässt sich jetzt mit der Android-App vom Handy aus bedienen – im Heimnetz oder über dein VPN, per Code gekoppelt; Anfragen laufen durch Julia samt Ampel, Freigaben erscheinen am PC

## 0.5.4 – 2026-09-15
- Julia lebt jetzt in einem einzigen Repository; der Handy-Zugang und das Proxmox-Relay sind entfernt, ein GPU-Absturz beim Start wird sicher abgefangen, und die Versionszählung beginnt neu
