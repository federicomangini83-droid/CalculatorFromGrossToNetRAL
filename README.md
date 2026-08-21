# Calcolatore Retribuzione Netta da RAL — Anno d'imposta 2026

Prototipo che, data la **Retribuzione Annua Lorda (RAL)** di un lavoratore
dipendente del settore privato, calcola il **netto annuale e mensile** e scompone
tutte le voci trattenute e aggiunte.

🔗 **App live:** https://federicomangini83-droid.github.io/CalculatorFromGrossToNetRAL/

---

# PARTE 1 — Definizione teorica del calcolo

## 1.1 Variabili di input

| Simbolo | Variabile | Unità |
|---------|-----------|-------|
| `RAL` | Retribuzione Annua Lorda | € |
| `aINPS` | Aliquota contributiva a carico del lavoratore | % |
| `M` | Numero di mensilità (12/13/14/15) | n. |
| `G` | Giorni di lavoro nell'anno | giorni (max 365) |
| `aReg` | Aliquota addizionale regionale | % |
| `aCom` | Aliquota addizionale comunale | % |
| `FB` | Fringe benefit / welfare annuo | € |
| `vBP` | Valore giornaliero buono pasto | € |
| `gBP` | Giorni con buono pasto nell'anno | giorni |

## 1.2 Parametri fissi (costanti di legge 2026)

| Simbolo | Parametro | Valore 2026 |
|---------|-----------|-------------|
| `S₁%` | Soglia 1° scaglione IRPEF (23%) | fino a 28.000 € |
| `S₂%` | Soglia 2° scaglione IRPEF (33%) | 28.000–50.000 € |
| `S₃%` | Soglia 3° scaglione IRPEF (43%) | oltre 50.000 € |
| `soglia1%` | Soglia contributo aggiuntivo INPS +1% | 56.224 € |
| `MAX` | Massimale contributivo INPS | 122.295 € |
| `Dmax` | Detrazione lavoro dip. massima | 1.955 € |
| `UD` | Ulteriore detrazione cuneo (piena) | 1.000 € |
| `soglia_UD` | Soglie ulteriore detrazione | 20.000 / 32.000 / 40.000 € |
| `T` | Trattamento integrativo massimo | 1.200 € |
| `EFB` | Esenzione fringe benefit | 1.000 € (2.000 con figli) |
| `EBP` | Esenzione buono pasto/giorno | 10 € (elettr.) / 4 € (cart.) |
| `div_TFR` | Divisore TFR | 13,5 |

## 1.3 Formula estesa (passo per passo)

**(1) Contributi INPS** — con base limitata al massimale e +1% oltre soglia:

```
base = min(RAL, MAX)
se base ≤ soglia1%:   CINPS = base × aINPS
altrimenti:           CINPS = soglia1% × aINPS + (base − soglia1%) × (aINPS + 1%)
```

**(2) Reddito complessivo** (= base imponibile IRPEF; i contributi sono deducibili):

```
RC = RAL − CINPS
```

**(3) IRPEF lorda** — progressiva per scaglioni (ogni aliquota solo sulla parte di RC nello scaglione):

```
IRPEFl = 23% × min(RC, 28.000)
       + 33% × max(0, min(RC, 50.000) − 28.000)
       + 43% × max(0, RC − 50.000)
```

**(4) Detrazione lavoro dipendente** (art. 13 TUIR), rapportata ai giorni:

```
             ┌ 1.955                              se RC ≤ 15.000
D_base(RC) = │ 1.910 + 1.190 × (28.000−RC)/13.000  se 15.000 < RC ≤ 28.000
             │ 1.910 × (50.000−RC)/22.000          se 28.000 < RC ≤ 50.000
             └ 0                                   se RC > 50.000

DLav = D_base(RC) × (G / 365)     [+65 € se 25.000 < RC ≤ 35.000]
```

**(5) Ulteriore detrazione — cuneo fiscale** (riduce l'IRPEF, redditi 20k–40k):

```
        ┌ 1.000                          se 20.000 < RC ≤ 32.000
UDetr = │ 1.000 × (40.000−RC)/8.000       se 32.000 < RC ≤ 40.000
        └ 0                              altrimenti
```

**(6) IRPEF netta:**

```
IRPEFn = max(0, IRPEFl − DLav − UDetr)
```

**(7) Addizionali** (sul reddito complessivo):

```
AReg = RC × aReg      ACom = RC × aCom
```

**(8) Somma integrativa — cuneo fiscale** (esente, redditi ≤ 20k, si somma al netto):

```
        ┌ RC × 7,1%   se RC ≤ 8.500
SInt =  │ RC × 5,3%   se 8.500 < RC ≤ 15.000
        │ RC × 4,8%   se 15.000 < RC ≤ 20.000
        └ 0           se RC > 20.000
```

**(9) Trattamento integrativo** (ex bonus 100€, si somma al netto):

```
        ┌ 1.200                      se RC ≤ 15.000 e IRPEFl > DLav
TInt =  │ min(DLav − IRPEFl, 1.200)   se 15.000 < RC ≤ 28.000 e DLav > IRPEFl
        └ 0                          se RC > 28.000
```

### ▶️ FORMULA DEL NETTO ANNUO

```
NETTO ANNUO = RAL − CINPS − IRPEFn − AReg − ACom + SInt + TInt
```

**Ripartizione mensile** (detrazioni e crediti gravano solo sui 12 mesi ordinari):

```
netto_mensilità_aggiuntiva = (RAL/M) − contributi − IRPEF(aliq.marginale) − addizionali
netto_mese_ordinario = (NETTO ANNUO − netto_mensilità_aggiuntiva × (M−12)) / 12
```

**Voci calcolate a parte** (non sommate al netto in busta):

```
buoni pasto esenti = min(vBP, EBP) × gBP
fringe benefit     = FB se FB ≤ EFB, altrimenti FB è interamente tassato (regola "tutto o niente")
TFR annuo          = RAL/13,5 − RAL×0,50%   (figurativo, liquidato a fine rapporto)
```

---

# PARTE 2 — Derivazione di ogni variabile e parametro (con fonte ufficiale)

Ogni valore usato nel calcolo è tracciato alla sua fonte primaria.
I link sono a **Normattiva**, **Gazzetta Ufficiale**, **INPS**, **MEF** e
**Agenzia delle Entrate** (fonti ufficiali dello Stato).

## 2.1 Aliquota contributi INPS `aINPS` = 9,19 % (9,49 % oltre 15 dip.)
Quota IVS a carico del lavoratore dipendente privato (FPLD). Non esiste un singolo
articolo che citi "9,19 %": è la somma delle voci assicurative a carico del lavoratore,
pubblicata dall'INPS. La quota base è **9,19 %**, che sale a **9,49 %** nelle aziende
>15 dipendenti (+0,30 % Fondo Integrazione Salariale); apprendisti **5,84 %**.
- Pagina istituzionale INPS "Aliquote contributive" (aliquota IVS complessiva 33 %):
  https://www.inps.it/it/it/inps-comunica/diritti-e-obblighi-in-materia-di-sicurezza-sociale-nell-unione-e/per-le-imprese/aliquote-contributive.html
- OpenData INPS (tabelle aliquote con la scomposizione 9,19 / 9,49):
  https://opendata.inps.it/opendata/

## 2.2 Soglia +1 % `soglia1%` = 56.224 € e massimale `MAX` = 122.295 €
Valori annuali rivalutati ISTAT. Il +1 % aggiuntivo a carico del lavoratore oltre la
prima fascia deriva dall'art. 3-ter della L. 438/1992; le soglie 2026 sono fissate
dalla circolare annuale INPS.
- Circolare INPS n. 6 del 30/01/2026 (punto 5: soglia 56.224 €; punto 6: massimale 122.295 €):
  https://www.inps.it/it/it/inps-comunica/atti/circolari-messaggi-e-normativa/dettaglio.circolari-e-messaggi.2026.01.circolare-numero-6-del-30-01-2026_15151.html

## 2.3 Deducibilità dei contributi → `RC = RAL − CINPS`
I contributi previdenziali obbligatori sono oneri deducibili: si sottraggono dal
reddito prima di calcolare l'IRPEF.
- Art. 10 TUIR (DPR 917/1986), su Normattiva:
  https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.del.presidente.della.repubblica:1986-12-22;917

## 2.4 Scaglioni e aliquote IRPEF 23 / 33 / 43 %
Struttura a tre scaglioni. Il **2° scaglione è sceso dal 35 % al 33 %** con la Legge
di Bilancio 2026, che ha modificato l'art. 11, c.1, lett. b) del TUIR.
- Art. 11 TUIR (testo vigente), su Normattiva:
  https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.del.presidente.della.repubblica:1986-12-22;917
- Art. 11 TUIR (lettura per commi), Brocardi:
  https://www.brocardi.it/testo-unico-imposte-redditi/titolo-i/capo-i/art11.html
- Legge 30/12/2025 n. 199 (Bilancio 2026), art. 1 c.3 — "35 % → 33 %", su Normattiva:
  https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2025;199
- Stesso testo in Gazzetta Ufficiale (GU n. 301 del 30/12/2025):
  https://www.gazzettaufficiale.it/eli/id/2025/12/30/25G00212/SG

## 2.5 Detrazione lavoro dipendente `DLav` (importi, formule, giorni)
Importo 1.955 € fino a 15.000 €, decrescente fino a 0 a 50.000 €; minimo 690 €
(1.380 € per tempo determinato); **rapportata ai giorni** di lavoro nell'anno.
L'importo massimo è stato portato a 1.955 € dalla Legge di Bilancio 2025.
- Art. 13 c.1 TUIR (testo con le formule per fascia), Brocardi:
  https://www.brocardi.it/testo-unico-imposte-redditi/titolo-i/capo-i/art13.html
- Legge 30/12/2024 n. 207 (Bilancio 2025), art. 1 c.2 lett. b) — "1.880 → 1.955 €", su Normattiva:
  https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2024;207

## 2.6 Cuneo fiscale: somma integrativa `SInt` + ulteriore detrazione `UDetr`
Dal 2025 il taglio del cuneo è realizzato con due misure fiscali alternative in base
al reddito: **somma integrativa** esente (7,1 / 5,3 / 4,8 % fino a 20.000 €) e
**ulteriore detrazione** (1.000 € tra 20.000 e 32.000 €, decrescente fino a 40.000 €).
È la voce "Ult. detraz. L.Dip." del cedolino.
- Legge 30/12/2024 n. 207, art. 1 commi 4–9 (testo del cuneo), su Normattiva:
  https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2024;207
- Stesso testo in Gazzetta Ufficiale (GU n. 305 del 31/12/2024):
  https://www.gazzettaufficiale.it/eli/id/2024/12/31/24G00229/sg

## 2.7 Trattamento integrativo `TInt` (ex bonus 100 €)
Credito che si somma al netto (non riduce l'imponibile): fino a 1.200 €/anno per
redditi ≤ 15.000 € con capienza IRPEF, ridotto fino a 28.000 €.
- D.L. 5/02/2020 n. 3 (istitutivo), conv. L. 2/04/2020 n. 21, su Normattiva:
  https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legge:2020;3

## 2.8 Fringe benefit `EFB` = 1.000 € (2.000 € con figli) — regola "tutto o niente"
Soglia di esenzione dei beni e servizi ceduti al dipendente; se il valore supera la
soglia, l'intero importo diventa imponibile. Soglia elevata per il triennio 2025–2027.
- Art. 51 c.3 TUIR (principio di esenzione), Brocardi:
  https://www.brocardi.it/testo-unico-imposte-redditi/titolo-i/capo-iv/art51.html
- Legge 30/12/2024 n. 207 (soglie 1.000 / 2.000 € per 2025–2027), su Normattiva:
  https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2024;207

## 2.9 Buoni pasto `EBP` = 10 € (elettronici) / 4 € (cartacei)
Esenzione giornaliera; l'eccedenza è tassata. La soglia elettronica è salita da 8 a
10 € con la Legge di Bilancio 2026 (modifica dell'art. 51 c.2 lett. c TUIR).
- Art. 51 c.2 lett. c) TUIR, Brocardi:
  https://www.brocardi.it/testo-unico-imposte-redditi/titolo-i/capo-iv/art51.html
- Legge 30/12/2025 n. 199, art. 1 c.14 ("8 → 10 €" elettronici), su Normattiva:
  https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2025;199

## 2.10 Addizionale regionale `aReg`
Calcolata sul reddito complessivo; aliquota base 1,23 %, maggiorabile dalle Regioni.
Nel prototipo si usa un'aliquota indicativa per Regione: per il valore esatto per
fascia si rimanda al Portale del federalismo fiscale.
- Art. 50 D.Lgs. 15/12/1997 n. 446 (istitutivo), su Normattiva:
  https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:1997-12-15;446
- Disciplina del tributo, Dipartimento delle Finanze (MEF):
  https://www.finanze.gov.it/it/fiscalita/fiscalita-regionale-e-locale/Addizionale-regionale-allIRPEF/disciplina-del-tributo/
- Aliquote reali per Regione/Comune — Portale del federalismo fiscale (MEF):
  https://www.finanze.gov.it/

## 2.11 Addizionale comunale `aCom`
Stabilita dal singolo Comune (0–0,9 %), calcolata sul reddito complessivo.
- D.Lgs. 28/09/1998 n. 360 (istitutivo), su Normattiva:
  https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:1998;360

## 2.12 TFR `div_TFR` = 13,5
Quota annua = retribuzione / 13,5. È un accantonamento figurativo, liquidato a fine
rapporto: mostrato a parte per non falsare il netto in busta.
- Art. 2120 Codice Civile (comma 1: "divisa per 13,5"), Brocardi:
  https://www.brocardi.it/codice-civile/libro-quinto/titolo-ii/capo-i/sezione-iii/art2120.html
- L. 29/05/1982 n. 297 (che ha riscritto l'art. 2120 c.c.), su Normattiva:
  https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:1982;297

## 2.13 Testo unico di riferimento (TUIR) e PDF ufficiale
Tutti gli articoli TUIR citati (10, 11, 13, 51) sono nel DPR 917/1986.
- Testo integrale su Normattiva:
  https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.del.presidente.della.repubblica:1986-12-22;917
- PDF ufficiale del TUIR, Agenzia delle Entrate:
  https://www.agenziaentrate.gov.it/portale/documents/20143/270670/DPR%2022%20dicembre%201986%20n%20917%20%28Tuir%29_Testo%20unico%20del%2022_12_1986%20n.%20917.pdf/

---

## Scelte di semplificazione dichiarate
- **Familiari a carico esclusi** (coniuge, figli, ascendenti): non incidono sul calcolo
  in questa versione. Scelta voluta per un uso personale di stima.
- **Aliquote regionali/comunali indicative**: valori base/medi; il dato puntuale per
  fascia va verificato sul Portale del federalismo fiscale.
- **Assegno Unico Universale** non incluso: non è reddito e non transita in busta paga
  (erogato da INPS su base ISEE).

> ⚠️ Stima indicativa a scopo dimostrativo. Non sostituisce la busta paga reale, che
> può includere premi, conguagli, voci contrattuali e casi particolari non modellati.

## Come eseguirlo in locale
```bash
python -m http.server 8000
# poi apri http://localhost:8000
```
