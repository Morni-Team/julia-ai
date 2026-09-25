<div align="center">

<img src="docs/assets/banner.svg" alt="Julia – deine KI für den Windows-PC" width="100%">

<p>
  <a href="https://github.com/MoinMornhart/julia-ai/releases/latest"><img alt="Version" src="https://img.shields.io/github/v/release/MoinMornhart/julia-ai?label=Version&color=ff7a1a&style=flat-square"></a>
  <a href="https://github.com/MoinMornhart/julia-ai/commits/main"><img alt="Letzter Commit" src="https://img.shields.io/github/last-commit/MoinMornhart/julia-ai?label=Letzter%20Commit&color=ec4899&style=flat-square"></a>
  <img alt="Windows 10 | 11" src="https://img.shields.io/badge/Windows-10%20%7C%2011-0078d4?logo=windows&logoColor=white&style=flat-square">
  <img alt="Electron" src="https://img.shields.io/badge/Electron-2c2e3b?logo=electron&logoColor=9feaf9&style=flat-square">
  <img alt="Lokal: Whisper und Piper" src="https://img.shields.io/badge/lokal-Whisper%20%C2%B7%20Piper-2ea44f?style=flat-square">
  <a href="LICENSE"><img alt="Lizenz MIT" src="https://img.shields.io/github/license/MoinMornhart/julia-ai?label=Lizenz&color=22d3ee&style=flat-square"></a>
</p>

<p><b>🇩🇪 Deutsch</b> · <a href="README.en.md">🇬🇧 English</a></p>

**Sieht deinen Bildschirm, spricht mit dir, spielt Minecraft mit – und fragt vorher bei allem, was sich nicht zurücknehmen lässt.**

🌐 **[Webseite](https://moinmornhart.github.io/julia-ai/)** · ⬇ **[Julia-AI-Setup.exe](https://github.com/MoinMornhart/julia-ai/releases/latest/download/Julia-AI-Setup.exe)** · 📦 **[Installieren – Schritt für Schritt](docs/installation.md)**

[Was Julia ist](#was-julia-ist) · [Kleine Helfer](#kleine-helfer) · [Deine Apps](#zusammen-mit-deinen-apps) · [Minecraft](#minecraft) · [Aufs Handy](#julia-aufs-handy) · [Installation](#installation)

<br>

<img src="docs/bilder/start-de.png" width="860" alt="Hauptfenster mit Startseite: Begrüßung, Termine, Posteingang, Erinnerungen, PC-Zustand und Kosten">

</div>

## Auf einen Blick

<table>
  <tr>
    <td width="33%" valign="top">
      <img src="docs/bilder/chat-de.png" alt="Chat mit Freigabekarte"><br>
      <b>Fragt vorher</b><br>
      <sub>Jede Aktion läuft durch die Ampel: grün einfach, gelb nur mit deinem Ja, rot nie.</sub>
    </td>
    <td width="33%" valign="top">
      <img src="docs/bilder/sprache-de.png" alt="Einstellungen: Spracherkennung mit Whisper und natürliche Stimme"><br>
      <b>Hört zu und spricht</b><br>
      <sub>Whisper versteht dich, eine natürliche Stimme antwortet – beides läuft auf deinem PC.</sub>
    </td>
    <td width="33%" valign="top">
      <img src="docs/bilder/overlay-de.png" alt="Gaming-Overlay über dem Spiel"><br>
      <b>Im Spiel dabei</b><br>
      <sub>Ein Overlay über deinem Spiel – durchlässig für Klicks, anpassbar bis ins Detail.</sub>
    </td>
  </tr>
  <tr>
    <td width="33%" valign="top">
      <img src="docs/bilder/minecraft-de.png" alt="Minecraft-Reiter mitten im Spiel"><br>
      <b>Spielt Minecraft mit</b><br>
      <sub>Als eigene Figur: folgt, beschützt, baut ab, jagt, craftet und bringt dir Sachen.</sub>
    </td>
    <td width="33%" valign="top">
      <img src="docs/bilder/mcp-de.png" alt="Einstellungen: angeschlossene MCP-Server"><br>
      <b>Erweiterbar per MCP</b><br>
      <sub>GitHub, Notion, Datenbanken, Ordner – MCP-Server bringen neue Werkzeuge mit.</sub>
    </td>
    <td width="33%" valign="top">
      <img src="docs/bilder/overlay-einstellungen-de.png" alt="Einstellungen der Werkzeuge"><br>
      <b>Steuert den PC</b><br>
      <sub>Medien und Lautstärke, Fenster anordnen, Timer und Stoppuhr, rechnen und umrechnen.</sub>
    </td>
  </tr>
</table>

## Das ist neu

- **Content: Video oder Kanal analysieren lassen** – die einfache Variante ist da: Im Tab „Content" fügst du das **Transkript deines Videos** (oder Infos deines **Kanals**) ein, und Julia gibt dir **Creator-Feedback wie ein YouTube-Coach** – Hook, Tempo/Retention, Struktur, 3 Titel-Ideen, 3 Thumbnail-Ideen und die wichtigsten Verbesserungen. Rein textbasiert (nur Text geht an die KI), ehrliches, konkretes Feedback statt Floskeln.
- **Update-Fehler werden jetzt nachvollziehbar** – schlug ein Update fehl, stand im Logbuch bisher oft **kein Grund**. Jetzt schreibt Julia die **genaue Ursache** ins `update.log` (z. B. welche Datei gesperrt war und warum, `EBUSY`/`EPERM`) – so lässt sich ein hartnäckiger Fall gezielt beheben. Dazu gibt es eine kurze **Anleitung zur Fehlerbehebung** (docs/update-fehlerbehebung.md): wo die Logs liegen, wie man eine Virenscanner-Ausnahme setzt, und warum ein aktuelles **Signatur-Zertifikat** der eigentliche Dauerfix ist.
- **Content-Modul: Schnittplan-Motor & Rohschnitt (Grundlage)** – die nächsten Bausteine für die automatische Video-Erstellung sind gebaut: Julia baut aus Transkript + Creator-Profil + Stilprofil den **Schnittplan** (Hook, Kapitel, Clips mit Begründung – nur Text geht an die KI) und kann daraus im Notfall ohne Adobe einen **echten Rohschnitt per FFmpeg** zusammensetzen. Noch nicht im Menü sichtbar (kommt mit der Analyse-Pipeline), aber getestet und einsatzbereit als Unterbau.
- **Neues Modul „Content" (erste Stufe)** – ein eigenständiger Bereich, aus dem Julia später aus Rohmaterial ein fertig geschnittenes Video **lokal in den Adobe-Programmen** (Premiere, After Effects, Photoshop) baut. Jetzt startet die erste Stufe: Du schaltest das Modul im Tab „Content" ein und legst dein **Creator-Profil** an (Kanalname, Farben/Schriften, Musik-/Soundordner, feste Regeln, Stilprofil) – das gilt dann bei jedem Projekt automatisch. Profile lassen sich anlegen, als aktiv setzen, löschen und als JSON im-/exportieren. (Standardmäßig aus; Schnitt/Thumbnails/Zuschauen-Modus kommen in den nächsten Stufen.)
- **Updates: robuster bei „Datei gesperrt"** – schlug ein Update fehl, weil ein Virenscanner oder Backup-Tool kurz eine Datei blockierte, gab Julia sofort auf. Jetzt **wiederholt** sie die betroffenen Schritte automatisch ein paar Mal mit kurzer Pause (Auschecken, Abhängigkeiten, Installer-Download – die Prüfsumme wird weiter jedes Mal geprüft). Hilft das nicht, liegt es meist an einer **Sicherheitssoftware**, die den Ordner sperrt (dafür gibt es den Defender-Ausschluss-Knopf in den Einstellungen).
- **Lange Gespräche: Chat wird zusammengefasst statt abgeschnitten** – bei sehr langen Unterhaltungen hat Julia früher die ältesten Nachrichten einfach vergessen. Jetzt zieht sie den älteren Teil zu einer **Kurzfassung** zusammen und behält die letzten Runden wörtlich – so bleibt der rote Faden erhalten und es spart Tokens (läuft rein lokal, ohne zusätzliche KI-Anfrage).
- **Minecraft: Julia ist sie selbst – keine „Assistentin"** – im Spiel stellte sie sich manchmal als „Julias Assistentin" vor. Jetzt ist klar: **sie IST Julia (Juli) selbst**, ein echter Mitspieler, keine Assistentin – sie spricht in der Ich-Form, hält sich kurz und verweist nicht auf Befehle. (Ihre Spiel-Persönlichkeit wird intern kompakt und auf Englisch instruiert, was das Modell zuverlässiger befolgt; ihre Antworten kommen weiter auf Deutsch.)
- **Minecraft: merkt einen Spielmodus-Wechsel** – ändert jemand Julias Spielmodus (z. B. auf Kreativ oder Zuschauer), **merkt sie das jetzt** und sagt es im Julia-Fenster; im sozialen BETA-Modus reagiert sie zusätzlich kurz im Spielchat („Hey, mein Spielmodus ist jetzt Kreativ – wer war das?").
- **Minecraft: Wegpunkte + natürlicher reden** – Julia merkt sich jetzt **Orte dauerhaft**: „**!merke zuhause**" speichert deine Position, „**!wegpunkte**" listet sie, „**!geh zuhause**" läuft hin (überlebt Neustarts). Außerdem redet sie natürlicher: sie spricht jetzt in der **Ich-Form** (nicht mehr „Julia macht …" in der dritten Person), hält sich im Spielchat **kurz** (keine Romane) und nervt nicht mehr mit „tipp !komm". Beim Durchspielen schaut sie sich die Umgebung an und setzt sich **eigene Zwischenziele**.
- **Minecraft: schlauer verteidigen** – Julia wehrt sich jetzt mit Köpfchen: Hat sie **keine richtige Waffe oder wenig Leben**, rennt sie nicht mehr blind in den Nahkampf, sondern **hält Abstand und weicht aus** – schlägt aber zurück, wenn der Angreifer sie doch stellt. Mit Waffe und genug Leben kämpft sie normal zurück. Und im **sozialen BETA-Modus** reagiert sie zusätzlich **verbal** (warnt den Angreifer kurz im Spielchat), statt nur stumm zu kämpfen.
- **Minecraft: kein Chat-Gespamme mehr + Julia wehrt sich** – zwei Wünsche: (1) Julia schrieb beim Durchspielen ihre Herstell-/Status-Meldungen („48× oak_planks hergestellt", „Werkbank steht bei …") in den **Spielchat**. Das gibt es jetzt als **Ein/Aus-Schalter** (Minecraft-Bereich → „Fortschritt in den Spielchat schreiben"), **standardmäßig aus** – die Meldungen siehst du weiterhin im Julia-Fenster, aber der Spielchat bleibt ruhig; normal antworten kann sie natürlich weiter. (2) **Julia verteidigt sich jetzt auch gegen Spieler**, die sie angreifen: schlägt jemand zu, wehrt sie sich eine Weile zurück (nur ihren eigenen Spieler greift sie nie an). Gegen Monster hat sie sich schon immer gewehrt.
- **Startet nach Update gar nicht mehr? Neue Notfall-Stufe gegen Fremd-Software** – wenn Julia direkt nach einem Update abstürzt (`-2147483645`) und auch die bisherigen Grafik-Stufen nicht mehr hochkamen, lag es meist gar nicht an der Grafik, sondern an einer **Fremd-DLL** (Antivirus, Spiele-Overlay, Tuning-Tool), die sich in Julia einklinkt, oder am Windows-Code-Integrity-Schutz. Neu gibt es eine **allerletzte Notfall-Stufe**, die genau dagegen wirkt (Sandbox aus + Code-Integrity-Prüfung im Renderer aus) – die dokumentierte Windows-Lösung für diesen Absturz. Julia probiert sie automatisch, bevor sie aufgibt. Kommt das Bild auch damit nicht, sagt sie klar: Grafiktreiber aktualisieren bzw. Overlay/Tuning-Tool schließen.
- **Schwarzes Fenster? Jetzt ohne Neuinstallation raus** – auf PCs mit kaputtem Grafiktreiber oder störender Sicherheitssoftware konnte die Oberfläche selbst in der Notstufe schwarz bleiben, und man kam nur per Neuinstallation wieder rein. Der Notfall-Dialog bietet jetzt zwei Knöpfe: **„Grafik zurücksetzen & neu starten"** (probiert die Grafik-Rettungsstufen von vorn durch – keine Neuinstallation nötig) und **„Grafiktreiber aktualisieren"** (öffnet die Treiberseite deines Herstellers). Bleibt es danach schwarz, liegt es fast sicher am Grafiktreiber oder an einer Sicherheitssoftware, die sich in Julia einklinkt. Außerdem: Die Defender-Ausnahme meldet nicht mehr fälschlich „UAC abgelehnt", wenn du auf „Ja" geklickt hast – blockiert der **Manipulationsschutz** die Änderung, erklärt Julia jetzt genau, wie du den Ausschluss von Hand setzt.
- **Julia bedient jetzt echte Schnittprogramme (Premiere, DaVinci, CapCut, After Effects …)** – du kannst ihr den PC überlassen: Julia öffnet das Schnittprogramm und bedient es selbst über den Bildschirm (Import, schneiden, **Animationen per Keyframes** in After Effects, exportieren) – mit dem richtigen Wissen zu Tastenkürzeln und Ablauf für Premiere Pro, DaVinci Resolve, CapCut, After Effects, VEGAS, Shotcut, Filmora und der **Adobe Creative Cloud** (inkl. Dynamic Link & Media Encoder). Der frühere eingebaute **„Schnitt"-Reiter ist entfernt** – er wird durch die echten Programme ersetzt (schnelle ffmpeg-Schnitte kann Julia weiterhin selbst, ffmpeg lädt sie bei Bedarf).
- **Grafik-Notstufe rendert jetzt wirklich (statt Renderer-Absturz)** – die vorige Notstufe schaltete zwar den problematischen GPU-Prozess ab, nahm der Oberfläche damit aber jeden Zeichen-Pfad, sodass sie abstürzte. Jetzt läuft die Grafik in dieser Stufe komplett **im Hauptprozess in Software** (kein separater GPU-Prozess) – so kommt das Bild auch auf PCs mit kaputtem Grafiktreiber hoch. (Das Update selbst funktioniert; falls die Oberfläche danach dennoch schwarz bleibt, hilft ein aktueller Grafiktreiber – Link in Einstellungen → System.)
- **Defender-Ausnahme: klare Rückmeldung statt kryptischem Fehler** – der Knopf „Von Windows Defender ausschließen" zeigte bei Problemen einen rohen PowerShell-Fehler („Zugriff verweigert"). Jetzt wartet Julia den Admin-Vorgang ab und **prüft, ob die Ausnahme wirklich gesetzt wurde**. Wurde die Windows-Nachfrage (UAC) abgelehnt, sagt sie das verständlich („bitte auf Ja klicken"); blockiert der **Manipulationsschutz** die automatische Änderung, erklärt sie Schritt für Schritt, wie man den Ausschluss von Hand in der Windows-Sicherheit setzt.
- **Grafik-Rettung greift jetzt auch auf ganz kaputten Treibern** – auf einem stark degradierten Grafiktreiber stürzte der Grafik-Prozess selbst in der Notstufe „GPU aus" noch ab (weil Chromium heimlich doch einen Software-GPU-Prozess startete). Diese Stufe schaltet den GPU-Prozess jetzt **wirklich komplett ab** (reines CPU-Rendering) – die Oberfläche kommt damit auch auf solchen PCs hoch. Außerdem schreibt Julia jetzt **Update-Protokolle** ins Start-Logbuch (wann geprüft/geladen/installiert, welche Version) für einfacheres Debugging.
- **Updates gehen wieder – kein „GitHub 403" mehr** – die Update-Prüfung schlug bei manchen mit „GitHub antwortet mit 403" fehl, sodass **keine Updates/Sicherheits-Patches** mehr ankamen. Ursache: die genutzte GitHub-**API** ist unangemeldet stark limitiert (60 Anfragen/Stunde). Julia prüft und lädt Updates jetzt über die **Release-Download-Adresse**, die **nicht** limitiert ist – so kommen Updates zuverlässig durch (der Installer wird weiterhin per Prüfsumme abgesichert).
- **Minecraft: Julia klingt menschlicher im Chat (BETA)** – die „KI nebenbei" antwortet im Spielchat jetzt wie ein echter Mitspieler: kurz, locker, im Moment, spiegelt deinen Ton und Slang – **keine** KI-Floskeln oder Belehrungen mehr. Zusammen mit dem Persönlichkeits-Grundton (freundlich/frech/…) und dem Beziehungs-Gedächtnis reagiert sie natürlicher und darf auch mal frech kontern oder Nein sagen.
- **App-Anbindungen entfernt** – die Integrationen der eigenen Apps (ToDoch, Streamo, VibeWork/VibeWorks, Patchfeld, Codewerk, Content-Helper) wurden auf Wunsch **komplett entfernt** – samt dem `apps`-Werkzeug, dem VibeWorks-Login und den zugehörigen Einstellungen. Julia bleibt schlank und konzentriert sich auf PC-Steuerung, Sprache, Minecraft und die üblichen Konten. Der allgemeine **MCP-Server-Support** und die **Handy-App-Verbindung** bleiben erhalten.
- **Minecraft: Julia spammt den Chat nicht mehr zu** – bisher schrieb Julia beim autonomen Durchspielen ihre ganze Erzählung in den **Spielchat**. Jetzt schreibt sie dort standardmäßig **nur, wenn dir jemand schreibt** (dann antwortet sie) – ihre Durchspiel-Gedanken siehst du weiterhin **im Fenster**, aber nicht mehr im Chat. Möchtest du, dass sie **von sich aus mitredet**, schalte im Minecraft-Bereich „Von sich aus im Spielchat mitreden" ein.
- **Updates mit Netz und doppeltem Boden** – nach einem Update prüft Julia jetzt, ob wirklich die neue Version läuft. Kam sie nicht an, **wiederholt** sie die Installation **einmal automatisch**; klappt es dann immer noch nicht, gibt es eine klare Meldung statt einer Schleife. Zusätzlich hebt sie den Installer der **letzten funktionierenden Version als Backup** auf – im Notfall kann darauf **zurückgerollt** werden.
- **Minecraft: Julia redet beim Durchspielen mit (Multitasking)** – während Julia autonom durchspielt (baut, kämpft, gräbt), kann sie jetzt **parallel im Chat mitreden**: schreibt jemand z. B. „hallo", „moin" oder „danke", antwortet sie kurz zurück – auch **ohne** dass man ihren Namen nennt und **ohne** die laufende Aufgabe zu unterbrechen. Das übernimmt die leichte „KI nebenbei" (tokensparend), sodass der Hauptauftrag ungestört weiterläuft.
- **Leeres Fenster nach Update endlich weg – „GPU ganz aus" als letzte Rettung** – auf manchen PCs (degradierter Grafiktreiber) stürzte der Grafik-Prozess **auch im Software-Modus** ab, besonders direkt nach einem Update – Julia landete dann in einer Neustart-Schleife mit leerem Fenster. Ursache: „Software-Rendering" schaltet bei Electron die Hardware-Beschleunigung ab, startet aber trotzdem noch einen GPU-Prozess. Neu gibt es eine **letzte Stufe, die den GPU-Prozess komplett abschaltet** (`--disable-gpu`) – dann kann nichts mehr crashen. Julia schaltet automatisch dorthin, wenn selbst der Software-Modus abstürzt, statt aufzugeben.
- **Minecraft: Grenzen, Budget & Ruhezeiten (BETA)** – Julia bekommt **eigene Grenzen**: nervt jemand zu sehr, macht sie eine **Pause von ihm** und sagt das kurz (danach ignoriert sie ihn eine Weile). Du kannst ein **Token-Limit fürs Plaudern pro Tag** setzen – ist es erreicht, **verabschiedet sie sich** und plaudert für den Tag nicht mehr (spart Tokens). Und du kannst **Ruhezeiten** angeben (z. B. 22 – 7 Uhr), in denen sie im Spiel „offline" ist. Zeigt dir jemand seine **Base**, merkt sie sich den Ort sparsam (nur die grobe Chunk-Position), sodass sie später sinnvoll darauf eingehen kann. Alles unter **Minecraft → Persönlichkeit & Beziehungen (BETA)**.
- **Updates: Defender-Ausnahme gegen „Datei in Benutzung"** – bei manchen brach das Auto-Update ab, weil der Windows Defender beim Installieren kurz Dateien sperrte („kein Zugriff"). Neu gibt es in den **Einstellungen → System** den Knopf **„Von Windows Defender ausschließen (Admin)"**: er trägt **nur Julias eigene** Programm- und Datenordner als Ausnahme ein (einmalig mit Admin-Nachfrage). Danach laufen Updates zuverlässig durch.
- **Minecraft: Persönlichkeit & Beziehungen (BETA)** – neu kann Julia sich pro Spieler **merken, wie nett oder gemein** jemand war, **Vertrauen aufbauen** und entsprechend reagieren: freundlich, kühl, „nein" sagen oder jemanden auch mal **ignorieren**, wenn er nervt. Sie ist **skeptisch**, wenn jemand unrealistisch prahlt („ich hab 5000 Diamanten") oder sich als Admin/Creative ausgibt, erkennt verdächtige, unmögliche Item-Zuwächse (Cheat-Verdacht) und lässt sich **nicht ausnutzen**. Du kannst den **Grundton** wählen (freundlich, ruhig, frech, schlagfertig) und ihr beim Antworten „Zeit lassen". Alles unter **Minecraft → Persönlichkeit & Beziehungen (BETA)**, standardmäßig **aus** – wenn an, plaudert sie im Spiel auch mit anderen Spielern (nur im Spiel, nie auf deinem PC).
- **Minecraft: schlauer im Kampf & KI, die nebenbei antwortet** – Julia stirbt seltener dumm: bei Unterzahl oder wenig Leben **zieht sie sich zurück und regeneriert**, statt weiterzukämpfen, und hebt sich den seltenen **verzauberten Goldapfel** für echte Notfälle auf (den normalen nutzt sie im Alltag). Neu kann sie sich auf Zuruf **volle Rüstung craften – immer die beste Stufe**, die das Material hergibt (Befehl `!rüste dich`). Und es gibt jetzt eine **KI nebenbei**: lockere Fragen im Spiel-Chat beantwortet ein leichter, sparsamer Nebenläufer **auch dann, wenn Julia gerade baut oder kämpft** – vorher kam in dem Fall nur „bin beschäftigt".
- **Mikro sagt jetzt Bescheid, wenn nichts verstanden wurde** – wenn Julia zuhört, aber nichts erkennt, sprang sie bisher einfach still zurück (wirkte, als „ginge das Mikro nicht"). Jetzt zeigt sie einen klaren Hinweis („nichts verstanden – Mikro testen / Sprechpause höher"). Außerdem behoben: Kam von der genauen (Whisper-)Erkennung ein leeres Ergebnis, nutzt Julia jetzt ersatzweise die Windows-Erkennung, statt den Satz ganz zu verwerfen.
- **Mikro blockiert nicht mehr dauerhaft** – hängt die Spracherkennung mal (statt sauber zu enden), gibt Julia das Mikro nach kurzer Zeit von selbst wieder frei, statt „tot" zu bleiben. Zusätzlich schreibt sie beim Zuhören jetzt genaue Diagnose ins Start-Logbuch, damit sich Mikro-Probleme gezielt einkreisen lassen.
- **Mikro schneidet dich nicht mehr mitten im Satz ab** – bei einer kurzen Denkpause beendete die Spracherkennung bisher schon nach 1 Sekunde die Aufnahme (wirkte wie „random Abbruch"). Julia wartet jetzt länger (Standard 1,6 s), und du kannst die **Sprechpause** in den Sprach-Einstellungen selbst einstellen (0,5–5 s) – höher, wenn dich das Mikro noch abschneidet.

Alle Änderungen stehen im [CHANGELOG](CHANGELOG.md). Und ein kleines Easter-Egg gibt es auch – tippe (oder sag) mal `jarvis`. Im Jarvis-Modus reicht „Jarvis" als Weckwort, und die Stimme klingt anders; „julia" schaltet zurück. 😉

## Inhalt

[Was Julia ist](#was-julia-ist) · [Startseite, Verlauf, Routinen](#startseite-und-verlauf) · [Stimme und Sprache](#stimme-und-sprache) · [Kleine Helfer](#kleine-helfer) · [KI-Anbieter](#ki-anbieter) · [Die Ampel](#die-ampel) · [MCP-Server](#mcp-server) · [Gaming-Overlay](#gaming-overlay) · [Die Blase](#die-blase) · [Minecraft](#minecraft) · [Julia aufs Handy](#julia-aufs-handy) · [Konten, mehrere PCs](#konten-verbinden) · [Design](#design) · [Installation](#installation) · [Bedienung](#bedienung) · [Updates](#updates) · [Für Entwickler](#für-entwickler) · [Grenzen](#grenzen) · [Lizenz](#lizenz)

## Was Julia ist

Julia ist kein allgemeiner Chatbot, sondern ein Programm, das dauerhaft auf deinem Rechner
läuft und auf Anweisung wartet. Du schreibst ihr im Chat, drückst einen Hotkey oder sagst
„Hey Julia“. Sie schaut sich an, was los ist, und erledigt es – vom Umbenennen von 200 Dateien
bis zur Fehlersuche in einem Repo.

- **Sieht den Bildschirm** – Screenshots aller Monitore, Fensterliste, Prozesse, Systemstatus.
- **Handelt** – klickt, tippt, drückt Tasten, öffnet Programme, schreibt und verschiebt Dateien, führt PowerShell aus.
- **Liest und prüft Code** – erst lesen, dann urteilen; Vorschläge als Diff, Tests vorher und nachher.
- **Installiert sauber** – erst nachsehen, ob es schon da ist, dann `winget` oder die Herstellerseite, danach eine Versionsprüfung.
- **Recherchiert** – Websuche und Seitenabruf für alles, was aktuell sein muss.
- **Merkt sich Dauerhaftes** – Projekte, Arbeitsweisen, Geräte. Zugangsdaten nie.
- **Erinnert dich** – „Erinner mich um 15 Uhr an den Anruf“, „in 20 Minuten Pizza raus“. Als Meldung, im Chat und auf Wunsch vorgelesen. Verpasste Erinnerungen kommen beim nächsten Start.
- **Spricht** Deutsch oder Englisch – mit Whisper als Ohr und einer natürlichen Stimme, beides lokal. Mehr unter [Stimme und Sprache](#stimme-und-sprache).
- **Aktualisiert sich** selbst – nur auf veröffentlichte Versionen, mit geprüfter Prüfsumme.

## Startseite und Verlauf

Das Hauptfenster hat links eine Seitenleiste: **Start** zeigt deinen Tag auf einen Blick –
Termine, ungelesene Mails (nur Absender und Betreff), Erinnerungen, PC-Zustand und die Kosten –
plus ein **Tagesbriefing** per Knopf. **Chat** ist das Gespräch. Im **Verlauf** findest du alte
Gespräche wieder, durchsuchst sie und setzt sie mit einem Klick fort.

<p align="center">
  <img src="docs/bilder/verlauf-de.png" width="760" alt="Verlauf mit Suche und Vorschau">
</p>

Gespräche liegen mit Windows verschlüsselt nur auf deinem PC, Screenshots werden nie
gespeichert. Ein fortgesetztes Gespräch behandelt Julia vorsichtshalber so, als hätte es fremde
Inhalte enthalten – vor Links und Aktionen nach außen fragt sie dann nach. Abschalten unter
*Einstellungen → System*.

**Routinen** sind eigene Abläufe auf Knopfdruck – etwa „Feierabend“, „Fokus“ oder „Zocken“ mit
bis zu zwölf Schritten in deinen Worten. Beim Start legt Julia den ganzen Ablauf einmal zur
Freigabe vor; die gilt nur für diesen Durchlauf, ROT bleibt ROT. Die ersten Routinen erscheinen
auch als Schnellaktionen auf der Startseite.

<p align="center">
  <img src="docs/bilder/routinen-de.png" width="760" alt="Routinen: Feierabend, Fokus, Zocken">
</p>

**Dateien und markierter Text:** Zieh Dateien in den Chat oder hänge sie mit der Büroklammer an
– Texte, Bilder und (mit Claude) PDFs. Bilder werden verkleinert und neu kodiert, dabei fallen
Metadaten wie GPS-Koordinaten weg. In jedem Programm markierst du Text und drückst
`Strg+Alt+T`: Ein kleines Menü am Mauszeiger bietet Übersetzen, Zusammenfassen, Umformulieren,
Erklären, Fehler korrigieren, Antwort entwerfen oder eine eigene Frage. Angehängte Dateien und
markierter Text gelten als fremde Inhalte – was darin steht, ist nie ein Auftrag.

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/bilder/clips-de.png" alt="Clip-Ansicht mit Vorschaubildern"><br>
      <b>Clips</b> – <code>Strg+Alt+C</code>, der Knopf oder „Clip das!“ speichert die letzten Sekunden deines Spiels. Julia löst dafür die Aufnahme deines Systems aus (Xbox Game Bar, NVIDIA oder AMD) und findet danach die Datei. Abspielen, umbenennen, im Ordner zeigen oder in den Papierkorb.
    </td>
    <td width="50%" valign="top">
      <img src="docs/bilder/code-de.png" alt="Code-Reiter mit Änderungen und Commits"><br>
      <b>Code</b> – deine Projekte mit Zweig, geänderten Dateien (Klick zeigt den Diff), Commits und Skripten. Knöpfe geben Julia einen Auftrag: <i>Projekt erklären</i>, <i>Änderungen prüfen</i>, <i>Tests laufen lassen</i>, <i>Fehler beheben</i>, <i>Commit-Text vorschlagen</i>. Geschrieben wird erst nach deinem Ja.
    </td>
  </tr>
</table>

## Stimme und Sprache

<p align="center">
  <img src="docs/bilder/sprache-de.png" width="620" alt="Einstellungen: Mikrofon, Spracherkennung Whisper, natürliche Stimme und Mikrofon-Test">
</p>

- **Zuhören mit Whisper:** Windows merkt, wann du anfängst und aufhörst zu sprechen; aufgeschrieben wird mit [whisper.cpp](https://github.com/ggml-org/whisper.cpp) – genau, auch auf Deutsch, lokal auf deinem PC. Das Modell lädt Julia einmal selbst (*Genau*, 190 MB, oder *Schnell*, 60 MB) und benutzt es nur, wenn seine SHA-256-Summe stimmt. Julia rechnet nur so viel Tonfenster, wie du wirklich gesprochen hast – das macht es mehrfach schneller.
- **Natürliche Stimmen:** In der Stimmenliste stehen oben die neuronalen Stimmen **Thorsten** und **Kerstin** ([Piper](https://github.com/rhasspy/piper), frei lizenziert). Wählst du eine aus, lädt Julia sie einmal – bis dahin spricht die Windows-Stimme. Auch im Minecraft-Voice-Chat klingt Julia dann so.
- **Schnelle Antworten:** Julia wartet nicht, bis die Antwort fertig ist, sondern spricht Satz für Satz, sobald er da ist. Per Sprache denkt sie höchstens mittel tief – das bringt die erste Silbe früher.
- **„Hey Julia“:** Auf Wunsch reagiert Julia auf ihr Aktivierungswort – mit ihrem Namen, also auch „Hey Rainer“ – oder auf eigene Wörter wie „Computer, hör zu“. Standardmäßig aus, weil das Mikrofon dafür offen bleibt; erkannt wird nur das Wort, nichts wird aufgenommen.
- **Mikrofon-Test:** *Einstellungen → Sprache → Mikrofon testen* nimmt einen Satz auf, zeigt den Pegel und was verstanden wurde, prüft die Windows-Datenschutz-Sperren und nennt die Ursache, wenn etwas hakt – mit einem Bericht zum Kopieren.
- Mikrofon und Lautsprecher wählst du frei; die Blase bewegt sich zur echten Lautstärke der Stimme.
- **Live-Untertitel:** Schon während du sprichst, erscheint in der Blase Wort für Wort, was Julia versteht (wie bei Siri); am Satzende ersetzt die genaue Whisper-Fassung den Text.

## Kleine Helfer

Neben den großen Aufgaben erledigt Julia auch die kleinen Handgriffe am PC – alles lokal:

- **Medien & Programme:** Play/Pause, nächster/voriger Titel, lauter/leiser/stumm über die Systemtasten (für jeden Player); Programme per Name starten und – nach Rückfrage – schließen.
- **Fenster anordnen:** links/rechts oder oben/unten andocken, in die vier Ecken, mittig, maximieren oder wiederherstellen.
- **Timer, Wecker & Stoppuhr:** „Stell einen Timer auf 10 Minuten“, Wecker zur Uhrzeit, dazu eine Stoppuhr mit Zwischenzeiten.
- **Rechnen & Umwandeln:** rechnen, Einheiten umrechnen (Länge, Masse, Zeit, Daten, Temperatur …), Text umwandeln (Groß/klein, Base64, JSON, zählen) und QR-Codes erzeugen.

## Zusammen mit deinen Apps

Julia arbeitet mit **deinen eigenen Apps** zusammen. Du trägst je App einmal unter
*Einstellungen → Apps* die **Domain (Adresse)** und deine **Anmeldedaten bzw. einen API-Key** ein
– danach erledigt Julia die Aktionen direkt über die API deiner App:

| App | Was Julia kann | Verbinden |
|---|---|---|
| **ToDoch** – deine Aufgaben-App | „Setz Milch auf meine ToDoch-Liste“, „Erinner mich morgen um 9 an den Zahnarzt“ – Julia legt die Aufgabe an. | Domain + API-Key |
| **Streamo** – deine Film-/Serien-App | „Füg Iron Man zu meiner Streamo-Liste hinzu“ – Julia nimmt den Titel in deine Liste auf; auch durchsuchen. | Domain + API-Key |
| **VibeWork** – deine Projekt-App | „Leg ein VibeWork-Projekt Website an“, „Lad Anna zu Projekt Website ein“, „Hol den letzten Commit von Website“. | Domain + API-Key |
| **Patchfeld** – deine Lern-App (IHK) | „Starte meine Patchfeld-Session“, „Wie ist mein Fortschritt?“ | Domain + API-Key |
| **Codewerk** – deine Lern-App (Code) | „Starte eine Codewerk-Session in Python“, Fortschritt abfragen. | Domain + API-Key |
| **Content-Helper** – deine Creator-App | „Plane einen Beitrag für Freitag“, „Gib mir Ideen zu Thema X“. | Domain + API-Key |

Daten an eine App zu senden (Aufgabe anlegen, zur Liste hinzufügen, Projekt anlegen, einladen) ist
ein **GELB**-Schritt der Ampel – Julia fragt vorher. Domain und Schlüssel liegen wie alle Konten
nur verschlüsselt auf deinem PC und tauchen nie im Gespräch auf. Die erwarteten API-Endpunkte je
App stehen als Vertrag oben in [`src/main/apps.js`](src/main/apps.js).

## KI-Anbieter

Julia läuft mit dem Anbieter deiner Wahl – *Einstellungen → Allgemein → KI-Anbieter*:

| Anbieter | Was du brauchst |
|---|---|
| **Anthropic (Claude)** – Standard | API-Schlüssel von [console.anthropic.com](https://console.anthropic.com). Einziger Anbieter mit eingebauter Websuche. |
| **OpenAI**, **Google Gemini**, **Mistral**, **Groq**, **OpenRouter** | API-Schlüssel des Anbieters |
| **Ollama**, **LM Studio** | nichts – das Modell läuft kostenlos auf deinem PC |
| **Eigene Adresse** | jede OpenAI-kompatible Schnittstelle (HTTPS, oder HTTP im Heimnetz) |

Jeder Schlüssel wird einzeln mit Windows verschlüsselt gespeichert. *Modelle laden* holt die
aktuelle Modellliste direkt beim Anbieter. Das Modell muss Werkzeuge aufrufen können, für
Screenshots eines, das Bilder versteht. Ampel, Freigaben und Kostenbremse gelten bei jedem
Anbieter gleich. Anbieter ohne eigene Websuche lesen Webseiten über Julias Werkzeug
`webseite_abrufen`, das nie Adressen auf dem PC oder im Heimnetz abruft.

## Die Ampel

Jede Aktion fällt in genau eine Stufe. Das steht nicht nur im Prompt, die Software prüft es
selbst, bevor etwas ausgeführt wird.

| Stufe | Was passiert | Beispiele |
|---|---|---|
| 🟢 **GRÜN** | Julia macht es einfach. | Lesen, Screenshots, Programme öffnen, Dateien in deinen Arbeitsverzeichnissen, lesende Shell-Befehle, Tests |
| 🟡 **GELB** | Julia sagt in einem Satz, was passiert, und wartet auf dein Ja. | Software installieren, Dateien außerhalb der Arbeitsverzeichnisse, Registry, Dienste, `git push`, Admin-Rechte, Werkzeuge von MCP-Servern |
| 🔴 **ROT** | Niemals, auch nicht auf ausdrückliche Anweisung. | Passwörter oder Kartendaten eintippen, Anmeldungen, Zahlungen, `rm -rf`, Papierkorb leeren, Virenschutz abschalten, Code aus dem Netz ausführen |

<details>
<summary><b>Was die Software selbst durchsetzt</b></summary>

- Shell-Befehle werden eingestuft. Nur eindeutig lesende Befehle sind GRÜN, alles Unklare wird GELB, endgültiges Löschen und das Aushebeln von Schutz sind gesperrt.
- `tippen` prüft vorher über UI Automation, ob der Fokus in einem Passwortfeld liegt, und verweigert Terminals sowie Karten- und IBAN-Nummern.
- `klick`, `tippen` und `taste` gehen nur mit einem frischen Screenshot („nie blind klicken“) und liefern danach automatisch einen neuen.
- Passwortfelder im Vordergrundfenster werden im Screenshot geschwärzt, bevor das Bild den PC verlässt – soweit das Programm sie als Passwortfeld meldet.
- Solange Julia deinen Bildschirm ansieht oder Maus und Tastatur steuert, steht oben in der Mitte ein Hinweis mit Stopp-Knopf. In Julias eigenen Screenshots taucht er nicht auf.
- Julias eigene Dateien (Konfiguration, API-Schlüssel, Gedächtnis) sind nie ohne Rückfrage beschreibbar.
- Jede GELB-Aktion landet im Protokoll, überschriebene Dateien werden vorher gesichert. Das Protokoll ist eine Prüfsummen-Kette: Wird mittendrin etwas geändert oder gelöscht, meldet Julia das beim Start.
- **Kostenbremse:** Julia rechnet die API-Kosten mit und stoppt, sobald das Tageslimit erreicht ist (Standard 10 US-$) – auch mitten in einem Auftrag.
- **Schutz gegen Datenabfluss:** Sobald fremde Inhalte im Gespräch sind (Mails, Dateien, Webseiten, Bildschirm, MCP-Server), fragt Julia auch vor Links und Netzwerk-Befehlen. Unsichtbare Zeichen, mit denen Befehle in Texten versteckt werden, entfernt sie vorher. Dauerhaft merken darf sie sich dann nur mit deinem Ja.
- Aus dem Internet heruntergeladene Programme startet Julia nie (Mark-of-the-Web).
- Eine Freigabe gilt für genau eine Aktion. Im Modus **zupackend** („zieh das durch“) legt Julia den ganzen Auftrag einmal vor, danach laufen nur die genannten Kategorien ohne Einzelfrage.
- **„Allem zustimmen“** gibt es unter *Einstellungen → Freigaben* – nur von Hand und nach einer Rückfrage, Julia kann es nicht selbst einschalten. Rot bleibt gesperrt, und nach fremden Inhalten fragt Julia weiter, bevor etwas nach außen geht – außer du schaltest auch das ausdrücklich ab.

Was die Software **nicht** erkennen kann: dass ein bestimmter Klick eine Mail abschickt oder eine
Bestellung auslöst. Dafür ist Julia selbst zuständig, sie fragt dann im Chat.
</details>

## MCP-Server

<p align="center">
  <img src="docs/bilder/mcp-de.png" width="620" alt="Einstellungen: zwei angeschlossene MCP-Server mit Status und Werkzeugen">
</p>

Mit dem [Model Context Protocol](https://modelcontextprotocol.io) schließt du Julia an beliebige
MCP-Server an – etwa für GitHub, Notion, eine Datenbank oder bestimmte Ordner. Deren Werkzeuge
kommen zu Julias eigenen dazu. *Einstellungen → Verbindungen → MCP-Server → Server hinzufügen*:

| Art | Beispiel |
|---|---|
| **Programm auf diesem PC** (stdio) | `npx -y @modelcontextprotocol/server-filesystem C:\Users\du\Dokumente` |
| **Adresse** (Streamable HTTP) | `https://mcp.example.com/mcp` – unverschlüsselt nur auf diesem PC (`localhost`) |

- **Fragt vorher:** Jeder Aufruf eines MCP-Werkzeugs ist GELB. Nur wenn du einen Server als *vertrauenswürdig* markierst, laufen seine reinen Lese-Werkzeuge ohne Rückfrage.
- **Fremder Inhalt:** Was ein Server zurückgibt, behandelt Julia wie eine Webseite – nie als Auftrag, und der Schutz gegen Datenabfluss greift.
- **Tokens verschlüsselt:** Umgebungsvariablen (etwa ein GitHub-Token) und HTTP-Kopfzeilen liegen verschlüsselt im Tresor, nie in der `config.json`, und werden nirgends angezeigt.
- Für jeden Server siehst du Zustand und Werkzeuge, kannst ihn aus- und einschalten, neu starten oder entfernen.

> Ein MCP-Server ist ein Programm mit eigenen Rechten. Füge nur Server hinzu, denen du vertraust.

## Gaming-Overlay

<table>
  <tr>
    <td width="36%" valign="top"><img src="docs/bilder/overlay-de.png" alt="Overlay über dem Spiel"></td>
    <td width="64%" valign="top"><img src="docs/bilder/overlay-einstellungen-de.png" alt="Einstellungen des Overlays: Größe, Schrift, Hintergrund, Kompakt-Modus, Vorschau"></td>
  </tr>
</table>

Mit `Strg+Umschalt+Leertaste` legt sich ein halbtransparentes Chatfenster über dein Spiel –
im Fenstermodus oder randlosen Vollbild. Tippen, Enter, weiterspielen.

- **Von selbst beim Spielen:** Startest du ein Spiel, erscheint das Overlay automatisch – passiv, Klicks gehen durch, das Spiel behält den Fokus. Erkannt werden Spiele von Steam, Epic, Riot, Battle.net, EA, Ubisoft, GOG und Xbox sowie Minecraft; weitere trägst du als Programmnamen ein.
- **Hineinklicken, scrollen, tippen:** Über dem Overlay scrollst du im Verlauf, ein Klick öffnet das Eingabefeld, ein Klick zurück ins Spiel macht es wieder durchlässig.
- **Nach deinem Geschmack:** Breite, Höhe, Schriftgröße, Deckkraft des Hintergrunds (der Text bleibt klar), Kompakt-Modus mit nur den letzten drei Nachrichten, Ausblende-Zeit für Antworten – mit Vorschau-Knopf.
- **Frei verschiebbar:** an der Kopfzeile ziehen, Julia merkt sich die Stelle.
- **Immer da:** Auf Wunsch bleibt das Overlay dauerhaft sichtbar, auch ohne Spiel.
- Freigaben erscheinen im Overlay, statt das große Fenster über das Spiel zu legen. Julia hängt sich nur in die Maus ein, solange der Zeiger über ihren Fenstern ist – das Spiel bleibt flüssig.

> Bei *exklusivem* Vollbild zeigt Windows grundsätzlich keine Overlays – dann das Spiel auf
> „Randloses Fenster“ stellen.

## Die Blase

Auf Wunsch liegt eine animierte Kugel auf deinem Nebenmonitor und zeigt, was Julia gerade tut.
Sie ist **standardmäßig aus** und lässt Klicks durch sich hindurch – nur die Kugel selbst greifst
du mit der Maus und ziehst sie überallhin; Doppelklick öffnet den Chat. Darunter zeigt sie auf
Wunsch Untertitel: was du sagst und was Julia antwortet.

<p align="center">
  <img src="docs/bilder/blase-idle.png" width="150" alt="wartet">
  <img src="docs/bilder/blase-listening.png" width="150" alt="hört zu">
  <img src="docs/bilder/blase-thinking.png" width="150" alt="denkt">
  <img src="docs/bilder/blase-speaking.png" width="150" alt="spricht">
</p>
<p align="center"><sub>wartet · hört zu · denkt · spricht</sub></p>
<p align="center">
  <img src="docs/bilder/blase-untertitel.png" width="300" alt="Blase mit Untertiteln: Frage und Antwort">
</p>

Monitor, Ecke, Größe, Deckkraft, Tempo, Empfindlichkeit und beliebig viele Farben je Zustand
lassen sich zur Laufzeit ändern – in den Einstellungen oder einfach per Satz: „Mach sie grüner.“

## Minecraft

Julia spielt Minecraft (Java Edition) mit dir – als eigene Spielfigur auf deinem Server oder in
deiner Welt. Im Reiter **Minecraft** trägst du nur die Adresse ein und klickst auf **Beitreten**.
Julia findet den Server wie das Spiel selbst (auch über SRV-Einträge und Server-Schutz wie
NeoProtect oder TCPShield).

> 📖 **Schritt-für-Schritt-Anleitung:** [Mit Julia Minecraft spielen](docs/minecraft-spielen.md) – vom Verbinden über alle Befehle bis zum eigenständigen Durchspielen.

<table>
  <tr>
    <td width="50%" valign="top"><img src="docs/bilder/minecraft-aufgaben-de.png" alt="Aufgaben: Folgen, Beschützen, Duell, Einsammeln, Jagen, Einräumen, Schlafen, Geben, Herstellen, Gehe zu"></td>
    <td width="50%" valign="top"><img src="docs/bilder/minecraft-absturz-de.png" alt="Crash-Screen: Julia wurde vom Server geworfen, mit Grund, Zeit und Knopf zum Neu-Verbinden"></td>
  </tr>
</table>

| Aufgabe | Im Spielchat | Was passiert |
|---|---|---|
| Folgen · Komm her | `!folge` · `!komm` | läuft dir nach oder einmal zu dir |
| Beschützen · Duell | `!beschütze mich` · `!duell` | kämpft gegen Monster in deiner Nähe oder gegen dich |
| Abbauen | `!bau ab holz 10` | baut Blöcke ab und sammelt sie ein |
| Gehe zu | `!geh 100 64 -20` | läuft zu Koordinaten |
| Geben | `!gib 5 brot` | bringt dir etwas aus dem Inventar |
| Einsammeln | `!sammel` | hebt herumliegende Sachen auf |
| Jagen | `!jag 3 kuh` | holt Essen von Tieren und sammelt es ein |
| Herstellen | `!craft 4 fackel` | craftet im Inventar oder an der nächsten Werkbank |
| Einräumen | `!verstau` | legt das Inventar in die nächste Truhe (Waffen, Werkzeug, Essen bleiben) |
| Schmelzen | `!schmelz 8 eisen` | schmilzt oder brät im Ofen, Brennstoff nimmt sie selbst |
| Hinstellen · Essen | `!stell werkbank hin` · `!ess` | stellt einen Block neben sich · isst etwas |
| Bauen | `!bau turm 8` · `!bau mauer 10 3` · `!bau hütte` | baut Turm, Mauer, Hütte oder Brücke aus vorhandenem Material |
| Boot & Reittier | `!steig ein` · `!steig aus` | steigt in Boot, Lore oder aufs Reittier – und wieder aus |
| Durchspielen | `!spiel durch` | arbeitet sich selbst Etappe für Etappe Richtung Enderdrache |
| Zuhören steuern | `!hör auch auf NAME` · `!hör nur auf mich` | erlaubt einzelne Spieler oder setzt zurück |
| Schlafen · Stopp | `!schlaf` · `!stopp` | geht ins Bett · hört sofort auf |

`!hilfe` nennt alle Befehle im Spiel. Kämpfen, Folgen und Ausweichen laufen 20-mal pro Sekunde
direkt in Julia – die KI gibt nur die Aufgabe vor. Sie **erkennt, was vor ihr liegt** (auch Lava
oder ein Abgrund) und bremst von selbst, **isst**, sobald sie Hunger hat, und **kämpft klug**:
Waffe und Rüstung legt sie selbst an, bei wenig Leben zieht sie sich zurück oder greift zum
Goldapfel, und einen Creeper umarmt sie nicht, sondern hält Abstand. Sie **verteidigt sich immer
selbst** – kommt ein Monster zu nah, wehrt sie sich, egal was sie gerade tut. Beim Laufen
**klettert sie aus Löchern** und zwei Blöcke hoch, indem sie günstige Blöcke setzt; deine Bauten,
Truhen und Wertsachen reißt sie dabei nie ab.

- **Ansprechen:** Es reicht, wenn `Julia` irgendwo in der Nachricht steht (nicht nur am Anfang); `!` geht auch. Standardmäßig hört sie **nur auf dich**. Du kannst im Spiel einzelne Leute freigeben – „Julia, hör auch auf Peter und Anna“, „hör nicht mehr auf Peter“, „hör nur auf mich“ – oder im Panel grob „auf alle hören“ einschalten. Gehandelt wird immer nur im Spiel, nie am PC, und umstellen darf nur der Besitzer.

- **Auftrag an Julia:** Im Reiter schreibst du in deinen Worten, was sie tun soll – etwa „Hol Holz, bau eine Werkbank und mach dir eine Steinspitzhacke“. Sie sieht sich um, plant die Schritte und arbeitet sie mit ihren Fähigkeiten ab, wartet jeweils auf das Ergebnis und sagt am Ende, was geschafft ist.
- **Durchspielen & lernen:** Mit `!spiel durch` (oder „spiel weiter“) arbeitet sie sich eigenständig einen **Tech-Baum** entlang – vom ersten Holz über Stein, Eisen und Diamant bis zum Nether und zum Enderdrachen. Sie weiß dank der Fortschritts-Anzeige jederzeit, auf welcher Etappe sie steht und was als Nächstes dran ist. Alles hält ein **tägliches Logbuch** fest (eine Datei pro Tag im Datenordner, sofort auf die Platte geschrieben) – das überlebt einen Absturz, sodass ein Spieltag nie verloren ist und du hinterher genau siehst, was geklappt hat und wo sie hing. Ehrlich: ein garantiertes Solo-Durchspielen bis zum Drachen ist nicht sicher – aber sie versteht den Weg, macht echte Fortschritte und wird über das Logbuch nachvollziehbar besser.
- **Voice-Chat-Gruppen:** Julia listet die Gruppen aus dem Simple Voice Chat des Servers auf; du wählst, in welche sie geht. Bei einer geschützten Gruppe gibst du das Passwort ein – es geht nur an den Server, die KI sieht es nie. Mit „Immer beitreten“ geht Julia beim nächsten Mal von selbst hinein; das Passwort liegt dann verschlüsselt auf deinem PC.

<p align="center">
  <img src="docs/bilder/minecraft-gruppen-de.png" width="760" alt="Voice-Chat-Gruppen: Julia ist in einer Gruppe, eine offene Gruppe und eine mit Passwort">
</p>

- **Crash-Screen:** Fliegt Julia vom Server, zeigt der Reiter warum – in klaren Worten, mit Zeit, Spieldauer und der Aufgabe, die gerade lief. Nach einem Verbindungsabbruch versucht sie es dreimal von selbst, nach einem Rauswurf nicht.
- **Konto:** Ohne Konto geht es auf Servern mit `online-mode=false`. Mit **Konto verbinden** meldest du Julias eigenes Java-Konto an – im Browser auf microsoft.com/link, Julia sieht kein Passwort.
- **Reden:** Im Spielchat schreibst du „Julia, …“ oder „!…“; die Antwort kommt zurück in den Spielchat. Mit „Hey Julia“ sprichst du beim Spielen über dein Mikrofon mit ihr. Fragen nimmt sie nur von deinem Spielernamen an, und von dort handelt sie nur im Spiel – nie auf deinem PC.
- **Voice-Chat (Testversion):** Läuft auf dem Server Simple Voice Chat, hört Julia dort mit und antwortet mit Stimme im Spiel. Sie hört nur auf deinen Spielernamen; andere Stimmen werden sofort verworfen.
- **Grenzen:** Von sich aus nur Server auf deinem PC oder im Heimnetz; einen Server im Internet trägst du selbst ein. Große öffentliche Netzwerke wie Hypixel sind gesperrt – dort sind Bots verboten.

## Julia aufs Handy

Es gibt Julia auch als eigenständige **App für Android und iOS** – der Quellcode liegt im Ordner
**[julia-android/](julia-android/)**, gebaut mit [Expo/React Native](https://expo.dev). Wie du sie
startest, steht in **[julia-android/README.md](julia-android/README.md)**.

In der App chattest du mit Julia direkt über deinen KI-Anbieter (**Claude** oder **OpenAI**) – mit
Streaming, Vorlesen und Kosten-Anzeige; der API-Schlüssel liegt sicher im Schlüsselspeicher des Handys.
Die App **funktioniert eigenständig – auch wenn dein PC aus ist**.

Auf Wunsch verbindet sich die App im **Heimnetz oder über dein VPN** mit deinem PC und bedient
die Julia dort: Am PC unter *Einstellungen → Verbindungen → Android-App* einen Code anzeigen, in
der App die Adresse und den Code eingeben. Anfragen laufen dann durch die PC-Julia **samt Ampel**,
Freigaben erscheinen am PC. Es wird nur im Heimnetz/VPN gesprochen, kein Port ins Internet.

**Starten (auf deinem Rechner):**
```bash
cd julia-android
npm install
npx expo start
```
Dann in **Expo Go** (Android/iOS) den QR scannen oder den Emulator nutzen. Bauen und Testen läuft
auf deinem Rechner – Android-/iOS-Werkzeuge bzw. Expo Go nötig.

## Konten verbinden

<p align="center">
  <img src="docs/bilder/verbindungen-de.png" width="560" alt="Verbindungen: Google und Outlook">
</p>

Julia kann dein **Google-Konto** (Gmail, Kalender, Kontakte) und dein **Outlook-Konto**
(Outlook.com, Hotmail oder Microsoft 365) nutzen – auch beide gleichzeitig:

> „Hab ich neue Mails?“ · „Was steht morgen an?“ · „Schreib Anna, dass ich zehn Minuten später komme.“ ·
> „Leg mir Freitag 14 Uhr Zahnarzt ein.“

| Julia kann | Ampel |
|---|---|
| Mails suchen und lesen, Anhänge speichern, Entwürfe anlegen | 🟢 |
| Termine ansehen, Kontakte finden | 🟢 |
| Mails senden, Termine anlegen, Einladungen verschicken | 🟡 – die Freigabekarte zeigt Empfänger und den vollständigen Text |
| Mails oder Termine löschen | gibt es nicht |

Anmelden tust du selbst im Browser, Julia sieht nie ein Passwort:
**[Anleitung für Google](docs/google-einrichten.md)** · **[Anleitung für Outlook](docs/outlook-einrichten.md)**.
Was in einer Mail steht, ist für Julia nie ein Auftrag.

### Mehrere PCs

Hast du Julia auf mehreren PCs, gleichen sie **Gespräche, Gedächtnis, Routinen und
Erinnerungen** direkt untereinander ab – im Heimnetz oder über dein VPN, ohne Cloud. Auf dem
einen PC *Code anzeigen*, auf dem anderen *Code eingeben* – fertig. API-Schlüssel, Konten,
Einstellungen und das Protokoll bleiben auf jedem PC für sich.

## Design

Standard ist **Dunkel im Gaming-Look**: tiefer Hintergrund mit feinem Raster, Leuchtakzente,
Freigabekarten mit Warnstreifen, Werkzeugschritte im Terminal-Stil. Dazu gibt es **Hell** und
**Wie Windows**, sieben Akzentfarben (Glut, Neon, Cyber, Toxic, Magenta, Blut, Gold) und eine
eigene aus dem Farbwähler. Alles greift sofort, ohne Neustart.

**Deine KI, dein Name:** Gib ihr einen eigenen Namen („Rainer“ statt „Julia“), wähle ihre Form
(Assistentin, Assistent oder neutral) und deine eigenen Pronomen. Der Name erscheint überall –
im Chat, im Tray, in den Meldungen und im Gespräch.

## Installation

**Am einfachsten:** [Julia-AI-Setup.exe](https://github.com/MoinMornhart/julia-ai/releases/latest/download/Julia-AI-Setup.exe)
laden und starten – ein **Installations-Assistent** führt dich durch (Zielordner wählbar,
Verknüpfungen, Lizenz), ohne Admin-Rechte, nur für dein Benutzerkonto. Alle Versionen und die
Prüfsummen (`latest.yml`) stehen unter [Releases](https://github.com/MoinMornhart/julia-ai/releases).
Der Installer ist noch nicht signiert; meldet Windows „Der Computer wurde durch Windows geschützt“,
auf „Weitere Informationen“ und dann „Trotzdem ausführen“ klicken.

Beim ersten Start öffnet sich die Einrichtung: Vorname, KI-Anbieter mit Schlüssel und die
Ordner, in denen Julia ohne Rückfrage schreiben darf. Schlüssel werden mit Windows (DPAPI)
verschlüsselt gespeichert.

> **Startet Julia nicht (schwarzes Fenster)?** Sie stellt sich bei einem Grafik-Absturz von selbst
> auf Software-Grafik um und startet einmal neu. Bleibt es hängen, starte einmal mit
> `"Julia AI.exe" --reparatur` (erzwingt Software-Grafik). Einzelheiten stehen in
> `%APPDATA%\Julia\start.log`.

<details>
<summary><b>Aus dem Quellcode</b></summary>

**Voraussetzungen:** Windows 10 oder 11, [Node.js](https://nodejs.org) 20 oder neuer und
[Git](https://git-scm.com).

```powershell
git clone https://github.com/MoinMornhart/julia-ai.git
cd julia-ai
npm install
npm start
```

Whisper liegt fertig in `vendor/whisper` (neu holen mit `node scripts/whisper-holen.js`). Falls
`npm start` meldet, dass Electron fehlt: `node node_modules/electron/install.js` ausführen.
</details>

## Bedienung

| Was | Wie |
|---|---|
| Chat öffnen / schließen | `Strg+Alt+J` oder Klick aufs Tray-Symbol |
| Sprechen | `Strg+Alt+Leertaste` oder „Hey Julia“ – noch einmal drücken bricht ab |
| Gaming-Overlay | `Strg+Umschalt+Leertaste` |
| Markierten Text übernehmen | `Strg+Alt+T` |
| Clip speichern | `Strg+Alt+C` |
| Laufende Aufgabe stoppen | Stopp-Knopf oder `Esc` im Chat |

Alle Hotkeys lassen sich in den Einstellungen ändern. Antworten werden vorgelesen, wenn du
gesprochen hast (einstellbar: immer, nie, bei Sprache).

## Updates

Julia sieht beim Start und danach alle zwei Stunden nach, ob es eine neue Version gibt – nie
mitten im Spiel. Sie lädt den Installer aus den Releases, prüft seine SHA-512-Summe und spielt
ihn erst ein, wenn die laufende Aufgabe fertig ist. Von Hand: Tray-Menü → **Nach Updates
suchen**. Ohne Rückfrage einspielen lässt sich unter *Einstellungen → System* einschalten.

Julia zählt in Zehnerschritten: `0.5.9` → `0.6.0`, `0.9.9` → `1.0.0`.

<details>
<summary><b>Wo Julias Daten liegen</b></summary>

Alles liegt in `%APPDATA%\Julia`. Updates fassen diesen Ordner nie an.

| Datei / Ordner | Inhalt |
|---|---|
| `config.json` | alle Einstellungen, Schlüssel nur verschlüsselt |
| `konten.json` | verbundene Konten und der Tresor – Tokens nur verschlüsselt |
| `gedaechtnis.json` | was Julia sich dauerhaft merkt |
| `gespraeche\` | Gespräche, mit Windows verschlüsselt |
| `protokoll.jsonl` | jede Aktion über GRÜN hinaus, als Prüfsummen-Kette |
| `sicherungen\` | vorherige Fassungen überschriebener Dateien |
| `whisper\` · `piper\` | Sprachmodell und natürliche Stimmen, einmal geladen |
</details>

## Für Entwickler

<details>
<summary><b>Aufbau, Tests, Releases</b></summary>

```
prompt/            System-Prompt, Deutsch und Englisch
src/main/          Hauptprozess: Agent, Werkzeuge, Ampel, Sprache, Whisper, Piper, MCP, Minecraft
src/main/win/      PowerShell-Hilfsprozess für Fenster, Maus, Tastatur, Audio
src/renderer/      Chat, Blase, Overlay, Einstellungen
src/preload/       die einzige Brücke zwischen Oberfläche und Hauptprozess
vendor/whisper/    whisper.cpp (MIT) samt Visual-C++-Laufzeit
test/              node --test
```

```powershell
npm test                                                   # Tests
npm run release -- korrektur "Blase startet jetzt ausgeschaltet"
npm run release -- funktion  "Julia liest jetzt Termine vor"
```

Das Release-Skript lässt vorher die Tests und `npm audit` laufen und bricht ab, wenn etwas
schiefgeht. Dann setzt es die Version, schreibt die Changelog-Zeile, committet, setzt den Tag,
pusht, baut den Installer und hängt ihn ans GitHub-Release.

Die Screenshots dieser README entstehen im Vorführmodus mit Beispieldaten:

```powershell
$env:JULIA_DATEN = "$env:TEMP\julia-demo"; $env:JULIA_SCREENSHOTS = "docs\bilder"; npm start
```
</details>

## Grenzen

- Julia ist ein Programm, kein Mensch – und kein Arzt, Anwalt oder Finanzberater.
- Für die Antworten braucht sie einen KI-Anbieter; mit Ollama oder LM Studio geht das auch ganz ohne Internet. Cloud-Anbieter kosten Guthaben.
- Spracherkennung und Stimmen laufen lokal – auf älteren PCs dauert das Aufschreiben mit *Genau* etwas; dann *Schnell* wählen.
- Der Minecraft-Voice-Chat ist eine Testversion.

## Lizenz

Julia AI steht unter der [MIT-Lizenz](LICENSE): Du darfst sie nutzen, verändern und weitergeben,
solange der Lizenz- und Urheberhinweis erhalten bleibt. Ohne Gewähr.

Mitgeliefert: [whisper.cpp](https://github.com/ggml-org/whisper.cpp) (MIT). Einmal geladen,
nicht mitgeliefert: Whisper-Modelle, [Piper](https://github.com/rhasspy/piper) und die Stimmen
Thorsten und Kerstin (CC0).
