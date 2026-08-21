/* =========================================================================
   MOTORE DI CALCOLO: dalla RAL al NETTO  (v2 - con detrazioni familiari,
   trattamento integrativo, benefici esenti, mensilita aggiuntive)
   -------------------------------------------------------------------------
   Sequenza:
     RAL
      -> (1) contributi INPS
      -> (2) imponibile fiscale = RAL - contributi
      -> (3) IRPEF lorda a scaglioni
      -> (4) detrazioni: lavoro dipendente (art.13) + familiari (art.12)
      -> (5) IRPEF netta = max(0, lorda - detrazioni)
      -> (6) addizionali regionale + comunale
      -> (7) NETTO ANNUO in busta = RAL - contributi - IRPEF netta - addizionali
      -> (8) + trattamento integrativo (credito, si somma)
      -> (9) benefici esenti (fringe + buoni pasto), calcolati a parte
   ========================================================================= */

function arrotonda(n, d = 2) { const f = Math.pow(10, d); return Math.round(n * f) / f; }

/* ---- (1) CONTRIBUTI INPS ---- */
function calcolaContributiInps(ral, aliquotaBase, p) {
  const c = p.contributi_inps;
  const base = Math.min(ral, c.massimale_contributivo);
  let contributi;
  if (base <= c.soglia_aliquota_aggiuntiva) {
    contributi = base * (aliquotaBase / 100);
  } else {
    contributi = c.soglia_aliquota_aggiuntiva * (aliquotaBase / 100);
    contributi += (base - c.soglia_aliquota_aggiuntiva) * ((aliquotaBase + c.aliquota_aggiuntiva_1pct) / 100);
  }
  return arrotonda(contributi);
}

/* ---- (3) IRPEF LORDA A SCAGLIONI ---- */
function calcolaIrpefLorda(imponibile, p) {
  let imposta = 0;
  for (const s of p.irpef_scaglioni.scaglioni) {
    const sup = (s.a === null) ? Infinity : s.a;
    if (imponibile > s.da) imposta += (Math.min(imponibile, sup) - s.da) * (s.aliquota / 100);
  }
  return arrotonda(imposta);
}

/* Aliquota marginale (serve per il netto delle mensilita aggiuntive) */
function aliquotaMarginale(imponibile, p) {
  let aliq = 0;
  for (const s of p.irpef_scaglioni.scaglioni) {
    if (imponibile > s.da) aliq = s.aliquota;
  }
  return aliq;
}

/* ---- (4a) DETRAZIONE LAVORO DIPENDENTE (art.13) con giorni e t.det. ---- */
function calcolaDetrLavoro(reddito, p, giorni, tempoDeterminato) {
  const d = p.detrazioni_lavoro_dipendente;
  let base = 0;
  for (const f of d.fasce) {
    const sup = (f.a === null) ? Infinity : f.a;
    if (reddito > f.da && reddito <= sup) {
      if (f.tipo === "fisso") base = f.importo;
      else { const R = reddito; base = Math.max(0, eval(f.formula)); }
      // bonus ulteriore +65 (comma 1.1)
      const b = d.bonus_ulteriore;
      if (reddito > b.da && reddito <= b.a) base += b.importo;
      // ragguaglio ai giorni di lavoro nell'anno
      let importo = base * (giorni / 365);
      // minimo garantito (piu alto per tempo determinato)
      if (reddito <= 15000) {
        const min = tempoDeterminato ? f.minimo_tempo_determinato : f.minimo_garantito;
        // il minimo si applica al valore ragguagliato solo se spettante
        if (importo > 0 && importo < min) importo = min * (giorni / 365);
      }
      return arrotonda(Math.max(0, importo));
    }
  }
  return 0;
}

/* ---- (4b) DETRAZIONI FAMILIARI (art.12) ---- */
function calcolaDetrFamiliari(reddito, fam, p) {
  const df = p.detrazioni_familiari;
  let tot = 0;
  const dett = { figli: 0, coniuge: 0, altri: 0 };

  // FIGLI 21-29 (formula per figlio, soglia sale di 15.000 per figlio extra)
  if (fam.numFigli > 0) {
    const soglia = df.figli.soglia_base + (fam.numFigli - 1) * df.figli.incremento_soglia_per_figlio_extra;
    if (reddito < soglia) {
      const teor = fam.figliDisabili ? df.figli.teorico_disabile : df.figli.teorico;
      dett.figli = arrotonda(teor * fam.numFigli * (soglia - reddito) / soglia);
    }
  }

  // CONIUGE a carico (scaglioni art.12 c.1 lett.a, azzeramento oltre 80.000)
  if (fam.coniuge) {
    dett.coniuge = arrotonda(calcolaDetrConiuge(reddito));
  }

  // ALTRI FAMILIARI (ascendenti conviventi): 750 * (80000 - R)/80000
  if (fam.numAltri > 0) {
    if (reddito < df.altri_familiari.soglia) {
      dett.altri = arrotonda(df.altri_familiari.teorico * fam.numAltri *
        (df.altri_familiari.soglia - reddito) / df.altri_familiari.soglia);
    }
  }

  tot = dett.figli + dett.coniuge + dett.altri;
  return { totale: arrotonda(tot), dettaglio: dett };
}

/* Coniuge a carico - scaglioni art.12 c.1 lett.a (importi 2026) */
function calcolaDetrConiuge(R) {
  if (R <= 15000) {
    // 800 - 110 * (R/15000)
    return 800 - 110 * (R / 15000);
  } else if (R <= 40000) {
    // 690 fisso, con maggiorazioni tra 29.000 e 35.200
    let d = 690;
    if (R > 29000 && R <= 29200) d += 10;
    else if (R > 29200 && R <= 34700) d += 20;
    else if (R > 34700 && R <= 35000) d += 30;
    else if (R > 35000 && R <= 35100) d += 20;
    else if (R > 35100 && R <= 35200) d += 10;
    return d;
  } else if (R <= 80000) {
    // 690 * (80000 - R) / 40000
    return 690 * (80000 - R) / 40000;
  }
  return 0;
}

/* ---- (8) TRATTAMENTO INTEGRATIVO (ex bonus 100) - si SOMMA al netto ---- */
function calcolaTrattamentoIntegrativo(reddito, irpefLorda, detrLavoro, p) {
  const t = p.trattamento_integrativo;
  if (reddito > t.soglia_max) return 0;
  // condizione capienza: IRPEF lorda deve superare la detrazione da lavoro
  if (reddito <= t.soglia_pieno) {
    return (irpefLorda > detrLavoro) ? t.importo_max : 0;
  }
  // fascia 15.000-28.000: spetta se detrazioni > IRPEF, per la differenza (max 1200)
  const diff = detrLavoro - irpefLorda;
  if (diff > 0) return arrotonda(Math.min(diff, t.importo_max));
  return 0;
}

/* ---- (9) BENEFICI ESENTI: fringe benefit + buoni pasto ---- */
function calcolaBenefici(input, p) {
  const b = p.benefici_esenti;

  // FRINGE BENEFIT: regola tutto-o-niente
  const sogliaFB = input.figliACarico ? b.fringe_benefit.soglia_con_figli : b.fringe_benefit.soglia_senza_figli;
  const fb = input.fringeBenefit || 0;
  const fbEsente   = (fb <= sogliaFB) ? fb : 0;
  const fbImponibile = (fb > sogliaFB) ? fb : 0; // se sfora, TUTTO imponibile

  // BUONI PASTO: esente giornaliero, eccedenza tassata
  let bpEsenteGiorno = 0, bpImponibileGiorno = 0;
  if (input.tipoBuonoPasto === "elettronico") bpEsenteGiorno = b.buoni_pasto.esente_elettronico;
  else if (input.tipoBuonoPasto === "cartaceo") bpEsenteGiorno = b.buoni_pasto.esente_cartaceo;

  const valBuono = input.valoreBuono || 0;
  const giorniBuono = input.giorniBuono || b.buoni_pasto.giorni_lavoro_default;
  let bpEsenteAnnuo = 0, bpImponibileAnnuo = 0, bpMensile = 0;
  if (valBuono > 0 && bpEsenteGiorno > 0) {
    const esenteGiorno = Math.min(valBuono, bpEsenteGiorno);
    const eccedenzaGiorno = Math.max(0, valBuono - bpEsenteGiorno);
    bpEsenteAnnuo = arrotonda(esenteGiorno * giorniBuono);
    bpImponibileAnnuo = arrotonda(eccedenzaGiorno * giorniBuono);
    bpMensile = arrotonda(valBuono * (giorniBuono / 12)); // valore mensile in buoni
  }

  return {
    fringeEsente: arrotonda(fbEsente),
    fringeImponibile: arrotonda(fbImponibile),
    buoniEsenteAnnuo: bpEsenteAnnuo,
    buoniImponibileAnnuo: bpImponibileAnnuo,
    buoniMensile: bpMensile,
    imponibileAggiuntivo: arrotonda(fbImponibile + bpImponibileAnnuo)
  };
}

/* =========================================================================
   FUNZIONE PRINCIPALE
   ========================================================================= */
function calcolaNetto(input, p) {
  const ral = input.ral;
  const giorni = input.giorni || 365;
  const tempoDet = (input.tipoContratto === "determinato");

  // benefici (potrebbero aggiungere imponibile se sforano soglia)
  const benefici = calcolaBenefici(input, p);

  // (1) contributi (calcolati sulla RAL; l'imponibile fringe eccedente e' gia' al netto contributi nel prototipo)
  const contributiInps = calcolaContributiInps(ral, input.aliquotaInps, p);

  // (2) imponibile fiscale = RAL - contributi + eventuale imponibile da benefici sforati
  const imponibileFiscale = arrotonda(ral - contributiInps + benefici.imponibileAggiuntivo);

  // (3) IRPEF lorda
  const irpefLorda = calcolaIrpefLorda(imponibileFiscale, p);

  // (4) detrazioni
  const detrLavoro = calcolaDetrLavoro(imponibileFiscale, p, giorni, tempoDet);
  const famObj = calcolaDetrFamiliari(imponibileFiscale, {
    numFigli: input.numFigli || 0,
    figliDisabili: input.figliDisabili || false,
    coniuge: input.coniuge || false,
    numAltri: input.numAltri || 0
  }, p);
  const detrazioniTotali = arrotonda(detrLavoro + famObj.totale);

  // (5) IRPEF netta
  const irpefNetta = arrotonda(Math.max(0, irpefLorda - detrazioniTotali));

  // (6) addizionali
  const addReg = arrotonda(imponibileFiscale * (input.aliquotaRegionale / 100));
  const addCom = arrotonda(imponibileFiscale * (input.aliquotaComunale / 100));

  // (7) netto annuo in busta
  const nettoAnnuo = arrotonda(ral - contributiInps - irpefNetta - addReg - addCom);

  // (8) trattamento integrativo (si somma)
  const trattIntegrativo = calcolaTrattamentoIntegrativo(imponibileFiscale, irpefLorda, detrLavoro, p);
  const nettoAnnuoConBonus = arrotonda(nettoAnnuo + trattIntegrativo);

  // --- SDOPPIAMENTO MENSILITA: ordinaria (con detrazioni) vs aggiuntiva (senza) ---
  const mensilita = input.mensilita;
  const mesiExtra = Math.max(0, mensilita - 12);
  const aliqMarg = aliquotaMarginale(imponibileFiscale, p);

  // netto di UNA mensilita aggiuntiva (13/14/15): niente detrazioni
  const lordoMese = ral / mensilita;
  const contrMese = arrotonda(lordoMese * (input.aliquotaInps / 100));
  const imponMese = lordoMese - contrMese;
  const irpefMese = imponMese * (aliqMarg / 100);
  const addMese = imponMese * ((input.aliquotaRegionale + input.aliquotaComunale) / 100);
  const nettoMensilitaAggiuntiva = arrotonda(lordoMese - contrMese - irpefMese - addMese);

  // i 12 mesi ordinari assorbono le detrazioni -> netto ordinario piu alto
  const nettoMesiExtraTot = nettoMensilitaAggiuntiva * mesiExtra;
  const nettoOrdinarioMese = arrotonda((nettoAnnuo - nettoMesiExtraTot) / 12);

  const tfr = arrotonda((ral / p.tfr.divisore) - ral * (p.tfr.contributo_fondo_garanzia / 100));
  const totaleTasse = arrotonda(irpefNetta + addReg + addCom);

  return {
    ral, contributiInps, imponibileFiscale, irpefLorda,
    detrLavoro, detrFamiliari: famObj.totale, detrFamDettaglio: famObj.dettaglio,
    detrazioniTotali, irpefNetta, addReg, addCom, totaleTasse,
    nettoAnnuo, trattIntegrativo, nettoAnnuoConBonus,
    nettoOrdinarioMese, nettoMensilitaAggiuntiva, mesiExtra, mensilita,
    tfr, benefici,
    aliquotaEffettiva: arrotonda((totaleTasse / ral) * 100),
    percNetto: arrotonda((nettoAnnuo / ral) * 100)
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { calcolaNetto };
}
