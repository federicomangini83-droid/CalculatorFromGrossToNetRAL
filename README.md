[README.md](https://github.com/user-attachments/files/31300583/README.md)
# Calcolatore Retribuzione Netta da RAL — 2026

Prototipo di un calcolatore che, partendo dalla **Retribuzione Annua Lorda (RAL)**,
proietta il **netto annuale e mensile** del dipendente e mostra tutte le voci
trattenute sul lordo (contributi INPS, IRPEF, addizionali).

## 🔗 Sito live
👉 _(inserire qui il link GitHub Pages dopo il deploy)_

## 🎯 Cosa fa
- Input: RAL, mensilità (12/13/14), tipo contratto, dimensione azienda, regione, addizionale comunale.
- Output: netto annuo e mensile, tabella delle trattenute, **grafico a torta** della ripartizione della RAL.

## 🧮 Logica di calcolo
La sequenza segue le regole fiscali/previdenziali italiane:

```
RAL
 → (1) contributi INPS a carico lavoratore        [base: RAL]
 → (2) imponibile fiscale = RAL − contributi        (contributi deducibili, art. 10 TUIR)
 → (3) IRPEF lorda a scaglioni 23/33/43%           [base: imponibile fiscale]
 → (4) detrazioni lavoro dipendente (art. 13 TUIR) (riducono l'IRPEF lorda)
 → (5) IRPEF netta = IRPEF lorda − detrazioni       (minimo 0)
 → (6) addizionali regionale + comunale            [base: imponibile fiscale]
 → (7) NETTO ANNUO = RAL − contributi − IRPEF netta − addizionali
```

Il **TFR** è mostrato a parte perché è un accantonamento *figurativo*
(liquidato a fine rapporto, non percepito in busta paga mensile).

## 📁 Struttura del progetto
```
├── index.html          # pagina (form + risultati + grafico)
├── style.css           # grafica
├── calcolo.js          # MOTORE: tutta la logica di calcolo, commentata
├── app.js              # collega interfaccia, dati e motore
└── data/
    ├── parametri.json  # costanti di legge (scaglioni, INPS, detrazioni…)
    └── opzioni.json    # scelte del form (regioni, mensilità, contratto…)
```

Architettura a **due file dati separati**: per aggiornare un'aliquota domani
basta modificare il JSON, senza toccare la logica.

## 📚 Fonti (anno d'imposta 2026)
| Voce | Riferimento |
|------|-------------|
| IRPEF a scaglioni 23/33/43% | Art. 11 TUIR (DPR 917/1986), modif. L. 199/2025 |
| Contributi INPS 9,19% (quota lavoratore) | Tabelle aliquote INPS 2026 (OpenData) |
| Soglia +1% (56.224 €) e massimale (122.295 €) | Circolare INPS n. 6/2026 |
| Detrazioni lavoro dipendente | Art. 13, c.1 TUIR |
| Addizionale regionale | Art. 50 D.Lgs. 446/1997 |
| Addizionale comunale | D.Lgs. 360/1998 |

> ⚠️ Stima indicativa a scopo dimostrativo. Non sostituisce la busta paga reale
> (che può includere premi, conguagli, cuneo fiscale, ecc.).

## ▶️ Come eseguirlo in locale
Serve un piccolo server (il sito carica i JSON via `fetch`):
```bash
python -m http.server 8000
# poi apri http://localhost:8000
```
