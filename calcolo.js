/* =========================================================================
   MOTORE DI CALCOLO: dalla RAL al NETTO  (v4 - con dati per audit)
   ========================================================================= */

function arrotonda(n, d = 2) { const f = Math.pow(10, d); return Math.round(n * f) / f; }

function calcolaContributiInps(ral, aliquotaBase, p) {
  const c = p.contributi_inps;
  const base = Math.min(ral, c.massimale_contributivo);
  let contributi;
  if (base <= c.soglia_aliquota_aggiuntiva) contributi = base * (aliquotaBase / 100);
  else {
    contributi = c.soglia_aliquota_aggiuntiva * (aliquotaBase / 100);
    contributi += (base - c.soglia_aliquota_aggiuntiva) * ((aliquotaBase + c.aliquota_aggiuntiva_1pct) / 100);
  }
  return arrotonda(contributi);
}

function calcolaIrpefLorda(imponibile, p) {
  let imposta = 0;
  for (const s of p.irpef_scaglioni.scaglioni) {
    const sup = (s.a === null) ? Infinity : s.a;
    if (imponibile > s.da) imposta += (Math.min(imponibile, sup) - s.da) * (s.aliquota / 100);
  }
  return arrotonda(imposta);
}

/* dettaglio scaglioni per l'audit: [{aliquota, base, imposta}] */
function dettaglioIrpef(imponibile, p) {
  const out = [];
  for (const s of p.irpef_scaglioni.scaglioni) {
    const sup = (s.a === null) ? Infinity : s.a;
    if (imponibile > s.da) {
      const base = Math.min(imponibile, sup) - s.da;
      out.push({ aliquota: s.aliquota, base: arrotonda(base), imposta: arrotonda(base * s.aliquota / 100) });
    }
  }
  return out;
}

function aliquotaMarginale(imponibile, p) {
  let aliq = 0;
  for (const s of p.irpef_scaglioni.scaglioni) if (imponibile > s.da) aliq = s.aliquota;
  return aliq;
}

function calcolaDetrLavoro(reddito, p, giorni, tempoDeterminato) {
  const d = p.detrazioni_lavoro_dipendente;
  for (const f of d.fasce) {
    const sup = (f.a === null) ? Infinity : f.a;
    if (reddito > f.da && reddito <= sup) {
      let base;
      if (f.tipo === "fisso") base = f.importo;
      else { const R = reddito; base = Math.max(0, eval(f.formula)); }
      let bonus65 = 0;
      const b = d.bonus_ulteriore;
      if (reddito > b.da && reddito <= b.a) { bonus65 = b.importo; base += bonus65; }
      let importo = base * (giorni / 365);
      if (reddito <= 15000) {
        const min = tempoDeterminato ? f.minimo_tempo_determinato : f.minimo_garantito;
        if (importo > 0 && importo < min) importo = min * (giorni / 365);
      }
      return { valore: arrotonda(Math.max(0, importo)), bonus65: bonus65, fascia: f };
    }
  }
  return { valore: 0, bonus65: 0, fascia: null };
}

function calcolaSommaIntegrativa(reddito, p) {
  const s = p.cuneo_fiscale.somma_integrativa;
  if (reddito > s.soglia_max) return { valore: 0, perc: 0 };
  let perc = 0;
  for (const sc of s.scaglioni) if (reddito <= sc.fino_a) { perc = sc.percentuale; break; }
  return { valore: arrotonda(reddito * (perc / 100)), perc: perc };
}

function calcolaUlterioreDetrazione(reddito, p) {
  const u = p.cuneo_fiscale.ulteriore_detrazione;
  if (reddito <= u.soglia_min || reddito > u.soglia_max) return 0;
  if (reddito <= u.soglia_piena) return u.importo_pieno;
  return arrotonda(u.importo_pieno * (u.soglia_max - reddito) / (u.soglia_max - u.soglia_piena));
}

function calcolaTrattamentoIntegrativo(reddito, irpefLorda, detrLavoro, p) {
  const t = p.trattamento_integrativo;
  if (reddito > t.soglia_max) return 0;
  if (reddito <= t.soglia_pieno) return (irpefLorda > detrLavoro) ? t.importo_max : 0;
  const diff = detrLavoro - irpefLorda;
  return diff > 0 ? arrotonda(Math.min(diff, t.importo_max)) : 0;
}

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
    fringeEsente: arrotonda(fbEsente), fringeImponibile: arrotonda(fbImponibile), fringeSoglia: sogliaFB,
    buoniEsenteAnnuo: bpEsenteAnnuo, buoniImponibileAnnuo: bpImponibileAnnuo, buoniTotAnnuo: bpTotAnnuo,
    buoniMensile: bpMensile, buoniEsenteGiorno: bpEsenteGiorno, valoreBuono: valBuono, giorniBuono: giorniBuono,
    imponibileAggiuntivo: arrotonda(fbImponibile + bpImponibileAnnuo), totaleEsente: arrotonda(fbEsente + bpEsenteAnnuo)
  };
}

function calcolaNetto(input, p) {
  const ral = input.ral;
  const giorni = input.giorni || 365;
  const tempoDet = (input.tipoContratto === "determinato");

  const benefici = calcolaBenefici(input, p);
  const contributiInps = calcolaContributiInps(ral, input.aliquotaInps, p);
  const imponibileFiscale = arrotonda(ral - contributiInps + benefici.imponibileAggiuntivo);
  const irpefLorda = calcolaIrpefLorda(imponibileFiscale, p);
  const irpefDettaglio = dettaglioIrpef(imponibileFiscale, p);

  const dl = calcolaDetrLavoro(imponibileFiscale, p, giorni, tempoDet);
  const detrLavoro = dl.valore;
  const ulterioreDetr = calcolaUlterioreDetrazione(imponibileFiscale, p);
  const detrazioniTotali = arrotonda(detrLavoro + ulterioreDetr);
  const irpefNetta = arrotonda(Math.max(0, irpefLorda - detrazioniTotali));

  const addReg = arrotonda(imponibileFiscale * (input.aliquotaRegionale / 100));
  const addCom = arrotonda(imponibileFiscale * (input.aliquotaComunale / 100));

  const si = calcolaSommaIntegrativa(imponibileFiscale, p);
  const sommaIntegrativa = si.valore;
  const trattIntegrativo = calcolaTrattamentoIntegrativo(imponibileFiscale, irpefLorda, detrLavoro, p);
  const creditiEsenti = arrotonda(sommaIntegrativa + trattIntegrativo);

  const nettoAnnuo = arrotonda(ral - contributiInps - irpefNetta - addReg - addCom + creditiEsenti);

  const mensilita = input.mensilita;
  const mesiExtra = Math.max(0, mensilita - 12);
  const aliqMarg = aliquotaMarginale(imponibileFiscale, p);
  const lordoMese = ral / mensilita;
  const contrMese = arrotonda(lordoMese * (input.aliquotaInps / 100));
  const imponMese = lordoMese - contrMese;
  const irpefMese = imponMese * (aliqMarg / 100);
  const addMese = imponMese * ((input.aliquotaRegionale + input.aliquotaComunale) / 100);
  const nettoMensilitaAggiuntiva = arrotonda(lordoMese - contrMese - irpefMese - addMese);
  const nettoMesiExtraTot = nettoMensilitaAggiuntiva * mesiExtra;
  const nettoOrdinarioMese = arrotonda((nettoAnnuo - nettoMesiExtraTot) / 12);

  const tfr = arrotonda((ral / p.tfr.divisore) - ral * (p.tfr.contributo_fondo_garanzia / 100));
  const totaleTasse = arrotonda(irpefNetta + addReg + addCom);
  const nettoInBusta = arrotonda(ral - contributiInps - totaleTasse);

  return {
    ral, contributiInps, imponibileFiscale, irpefLorda, irpefDettaglio,
    detrLavoro, detrLavoroBonus65: dl.bonus65, ulterioreDetr, detrazioniTotali, irpefNetta,
    addReg, addCom, totaleTasse, sommaIntegrativa, sommaIntegrativaPerc: si.perc,
    trattIntegrativo, creditiEsenti, nettoInBusta, nettoAnnuo,
    nettoOrdinarioMese, nettoMensilitaAggiuntiva, mesiExtra, mensilita, lordoMese: arrotonda(lordoMese),
    aliqMarg, contrMese, tfr, benefici,
    aliquotaInps: input.aliquotaInps, aliquotaRegionale: input.aliquotaRegionale, aliquotaComunale: input.aliquotaComunale,
    aliquotaEffettiva: arrotonda((totaleTasse / ral) * 100), percNetto: arrotonda((nettoAnnuo / ral) * 100)
  };
}

if (typeof module !== "undefined" && module.exports) module.exports = { calcolaNetto };
