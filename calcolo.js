/* Motore di calcolo v5: addizionale regionale con aliquota unica o scaglioni progressivi. */

function arrotonda(n, d = 2) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

function calcolaContributiInps(ral, aliquotaBase, p) {
  const c = p.contributi_inps;
  const base = Math.min(ral, c.massimale_contributivo);
  let contributi = 0;

  if (base <= c.soglia_aliquota_aggiuntiva) {
    contributi = base * aliquotaBase / 100;
  } else {
    contributi = c.soglia_aliquota_aggiuntiva * aliquotaBase / 100;
    contributi += (base - c.soglia_aliquota_aggiuntiva) *
      (aliquotaBase + c.aliquota_aggiuntiva_1pct) / 100;
  }
  return arrotonda(contributi);
}

function calcolaIrpefLorda(imponibile, p) {
  let imposta = 0;
  for (const s of p.irpef_scaglioni.scaglioni) {
    const sup = s.a === null ? Infinity : s.a;
    if (imponibile > s.da) {
      imposta += (Math.min(imponibile, sup) - s.da) * s.aliquota / 100;
    }
  }
  return arrotonda(imposta);
}

function dettaglioIrpef(imponibile, p) {
  const dettaglio = [];
  for (const s of p.irpef_scaglioni.scaglioni) {
    const sup = s.a === null ? Infinity : s.a;
    if (imponibile > s.da) {
      const base = Math.min(imponibile, sup) - s.da;
      dettaglio.push({
        aliquota: s.aliquota,
        base: arrotonda(base),
        imposta: arrotonda(base * s.aliquota / 100)
      });
    }
  }
  return dettaglio;
}

function aliquotaMarginale(imponibile, p) {
  let aliquota = 0;
  for (const s of p.irpef_scaglioni.scaglioni) {
    if (imponibile > s.da) aliquota = s.aliquota;
  }
  return aliquota;
}

function calcolaDetrLavoro(reddito, p, giorni, tempoDeterminato) {
  const d = p.detrazioni_lavoro_dipendente;
  for (const f of d.fasce) {
    const sup = f.a === null ? Infinity : f.a;
    if (reddito > f.da && reddito <= sup) {
      let base;
      if (f.tipo === "fisso") {
        base = f.importo;
      } else {
        const R = reddito;
        base = Math.max(0, eval(f.formula));
      }

      let bonus65 = 0;
      const b = d.bonus_ulteriore;
      if (reddito > b.da && reddito <= b.a) {
        bonus65 = b.importo;
        base += bonus65;
      }

      let importo = base * giorni / 365;
      if (reddito <= 15000) {
        const minimo = tempoDeterminato ? f.minimo_tempo_determinato : f.minimo_garantito;
        if (importo > 0 && importo < minimo) importo = minimo * giorni / 365;
      }

      return { valore: arrotonda(Math.max(0, importo)), bonus65 };
    }
  }
  return { valore: 0, bonus65: 0 };
}

function calcolaSommaIntegrativa(reddito, p) {
  const s = p.cuneo_fiscale.somma_integrativa;
  if (reddito > s.soglia_max) return { valore: 0, perc: 0 };

  let perc = 0;
  for (const sc of s.scaglioni) {
    if (reddito <= sc.fino_a) {
      perc = sc.percentuale;
      break;
    }
  }
  return { valore: arrotonda(reddito * perc / 100), perc };
}

function calcolaUlterioreDetrazione(reddito, p) {
  const u = p.cuneo_fiscale.ulteriore_detrazione;
  if (reddito <= u.soglia_min || reddito > u.soglia_max) return 0;
  if (reddito <= u.soglia_piena) return u.importo_pieno;
  return arrotonda(
    u.importo_pieno * (u.soglia_max - reddito) /
    (u.soglia_max - u.soglia_piena)
  );
}

function calcolaTrattamentoIntegrativo(reddito, irpefLorda, detrLavoro, p) {
  const t = p.trattamento_integrativo;
  if (reddito > t.soglia_max) return 0;
  if (reddito <= t.soglia_pieno) {
    return irpefLorda > detrLavoro ? t.importo_max : 0;
  }
  const differenza = detrLavoro - irpefLorda;
  return differenza > 0 ? arrotonda(Math.min(differenza, t.importo_max)) : 0;
}

function calcolaBenefici(input, p) {
  const b = p.benefici_esenti;
  const sogliaFB = input.figliACarico
    ? b.fringe_benefit.soglia_con_figli
    : b.fringe_benefit.soglia_senza_figli;

  const fb = input.fringeBenefit || 0;
  const fringeEsente = fb <= sogliaFB ? fb : 0;
  const fringeImponibile = fb > sogliaFB ? fb : 0;

  let limiteBuono = 0;
  if (input.tipoBuonoPasto === "elettronico") limiteBuono = b.buoni_pasto.esente_elettronico;
  if (input.tipoBuonoPasto === "cartaceo") limiteBuono = b.buoni_pasto.esente_cartaceo;

  const valoreBuono = input.valoreBuono || 0;
  const giorniBuono = input.giorniBuono || b.buoni_pasto.giorni_lavoro_default;
  let buoniEsenteAnnuo = 0;
  let buoniImponibileAnnuo = 0;
  let buoniTotAnnuo = 0;
  let buoniMensile = 0;

  if (valoreBuono > 0 && limiteBuono > 0) {
    buoniEsenteAnnuo = arrotonda(Math.min(valoreBuono, limiteBuono) * giorniBuono);
    buoniImponibileAnnuo = arrotonda(Math.max(0, valoreBuono - limiteBuono) * giorniBuono);
    buoniTotAnnuo = arrotonda(valoreBuono * giorniBuono);
    buoniMensile = arrotonda(buoniTotAnnuo / 12);
  }

  return {
    fringeEsente: arrotonda(fringeEsente),
    fringeImponibile: arrotonda(fringeImponibile),
    fringeSoglia: sogliaFB,
    buoniEsenteAnnuo,
    buoniImponibileAnnuo,
    buoniTotAnnuo,
    buoniMensile,
    buoniEsenteGiorno: limiteBuono,
    valoreBuono,
    giorniBuono,
    imponibileAggiuntivo: arrotonda(fringeImponibile + buoniImponibileAnnuo),
    totaleEsente: arrotonda(fringeEsente + buoniEsenteAnnuo)
  };
}

/*
 * Regione: supporta aliquota unica oppure scaglioni progressivi.
 * Comune: resta volutamente un'aliquota unica inserita dall'utente.
 */
function calcolaAddizionaleRegionale(imponibile, input) {
  const scaglioni = input.regioneScaglioni;

  if (Array.isArray(scaglioni) && scaglioni.length > 0) {
    let totale = 0;
    const dettaglio = [];

    for (const s of scaglioni) {
      const sup = s.a === null ? Infinity : s.a;
      if (imponibile > s.da) {
        const base = Math.min(imponibile, sup) - s.da;
        const imposta = base * s.aliquota / 100;
        totale += imposta;
        dettaglio.push({
          da: s.da,
          a: s.a,
          aliquota: s.aliquota,
          base: arrotonda(base),
          imposta: arrotonda(imposta)
        });
      }
    }

    return {
      valore: arrotonda(totale),
      tipo: "scaglioni_progressivi",
      dettaglio
    };
  }

  const aliquota = input.aliquotaRegionale || 0;
  const imposta = arrotonda(imponibile * aliquota / 100);
  return {
    valore: imposta,
    tipo: "aliquota_unica",
    dettaglio: [{ da: 0, a: null, aliquota, base: imponibile, imposta }]
  };
}

function calcolaNetto(input, p) {
  const ral = input.ral;
  const giorni = input.giorni || 365;
  const tempoDeterminato = input.tipoContratto === "determinato";

  const benefici = calcolaBenefici(input, p);
  const contributiInps = calcolaContributiInps(ral, input.aliquotaInps, p);
  const imponibileFiscale = arrotonda(
    ral - contributiInps + benefici.imponibileAggiuntivo
  );

  const irpefLorda = calcolaIrpefLorda(imponibileFiscale, p);
  const irpefDettaglio = dettaglioIrpef(imponibileFiscale, p);

  const dl = calcolaDetrLavoro(imponibileFiscale, p, giorni, tempoDeterminato);
  const detrLavoro = dl.valore;
  const ulterioreDetr = calcolaUlterioreDetrazione(imponibileFiscale, p);
  const detrazioniTotali = arrotonda(detrLavoro + ulterioreDetr);
  const irpefNetta = arrotonda(Math.max(0, irpefLorda - detrazioniTotali));

  const calcoloAddReg = calcolaAddizionaleRegionale(imponibileFiscale, input);
  const addReg = calcoloAddReg.valore;
  const addRegDettaglio = calcoloAddReg.dettaglio;
  const addRegTipo = calcoloAddReg.tipo;

  /* Addizionale comunale invariata: aliquota manuale sull'intero imponibile. */
  const addCom = arrotonda(imponibileFiscale * input.aliquotaComunale / 100);

  const si = calcolaSommaIntegrativa(imponibileFiscale, p);
  const sommaIntegrativa = si.valore;
  const trattIntegrativo = calcolaTrattamentoIntegrativo(
    imponibileFiscale, irpefLorda, detrLavoro, p
  );
  const creditiEsenti = arrotonda(sommaIntegrativa + trattIntegrativo);

  const nettoAnnuo = arrotonda(
    ral - contributiInps - irpefNetta - addReg - addCom + creditiEsenti
  );

  const mensilita = input.mensilita;
  const mesiExtra = Math.max(0, mensilita - 12);
  const aliquotaIrpefMarginale = aliquotaMarginale(imponibileFiscale, p);
  const aliquotaRegionaleEffettiva = imponibileFiscale > 0
    ? addReg / imponibileFiscale * 100
    : 0;

  const lordoMese = ral / mensilita;
  const contrMese = arrotonda(lordoMese * input.aliquotaInps / 100);
  const imponMese = lordoMese - contrMese;
  const irpefMese = imponMese * aliquotaIrpefMarginale / 100;

  /* Per la sola ripartizione mensile, l'addizionale regionale annua e ripartita
     usando la sua aliquota effettiva; il totale annuo resta quello a scaglioni. */
  const addMese = imponMese *
    (aliquotaRegionaleEffettiva + input.aliquotaComunale) / 100;

  const nettoMensilitaAggiuntiva = arrotonda(
    lordoMese - contrMese - irpefMese - addMese
  );

  const nettoOrdinarioMese = arrotonda(
    (nettoAnnuo - nettoMensilitaAggiuntiva * mesiExtra) / 12
  );

  const tfr = arrotonda(
    ral / p.tfr.divisore - ral * p.tfr.contributo_fondo_garanzia / 100
  );
  const totaleTasse = arrotonda(irpefNetta + addReg + addCom);
  const nettoInBusta = arrotonda(ral - contributiInps - totaleTasse);

  return {
    ral,
    contributiInps,
    imponibileFiscale,
    irpefLorda,
    irpefDettaglio,
    detrLavoro,
    detrLavoroBonus65: dl.bonus65,
    ulterioreDetr,
    detrazioniTotali,
    irpefNetta,
    addReg,
    addRegDettaglio,
    addRegTipo,
    addCom,
    totaleTasse,
    sommaIntegrativa,
    sommaIntegrativaPerc: si.perc,
    trattIntegrativo,
    creditiEsenti,
    nettoInBusta,
    nettoAnnuo,
    nettoOrdinarioMese,
    nettoMensilitaAggiuntiva,
    mesiExtra,
    mensilita,
    lordoMese: arrotonda(lordoMese),
    aliquotaIrpefMarginale,
    aliquotaRegionaleEffettiva: arrotonda(aliquotaRegionaleEffettiva, 4),
    contrMese,
    tfr,
    benefici,
    aliquotaInps: input.aliquotaInps,
    aliquotaRegionale: input.aliquotaRegionale || null,
    aliquotaComunale: input.aliquotaComunale,
    regioneLabel: input.regioneLabel,
    fonteRegione: input.fonteRegione || "",
    aliquotaEffettiva: arrotonda(totaleTasse / ral * 100),
    percNetto: arrotonda(nettoAnnuo / ral * 100)
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { calcolaNetto, calcolaAddizionaleRegionale };
}
