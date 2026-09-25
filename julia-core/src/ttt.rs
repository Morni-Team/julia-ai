//! Test-Time-Training-Mechanik (Live-Lernen) mit O(1)-Speicher – Experiment (Issue #119).
//!
//! Dieses Modul setzt den von JONIMONI09 vorgeschlagenen `ttt_engine`-Baustein um:
//! ein rekurrenter Zustand fester Größe plus ein „Fast-Weights"-Puffer, der während
//! der Interaktion per Hebb'schem Update lernt, und eine Grammatik-Logit-Maske, die
//! ungültige Ausgaben mathematisch ausschließt.
//!
//! ## Was hier stimmt (und getestet ist)
//!
//! * **O(1)-Speicher über die Tokenzahl:** `recurrent_state` und `fast_weights` haben
//!   eine **feste** Länge (`STATE_DIM * STATE_DIM`) und wachsen nie – egal wie viele
//!   Tokens verarbeitet werden. Das ist der ehrliche Kern der Idee.
//! * **Grammatik-Schranke:** In [`TttEngine::generate_next_token`] können nur von der
//!   Maske erlaubte Tokens gewählt werden; ungültige sind per `NEG_INFINITY`
//!   ausgeschlossen (constrained decoding auf Logit-Ebene, wie in [`crate::grammar`]).
//!
//! ## Ehrliche Einordnung (wichtig – wie im Crate-Kopf)
//!
//! Dies ist eine **Mechanik-/Experiment-Demo**, KEIN kluges Sprachmodell: Es gibt
//! keine echte Embedding-→Layer-→Output-Kette und kein trainiertes Vokabular. Der
//! Ausgang ist grammatikgültig, aber inhaltlich bedeutungslos, solange keine echten,
//! trainierten Gewichte eingelesen und tatsächlich verwendet werden – das bleibt der
//! große, kostenrelevante Trainings-Schritt (Entscheidung für MoinMornhart).
//!
//! Bewusst **ohne** externe Abhängigkeit: der Vorschlag nutzte `memmap2` für einen
//! echten O(1)-RAM-Ladevorgang des Basismodells; julia-core ist aber absichtlich
//! `std`-only (kleiner, offline-tauglicher, CI-robuster Build). Deshalb liest
//! [`TttEngine::load_from_disk`] die Basis-Datei per `std::fs` ein. Der **Lern-/
//! Inferenz**-Speicher ist trotzdem O(1); nur das einmalige Einlesen ist O(Dateigröße)
//! – ein späterer mmap-Weg wäre eine bewusste Abhängigkeits-Entscheidung.

/// Zustandsdimension (Kanäle je Richtung). Fest → O(1)-Speicher.
pub const STATE_DIM: usize = 128;

/// Größe des Ausgabe-Alphabets (Bytes 0..255).
pub const VOCAB_SIZE: usize = 256;

/// Ein Live-Lern-Kern mit festem Zustand und festem Fast-Weights-Puffer.
pub struct TttEngine {
    /// Einmal von der Platte gelesenes Basismodell (roh). Aktuell nur gehalten, nicht
    /// in die Generierung eingebunden – siehe „Ehrliche Einordnung" im Modul-Kopf.
    base_weights: Vec<f32>,
    /// Rekurrenter Zustand, feste Länge `STATE_DIM * STATE_DIM` (wächst nie).
    recurrent_state: Vec<f32>,
    /// Fast-Weights (Live-Lern-Puffer), gleiche feste Länge.
    fast_weights: Vec<f32>,
    /// Lernrate für das Hebb'sche Update.
    learning_rate: f32,
}

impl Default for TttEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl TttEngine {
    /// Erzeugt einen Kern mit Null-Zustand und leerem Basismodell.
    pub fn new() -> Self {
        let n = STATE_DIM * STATE_DIM;
        TttEngine {
            base_weights: Vec::new(),
            recurrent_state: vec![0.0; n],
            fast_weights: vec![0.0; n],
            learning_rate: 0.01,
        }
    }

    /// Lädt ein Basismodell (als `f32`-Little-Endian) von der Platte. Fehlt/kaputt die
    /// Datei, wird ein klarer `io::Error` zurückgegeben, statt still zu scheitern.
    pub fn load_from_disk(path: &str) -> std::io::Result<Self> {
        let rohdaten = std::fs::read(path)?;
        // 4 Bytes je f32; überzählige Rest-Bytes werden ignoriert.
        let base_weights: Vec<f32> = rohdaten
            .chunks_exact(4)
            .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
            .collect();
        let mut engine = TttEngine::new();
        engine.base_weights = base_weights;
        Ok(engine)
    }

    /// Anzahl der eingelesenen Basis-Gewichte (0, solange keins geladen wurde).
    pub fn base_len(&self) -> usize {
        self.base_weights.len()
    }

    /// Länge des rekurrenten Zustands – bleibt über die gesamte Sequenz konstant (O(1)).
    pub fn state_len(&self) -> usize {
        self.recurrent_state.len()
    }

    /// Verarbeitet einen Eingabe-Token und lernt dabei (Hebb'sches Fast-Weights-Update).
    ///
    /// Aktualisiert je Zustandszeile genau die Spalte des Tokens: der Zustand zerfällt
    /// und bekommt einen Impuls, die Fast-Weights ziehen dem Zustands-Signal nach.
    /// Der Speicher wächst dabei um **0 Byte**, egal wie oft aufgerufen.
    pub fn process_and_learn_token(&mut self, token: u8) {
        let spalte = (token as usize) % STATE_DIM;
        let zerfall = 0.98f32;
        let rate = self.learning_rate;
        for (zustand_zeile, fast_zeile) in self
            .recurrent_state
            .chunks_mut(STATE_DIM)
            .zip(self.fast_weights.chunks_mut(STATE_DIM))
        {
            let signal = zustand_zeile[spalte] * zerfall + 0.1;
            zustand_zeile[spalte] = signal;
            fast_zeile[spalte] = (fast_zeile[spalte] + rate * signal) * 0.999;
        }
    }

    /// Wählt den nächsten Token greedy aus den Diagonal-Logits – aber nur unter den
    /// von `grammar_mask` erlaubten. Ungültige Tokens sind ausgeschlossen (die
    /// Grammatik kann physisch nicht verletzt werden).
    pub fn generate_next_token(&self, grammar_mask: &[bool; VOCAB_SIZE]) -> u8 {
        let mut bester = 0u8;
        let mut max_wert = f32::NEG_INFINITY;
        for (idx, &erlaubt) in grammar_mask.iter().enumerate() {
            if !erlaubt {
                continue; // ungültiger Pfad – mathematisch ausgeschlossen
            }
            let dim = idx % STATE_DIM;
            let diagonale = dim * STATE_DIM + dim;
            let logit = self.recurrent_state[diagonale] + self.fast_weights[diagonale];
            if logit > max_wert {
                max_wert = logit;
                bester = idx as u8;
            }
        }
        bester
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn speicher_bleibt_konstant_ueber_viele_tokens() {
        let mut e = TttEngine::new();
        let start = e.state_len();
        for t in 0..100_000u32 {
            e.process_and_learn_token((t % 256) as u8);
            assert_eq!(e.state_len(), start); // O(1): wächst nie
        }
        assert_eq!(start, STATE_DIM * STATE_DIM);
    }

    #[test]
    fn grammatik_maske_erlaubt_nur_gueltige_tokens() {
        let mut e = TttEngine::new();
        // Etwas lernen, damit die Logits nicht alle exakt gleich (0) sind.
        for _ in 0..5 {
            e.process_and_learn_token(3);
            e.process_and_learn_token(7);
        }
        // Nur Token 3 und 7 sind erlaubt.
        let mut maske = [false; VOCAB_SIZE];
        maske[3] = true;
        maske[7] = true;
        let pick = e.generate_next_token(&maske);
        assert!(pick == 3 || pick == 7, "nur erlaubte Tokens dürfen gewählt werden");
    }

    #[test]
    fn leere_maske_liefert_den_null_token() {
        let e = TttEngine::new();
        let maske = [false; VOCAB_SIZE];
        // Kein Token erlaubt → der Vorgabewert 0 bleibt (kein Panik/kein Ausbruch).
        assert_eq!(e.generate_next_token(&maske), 0);
    }

    #[test]
    fn defekte_datei_meldet_klaren_fehler() {
        let r = TttEngine::load_from_disk("gibt-es-definitiv-nicht-12345.bin");
        assert!(r.is_err()); // statt still zu scheitern: klarer io::Error
    }

    #[test]
    fn frisch_geladen_hat_noch_keine_basisgewichte() {
        let e = TttEngine::new();
        assert_eq!(e.base_len(), 0);
    }
}
