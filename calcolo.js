/* =========================================================================
   MOTORE DI CALCOLO: dalla RAL al NETTO  (v3)
   - senza familiari a carico (semplificazione voluta)
   - CON cuneo fiscale 2026: somma integrativa (esente) + ulteriore detrazione
   -------------------------------------------------------------------------
   Sequenza:
     RAL
      -> (1) contributi INPS
      -> (2) imponibile fiscale (= reddito complessivo) = RAL - contributi
      -> (3) IRPEF lorda a scaglioni
      -> (4) detrazioni = lavoro dipendente (art.13) + ulteriore detrazione cuneo
      -> (5) IRPEF netta = max(0, lorda - detrazioni)
      -> (6) addizionali regionale + comunale
      -> (7) NETTO ANNUO busta = RAL - contributi - IRPEF netta - addizionali
                                 + somma integrativa cuneo (esente)
                                 + trattamento integrativo (se spetta)
      -> (8) benefici esenti (fringe + buoni) calcolati a parte
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

function aliquotaMarginale(imponibile, p) {
  let aliq = 0;
  for (const s of p.irpef_scaglioni.scaglioni) if (imponibile > s.da) aliq = s.aliquota;
  return aliq;
}

/* ---- (4a) DETRAZIONE LAVORO DIPENDENTE (art.13) con giorni e t.det. ---- */
function calcolaDetrLavoro(reddito, p, giorni, tempoDeterminato) {
  const d = p.detrazioni_lavoro_dipendente;
  for (const f of d.fasce) {
    const sup = (f.a === null) ? Infinity : f.a;
    if (reddito > f.da && reddito <= sup) {
      let base;
      if (f.tipo === "fisso") base = f.importo;
      else { const R = reddito; base = Math.max(0, eval(f.formula)); }
      const b = d.bonus_ulteriore;
      if (reddito > b.da && reddito <= b.a) base += b.importo;
      let importo = base * (giorni / 365);
      if (reddito <= 15000) {
        const min = tempoDeterminato ? f.minimo_tempo_determinato : f.minimo_garantito;
        if (importo > 0 && importo < min) importo = min * (giorni / 365);
      }
      return arrotonda(Math.max(0, importo));
    }
  }
  return 0;
}

/* ---- (4b) CUNEO FISCALE: SOMMA INTEGRATIVA (esente, si somma al netto) ---- */
function calcolaSommaIntegrativa(reddito, p) {
  const s = p.cuneo_fiscale.somma_integrativa;
  if (reddito > s.soglia_max) return 0;
  // percentuale a scaglioni sull'intero reddito (non progressiva sui pezzi)
  let perc = 0;
  for (const sc of s.scaglioni) { if (reddito <= sc.fino_a) { perc = sc.percentuale; break; } }
  return arrotonda(reddito * (perc / 100));
}

/* ---- (4c) CUNEO FISCALE: ULTERIORE DETRAZIONE (riduce IRPEF) ---- */
function calcolaUlterioreDetrazione(reddito, p) {
  const u = p.cuneo_fiscale.ulteriore_detrazione;
  if (reddito <= u.soglia_min || reddito > u.soglia_max) return 0;
  if (reddito <= u.soglia_piena) return u.importo_pieno;           // 1.000 fisso 20-32k
  // decrescente 32-40k: 1000 * (40000 - R) / 8000
  return arrotonda(u.importo_pieno * (u.soglia_max - reddito) / (u.soglia_max - u.soglia_piena));
}

/* ---- TRATTAMENTO INTEGRATIVO (ex bonus 100, si somma) ---- */
function calcolaTrattamentoIntegrativo(reddito, irpefLorda, detrLavoro, p) {
  const t = p.trattamento_integrativo;
  if (reddito > t.soglia_max) return 0;
  if (reddito <= t.soglia_pieno) return (irpefLorda > detrLavoro) ? t.importo_max : 0;
  const diff = detrLavoro - irpefLorda;
  return diff > 0 ? arrotonda(Math.min(diff, t.importo_max)) : 0;
}

/* ---- BENEFICI ESENTI: fringe benefit + buoni pasto ---- */
function calcolaBenefici(input, p) {
  const b = p.benefici_esenti;
  const sogliaFB = input.figliACarico ? b.fringe_benefit.soglia_con_figli : b.fringe_benefit.soglia_senza_figli;
  const fb = input.fringeBenefit || 0;
  const fbEsente = (fb <= sogliaFB) ? fb : 0;
  const fbImponibile = (fb > sogliaFB) ? fb : 0;

  let bpEsenteGiorno = 0;
  if (input.tipoBuonoPasto === "elettronico") bpEsenteGiorno = b.buoni_pasto.esente_elettronico;
  else if (input.tipoBuonoPasto === "cartaceo") bpEsenteGiorno = b.buoni_pasto.esente_cartaceo;

  const valBuono = input.valoreBuono || 0;
  const giorniBuono = input.giorniBuono || b.buoni_pasto.giorni_lavoro_default;
  let bpEsenteAnnuo = 0, bpImponibileAnnuo = 0, bpTotAnnuo = 0, bpMensile = 0;
  if (valBuono > 0 && bpEsenteGiorno > 0) {
    const esenteGiorno = Math.min(valBuono, bpEsenteGiorno);
    const eccedenza = Math.max(0, valBuono - bpEsenteGiorno);
    bpEsenteAnnuo = arrotonda(esenteGiorno * giorniBuono);
    bpImponibileAnnuo = arrotonda(eccedenza * giorniBuono);
    bpTotAnnuo = arrotonda(valBuono * giorniBuono);
    bpMensile = arrotonda(bpTotAnnuo / 12);
  }

  return {
    fringeEsente: arrotonda(fbEsente),
    fringeImponibile: arrotonda(fbImponibile),
    fringeSoglia: sogliaFB,
    buoniEsenteAnnuo: bpEsenteAnnuo,
    buoniImponibileAnnuo: bpImponibileAnnuo,
    buoniTotAnnuo: bpTotAnnuo,
    buoniMensile: bpMensile,
    buoniEsenteGiorno: bpEsenteGiorno,
    valoreBuono: valBuono,
    imponibileAggiuntivo: arrotonda(fbImponibile + bpImponibileAnnuo),
    totaleEsente: arrotonda(fbEsente + bpEsenteAnnuo)
  };
}

/* =========================================================================
   FUNZIONE PRINCIPALE
   ========================================================================= */
function calcolaNetto(input, p) {
  const ral = input.ral;
  const giorni = input.giorni || 365;
  const tempoDet = (input.tipoContratto === "determinato");

  const benefici = calcolaBenefici(input, p);

  // (1) contributi
  const contributiInps = calcolaContributiInps(ral, input.aliquotaInps, p);

  // (2) imponibile fiscale (= reddito complessivo) + eventuale imponibile da benefici sforati
  const imponibileFiscale = arrotonda(ral - contributiInps + benefici.imponibileAggiuntivo);

  // (3) IRPEF lorda
  const irpefLorda = calcolaIrpefLorda(imponibileFiscale, p);

  // (4) detrazioni: lavoro + ulteriore detrazione cuneo
  const detrLavoro = calcolaDetrLavoro(imponibileFiscale, p, giorni, tempoDet);
  const ulterioreDetr = calcolaUlterioreDetrazione(imponibileFiscale, p);
  const detrazioniTotali = arrotonda(detrLavoro + ulterioreDetr);

  // (5) IRPEF netta
  const irpefNetta = arrotonda(Math.max(0, irpefLorda - detrazioniTotali));

  // (6) addizionali
  const addReg = arrotonda(imponibileFiscale * (input.aliquotaRegionale / 100));
  const addCom = arrotonda(imponibileFiscale * (input.aliquotaComunale / 100));

  // cuneo: somma integrativa (esente, si somma) + trattamento integrativo
  const sommaIntegrativa = calcolaSommaIntegrativa(imponibileFiscale, p);
  const trattIntegrativo = calcolaTrattamentoIntegrativo(imponibileFiscale, irpefLorda, detrLavoro, p);
  const creditiEsenti = arrotonda(sommaIntegrativa + trattIntegrativo);

  // (7) netto annuo busta (i crediti esenti si sommano)
  const nettoAnnuo = arrotonda(ral - contributiInps - irpefNetta - addReg - addCom + creditiEsenti);

  // --- SDOPPIAMENTO MENSILITA ---
  const mensilita = input.mensilita;
  const mesiExtra = Math.max(0, mensilita - 12);
  const aliqMarg = aliquotaMarginale(imponibileFiscale, p);

  // netto di UNA mensilita aggiuntiva (13/14/15): subisce solo INPS + IRPEF marginale + addizionali, NIENTE detrazioni/crediti
  const lordoMese = ral / mensilita;
  const contrMese = arrotonda(lordoMese * (input.aliquotaInps / 100));
  const imponMese = lordoMese - contrMese;
  const irpefMese = imponMese * (aliqMarg / 100);
  const addMese = imponMese * ((input.aliquotaRegionale + input.aliquotaComunale) / 100);
  const nettoMensilitaAggiuntiva = arrotonda(lordoMese - contrMese - irpefMese - addMese);

  // i 12 mesi ordinari assorbono detrazioni + crediti -> netto ordinario piu alto
  const nettoMesiExtraTot = nettoMensilitaAggiuntiva * mesiExtra;
  const nettoOrdinarioMese = arrotonda((nettoAnnuo - nettoMesiExtraTot) / 12);

  const tfr = arrotonda((ral / p.tfr.divisore) - ral * (p.tfr.contributo_fondo_garanzia / 100));
  const totaleTasse = arrotonda(irpefNetta + addReg + addCom);
  const nettoInBusta = arrotonda(ral - contributiInps - totaleTasse); // senza crediti (per la torta)

  return {
    ral, contributiInps, imponibileFiscale, irpefLorda,
    detrLavoro, ulterioreDetr, detrazioniTotali, irpefNetta,
    addReg, addCom, totaleTasse,
    sommaIntegrativa, trattIntegrativo, creditiEsenti,
    nettoInBusta, nettoAnnuo,
    nettoOrdinarioMese, nettoMensilitaAggiuntiva, mesiExtra, mensilita, lordoMese: arrotonda(lordoMese),
    tfr, benefici,
    aliquotaEffettiva: arrotonda((totaleTasse / ral) * 100),
    percNetto: arrotonda((nettoAnnuo / ral) * 100)
  };
}

if (typeof module !== "undefined" && module.exports) module.exports = { calcolaNetto };
