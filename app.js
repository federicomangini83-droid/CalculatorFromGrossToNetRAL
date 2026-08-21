@@ -1,440 +1,450 @@
/* app.js v5 - audit interattivo + addizionale regionale progressiva. */

let PARAMETRI = null;
let OPZIONI = null;
let grafico = null;
let ULTIMO = null;

function euro(n) {
  return Number(n || 0).toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function num(n, decimali = 2) {
  return Number(n || 0).toLocaleString("it-IT", {
    minimumFractionDigits: decimali,
    maximumFractionDigits: decimali
  });
}

async function inizializza() {
  const [parametri, opzioni] = await Promise.all([
    fetch("data/parametri.json").then(r => r.json()),
    fetch("data/opzioni.json").then(r => r.json())
  ]);

  PARAMETRI = parametri;
  OPZIONI = opzioni;

  popolaSelect("mensilita", OPZIONI.mensilita, 13);
  popolaSelect("tipoContratto", OPZIONI.tipo_contratto, "indeterminato");
  popolaSelect("dimensioneAzienda", OPZIONI.dimensione_azienda, "fino15");
  popolaSelect("regione", OPZIONI.regioni, "toscana");
  popolaSelect("tipoBuonoPasto", OPZIONI.tipo_buono_pasto, "nessuno");

  document.getElementById("tipoContratto").addEventListener("change", toggleGiorni);
  document.getElementById("tipoBuonoPasto").addEventListener("change", toggleBuono);
  document.getElementById("btnCalcola").addEventListener("click", eseguiCalcolo);

  document.addEventListener("click", e => {
    const info = e.target.closest(".info");
    if (info) {
      e.stopPropagation();
      apriAudit(info);
      return;
    }
    if (!e.target.closest("#auditPopover")) chiudiAudit();
  });

  const close = document.getElementById("auditClose");
  if (close) close.addEventListener("click", chiudiAudit);
}

function popolaSelect(id, lista, defaultId) {
  const select = document.getElementById(id);
  select.innerHTML = "";
  for (const elemento of lista) {
    const option = document.createElement("option");
    option.value = elemento.id;
    option.textContent = elemento.label;
    if (elemento.id === defaultId) option.selected = true;
    select.appendChild(option);
  }
}

function toggleGiorni() {
  const determinato = document.getElementById("tipoContratto").value === "determinato";
  document.getElementById("wrapGiorni").style.display = determinato ? "block" : "none";
}

function toggleBuono() {
  const attivo = document.getElementById("tipoBuonoPasto").value !== "nessuno";
  document.getElementById("wrapBuono").style.display = attivo ? "block" : "none";
}

function determinaAliquotaInps() {
  const contratto = OPZIONI.tipo_contratto.find(
    c => c.id === document.getElementById("tipoContratto").value
  );

  if (contratto.aliquota_inps_key === "aliquota_apprendista") {
    return PARAMETRI.contributi_inps.aliquota_apprendista;
  }

  const dimensione = OPZIONI.dimensione_azienda.find(
    d => d.id === document.getElementById("dimensioneAzienda").value
  );
  return PARAMETRI.contributi_inps[dimensione.aliquota_inps_key];
}

function eseguiCalcolo() {
  const ral = parseFloat(document.getElementById("ral").value);
  if (!Number.isFinite(ral) || ral <= 0) {
    alert("Inserisci una RAL valida.");
    return;
  }

  const regione = OPZIONI.regioni.find(
    r => r.id === document.getElementById("regione").value
  );

  const input = {
    ral,
    aliquotaInps: determinaAliquotaInps(),
    aliquotaRegionale: regione.aliquota || null,
    regioneConfig: regione,
    regioneScaglioni: regione.scaglioni || null,
    regioneTipoAddizionale: regione.tipo_addizionale || "aliquota_unica",
    regioneLabel: regione.label,
    fonteRegione: regione.fonte || "",
    aliquotaComunale: parseFloat(document.getElementById("addComunale").value) || 0,
    mensilita: parseInt(document.getElementById("mensilita").value, 10),
    tipoContratto: document.getElementById("tipoContratto").value,
    giorni: parseInt(document.getElementById("giorni").value, 10) || 365,
    fringeBenefit: parseFloat(document.getElementById("fringeBenefit").value) || 0,
    tipoBuonoPasto: document.getElementById("tipoBuonoPasto").value,
    valoreBuono: parseFloat(document.getElementById("valoreBuono").value) || 0,
    giorniBuono: parseInt(document.getElementById("giorniBuono").value, 10) || 220,
    figliACarico: false
  };

  ULTIMO = calcolaNetto(input, PARAMETRI);
  mostraRisultati(ULTIMO);
}

function generaAudit(chiave, r) {
  const irpefRighe = r.irpefDettaglio.map(s =>
    `<code>${num(s.aliquota)}% x ${euro(s.base)} = ${euro(s.imposta)}</code>`
  ).join("<br>");

  const regionaleRighe = r.addRegDettaglio.map(s =>
    `<code>${euro(s.base)} x ${num(s.aliquota)}% = ${euro(s.imposta)}</code>`
  ).join("<br>");

  const riduzioniRegionali = (r.addRegRiduzioni || [])
    .filter(x => x.importo > 0)
    .map(x => `<code>- ${euro(x.importo)} (${x.descrizione})</code>`)
    .join("<br>");

  let regionaleSpiegazione = `<b>${r.regioneLabel}</b><br><br>${regionaleRighe || "Nessuna imposta dovuta."}`;
  if (riduzioniRegionali) regionaleSpiegazione += `<br>${riduzioniRegionali}`;
  regionaleSpiegazione += `<br><br><b>Totale = ${euro(r.addReg)}</b>`;
  if (r.addRegNotaSemplificazione) {
    regionaleSpiegazione += `<br><br><b>Semplificazione:</b> ${r.addRegNotaSemplificazione}`;
  }

  const audit = {
    ral: {
      t: "RAL (lordo)",
      b: `Retribuzione Annua Lorda inserita: <b>${euro(r.ral)}</b>. E il punto di partenza prima delle trattenute.`,
      f: "Dato di input"
    },
    inps: {
      t: "Contributi INPS",
      b: `<code>${euro(r.ral)} x ${num(r.aliquotaInps)}% = ${euro(r.contributiInps)}</code><br>` +
         `La percentuale dipende dal contratto e dalla dimensione aziendale.`,
      f: "Tabelle aliquote INPS 2026 + Circolare INPS n. 6/2026"
    },
    imponibile: {
      t: "Lordo post contributi (imponibile)",
      b: `I contributi obbligatori sono deducibili:<br>` +
         `<code>${euro(r.ral)} - ${euro(r.contributiInps)} = ${euro(r.imponibileFiscale)}</code>`,
      f: "Art. 10 TUIR"
    },
    irpefLorda: {
      t: "IRPEF lorda",
      b: `Calcolo progressivo per scaglioni:<br>${irpefRighe}<br><br><b>Totale = ${euro(r.irpefLorda)}</b>`,
      f: "Art. 11 TUIR"
    },
    detrLav: {
      t: "Detrazione lavoro dipendente",
      b: `La detrazione decresce all'aumentare del reddito. Nel caso calcolato vale <b>${euro(r.detrLavoro)}</b>` +
         (r.detrLavoroBonus65 ? `, incluso il correttivo di ${euro(r.detrLavoroBonus65)}.` : "."),
      f: "Art. 13 TUIR"
    },
    ultDetr: {
      t: "Ulteriore detrazione (cuneo fiscale)",
      b: r.ulterioreDetr > 0
        ? (r.imponibileFiscale <= 32000
          ? `Reddito entro 32.000 EUR: detrazione piena di <b>${euro(r.ulterioreDetr)}</b>.`
          : `<code>1.000 x (40.000 - ${num(r.imponibileFiscale)}) / 8.000 = ${euro(r.ulterioreDetr)}</code>`)
        : "Il reddito non rientra nella fascia 20.000-40.000 EUR.",
      f: "Art. 1 c.6 L. 207/2024"
    },
    irpefNetta: {
      t: "IRPEF netta",
      b: `<code>${euro(r.irpefLorda)} - ${euro(r.detrLavoro)} - ${euro(r.ulterioreDetr)} = ${euro(r.irpefNetta)}</code>`,
      f: "IRPEF lorda al netto delle detrazioni"
      b:
        `L'IRPEF netta parte dall'imposta lorda calcolata sul reddito imponibile ` +
        `e sottrae le detrazioni spettanti:<br>` +
        `<code>${euro(r.irpefLorda)} - ${euro(r.detrLavoro)} - ` +
        `${euro(r.ulterioreDetr)} = ${euro(r.irpefNetta)}</code><br><br>` +
        `Il reddito imponibile utilizzato a monte è determinato tenendo conto ` +
        `degli oneri deducibili previsti dall'art. 10 TUIR.`,
      f:
        "Art. 10 TUIR per la determinazione del reddito imponibile; " +
        "art. 11 TUIR per l'IRPEF lorda; " +
        "art. 13 TUIR per la detrazione da lavoro dipendente; " +
        "art. 1, commi 4-9, L. 207/2024 per il cuneo fiscale"
    },
    addReg: {
      t: "Addizionale regionale",
      b: regionaleSpiegazione,
      f: r.fonteRegione
        ? `Dipartimento delle Finanze: ${r.fonteRegione}`
        : "Dipartimento delle Finanze - Addizionale regionale IRPEF"
    },
    addCom: {
      t: "Addizionale comunale",
      b: `L'aliquota comunale resta un input manuale ed e applicata all'intero imponibile:<br>` +
         `<code>${euro(r.imponibileFiscale)} x ${num(r.aliquotaComunale)}% = ${euro(r.addCom)}</code>`,
      f: "D.Lgs. 360/1998 + delibera del Comune"
    },
    totTasse: {
      t: "Totale tasse",
      b: `<code>${euro(r.irpefNetta)} + ${euro(r.addReg)} + ${euro(r.addCom)} = ${euro(r.totaleTasse)}</code>`,
      f: "IRPEF netta + addizionali"
    },
    netto: {
      t: "Netto in busta",
      b: `<code>${euro(r.ral)} - ${euro(r.contributiInps)} - ${euro(r.irpefNetta)} - ` +
         `${euro(r.addReg)} - ${euro(r.addCom)}` +
         (r.creditiEsenti ? ` + ${euro(r.creditiEsenti)}` : "") +
         ` = ${euro(r.nettoAnnuo)}</code>`,
      f: "Formula del netto annuo"
    },
    crediti: {
      t: "Crediti esenti",
      b: `Somma integrativa ${euro(r.sommaIntegrativa)} + trattamento integrativo ` +
         `${euro(r.trattIntegrativo)} = <b>${euro(r.creditiEsenti)}</b>.`,
      f: "L. 207/2024 + D.L. 3/2020"
    },
    sommaInt: {
      t: "Somma integrativa",
      b: `<code>${euro(r.imponibileFiscale)} x ${num(r.sommaIntegrativaPerc)}% = ${euro(r.sommaIntegrativa)}</code>`,
      f: "Art. 1 c.4 L. 207/2024"
    },
    trattInt: {
      t: "Trattamento integrativo",
      b: `Credito calcolato nel caso corrente: <b>${euro(r.trattIntegrativo)}</b>.`,
      f: "Art. 1 D.L. 3/2020"
    },
    aliqEff: {
      t: "Aliquota effettiva",
      b: `<code>${euro(r.totaleTasse)} / ${euro(r.ral)} = ${num(r.aliquotaEffettiva)}%</code>`,
      f: "Indicatore di sintesi"
    },
    mensOrd: {
      t: "Mensilita ordinarie",
      b: `<code>(${euro(r.nettoAnnuo)} - ${euro(r.nettoMensilitaAggiuntiva)} x ${r.mesiExtra}) / 12 = ` +
         `${euro(r.nettoOrdinarioMese)}</code>`,
      f: "Ripartizione annuale del netto"
    },
    mensExtra: {
      t: "Mensilita aggiuntive",
      b: `Le mensilita aggiuntive non beneficiano delle detrazioni. Per distribuire ` +
         `l'addizionale regionale progressiva si usa l'aliquota regionale effettiva annua ` +
         `(${num(r.aliquotaRegionaleEffettiva, 4)}%).<br>` +
         `<code>${euro(r.lordoMese)} - contributi - IRPEF - addizionali = ` +
         `${euro(r.nettoMensilitaAggiuntiva)}</code>`,
      f: "Ripartizione rappresentativa del netto annuo"
    },
    buoni: {
      t: "Buoni pasto",
      b: `<code>${euro(r.benefici.valoreBuono)} x ${r.benefici.giorniBuono} = ` +
         `${euro(r.benefici.buoniTotAnnuo)}</code><br>` +
         `Esente fino a ${euro(r.benefici.buoniEsenteGiorno)} per giorno.`,
      f: "Art. 51 c.2 lett. c TUIR"
    },
    fringe: {
      t: "Fringe benefit",
      b: r.benefici.fringeImponibile > 0
        ? `Importo oltre la soglia di ${euro(r.benefici.fringeSoglia)}: interamente imponibile.`
        : `Importo entro la soglia di ${euro(r.benefici.fringeSoglia)}: esente.`,
      f: "Art. 51 c.3 TUIR"
    },
    tfr: {
      t: "TFR accantonato",
      b: `<code>${euro(r.ral)} / 13,5 - ${euro(r.ral)} x 0,50% = ${euro(r.tfr)}</code>`,
      f: "Art. 2120 Codice Civile"
    }
  };

  return audit[chiave] || { t: "Informazione", b: "Spiegazione non disponibile.", f: "" };
}

function apriAudit(elemento) {
  if (!ULTIMO) return;
  const info = generaAudit(elemento.getAttribute("data-audit"), ULTIMO);
  document.getElementById("auditTitle").textContent = info.t;
  document.getElementById("auditBody").innerHTML = info.b;
  document.getElementById("auditFonte").textContent = info.f ? `Fonte: ${info.f}` : "";

  const pop = document.getElementById("auditPopover");
  pop.style.display = "block";

  const rect = elemento.getBoundingClientRect();
  const larghezza = 320;
  let left = rect.left + window.scrollX - larghezza / 2 + 8;
  left = Math.max(10, Math.min(
    left,
    window.scrollX + document.documentElement.clientWidth - larghezza - 10
  ));
  pop.style.left = `${left}px`;
  pop.style.top = `${rect.bottom + window.scrollY + 8}px`;
}

function chiudiAudit() {
  const pop = document.getElementById("auditPopover");
  if (pop) pop.style.display = "none";
}

function mostraRisultati(r) {
  document.getElementById("risultati").style.display = "block";
  document.getElementById("outNettoAnnuo").textContent = euro(r.nettoAnnuo);
  document.getElementById("outPercNetto").textContent = `(${r.percNetto}% della RAL)`;
  document.getElementById("outNettoOrd").textContent = euro(r.nettoOrdinarioMese);

  if (r.mesiExtra > 0) {
    document.getElementById("rowExtra").style.display = "flex";
    document.getElementById("badgeExtra").textContent = `${r.mesiExtra}x`;
    const nomi = {
      1: "13a mensilita",
      2: "13a e 14a mensilita",
      3: "13a, 14a e 15a mensilita"
    };
    document.getElementById("descExtra").innerHTML =
      `${nomi[r.mesiExtra]} <i class="info" data-audit="mensExtra">&#9432;</i>` +
      `<br><small>senza detrazioni: netto piu basso</small>`;
    document.getElementById("outNettoExtra").textContent =
      `${euro(r.nettoMensilitaAggiuntiva)} cad.`;
  } else {
    document.getElementById("rowExtra").style.display = "none";
  }

  document.getElementById("outRal").textContent = euro(r.ral);
  document.getElementById("outInps").textContent = euro(r.contributiInps);
  document.getElementById("outLordoPost").textContent = euro(r.imponibileFiscale);
  document.getElementById("outIrpef").textContent = euro(r.irpefNetta);
  document.getElementById("outAddReg").textContent = euro(r.addReg);
  document.getElementById("outAddCom").textContent = euro(r.addCom);
  document.getElementById("outNettoRiga").textContent = euro(r.nettoAnnuo);

  if (r.creditiEsenti > 0) {
    document.getElementById("rowCredito").style.display = "table-row";
    document.getElementById("outCrediti").textContent = `+ ${euro(r.creditiEsenti)}`;
  } else {
    document.getElementById("rowCredito").style.display = "none";
  }

  document.getElementById("outImponibile").textContent = euro(r.imponibileFiscale);
  document.getElementById("outIrpefLorda").textContent = euro(r.irpefLorda);
  document.getElementById("outDetrLav").textContent = euro(r.detrLavoro);
  document.getElementById("liUlt").style.display = r.ulterioreDetr > 0 ? "flex" : "none";
  document.getElementById("outUltDetr").textContent = euro(r.ulterioreDetr);
  document.getElementById("outTotTasse").textContent = euro(r.totaleTasse);
  document.getElementById("outAliqEff").textContent = `${r.aliquotaEffettiva} %`;

  if (r.sommaIntegrativa > 0) {
    document.getElementById("boxSomma").style.display = "flex";
    document.getElementById("outSomma").textContent = `+ ${euro(r.sommaIntegrativa)}/anno`;
  } else {
    document.getElementById("boxSomma").style.display = "none";
  }

  if (r.trattIntegrativo > 0) {
    document.getElementById("boxBonus").style.display = "flex";
    document.getElementById("outBonus").textContent = `+ ${euro(r.trattIntegrativo)}/anno`;
  } else {
    document.getElementById("boxBonus").style.display = "none";
  }

  mostraBenefici(r.benefici);
  document.getElementById("outTfr").textContent = euro(r.tfr);
  disegnaGrafico(r);
}

function mostraBenefici(b) {
  const haBuoni = b.buoniTotAnnuo > 0;
  const haFringe = b.fringeEsente > 0 || b.fringeImponibile > 0;

  if (!haBuoni && !haFringe) {
    document.getElementById("beneficiPanel").style.display = "none";
    return;
  }

  document.getElementById("beneficiPanel").style.display = "block";

  if (haBuoni) {
    document.getElementById("benBuoni").style.display = "flex";
    document.getElementById("benBuoniSub").style.display = "block";
    document.getElementById("outBuoni").textContent = `${euro(b.buoniMensile)}/mese`;
    let testo = `${euro(b.valoreBuono)}/giorno - esente fino ${euro(b.buoniEsenteGiorno)} - ` +
      `totale anno ${euro(b.buoniTotAnnuo)}`;
    if (b.buoniImponibileAnnuo > 0) {
      testo += ` - di cui tassato ${euro(b.buoniImponibileAnnuo)}`;
    }
    document.getElementById("benBuoniSub").textContent = testo;
  } else {
    document.getElementById("benBuoni").style.display = "none";
    document.getElementById("benBuoniSub").style.display = "none";
  }

  if (haFringe) {
    document.getElementById("benFringe").style.display = "flex";
    document.getElementById("benFringeSub").style.display = "block";
    document.getElementById("outFringe").textContent =
      `${euro(b.fringeEsente + b.fringeImponibile)}/anno`;
    document.getElementById("benFringeSub").textContent = b.fringeImponibile > 0
      ? `Supera la soglia di ${euro(b.fringeSoglia)}: intero importo tassato`
      : `Entro la soglia di ${euro(b.fringeSoglia)}: esente`;
  } else {
    document.getElementById("benFringe").style.display = "none";
    document.getElementById("benFringeSub").style.display = "none";
  }

  document.getElementById("outBenTot").textContent = `${euro(b.totaleEsente)}/anno`;
}

function disegnaGrafico(r) {
  const ctx = document.getElementById("graficoTorta");
  const data = {
    labels: ["Netto in busta", "Contributi INPS", "IRPEF netta", "Add. regionale", "Add. comunale"],
    datasets: [{
      data: [r.nettoInBusta, r.contributiInps, r.irpefNetta, r.addReg, r.addCom],
      backgroundColor: ["#2e9e5b", "#e8913a", "#d94f4f", "#7b5cc4", "#4aa3c7"],
      borderWidth: 2,
      borderColor: "#fff"
    }]
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { position: "bottom", labels: { font: { size: 11 }, padding: 10 } },
      tooltip: {
        callbacks: {
          label: c => `${c.label}: ${euro(c.raw)} (${(c.raw / r.ral * 100).toFixed(1)}%)`
        }
      }
    }
  };

  if (grafico) grafico.destroy();
  grafico = new Chart(ctx, { type: "doughnut", data, options });
}

inizializza();
