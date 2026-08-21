# Calcolatore netto da RAL - 2026

Applicazione web per stimare il netto annuo e mensile di un lavoratore dipendente partendo dalla RAL.

**App:** [Apri il calcolatore](https://federicomangini83-droid.github.io/CalculatorFromGrossToNetRAL/)

L'obiettivo è avere una stima leggibile per confrontare offerte economiche. Non è una replica completa del cedolino: il perimetro e le semplificazioni sono dichiarati qui sotto.

---

## Flusso del calcolo

```text
RAL
- contributi INPS
= reddito imponibile

reddito imponibile
-> IRPEF lorda per scaglioni
- detrazione da lavoro dipendente
- ulteriore detrazione sul lavoro dipendente
= IRPEF netta

reddito imponibile
-> addizionale regionale
-> addizionale comunale

netto annuo =
RAL
- contributi INPS
- IRPEF netta
- addizionale regionale
- addizionale comunale
+ eventuali crediti spettanti
```

Buoni pasto, fringe benefit e TFR sono mostrati separatamente perché non sono una normale mensilità netta.

---

## Semplificazioni

### Addizionale regionale

Le aliquote regionali 2026 sono state inserite per tutte le Regioni e per le Province autonome di Bolzano e Trento usando il database ufficiale del Dipartimento delle Finanze.

Il file `data/opzioni.json` distingue quattro casi:

- `aliquota_unica`: una percentuale sull'intero imponibile;
- `scaglioni_progressivi`: ogni percentuale si applica solo alla quota di reddito del relativo scaglione;
- `aliquota_intero_imponibile_per_fascia`: la percentuale della fascia raggiunta si applica all'intero imponibile;
- `regola_speciale_umbria`: gestione dedicata alle agevolazioni generali pubblicate dal MEF.

Sono gestite anche alcune regole generali non legate alla famiglia, per esempio:

- esenzione della Valle d'Aosta fino a 15.000 euro;
- deduzione della Provincia autonoma di Trento fino a 30.000 euro;
- detrazione generale della Provincia autonoma di Bolzano;
- detrazione di 60 euro del Lazio tra 28.001 e 30.000 euro;
- detrazione di 150 euro dell'Umbria tra 28.001 e 50.000 euro.

### Agevolazioni regionali non applicate

Non vengono applicate le agevolazioni regionali che richiedono informazioni non presenti nel form, in particolare quelle collegate a:

- figli a carico;
- numero di figli;
- figli o familiari con disabilità;
- percentuale e mesi di carico.

Queste esclusioni sono indicate nel file `opzioni.json` tramite `nota_semplificazione` e sono mostrate anche nell'audit dell'addizionale regionale.

### Addizionale comunale

L'addizionale comunale è un input manuale.

```text
addizionale comunale = reddito imponibile x aliquota inserita
```

Il prototipo non importa automaticamente aliquote, scaglioni o soglie di esenzione del singolo Comune. Prima di inserire la percentuale occorre verificarla nel database ufficiale del Dipartimento delle Finanze.

### Altre esclusioni

Non sono gestiti:

- detrazioni per coniuge, figli o altri familiari;
- premi, straordinari, trasferte e conguagli;
- fondi pensione e trattenute specifiche;
- regole contrattuali o personali non presenti nel form.

---

## Addizionali regionali 2026 inserite nel file opzioni

La tabella riassume i valori presenti in `data/opzioni.json`.

| Regione / Provincia autonoma | Modalità | Aliquote inserite | Note del prototipo |
|---|---|---|---|
| Abruzzo | Progressiva | 1,67% fino a 28.000; 2,87% fino a 50.000; 3,33% oltre | Nessuna regola familiare applicata |
| Basilicata | Unica | 1,23% |  |
| Bolzano | Progressiva | 1,23% fino a 50.000; 1,73% oltre | Gestite le detrazioni generali; esclusa la detrazione per figli |
| Calabria | Unica | 1,73% |  |
| Campania | Progressiva | 1,73%; 2,96%; 3,20%; 3,33% | Escluse le detrazioni per figli |
| Emilia-Romagna | Progressiva | 1,33%; 1,93%; 2,78%; 3,33% |  |
| Friuli-Venezia Giulia | Aliquota sull'intero imponibile per fascia | 0,70% fino a 15.000; 1,23% oltre | Oltre 15.000 euro, 1,23% sull'intero imponibile |
| Lazio | Aliquota sull'intero imponibile per fascia | 1,73% fino a 28.000; 3,33% oltre | Gestita la detrazione di 60 euro tra 28.001 e 30.000 |
| Liguria | Progressiva | 1,23% fino a 28.000; 3,18% fino a 50.000; 3,23% oltre |  |
| Lombardia | Progressiva | 1,23%; 1,58%; 1,72%; 1,73% |  |
| Marche | Progressiva | 1,23%; 1,53%; 1,70%; 1,73% | Esclusa l'agevolazione per specifici casi di disabilità |
| Molise | Progressiva | 2,03%; 2,23%; 3,63%; 3,63% |  |
| Piemonte | Progressiva | 1,62%; 2,68%; 3,31%; 3,33% | Escluse le detrazioni per figli |
| Puglia | Progressiva | 1,33%; 2,13%; 3,23%; 3,33% | Escluse le detrazioni per carichi di famiglia |
| Sardegna | Unica | 1,23% | Escluse le detrazioni per figli |
| Sicilia | Unica | 1,23% |  |
| Toscana | Progressiva | 1,42%; 1,43%; 3,32%; 3,33% |  |
| Trento | Progressiva | 1,23% fino a 50.000; 1,73% oltre | Gestita la deduzione fino a 30.000; esclusa la detrazione per figli |
| Umbria | Regola speciale | 1,23% sull'intero imponibile fino a 28.000; poi scaglioni 1,73%; 3,02%; 3,12%; 3,33% | Gestita la detrazione di 150 euro tra 28.001 e 50.000 |
| Valle d'Aosta | Unica con esenzione | Esente fino a 15.000; 1,23% sull'intero imponibile oltre |  |
| Veneto | Unica | 1,23% | Esclusa l'aliquota agevolata per specifici casi di disabilità |

Le fasce precise sono nel file `data/opzioni.json`.

---

## Come verificare le addizionali regionali sul sito del MEF

Pagina iniziale ufficiale:

[Apri la ricerca delle addizionali regionali](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/sceltaregione.htm?cm=)

Procedura:

1. Aprire la pagina.
2. Selezionare la Regione o Provincia autonoma.
3. Nella pagina dei risultati selezionare l'anno **2026**.
4. Controllare le colonne **Aliquota** e **Fascia di applicazione**.
5. Leggere sempre anche **Disposizioni particolari**, **Norme di riferimento** e **Note**.
6. Confrontare la pagina con la voce corrispondente in `data/opzioni.json`.

### Link ufficiali diretti per Regione

- [Abruzzo - MEF](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/addregirpef.php?reg=01)
- [Basilicata - MEF](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/addregirpef.php?reg=02)
- [Provincia autonoma di Bolzano - MEF](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/addregirpef.php?reg=03)
- [Calabria - MEF](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/addregirpef.php?reg=04)
- [Campania - MEF](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/addregirpef.php?reg=05)
- [Emilia-Romagna - MEF](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/addregirpef.php?reg=06)
- [Friuli-Venezia Giulia - MEF](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/addregirpef.php?reg=07)
- [Lazio - MEF](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/addregirpef.php?reg=08)
- [Liguria - MEF](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/addregirpef.php?reg=09)
- [Lombardia - MEF](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/addregirpef.php?reg=10)
- [Marche - MEF](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/addregirpef.php?reg=11)
- [Molise - MEF](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/addregirpef.php?reg=12)
- [Piemonte - MEF](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/addregirpef.php?reg=13)
- [Puglia - MEF](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/addregirpef.php?reg=14)
- [Sardegna - MEF](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/addregirpef.php?reg=15)
- [Sicilia - MEF](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/addregirpef.php?reg=16)
- [Toscana - MEF](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/addregirpef.php?reg=17)
- [Provincia autonoma di Trento - MEF](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/addregirpef.php?reg=18)
- [Umbria - MEF](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/addregirpef.php?reg=19)
- [Valle d'Aosta - MEF](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/addregirpef.php?reg=20)
- [Veneto - MEF](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/addregirpef.php?reg=21)

---

## Addizionale comunale

Pagina ufficiale:

[Apri la ricerca delle addizionali comunali](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/nuova_addcomirpef/sceltaregione.htm)

Procedura:

1. Cercare il Comune o selezionare la Regione.
2. Selezionare l'anno di interesse.
3. Controllare aliquota, eventuali scaglioni, soglia di esenzione e note.
4. Inserire nell'app la percentuale scelta per la simulazione.

**Semplificazione:** l'app non gestisce automaticamente scaglioni o esenzioni comunali.

---

## Altre fonti ufficiali

### TUIR

[DPR 917/1986 su Normattiva](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.del.presidente.della.repubblica:1986-12-22;917!vig=2025-01-21)

Articoli usati:

- articolo 10: oneri deducibili;
- articolo 11: aliquote e scaglioni IRPEF;
- articolo 13: detrazione da lavoro dipendente;
- articolo 51: fringe benefit e buoni pasto.

### Aliquota IRPEF del 33% dal 2026

[Legge 30 dicembre 2025, n. 199 su Normattiva](https://www.normattiva.it/eli/id/2025/12/30/25G00212/CONSOLIDATED/)

Aprire l'articolo 1 e cercare il comma 3.

### Cuneo fiscale

[Legge 30 dicembre 2024, n. 207 su Normattiva](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2024;207)

Aprire l'articolo 1 e leggere i commi da 4 a 9.

### Soglia INPS dell'1% e massimale 2026

[Circolare INPS n. 6 del 30 gennaio 2026](https://www.inps.it/it/it/inps-comunica/atti/circolari-messaggi-e-normativa/dettaglio.circolari-e-messaggi.2026.01.circolare-numero-6-del-30-01-2026_15151.html)

Nel documento consultare:

- punto 5: quota soggetta all'aliquota aggiuntiva dell'1%;
- punto 6: massimale annuo della base contributiva e pensionabile.

---

## Struttura dei file

```text
index.html          struttura della pagina
style.css           layout e popup dell'audit
app.js              input, output e testi dell'audit
calcolo.js          formule, regole regionali e calcolo del netto
data/opzioni.json   opzioni e dati regionali 2026
data/parametri.json altri parametri fiscali e contributivi
README.md           perimetro, semplificazioni e fonti
```

---

## Avvio in locale

```bash
python -m http.server 8000
```

Poi aprire `http://localhost:8000`.

---

## Limite d'uso

Il risultato è una stima. Prima di prendere una decisione economica va confrontato con un cedolino reale, una simulazione payroll o un professionista abilitato.
