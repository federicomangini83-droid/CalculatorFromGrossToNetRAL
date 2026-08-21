/* =========================================================================
   app.js - collega interfaccia, dati e motore di calcolo
   - carica i due file JSON (opzioni + parametri)
   - popola i menu a tendina
   - al click su "Calcola" esegue il calcolo e mostra risultati + grafico
   ========================================================================= */

let PARAMETRI = null;
let OPZIONI = null;
let grafico = null; // istanza Chart.js

/* Formatta un numero come valuta euro italiana */
function euro(n) {
  return n.toLocaleString("it-IT", {
    style: "currency", currency: "EUR",
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
}

/* Carica i file dati all'avvio */
async function inizializza() {
  const [par, opz] = await Promise.all([
    fetch("data/parametri.json").then(r => r.json()),
    fetch("data/opzioni.json").then(r => r.json())
  ]);
  PARAMETRI = par;
  OPZIONI = opz;

  popolaSelect("mensilita", OPZIONI.mensilita, 13);
  popolaSelect("tipoContratto", OPZIONI.tipo_contratto, "indeterminato");
  popolaSelect("dimensioneAzienda", OPZIONI.dimensione_azienda, "fino15");
  popolaSelect("regione", OPZIONI.regioni, "toscana");

  document.getElementById("btnCalcola").addEventListener("click", eseguiCalcolo);
}

/* Popola una <select> con una lista di opzioni {id,label} */
function popolaSelect(idElemento, lista, defaultId) {
  const sel = document.getElementById(idElemento);
  sel.innerHTML = "";
  for (const opt of lista) {
    const o = document.createElement("option");
    o.value = opt.id;
    o.textContent = opt.label;
    if (opt.id === defaultId) o.selected = true;
    sel.appendChild(o);
  }
}

/* Recupera l'aliquota INPS in base a contratto e dimensione azienda */
function determinaAliquotaInps() {
  const contrattoId = document.getElementById("tipoContratto").value;
  const dimensioneId = document.getElementById("dimensioneAzienda").value;

  const contratto = OPZIONI.tipo_contratto.find(c => c.id === contrattoId);

  // apprendista: aliquota dedicata a prescindere dalla dimensione
  if (contratto.aliquota_inps_key === "aliquota_apprendista") {
    return PARAMETRI.contributi_inps.aliquota_apprendista;
  }
  // altrimenti dipende dalla dimensione azienda
  const dimensione = OPZIONI.dimensione_azienda.find(d => d.id === dimensioneId);
  return PARAMETRI.contributi_inps[dimensione.aliquota_inps_key];
}

/* Gestore del pulsante Calcola */
function eseguiCalcolo() {
  const ral = parseFloat(document.getElementById("ral").value);
  if (isNaN(ral) || ral <= 0) {
    alert("Inserisci una RAL valida.");
    return;
  }

  const regioneId = document.getElementById("regione").value;
  const regione = OPZIONI.regioni.find(r => r.id === regioneId);

  const input = {
    ral: ral,
    aliquotaInps: determinaAliquotaInps(),
    aliquotaRegionale: regione.aliquota,
    aliquotaComunale: parseFloat(document.getElementById("addComunale").value) || 0,
    mensilita: parseInt(document.getElementById("mensilita").value)
  };

  const r = calcolaNetto(input, PARAMETRI);
  mostraRisultati(r);
}

/* Scrive i risultati in pagina e aggiorna il grafico */
function mostraRisultati(r) {
  document.getElementById("risultati").style.display = "block";

  document.getElementById("outNettoAnnuo").textContent = euro(r.nettoAnnuo);
  document.getElementById("outNettoMensile").textContent = euro(r.nettoMensile);

  document.getElementById("outRal").textContent = euro(r.ral);
  document.getElementById("outInps").textContent = euro(r.contributiInps);
  document.getElementById("outIrpef").textContent = euro(r.irpefNetta);
  document.getElementById("outAddReg").textContent = euro(r.addizionaleRegionale);
  document.getElementById("outAddCom").textContent = euro(r.addizionaleComunale);
  document.getElementById("outNettoRiga").textContent = euro(r.nettoAnnuo);

  document.getElementById("outImponibile").textContent = euro(r.imponibileFiscale);
  document.getElementById("outIrpefLorda").textContent = euro(r.irpefLorda);
  document.getElementById("outDetrazioni").textContent = euro(r.detrazioni);
  document.getElementById("outTotTasse").textContent = euro(r.totaleTasse);
  document.getElementById("outAliquotaEff").textContent = r.aliquotaEffettiva + " %";

  document.getElementById("outTfr").textContent = euro(r.tfr);

  disegnaGrafico(r);
}

/* Grafico a torta: come si ripartisce la RAL */
function disegnaGrafico(r) {
  const ctx = document.getElementById("graficoTorta");

  const dati = {
    labels: ["Netto in tasca", "Contributi INPS", "IRPEF netta",
             "Add. regionale", "Add. comunale"],
    datasets: [{
      data: [r.nettoAnnuo, r.contributiInps, r.irpefNetta,
             r.addizionaleRegionale, r.addizionaleComunale],
      backgroundColor: ["#2e9e5b", "#e8913a", "#d94f4f", "#7b5cc4", "#4aa3c7"],
      borderWidth: 2,
      borderColor: "#fff"
    }]
  };

  const opzioni = {
    responsive: true,
    plugins: {
      legend: { position: "bottom", labels: { font: { size: 11 }, padding: 10 } },
      tooltip: {
        callbacks: {
          label: (c) => {
            const perc = ((c.raw / r.ral) * 100).toFixed(1);
            return `${c.label}: ${euro(c.raw)} (${perc}%)`;
          }
        }
      }
    }
  };

  if (grafico) grafico.destroy(); // ridisegna da capo a ogni calcolo
  grafico = new Chart(ctx, { type: "doughnut", data: dati, options: opzioni });
}

/* Avvio */
inizializza();
