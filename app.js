/* app.js v2 - collega interfaccia, dati e motore (con nuove voci) */

let PARAMETRI = null, OPZIONI = null, grafico = null;

function euro(n) {
  return n.toLocaleString("it-IT", { style: "currency", currency: "EUR",
    minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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

  // attiva il campo "giorni" solo se contratto = tempo determinato
  document.getElementById("tipoContratto").addEventListener("change", toggleGiorni);
  // mostra i campi buono pasto solo se ne selezioni un tipo
  document.getElementById("tipoBuonoPasto").addEventListener("change", toggleBuono);

  document.getElementById("btnCalcola").addEventListener("click", eseguiCalcolo);
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
  const det = document.getElementById("tipoContratto").value === "determinato";
  document.getElementById("wrapGiorni").style.display = det ? "block" : "none";
}
function toggleBuono() {
  const attivo = document.getElementById("tipoBuonoPasto").value !== "nessuno";
  document.getElementById("wrapBuono").style.display = attivo ? "block" : "none";
}

function determinaAliquotaInps() {
  const contratto = OPZIONI.tipo_contratto.find(c => c.id === document.getElementById("tipoContratto").value);
  if (contratto.aliquota_inps_key === "aliquota_apprendista")
    return PARAMETRI.contributi_inps.aliquota_apprendista;
  const dim = OPZIONI.dimensione_azienda.find(d => d.id === document.getElementById("dimensioneAzienda").value);
  return PARAMETRI.contributi_inps[dim.aliquota_inps_key];
}

function eseguiCalcolo() {
  const ral = parseFloat(document.getElementById("ral").value);
  if (isNaN(ral) || ral <= 0) { alert("Inserisci una RAL valida."); return; }

  const regione = OPZIONI.regioni.find(r => r.id === document.getElementById("regione").value);
  const numFigli = parseInt(document.getElementById("numFigli").value) || 0;

  const input = {
    ral,
    aliquotaInps: determinaAliquotaInps(),
    aliquotaRegionale: regione.aliquota,
    aliquotaComunale: parseFloat(document.getElementById("addComunale").value) || 0,
    mensilita: parseInt(document.getElementById("mensilita").value),
    tipoContratto: document.getElementById("tipoContratto").value,
    giorni: parseInt(document.getElementById("giorni").value) || 365,
    coniuge: document.getElementById("coniuge").checked,
    numFigli,
    figliDisabili: document.getElementById("figliDisabili").checked,
    numAltri: parseInt(document.getElementById("numAltri").value) || 0,
    figliACarico: numFigli > 0,
    fringeBenefit: parseFloat(document.getElementById("fringeBenefit").value) || 0,
    tipoBuonoPasto: document.getElementById("tipoBuonoPasto").value,
    valoreBuono: parseFloat(document.getElementById("valoreBuono").value) || 0,
    giorniBuono: parseInt(document.getElementById("giorniBuono").value) || 220
  };

  mostraRisultati(calcolaNetto(input, PARAMETRI));
}

function mostraRisultati(r) {
  document.getElementById("risultati").style.display = "block";

  document.getElementById("outNettoAnnuo").textContent = euro(r.nettoAnnuo);
  document.getElementById("outNettoOrd").textContent = euro(r.nettoOrdinarioMese);

  // mensilita aggiuntive
  if (r.mesiExtra > 0) {
    document.getElementById("wrapMensExtra").style.display = "flex";
    const nomi = { 1: "13ª", 2: "13ª e 14ª", 3: "13ª, 14ª e 15ª" };
    document.getElementById("labelMensExtra").textContent =
      "Netto mensilità aggiuntiva (" + (nomi[r.mesiExtra] || "extra") + ")";
    document.getElementById("outNettoExtra").textContent = euro(r.nettoMensilitaAggiuntiva);
  } else {
    document.getElementById("wrapMensExtra").style.display = "none";
  }

  document.getElementById("outRal").textContent = euro(r.ral);
  document.getElementById("outInps").textContent = euro(r.contributiInps);
  document.getElementById("outIrpef").textContent = euro(r.irpefNetta);
  document.getElementById("outAddReg").textContent = euro(r.addReg);
  document.getElementById("outAddCom").textContent = euro(r.addCom);
  document.getElementById("outNettoRiga").textContent = euro(r.nettoAnnuo);

  document.getElementById("outImponibile").textContent = euro(r.imponibileFiscale);
  document.getElementById("outIrpefLorda").textContent = euro(r.irpefLorda);
  document.getElementById("outDetrLav").textContent = euro(r.detrLavoro);
  document.getElementById("outDetrFam").textContent = euro(r.detrFamiliari);
  document.getElementById("outTotTasse").textContent = euro(r.totaleTasse);
  document.getElementById("outAliqEff").textContent = r.aliquotaEffettiva + " %";

  // bonus 100 (si somma)
  if (r.trattIntegrativo > 0) {
    document.getElementById("boxBonus").style.display = "flex";
    document.getElementById("outBonus").textContent = "+ " + euro(r.trattIntegrativo) + "/anno";
  } else document.getElementById("boxBonus").style.display = "none";

  // benefici esenti (a parte)
  const totBenefEsente = r.benefici.fringeEsente + r.benefici.buoniEsenteAnnuo;
  if (totBenefEsente > 0 || r.benefici.imponibileAggiuntivo > 0) {
    document.getElementById("boxBenefici").style.display = "flex";
    let txt = "+ " + euro(totBenefEsente) + "/anno (esente)";
    if (r.benefici.buoniMensile > 0) txt += " &middot; buoni " + euro(r.benefici.buoniMensile) + "/mese";
    document.getElementById("outBenefici").innerHTML = txt;
    if (r.benefici.imponibileAggiuntivo > 0)
      document.getElementById("labelBenefici").textContent =
        "Benefici (parte eccedente TASSATA: " + euro(r.benefici.imponibileAggiuntivo) + ")";
    else
      document.getElementById("labelBenefici").textContent = "Benefici esenti (welfare + buoni pasto)";
  } else document.getElementById("boxBenefici").style.display = "none";

  document.getElementById("outTfr").textContent = euro(r.tfr);

  // nota assegno unico se dichiara figli
  document.getElementById("notaAuu").style.display =
    (document.getElementById("numFigli").value > 0) ? "block" : "none";

  disegnaGrafico(r);
}

function disegnaGrafico(r) {
  const ctx = document.getElementById("graficoTorta");
  const dati = {
    labels: ["Netto in busta", "Contributi INPS", "IRPEF netta", "Add. regionale", "Add. comunale"],
    datasets: [{
      data: [r.nettoAnnuo, r.contributiInps, r.irpefNetta, r.addReg, r.addCom],
      backgroundColor: ["#2e9e5b", "#e8913a", "#d94f4f", "#7b5cc4", "#4aa3c7"],
      borderWidth: 2, borderColor: "#fff"
    }]
  };
  const opz = {
    responsive: true,
    plugins: {
      legend: { position: "bottom", labels: { font: { size: 11 }, padding: 10 } },
      tooltip: { callbacks: { label: (c) => `${c.label}: ${euro(c.raw)} (${((c.raw / r.ral) * 100).toFixed(1)}%)` } }
    }
  };
  if (grafico) grafico.destroy();
  grafico = new Chart(ctx, { type: "doughnut", data: dati, options: opz });
}

inizializza();
