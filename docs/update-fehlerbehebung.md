# Update klappt nicht? – Fehlerbehebung

Kurzanleitung, wenn ein Update fehlschlägt („Datei in Benutzung", „kein Zugriff",
oder es tut sich scheinbar nichts).

## 1. Wo stehen die Infos?

Julia schreibt zwei lokale Logbücher in den Datenordner
(`%AppData%\Julia`):

- **`update.log`** – der eigenständige Update-Wächter (Auschecken, Abhängigkeiten,
  Neustart, Rückrollen). Seit v7.9.1 steht hier bei einem Fehler die **genaue
  Ursache** (z. B. `FEHLER git checkout: EBUSY … pfad/zur/datei` = Datei gesperrt).
- **`start.log`** – der Programmstart (GPU, Grafik, allgemeine Fehler).

Windows-Installer-Fehler (bei der installierten Fassung) protokolliert **Windows**
selbst: Ereignisanzeige → Windows-Protokolle → Anwendung.

## 2. Häufigste Ursache: eine Sicherheitssoftware sperrt Dateien

„Datei in Benutzung"/`EBUSY`/`EPERM` kommt fast immer daher, dass ein
**Virenscanner** oder **Backup-/Cloud-Sync-Tool** kurz eine Datei im Julia-Ordner
offen hält. Julia wiederholt solche Schritte seit v7.7.0 automatisch mehrfach –
hilft das nicht:

1. **Defender-Ausnahme setzen:** Einstellungen → System → „Von Windows Defender
   ausschließen (Admin)". Blockiert der **Manipulationsschutz**, folgt dort die
   Anleitung für den manuellen Ausschluss.
2. Andere Virenscanner/Backup-/Sync-Tools (z. B. OneDrive, Dropbox, Acronis) für
   den Julia-Ordner ebenfalls ausnehmen oder kurz pausieren.
3. Julia komplett schließen (auch im Tray) und das Update erneut anstoßen.

## 3. Warum kein separates „Updater-Programm" (C++/Extra-App)?

Ein selbst gebautes Zusatz-`.exe` wäre **nicht signiert** – und genau unsignierte
Programme blockiert Windows SmartScreen/Defender besonders gern. Das würde
Blockaden **vermehren**, nicht verhindern. Julias Update-Wächter ist bereits ein
**eigenständiger Prozess**, der losgelöst läuft, prüft (SHA-512), ein Backup hält
und im Fehlerfall zurückrollt.

Der einzige Weg, dass Installer/Update auf **jedem** PC ohne Warnungen „einfach
laufen", ist ein **Code-Signing-Zertifikat** (kostenpflichtig). Sobald eins über
`CSC_LINK`/`CSC_KEY_PASSWORD` bereitsteht, signiert der Build automatisch.

## 4. Nichts hilft?

Die aktuelle Version **von Hand** installieren: neueste
`Julia-AI-Setup.exe` von den GitHub-Releases laden, Julia schließen, Setup
ausführen. Kommt danach die Meldung „unbekannter Herausgeber", liegt das an der
fehlenden Signatur (Punkt 3) – „Weitere Informationen → Trotzdem ausführen".
