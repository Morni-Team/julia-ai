//! julia-core – nativer, ressourcenschonender Kern-Anfang für Julia AI (Issue #65).
//!
//! Dies ist die getestete **Mathematik-Grundlage** für einen Nicht-Transformer-Kern.
//! Sie setzt die real existierenden, ressourcensparenden Techniken um, die im Issue
//! genannt wurden – als sauberer, modularer Rust-Code:
//!
//! * [`state`] – lineare Zustandsraum-Rekurrenz (SSM-Stil) mit O(1)-Speicher über die Sequenzlänge (ersetzt den wachsenden Transformer-KV-Cache).
//! * [`ternary`] – ternäre Gewichte `{-1, 0, +1}` (BitNet-b1.58): das Matrix-Vektor-Produkt wird zu reiner Addition/Subtraktion, ohne Multiplikation.
//! * [`stream`] – Gewichte zeilenweise von der Platte streamen: der RAM-Bedarf bleibt O(cols), unabhängig von der Modellgröße.
//! * [`grammar`] – Grammatik-Masking auf Logit-Ebene (constrained decoding): erzwingt gültige Ausgaben.
//! * [`safety`] – ein ehrlich begrenztes Sicherheits-Gate (kein Ersatz für die Ampel – siehe Modul-Doku).
//! * [`train`] – lokaler Online-Trainings-Loop (Delta-/Hebb'sche Updates), 100 % lokal, plus Statistik und Quantisierung nach ternär.
//! * [`ttt`] – Live-Lern-Mechanik (Test-Time Training) mit O(1)-Speicher + Grammatik-Maske (Experiment, Issue #119) – ehrlich als Mechanik-Demo gekennzeichnet, kein trainiertes Modell.
//!
//! ## Ehrliche Einordnung
//!
//! WAS DAS IST: kompilierbarer, unit-getesteter Kern mit realer Mathematik – der
//! richtige, ressourcenschonende Unterbau für einen eigenen, linearen KI-Kern.
//!
//! WAS DAS (NOCH) NICHT IST: ein trainiertes, „kluges" Modell. Die Gewichte müssen
//! aus einem Training kommen (Daten + Rechenzeit); das ist der große, kostenrelevante
//! Schritt und bewusst **nicht** Teil dieses Grundgerüsts. Genauso wenig macht der
//! Kern eine KI „von selbst gutartig" – Sicherheit bleibt an der Ampel/den Werkzeugen.

pub mod cli;
pub mod grammar;
pub mod safety;
pub mod state;
pub mod stream;
pub mod ternary;
pub mod train;
pub mod ttt;

#[cfg(test)]
mod tests {
    use crate::grammar::{argmax, mask_logits};
    use crate::safety::{koexistenz_gate, Freigabe};
    use crate::state::LinearState;
    use crate::ternary::Ternary;

    // Ein winziger, illustrativer Durchlauf: ein Token durch den linearen Zustand,
    // eine ternäre Projektion auf „Logits", Grammatik-Masking, dann Greedy-Auswahl –
    // und ein Sicherheits-Gate obenauf. Zeigt, wie die Bausteine zusammenspielen.
    #[test]
    fn mini_pipeline_spielt_zusammen() {
        // Zustand mit 3 Kanälen.
        let mut zustand = LinearState::new(vec![0.5, 0.5, 0.5], vec![1.0, 1.0, 1.0], vec![1.0, 1.0, 1.0]);
        let _y = zustand.step(&[1.0, 0.0, -1.0]);
        assert_eq!(zustand.state_len(), 3); // Zustand bleibt fester Größe (O(1)).

        // Ternäre 4x3-Matrix erzeugt 4 „Logits" aus dem Zustand.
        let w = Ternary::from_values(4, 3, vec![
            1, 0, 0,
            0, 1, 0,
            0, 0, 1,
            1, -1, 0,
        ]);
        let mut logits = w.matvec(&[0.2, 0.9, 0.1]);
        assert_eq!(logits.len(), 4);

        // Nur Token 0 und 3 sind grammatikalisch erlaubt.
        mask_logits(&[0, 3], &mut logits);
        let pick = argmax(&logits).unwrap();
        assert!(pick == 0 || pick == 3, "nur erlaubte Tokens dürfen gewählt werden");

        // Sicherheits-Gate: harmlos → erlaubt, schädlich → blockiert.
        assert_eq!(koexistenz_gate(0.0), Freigabe::Erlaubt);
        assert!(matches!(koexistenz_gate(0.9), Freigabe::Blockiert(_)));
    }
}
