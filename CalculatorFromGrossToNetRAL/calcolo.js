/* =========================================================================
   MOTORE DI CALCOLO: dalla RAL (Retribuzione Annua Lorda) al NETTO
   -------------------------------------------------------------------------
   La logica segue la sequenza fiscale/previdenziale italiana:

     RAL
      -> (1) contributi INPS a carico lavoratore    [base: RAL]
      -> (2) imponibile fiscale = RAL - contributi   (contributi deducibili)
      -> (3) IRPEF lorda a scaglioni                 [base: imponibile fiscale]
      -> (4) detrazioni lavoro dipendente            (riducono l'IRPEF lorda)
      -> (5) IRPEF netta = IRPEF lorda - detrazioni  (minimo 0)
      -> (6) addizionali regionale + comunale        [base: imponibile fiscale]
      -> (7) NETTO ANNUO = RAL - contributi - IRPEF netta - addizionali

   Il TFR e' trattato a parte perche' e' un accantonamento FIGURATIVO:
   non viene percepito mensilmente, ma liquidato a fine rapporto.
   ========================================================================= */


/* -------------------------------------------------------------------------
   (1) CONTRIBUTI INPS A CARICO DEL LAVORATORE
   - aliquota base (es. 9,19%) sulla quota fino alla soglia
   - +1% aggiuntivo sulla quota che supera la soglia (es. 56.224 EUR)
   - nessun contributo oltre il massimale (es. 122.295 EUR)
   ------------------------------------------------------------------------- */
function calcolaContributiInps(ral, aliquotaBase, params) {
  const c = params.contributi_inps;
  const soglia = c.soglia_aliquota_aggiuntiva;   // oltre questa si applica +1%
  const massimale = c.massimale_contributivo;     // oltre questo: niente contributi
  const aliquotaAgg = c.aliquota_aggiuntiva_1pct; // 1%

  // La base contributiva non puo' superare il massimale
  const baseContributiva = Math.min(ral, massimale);

  let contributi = 0;

  if (baseContributiva <= soglia) {
    // tutta la retribuzione sta sotto la soglia: solo aliquota base
    contributi = baseContributiva * (aliquotaBase / 100);
  } else {
    // parte sotto soglia con aliquota base
    contributi += soglia * (aliquotaBase / 100);
    // parte sopra soglia: aliquota base + 1% aggiuntivo
    const quotaSopra = baseContributiva - soglia;
    contributi += quotaSopra * ((aliquotaBase + aliquotaAgg) / 100);
  }

  return arrotonda(contributi);
}


/* -------------------------------------------------------------------------
   (3) IRPEF LORDA A SCAGLIONI
   Ogni aliquota si applica SOLO alla porzione di reddito dentro lo scaglione.
   ------------------------------------------------------------------------- */
function calcolaIrpefLorda(imponibile, params) {
  const scaglioni = params.irpef_scaglioni.scaglioni;
  let imposta = 0;

  for (const s of scaglioni) {
    const limiteInf = s.da;
    const limiteSup = (s.a === null) ? Infinity : s.a;

    if (imponibile > limiteInf) {
      // quanto reddito cade dentro questo scaglione
      const quotaNelloScaglione = Math.min(imponibile, limiteSup) - limiteInf;
      imposta += quotaNelloScaglione * (s.aliquota / 100);
    }
  }

  return arrotonda(imposta);
}


/* -------------------------------------------------------------------------
   (4) DETRAZIONI PER LAVORO DIPENDENTE (art. 13 TUIR)
   L'importo dipende dalla fascia di reddito complessivo (R).
   ------------------------------------------------------------------------- */
function calcolaDetrazioni(reddito, params) {
  const fasce = params.detrazioni_lavoro_dipendente.fasce;

  for (const f of fasce) {
    const limiteSup = (f.a === null) ? Infinity : f.a;

    if (reddito > f.da && reddito <= limiteSup) {
      if (f.tipo === "fisso") {
        return f.importo;
      }
      if (f.tipo === "formula") {
        // valuta la formula sostituendo R con il reddito
        const R = reddito;
        // formula tipo: "1910 + 1190 * (28000 - R) / 13000"
        const valore = eval(f.formula); // formula controllata dal file parametri
        return arrotonda(Math.max(0, valore));
      }
    }
  }
  return 0;
}


/* -------------------------------------------------------------------------
   (6) ADDIZIONALI REGIONALE E COMUNALE
   Base di calcolo: imponibile fiscale (RAL - contributi).
   ------------------------------------------------------------------------- */
function calcolaAddizionale(imponibile, aliquota) {
  return arrotonda(imponibile * (aliquota / 100));
}


/* -------------------------------------------------------------------------
   TFR - accantonamento annuo (FIGURATIVO, non in busta paga mensile)
   Quota = RAL / 13,5, al netto del contributo 0,50% al Fondo garanzia.
   ------------------------------------------------------------------------- */
function calcolaTfr(ral, params) {
  const t = params.tfr;
  const quotaLorda = ral / t.divisore;
  const contributo = ral * (t.contributo_fondo_garanzia / 100);
  return arrotonda(quotaLorda - contributo);
}


/* =========================================================================
   FUNZIONE PRINCIPALE: orchestra tutti i passaggi
   input = {
     ral, aliquotaInps, aliquotaRegionale, aliquotaComunale, mensilita
   }
   ========================================================================= */
function calcolaNetto(input, params) {
  const ral = input.ral;

  // (1) contributi INPS
  const contributiInps = calcolaContributiInps(ral, input.aliquotaInps, params);

  // (2) imponibile fiscale (i contributi sono deducibili - art. 10 TUIR)
  const imponibileFiscale = arrotonda(ral - contributiInps);

  // (3) IRPEF lorda
  const irpefLorda = calcolaIrpefLorda(imponibileFiscale, params);

  // (4) detrazioni (calcolate sul reddito complessivo = imponibile fiscale)
  const detrazioni = calcolaDetrazioni(imponibileFiscale, params);

  // (5) IRPEF netta (non puo' andare sotto zero)
  const irpefNetta = arrotonda(Math.max(0, irpefLorda - detrazioni));

  // (6) addizionali
  const addizionaleRegionale = calcolaAddizionale(imponibileFiscale, input.aliquotaRegionale);
  const addizionaleComunale  = calcolaAddizionale(imponibileFiscale, input.aliquotaComunale);

  // (7) netto annuo
  const nettoAnnuo = arrotonda(
    ral - contributiInps - irpefNetta - addizionaleRegionale - addizionaleComunale
  );

  // netto mensile (ripartito sul numero di mensilita')
  const nettoMensile = arrotonda(nettoAnnuo / input.mensilita);

  // TFR figurativo (informativo)
  const tfr = calcolaTfr(ral, params);

  // totale tasse/trattenute
  const totaleTasse = arrotonda(irpefNetta + addizionaleRegionale + addizionaleComunale);
  const totaleTrattenute = arrotonda(contributiInps + totaleTasse);

  return {
    ral: ral,
    contributiInps: contributiInps,
    imponibileFiscale: imponibileFiscale,
    irpefLorda: irpefLorda,
    detrazioni: detrazioni,
    irpefNetta: irpefNetta,
    addizionaleRegionale: addizionaleRegionale,
    addizionaleComunale: addizionaleComunale,
    totaleTasse: totaleTasse,
    totaleTrattenute: totaleTrattenute,
    nettoAnnuo: nettoAnnuo,
    nettoMensile: nettoMensile,
    tfr: tfr,
    // percentuali sul lordo (utili per il grafico e la trasparenza)
    aliquotaEffettiva: arrotonda((totaleTasse / ral) * 100, 2),
    percNetto: arrotonda((nettoAnnuo / ral) * 100, 2)
  };
}


/* Utility: arrotonda a N decimali (default 2) */
function arrotonda(n, decimali = 2) {
  const f = Math.pow(10, decimali);
  return Math.round(n * f) / f;
}


/* Esporta le funzioni se siamo in Node (per test/validazione); nel browser
   restano globali. */
if (typeof module !== "undefined" && module.exports) {
  module.exports = { calcolaNetto, calcolaContributiInps, calcolaIrpefLorda,
                     calcolaDetrazioni, calcolaAddizionale, calcolaTfr };
}
