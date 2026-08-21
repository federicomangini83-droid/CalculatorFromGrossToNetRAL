/* app.js v3 - cuneo fiscale, benefici separati, ripartizione mensilita chiara */

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

  document.getElementById("tipoContratto").addEventListener("change", toggleGiorni);
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

  const input = {
    ral,
    aliquotaInps: determinaAliquotaInps(),
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
  mostraRisultati(calcolaNetto(input, PARAMETRI));
}

function mostraRisultati(r) {
  document.getElementById("risultati").style.display = "block";

  document.getElementById("outNettoAnnuo").textContent = euro(r.nettoAnnuo);
  document.getElementById("outPercNetto").textContent = "(" + r.percNetto + "% della RAL)";

  // ripartizione mensilita
  document.getElementById("outNettoOrd").textContent = euro(r.nettoOrdinarioMese);
  if (r.mesiExtra > 0) {
    document.getElementById("rowExtra").style.display = "flex";
    document.getElementById("badgeExtra").textContent = r.mesiExtra + "\u00D7";
    const nomi = { 1: "13ª mensilità", 2: "13ª e 14ª mensilità", 3: "13ª, 14ª e 15ª mensilità" };
    document.getElementById("descExtra").innerHTML =
      (nomi[r.mesiExtra] || "Mensilità aggiuntive") + "<br><small>senza detrazioni: netto più basso</small>";
    document.getElementById("outNettoExtra").textContent = euro(r.nettoMensilitaAggiuntiva) + " cad.";
  } else {
    document.getElementById("rowExtra").style.display = "none";
  }

  // tabella
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

  // dettaglio
  document.getElementById("outImponibile").textContent = euro(r.imponibileFiscale);
  document.getElementById("outIrpefLorda").textContent = euro(r.irpefLorda);
  document.getElementById("outDetrLav").textContent = euro(r.detrLavoro);
  document.getElementById("liUlt").style.display = (r.ulterioreDetr > 0) ? "flex" : "none";
  document.getElementById("outUltDetr").textContent = euro(r.ulterioreDetr);
  document.getElementById("outTotTasse").textContent = euro(r.totaleTasse);
  document.getElementById("outAliqEff").textContent = r.aliquotaEffettiva + " %";

  // cuneo somma integrativa
  if (r.sommaIntegrativa > 0) {
    document.getElementById("boxSomma").style.display = "flex";
    document.getElementById("outSomma").textContent = "+ " + euro(r.sommaIntegrativa) + "/anno";
  } else document.getElementById("boxSomma").style.display = "none";
  // trattamento integrativo
  if (r.trattIntegrativo > 0) {
    document.getElementById("boxBonus").style.display = "flex";
    document.getElementById("outBonus").textContent = "+ " + euro(r.trattIntegrativo) + "/anno";
  } else document.getElementById("boxBonus").style.display = "none";

  // BENEFICI (sezioni separate + totale)
  const b = r.benefici;
  const haBuoni = b.buoniTotAnnuo > 0;
  const haFringe = (b.fringeEsente > 0 || b.fringeImponibile > 0);
  if (haBuoni || haFringe) {
    document.getElementById("beneficiPanel").style.display = "block";

    if (haBuoni) {
      document.getElementById("benBuoni").style.display = "flex";
      document.getElementById("benBuoniSub").style.display = "block";
      document.getElementById("outBuoni").textContent = euro(b.buoniMensile) + "/mese";
      let sub = euro(b.valoreBuono) + "/giorno &middot; esente fino " + euro(b.buoniEsenteGiorno) +
                " &middot; totale anno " + euro(b.buoniTotAnnuo);
      if (b.buoniImponibileAnnuo > 0) sub += " &middot; di cui tassato " + euro(b.buoniImponibileAnnuo);
      document.getElementById("benBuoniSub").innerHTML = sub;
    } else {
      document.getElementById("benBuoni").style.display = "none";
      document.getElementById("benBuoniSub").style.display = "none";
    }

    if (haFringe) {
      document.getElementById("benFringe").style.display = "flex";
      document.getElementById("benFringeSub").style.display = "block";
      const totFringe = b.fringeEsente + b.fringeImponibile;
      document.getElementById("outFringe").textContent = euro(totFringe) + "/anno";
      if (b.fringeImponibile > 0)
        document.getElementById("benFringeSub").innerHTML =
          "&#9888;&#65039; supera la soglia di " + euro(b.fringeSoglia) + ": <strong>l'intero importo &egrave; tassato</strong>";
      else
        document.getElementById("benFringeSub").innerHTML =
          "entro la soglia di " + euro(b.fringeSoglia) + ": esente";
    } else {
      document.getElementById("benFringe").style.display = "none";
      document.getElementById("benFringeSub").style.display = "none";
    }

    document.getElementById("outBenTot").textContent = euro(b.totaleEsente) + "/anno";
  } else {
    document.getElementById("beneficiPanel").style.display = "none";
  }

  document.getElementById("outTfr").textContent = euro(r.tfr);
  disegnaGrafico(r);
}

function disegnaGrafico(r) {
  const ctx = document.getElementById("graficoTorta");
  const dati = {
    labels: ["Netto in busta", "Contributi INPS", "IRPEF netta", "Add. regionale", "Add. comunale"],
    datasets: [{
      data: [r.nettoInBusta, r.contributiInps, r.irpefNetta, r.addReg, r.addCom],
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
