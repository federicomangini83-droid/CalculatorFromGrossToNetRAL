/* app.js*/

let PARAMETRI = null, OPZIONI = null, grafico = null, ULTIMO = null;

function euro(n) {
  return n.toLocaleString("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function num(n) { return n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

async function inizializza() {
  const [par, opz] = await Promise.all([
    fetch("data/parametri.json").then(r => r.json()),
    fetch("data/opzioni.json").then(r => r.json())
  ]);
  PARAMETRI = par; OPZIONI = opz;
  popolaSelect("mensilita", OPZIONI.mensilita, 13);
  popolaSelect("tipoContratto", OPZIONI.tipo_contratto, "indeterminato");
  popolaSelect("dimensioneAzienda", OPZIONI.dimensione_azienda, "fino15");
  popolaSelect("regione", OPZIONI.regioni, "toscana");
  popolaSelect("tipoBuonoPasto", OPZIONI.tipo_buono_pasto, "nessuno");
  document.getElementById("tipoContratto").addEventListener("change", toggleGiorni);
  document.getElementById("tipoBuonoPasto").addEventListener("change", toggleBuono);
  document.getElementById("btnCalcola").addEventListener("click", eseguiCalcolo);

  // gestione popover audit
  document.addEventListener("click", (e) => {
    const info = e.target.closest(".info");
    if (info) { e.stopPropagation(); apriAudit(info); return; }
    if (!e.target.closest("#auditPopover")) chiudiAudit();
  });
  document.getElementById("auditClose").addEventListener("click", chiudiAudit);
}

function popolaSelect(id, lista, def) {
  const sel = document.getElementById(id); sel.innerHTML = "";
  for (const o of lista) {
    const e = document.createElement("option");
    e.value = o.id; e.textContent = o.label;
    if (o.id === def) e.selected = true;
    sel.appendChild(e);
  }
}
function toggleGiorni() {
  document.getElementById("wrapGiorni").style.display =
    document.getElementById("tipoContratto").value === "determinato" ? "block" : "none";
}
function toggleBuono() {
  document.getElementById("wrapBuono").style.display =
    document.getElementById("tipoBuonoPasto").value !== "nessuno" ? "block" : "none";
}
function determinaAliquotaInps() {
  const contratto = OPZIONI.tipo_contratto.find(c => c.id === document.getElementById("tipoContratto").value);
  if (contratto.aliquota_inps_key === "aliquota_apprendista") return PARAMETRI.contributi_inps.aliquota_apprendista;
  const dim = OPZIONI.dimensione_azienda.find(d => d.id === document.getElementById("dimensioneAzienda").value);
  return PARAMETRI.contributi_inps[dim.aliquota_inps_key];
}

function eseguiCalcolo() {
  const ral = parseFloat(document.getElementById("ral").value);
  if (isNaN(ral) || ral <= 0) { alert("Inserisci una RAL valida."); return; }
  const regione = OPZIONI.regioni.find(r => r.id === document.getElementById("regione").value);
  const input = {
    ral, aliquotaInps: determinaAliquotaInps(),
    aliquotaRegionale: regione.aliquota,
    aliquotaComunale: parseFloat(document.getElementById("addComunale").value) || 0,
    mensilita: parseInt(document.getElementById("mensilita").value),
    tipoContratto: document.getElementById("tipoContratto").value,
    giorni: parseInt(document.getElementById("giorni").value) || 365,
    fringeBenefit: parseFloat(document.getElementById("fringeBenefit").value) || 0,
    tipoBuonoPasto: document.getElementById("tipoBuonoPasto").value,
    valoreBuono: parseFloat(document.getElementById("valoreBuono").value) || 0,
    giorniBuono: parseInt(document.getElementById("giorniBuono").value) || 220,
    figliACarico: false
  };
  ULTIMO = calcolaNetto(input, PARAMETRI);
  ULTIMO.regioneLabel = regione.label;
  mostraRisultati(ULTIMO);
}

/* ============ AUDIT: genera la spiegazione con i numeri reali ============ */
function generaAudit(chiave, r) {
  const A = {};

  A.ral = { t: "RAL (lordo)", b:
    `È la <b>Retribuzione Annua Lorda</b> che hai inserito: <b>${euro(r.ral)}</b>.<br>` +
    `È il punto di partenza, prima di ogni trattenuta.`, f: "Dato di input" };

  A.inps = { t: "Contributi INPS", b:
    `Quota previdenziale a carico del lavoratore:<br>` +
    `<code>${euro(r.ral)} × ${num(r.aliquotaInps)}% = ${euro(r.contributiInps)}</code><br>` +
    `L'aliquota <b>${num(r.aliquotaInps)}%</b> dipende da contratto e dimensione azienda ` +
    `(9,19% fino a 15 dipendenti, 9,49% oltre, per il +0,30% FIS).`,
    f: "Tabelle aliquote INPS 2026 + Circolare INPS n. 6/2026" };

  A.imponibile = { t: "Lordo post contributi (imponibile)", b:
    `I contributi sono <b>deducibili</b>: si sottraggono dal lordo prima delle tasse.<br>` +
    `<code>${euro(r.ral)} − ${euro(r.contributiInps)} = ${euro(r.imponibileFiscale)}</code><br>` +
    `È il <b>reddito complessivo</b> su cui si calcolano IRPEF e addizionali.`,
    f: "Art. 10 TUIR" };

  const righeIrpef = r.irpefDettaglio.map(s =>
    `<code>${num(s.aliquota)}% × ${euro(s.base)} = ${euro(s.imposta)}</code>`).join("<br>");
  A.irpefLorda = { t: "IRPEF lorda", b:
    `Imposta progressiva a scaglioni sull'imponibile (${euro(r.imponibileFiscale)}). ` +
    `Ogni aliquota si applica solo alla sua fetta:<br>${righeIrpef}<br>` +
    `<b>Totale = ${euro(r.irpefLorda)}</b>`,
    f: "Art. 11 TUIR (aliquote 23/33/43%, mod. L. 199/2025)" };

  A.detrLav = { t: "Detrazione lavoro dipendente", b:
    `Riduce l'IRPEF; <b>decresce</b> col reddito e si azzera a 50.000 €.<br>` +
    `Per un reddito di ${euro(r.imponibileFiscale)} vale <b>${euro(r.detrLavoro)}</b>` +
    (r.detrLavoroBonus65 ? ` (incluso +${euro(r.detrLavoroBonus65)} per la fascia 25.000–35.000 €).` : `.`),
    f: "Art. 13 c.1 TUIR" };

  A.ultDetr = { t: "Ulteriore detrazione (cuneo fiscale)", b:
    (r.ulterioreDetr > 0
      ? `È la voce <b>«Ult. detraz. L.Dip.»</b> della busta paga. Vale 1.000 € pieni ` +
        `fino a 32.000 € di reddito, poi decresce fino a 40.000 €.<br>` +
        (r.imponibileFiscale <= 32000
          ? `Il tuo reddito è ≤ 32.000 € → <b>1.000 € pieni</b>.`
          : `<code>1.000 × (40.000 − ${num(r.imponibileFiscale)}) / 8.000 = ${euro(r.ulterioreDetr)}</code>`)
      : `Non spetta: il reddito è fuori dalla fascia 20.000–40.000 €.`),
    f: "Art. 1 c.6 L. 207/2024" };

  A.irpefNetta = { t: "IRPEF netta", b:
    `IRPEF lorda meno le detrazioni (non può andare sotto zero):<br>` +
    `<code>${euro(r.irpefLorda)} − ${euro(r.detrLavoro)} − ${euro(r.ulterioreDetr)} = ${euro(r.irpefNetta)}</code><br>` +
    `È l'imposta che paghi davvero.`,
    f: "Art. 11 c.3 TUIR" };

  A.addReg = { t: "Addizionale regionale", b:
    `Imposta regionale sull'imponibile, aliquota della regione scelta (${r.regioneLabel || "-"}):<br>` +
    `<code>${euro(r.imponibileFiscale)} × ${num(r.aliquotaRegionale)}% = ${euro(r.addReg)}</code>`,
    f: "Art. 50 D.Lgs. 446/1997 + Portale federalismo fiscale" };

  A.addCom = { t: "Addizionale comunale", b:
    `Imposta comunale sull'imponibile, aliquota inserita:<br>` +
    `<code>${euro(r.imponibileFiscale)} × ${num(r.aliquotaComunale)}% = ${euro(r.addCom)}</code>`,
    f: "D.Lgs. 360/1998 + delibera comunale" };

  A.totTasse = { t: "Totale tasse", b:
    `Somma di IRPEF netta e addizionali:<br>` +
    `<code>${euro(r.irpefNetta)} + ${euro(r.addReg)} + ${euro(r.addCom)} = ${euro(r.totaleTasse)}</code>`,
    f: "IRPEF + addizionali" };

  A.crediti = { t: "Crediti esenti (cuneo / bonus)", b:
    `Importi <b>esenti</b> che si <b>sommano</b> al netto (non riducono le tasse):<br>` +
    `Somma integrativa ${euro(r.sommaIntegrativa)} + Trattamento integrativo ${euro(r.trattIntegrativo)} = <b>${euro(r.creditiEsenti)}</b>`,
    f: "L. 207/2024 c.4 / D.L. 3/2020" };

  A.sommaInt = { t: "Somma integrativa (cuneo)", b:
    `Somma <b>esente</b> per redditi ≤ 20.000 €:<br>` +
    `<code>${euro(r.imponibileFiscale)} × ${num(r.sommaIntegrativaPerc)}% = ${euro(r.sommaIntegrativa)}</code><br>` +
    `Percentuale a scaglioni: 7,1% (≤8.500), 5,3% (≤15.000), 4,8% (≤20.000).`,
    f: "Art. 1 c.4 L. 207/2024" };

  A.trattInt = { t: "Trattamento integrativo (ex bonus 100€)", b:
    `Credito che si somma al netto: fino a 1.200 €/anno per redditi ≤ 15.000 € ` +
    `(con IRPEF capiente), ridotto fino a 28.000 €.<br>Nel tuo caso: <b>${euro(r.trattIntegrativo)}</b>.`,
    f: "Art. 1 D.L. 3/2020 conv. L. 21/2020" };

  A.netto = { t: "Netto in busta", b:
    `Lordo meno contributi e tasse, più i crediti esenti:<br>` +
    `<code>${euro(r.ral)} − ${euro(r.contributiInps)} − ${euro(r.irpefNetta)} − ${euro(r.addReg)} − ${euro(r.addCom)}` +
    (r.creditiEsenti ? ` + ${euro(r.creditiEsenti)}` : ``) + ` = ${euro(r.nettoAnnuo)}</code>`,
    f: "Formula del netto annuo" };

  A.aliqEff = { t: "Aliquota effettiva", b:
    `Percentuale <b>reale</b> di tasse sul lordo (diversa dall'aliquota marginale ${num(r.aliqMarg)}%):<br>` +
    `<code>${euro(r.totaleTasse)} / ${euro(r.ral)} = ${num(r.aliquotaEffettiva)}%</code>`,
    f: "Indicatore di sintesi" };

  A.mensOrd = { t: "Mensilità ordinarie (×12)", b:
    `Le detrazioni e i crediti annuali sono assorbiti dai <b>12 mesi ordinari</b>, ` +
    `quindi il loro netto è più alto:<br>` +
    `<code>(${euro(r.nettoAnnuo)} − ${euro(r.nettoMensilitaAggiuntiva)} × ${r.mesiExtra}) / 12 = ${euro(r.nettoOrdinarioMese)}</code>`,
    f: "Ripartizione detrazioni sui 12 mesi" };

  A.mensExtra = { t: "Mensilità aggiuntiva (13ª/14ª/15ª)", b:
    `Subisce solo INPS + IRPEF (aliquota marginale ${num(r.aliqMarg)}%) + addizionali, ` +
    `<b>senza detrazioni</b>: netto più basso.<br>` +
    `<code>${euro(r.lordoMese)} − contributi − IRPEF − addizionali = ${euro(r.nettoMensilitaAggiuntiva)}</code>`,
    f: "Detrazione rapportata al periodo (art. 13 TUIR)" };

  const b = r.benefici;
  A.buoni = { t: "Buoni pasto", b:
    `<code>${euro(b.valoreBuono)}/giorno × ${b.giorniBuono} giorni = ${euro(b.buoniTotAnnuo)}/anno</code><br>` +
    `Esenti fino a ${euro(b.buoniEsenteGiorno)}/giorno` +
    (b.buoniImponibileAnnuo > 0 ? `; l'eccedenza (${euro(b.buoniImponibileAnnuo)}) è tassata.` : `: tutto esente.`) +
    `<br>Valore mensile: ${euro(b.buoniMensile)}. Non si sommano al netto in busta.`,
    f: "Art. 51 c.2 lett. c TUIR (L. 199/2025)" };

  A.fringe = { t: "Fringe benefit / welfare", b:
    `Esente fino a ${euro(b.fringeSoglia)}/anno. Regola <b>«tutto o niente»</b>: ` +
    `se supera la soglia, l'intero importo è tassato.<br>` +
    (b.fringeImponibile > 0
      ? `Hai ${euro(b.fringeImponibile)} → supera la soglia: <b>tutto tassato</b>.`
      : `Hai ${euro(b.fringeEsente)} → entro la soglia: <b>esente</b>.`),
    f: "Art. 51 c.3 TUIR (L. 207/2024)" };

  A.tfr = { t: "TFR accantonato", b:
    `Accantonamento <b>figurativo</b> (liquidato a fine rapporto, non in busta):<br>` +
    `<code>${euro(r.ral)} / 13,5 − ${euro(r.ral)} × 0,50% = ${euro(r.tfr)}</code>`,
    f: "Art. 2120 Codice Civile" };

  return A[chiave] || { t: "Info", b: "Nessuna spiegazione disponibile.", f: "" };
}

function apriAudit(el) {
  if (!ULTIMO) return;
  const chiave = el.getAttribute("data-audit");
  const info = generaAudit(chiave, ULTIMO);
  document.getElementById("auditTitle").textContent = info.t;
  document.getElementById("auditBody").innerHTML = info.b;
  document.getElementById("auditFonte").innerHTML = info.f ? ("Fonte: " + info.f) : "";
  const pop = document.getElementById("auditPopover");
  pop.style.display = "block";
  // posizionamento vicino all'icona
  const rect = el.getBoundingClientRect();
  const pw = 320;
  let left = rect.left + window.scrollX - pw / 2 + 8;
  left = Math.max(10, Math.min(left, window.scrollX + document.documentElement.clientWidth - pw - 10));
  let top = rect.bottom + window.scrollY + 8;
  pop.style.left = left + "px";
  pop.style.top = top + "px";
}
function chiudiAudit() { document.getElementById("auditPopover").style.display = "none"; }

function mostraRisultati(r) {
  document.getElementById("risultati").style.display = "block";
  document.getElementById("outNettoAnnuo").textContent = euro(r.nettoAnnuo);
  document.getElementById("outPercNetto").textContent = "(" + r.percNetto + "% della RAL)";

  document.getElementById("outNettoOrd").textContent = euro(r.nettoOrdinarioMese);
  if (r.mesiExtra > 0) {
    document.getElementById("rowExtra").style.display = "flex";
    document.getElementById("badgeExtra").textContent = r.mesiExtra + "\u00D7";
    const nomi = { 1: "13ª mensilità", 2: "13ª e 14ª mensilità", 3: "13ª, 14ª e 15ª mensilità" };
    document.getElementById("descExtra").innerHTML =
      (nomi[r.mesiExtra] || "Mensilità aggiuntive") + ' <i class="info" data-audit="mensExtra">&#9432;</i><br><small>senza detrazioni: netto più basso</small>';
    document.getElementById("outNettoExtra").textContent = euro(r.nettoMensilitaAggiuntiva) + " cad.";
  } else document.getElementById("rowExtra").style.display = "none";

  document.getElementById("outRal").textContent = euro(r.ral);
  document.getElementById("outInps").textContent = euro(r.contributiInps);
  document.getElementById("outLordoPost").textContent = euro(r.imponibileFiscale);
  document.getElementById("outIrpef").textContent = euro(r.irpefNetta);
  document.getElementById("outAddReg").textContent = euro(r.addReg);
  document.getElementById("outAddCom").textContent = euro(r.addCom);
  if (r.creditiEsenti > 0) {
    document.getElementById("rowCredito").style.display = "table-row";
    document.getElementById("outCrediti").textContent = "+ " + euro(r.creditiEsenti);
  } else document.getElementById("rowCredito").style.display = "none";
  document.getElementById("outNettoRiga").textContent = euro(r.nettoAnnuo);

  document.getElementById("outImponibile").textContent = euro(r.imponibileFiscale);
  document.getElementById("outIrpefLorda").textContent = euro(r.irpefLorda);
  document.getElementById("outDetrLav").textContent = euro(r.detrLavoro);
  document.getElementById("liUlt").style.display = (r.ulterioreDetr > 0) ? "flex" : "none";
  document.getElementById("outUltDetr").textContent = euro(r.ulterioreDetr);
  document.getElementById("outTotTasse").textContent = euro(r.totaleTasse);
  document.getElementById("outAliqEff").textContent = r.aliquotaEffettiva + " %";

  if (r.sommaIntegrativa > 0) {
    document.getElementById("boxSomma").style.display = "flex";
    document.getElementById("outSomma").textContent = "+ " + euro(r.sommaIntegrativa) + "/anno";
  } else document.getElementById("boxSomma").style.display = "none";
  if (r.trattIntegrativo > 0) {
    document.getElementById("boxBonus").style.display = "flex";
    document.getElementById("outBonus").textContent = "+ " + euro(r.trattIntegrativo) + "/anno";
  } else document.getElementById("boxBonus").style.display = "none";

  const b = r.benefici;
  const haBuoni = b.buoniTotAnnuo > 0, haFringe = (b.fringeEsente > 0 || b.fringeImponibile > 0);
  if (haBuoni || haFringe) {
    document.getElementById("beneficiPanel").style.display = "block";
    if (haBuoni) {
      document.getElementById("benBuoni").style.display = "flex";
      document.getElementById("benBuoniSub").style.display = "block";
      document.getElementById("outBuoni").textContent = euro(b.buoniMensile) + "/mese";
      let sub = euro(b.valoreBuono) + "/giorno &middot; esente fino " + euro(b.buoniEsenteGiorno) + " &middot; totale anno " + euro(b.buoniTotAnnuo);
      if (b.buoniImponibileAnnuo > 0) sub += " &middot; di cui tassato " + euro(b.buoniImponibileAnnuo);
      document.getElementById("benBuoniSub").innerHTML = sub;
    } else { document.getElementById("benBuoni").style.display = "none"; document.getElementById("benBuoniSub").style.display = "none"; }
    if (haFringe) {
      document.getElementById("benFringe").style.display = "flex";
      document.getElementById("benFringeSub").style.display = "block";
      document.getElementById("outFringe").textContent = euro(b.fringeEsente + b.fringeImponibile) + "/anno";
      document.getElementById("benFringeSub").innerHTML = b.fringeImponibile > 0
        ? "&#9888;&#65039; supera la soglia di " + euro(b.fringeSoglia) + ": <strong>l'intero importo &egrave; tassato</strong>"
        : "entro la soglia di " + euro(b.fringeSoglia) + ": esente";
    } else { document.getElementById("benFringe").style.display = "none"; document.getElementById("benFringeSub").style.display = "none"; }
    document.getElementById("outBenTot").textContent = euro(b.totaleEsente) + "/anno";
  } else document.getElementById("beneficiPanel").style.display = "none";

  document.getElementById("outTfr").textContent = euro(r.tfr);
  disegnaGrafico(r);
}

function disegnaGrafico(r) {
  const ctx = document.getElementById("graficoTorta");
  const dati = {
    labels: ["Netto in busta", "Contributi INPS", "IRPEF netta", "Add. regionale", "Add. comunale"],
    datasets: [{ data: [r.nettoInBusta, r.contributiInps, r.irpefNetta, r.addReg, r.addCom],
      backgroundColor: ["#2e9e5b", "#e8913a", "#d94f4f", "#7b5cc4", "#4aa3c7"], borderWidth: 2, borderColor: "#fff" }]
  };
  const opz = { responsive: true, plugins: {
    legend: { position: "bottom", labels: { font: { size: 11 }, padding: 10 } },
    tooltip: { callbacks: { label: (c) => `${c.label}: ${euro(c.raw)} (${((c.raw / r.ral) * 100).toFixed(1)}%)` } } } };
  if (grafico) grafico.destroy();
  grafico = new Chart(ctx, { type: "doughnut", data: dati, options: opz });
}

inizializza();
