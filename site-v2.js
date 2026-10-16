/* Het serveradres staat NIET op de website. De status komt uit status.json,
   dat door een GitHub Action wordt bijgewerkt (zie .github/workflows/status.yml).
   Spelers, teams, kills en doden staan in spelers.json. */
const VERNIEUW_SEC = 60;

const $ = id => document.getElementById(id);
const zet = (id, tekst) => { const e = $(id); if (e) e.textContent = tekst; };
let lijst = [];

const kopUrl = naam => "https://mc-heads.net/avatar/" + encodeURIComponent(naam) + "/64";
const teamNaam = t => t === "noord" ? "Noord" : t === "zuid" ? "Zuid" : "";

function teamTag(team) {
  if (team !== "noord" && team !== "zuid") return null;
  const tag = document.createElement("span");
  tag.className = "tag " + team; tag.textContent = teamNaam(team);
  return tag;
}

/* ---------- spelerskaart ---------- */
function kaart(naam, online, team, dood) {
  const el = document.createElement("div");
  el.className = "player" + (dood ? " dood" : online ? "" : " offline");
  const av = document.createElement("div"); av.className = "avatar";
  const img = document.createElement("img");
  img.src = kopUrl(naam); img.alt = ""; img.loading = "lazy";
  av.append(img);
  const info = document.createElement("div"); info.className = "info";
  const n = document.createElement("div"); n.className = "name"; n.textContent = naam;
  const m = document.createElement("div"); m.className = "meta";
  const d = document.createElement("span"); d.className = "dot";
  const t = document.createElement("span"); t.textContent = dood ? "Dood" : online ? "Online" : "Offline";
  m.append(d, t);
  const tag = teamTag(team); if (tag) m.append(tag);
  info.append(n, m); el.append(av, info); return el;
}

/* ---------- teamscore (homepage) ---------- */
function toonScore() {
  if (!document.querySelector("[data-team]")) return;
  const som = {};
  for (const team of ["noord", "zuid"]) {
    const leden = lijst.filter(s => s.team === team);
    som[team] = {
      kills: leden.reduce((a, s) => a + (s.kills || 0), 0),
      levend: leden.filter(s => !s.dood).length,
      spelers: leden.length
    };
  }
  for (const team of ["noord", "zuid"]) {
    const blok = document.querySelector('[data-team="' + team + '"]');
    for (const veld of ["kills", "levend", "spelers"]) blok.querySelector('[data-f="' + veld + '"]').textContent = som[team][veld];
    const ander = team === "noord" ? "zuid" : "noord";
    blok.querySelector('[data-f="lead"]').textContent = som[team].kills > som[ander].kills ? "👑 Staat voorop" : "";
  }
}

/* ---------- ranglijst ---------- */
function toonRanglijst() {
  const body = $("ranglijstBody"); if (!body) return;
  const rij = lijst.map(s => ({ ...s, kills: s.kills || 0, deaths: s.deaths || 0 }));
  rij.sort((a, b) => (b.kills - a.kills) || (kd(b) - kd(a)) || a.naam.localeCompare(b.naam));
  $("rankLeeg").hidden = rij.length > 0;
  body.replaceChildren(...rij.map((s, i) => {
    const tr = document.createElement("tr"); if (s.dood) tr.className = "dood";
    const pos = document.createElement("td"); pos.className = "pos"; pos.textContent = ["🥇", "🥈", "🥉"][i] || String(i + 1);
    const wie = document.createElement("td");
    const w = document.createElement("div"); w.className = "who";
    const img = document.createElement("img"); img.src = kopUrl(s.naam); img.alt = ""; img.loading = "lazy";
    const nm = document.createElement("span"); nm.textContent = s.naam;
    w.append(img, nm);
    if (s.dood) { const k = document.createElement("span"); k.className = "kruis"; k.textContent = "✖"; w.append(k); }
    wie.append(w);
    const tm = document.createElement("td"); const tag = teamTag(s.team); if (tag) tm.append(tag);
    const k = document.createElement("td"); k.className = "num k"; k.textContent = s.kills;
    const de = document.createElement("td"); de.className = "num"; de.textContent = s.deaths;
    const r = document.createElement("td"); r.className = "num"; r.textContent = s.deaths ? (s.kills / s.deaths).toFixed(2) : (s.kills ? "∞" : "–");
    tr.append(pos, wie, tm, k, de, r); return tr;
  }));
}
const kd = s => s.deaths ? s.kills / s.deaths : s.kills;

/* ---------- serverstatus ---------- */
function toon(namen, aan, aantal, max, live) {
  if ($("serverBadge")) {
    $("serverBadge").className = "badge " + (aan ? "on" : "off");
    zet("serverText", aan ? aantal + " / " + max + " online" : (live ? "Server offline" : "Opent binnenkort"));
  }
  zet("count", aan ? aantal + " van " + max + " spelers online" : (live ? "De server is nu offline." : "De server is nog niet live."));

  if ($("spelersGrid")) {
    const set = new Set(namen.map(n => n.toLowerCase()));
    const rij = lijst.map(s => ({ ...s, online: aan && !s.dood && set.has(s.naam.toLowerCase()) }));
    // online eerst, dan offline, dode spelers onderaan
    const gewicht = s => s.dood ? 2 : s.online ? 0 : 1;
    rij.sort((a, b) => (gewicht(a) - gewicht(b)) || a.naam.localeCompare(b.naam));
    $("spelersGrid").replaceChildren(...rij.map(s => kaart(s.naam, s.online, s.team, s.dood)));

    const bekend = new Set(lijst.map(s => s.naam.toLowerCase()));
    const extra = namen.filter(n => !bekend.has(n.toLowerCase()));
    $("extraWrap").hidden = extra.length === 0;
    $("extraGrid").replaceChildren(...extra.map(n => kaart(n, true)));
    if (live) zet("updated", "De status wordt om de paar minuten bijgewerkt.");
  }
}

async function ververs() {
  try {
    const r = await fetch("status.json", { cache: "no-store" });
    if (!r.ok) throw new Error();
    const d = await r.json();
    toon(d.spelers || [], !!d.online, d.aantal || 0, d.max || 0, !!d.live);
  } catch (e) {
    if ($("serverBadge")) { $("serverBadge").className = "badge off"; zet("serverText", "Status onbekend"); }
  }
}

(async () => {
  const heeftLijstNodig = $("spelersGrid") || $("ranglijstBody") || document.querySelector("[data-team]");
  if (heeftLijstNodig) {
    try { lijst = await (await fetch("spelers.json", { cache: "no-store" })).json(); } catch (e) { lijst = []; }
    toonScore(); toonRanglijst();
  }
  if ($("serverBadge") || $("spelersGrid")) { ververs(); setInterval(ververs, VERNIEUW_SEC * 1000); }
})();
