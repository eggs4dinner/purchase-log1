// Purchase log server for Roblox experience 10769399162.
// Roblox servers POST purchases to /api/purchase, the dashboard (/) reads /api/purchases.
// Everything is in this one file. No npm packages needed: run with `node server.js`.

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "change-me"; // must match API_KEY in the Roblox script
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "purchases.json");

let purchases = [];
try {
  purchases = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
} catch {
  purchases = [];
}
const seenIds = new Set(purchases.map((p) => p.purchaseId));

function save() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(purchases, null, 2));
  } catch (err) {
    console.error("Could not save purchases:", err.message);
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req, limit = 10_000) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > limit) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function handlePurchase(req, res) {
  if (req.headers["x-api-key"] !== API_KEY) {
    return sendJson(res, 401, { error: "Bad API key" });
  }

  let p;
  try {
    p = JSON.parse(await readBody(req));
  } catch {
    return sendJson(res, 400, { error: "Invalid JSON" });
  }

  if (!p.purchaseId || !p.userId || !p.itemId || !["GamePass", "DevProduct"].includes(p.type)) {
    return sendJson(res, 400, { error: "Missing fields" });
  }

  // Roblox may retry a request, so ignore duplicates
  if (seenIds.has(String(p.purchaseId))) {
    return sendJson(res, 200, { ok: true, duplicate: true });
  }

  const entry = {
    purchaseId: String(p.purchaseId),
    type: p.type,
    itemId: Number(p.itemId),
    itemName: String(p.itemName || "Unknown item").slice(0, 100),
    price: Number(p.price) || 0,
    userId: Number(p.userId),
    username: String(p.username || "").slice(0, 50),
    displayName: String(p.displayName || "").slice(0, 50),
    placeId: Number(p.placeId) || null,
    universeId: Number(p.universeId) || null,
    studio: Boolean(p.studio),
    time: new Date().toISOString(),
  };

  purchases.push(entry);
  seenIds.add(entry.purchaseId);
  save();
  console.log(`[purchase] ${entry.username} bought ${entry.type} "${entry.itemName}" for R$${entry.price}`);
  sendJson(res, 200, { ok: true });
}

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ebike Police Escape · Sales</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Inter+Tight:wght@500;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<style>
  :root {
    color-scheme: dark;
    --bg: #000000;
    --glass: rgba(255, 255, 255, 0.055);
    --glass-strong: rgba(255, 255, 255, 0.09);
    --edge: rgba(255, 255, 255, 0.12);
    --edge-hi: rgba(255, 255, 255, 0.28);
    --text: #f5f5f7;
    --text-2: rgba(245, 245, 247, 0.68);
    --text-3: rgba(245, 245, 247, 0.42);
    --grid: rgba(255, 255, 255, 0.07);
    --gp: #3987e5;   /* game passes */
    --dp: #d95926;   /* dev products */
    --live: #30d158;
    --radius: 24px;
    --font: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
    --display: "Inter Tight", "Inter", system-ui, sans-serif;
    --mono: "JetBrains Mono", ui-monospace, monospace;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg); color: var(--text); }
  body { font: 15px/1.5 var(--font); -webkit-font-smoothing: antialiased; min-height: 100vh; overflow-x: hidden; }

  /* soft moving light behind the glass */
  .aura { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
  .aura span { position: absolute; border-radius: 50%; filter: blur(90px); opacity: 0.55; animation: drift 26s ease-in-out infinite alternate; }
  .aura .a1 { width: 520px; height: 520px; background: #1d4ed8; top: -160px; left: -120px; }
  .aura .a2 { width: 460px; height: 460px; background: #c2410c; bottom: -180px; right: -100px; animation-delay: -8s; opacity: 0.4; }
  .aura .a3 { width: 380px; height: 380px; background: #7c3aed; top: 35%; left: 55%; animation-delay: -15s; opacity: 0.3; }
  @keyframes drift { from { transform: translate(0, 0) scale(1); } to { transform: translate(80px, 60px) scale(1.15); } }
  @media (prefers-reduced-motion: reduce) { .aura span { animation: none; } }

  main { position: relative; z-index: 1; max-width: 1180px; margin: 0 auto; padding: 32px 16px 64px; }

  .glass {
    position: relative;
    background: linear-gradient(160deg, var(--glass-strong), var(--glass) 40%);
    border: 1px solid var(--edge);
    border-radius: var(--radius);
    backdrop-filter: blur(28px) saturate(180%);
    -webkit-backdrop-filter: blur(28px) saturate(180%);
    box-shadow: inset 0 1px 0 var(--edge-hi), 0 20px 50px rgba(0, 0, 0, 0.45);
  }

  header { display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-end; justify-content: space-between; margin-bottom: 24px; }
  .eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-2);
    padding: 6px 12px; border-radius: 999px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--live); box-shadow: 0 0 0 0 rgba(48, 209, 88, 0.6); animation: pulse 2s infinite; }
  @keyframes pulse { 70% { box-shadow: 0 0 0 8px rgba(48, 209, 88, 0); } 100% { box-shadow: 0 0 0 0 rgba(48, 209, 88, 0); } }
  h1 { font: 700 clamp(32px, 5vw, 52px)/1.05 var(--display); letter-spacing: -0.035em; margin: 14px 0 6px; }
  .sub { color: var(--text-3); margin: 0; font-size: 14px; }

  .uptime { padding: 18px 22px; min-width: 300px; }
  .uptime .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-3); }
  .uptime .clock { display: flex; gap: 14px; margin-top: 6px; }
  .uptime .unit { text-align: center; }
  .uptime .n { font: 600 30px/1 var(--display); letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
  .uptime .u { font-size: 11px; color: var(--text-3); margin-top: 4px; }
  .uptime .since { font-size: 12px; color: var(--text-3); margin-top: 10px; }

  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; margin-bottom: 14px; }
  @media (max-width: 400px) { .stat .value { font-size: 24px; } .uptime { min-width: 0; width: 100%; } }
  .stat { padding: 18px 20px; }
  .stat .label { font-size: 13px; color: var(--text-2); display: flex; align-items: center; gap: 8px; }
  .stat .value { font: 600 32px/1.1 var(--display); letter-spacing: -0.03em; margin-top: 8px; font-variant-numeric: tabular-nums; }
  .stat .hint { font-size: 12px; color: var(--text-3); margin-top: 4px; }
  .swatch { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }

  .grid2 { display: grid; grid-template-columns: 1.7fr 1fr; gap: 14px; margin-bottom: 14px; }
  @media (max-width: 860px) { .grid2 { grid-template-columns: 1fr; } }
  .card { padding: 20px 22px; }
  .card-head { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .card h2 { font: 600 17px/1.2 var(--display); letter-spacing: -0.01em; margin: 0; }
  .card .desc { font-size: 13px; color: var(--text-3); margin-top: 2px; }

  .seg { display: inline-flex; padding: 3px; border-radius: 999px; background: rgba(255, 255, 255, 0.06); border: 1px solid var(--edge); }
  .seg button { font: 500 13px var(--font); color: var(--text-2); background: none; border: 0; padding: 6px 14px; border-radius: 999px; cursor: pointer; }
  .seg button.active { background: rgba(255, 255, 255, 0.16); color: var(--text); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25); }

  .legend { display: flex; gap: 16px; font-size: 13px; color: var(--text-2); margin-top: 10px; }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }

  .chart { position: relative; width: 100%; }
  .chart svg { display: block; width: 100%; overflow: visible; }
  .chart text { fill: var(--text-3); font: 11px var(--font); }
  .tip { position: absolute; pointer-events: none; opacity: 0; transition: opacity 0.12s; z-index: 5;
    padding: 10px 12px; border-radius: 14px; font-size: 13px; min-width: 170px;
    background: rgba(28, 28, 30, 0.72); border: 1px solid var(--edge);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
  .tip .t { color: var(--text-2); margin-bottom: 6px; font-size: 12px; }
  .tip .r { display: flex; justify-content: space-between; gap: 16px; align-items: center; }
  .tip .r span:first-child { display: inline-flex; align-items: center; gap: 6px; color: var(--text-2); }
  .tip .tot { border-top: 1px solid var(--edge); margin-top: 6px; padding-top: 6px; font-weight: 600; }

  .items { display: flex; flex-direction: column; gap: 12px; }
  .item .top { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; }
  .item .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .item .amt { font-variant-numeric: tabular-nums; color: var(--text-2); white-space: nowrap; }
  .item .track { height: 8px; border-radius: 999px; background: rgba(255, 255, 255, 0.06); margin-top: 6px; overflow: hidden; }
  .item .fill { height: 100%; border-radius: 999px; }

  .toolbar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  .check { font-size: 13px; color: var(--text-2); display: inline-flex; gap: 8px; align-items: center; cursor: pointer; }
  .check input { accent-color: var(--gp); }

  .table-wrap { overflow-x: auto; margin: 0 -22px -20px; }
  table { width: 100%; border-collapse: collapse; min-width: 640px; }
  th, td { text-align: left; padding: 12px 22px; white-space: nowrap; }
  th { color: var(--text-3); font-weight: 500; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid var(--edge); }
  td { border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
  tr:last-child td { border-bottom: 0; }
  tbody tr { transition: background 0.15s; }
  tbody tr:hover { background: rgba(255, 255, 255, 0.04); }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .mono { font-family: var(--mono); font-size: 12px; color: var(--text-3); }
  a { color: var(--text); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .muted { color: var(--text-3); }
  .pill { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; color: var(--text-2);
    padding: 3px 10px; border-radius: 999px; background: rgba(255, 255, 255, 0.06); border: 1px solid var(--edge); }
  .pill .swatch { width: 8px; height: 8px; border-radius: 50%; }
  .studio { font-size: 11px; color: var(--text-3); margin-left: 6px; border: 1px dashed var(--edge); border-radius: 6px; padding: 1px 6px; }
  .empty { padding: 36px; text-align: center; color: var(--text-3); }
</style>
</head>
<body>
<div class="aura"><span class="a1"></span><span class="a2"></span><span class="a3"></span></div>
<main>
  <header>
    <div>
      <span class="eyebrow glass"><span class="dot"></span> Live &middot; updates every 5s</span>
      <h1>Ebike Police Escape</h1>
      <p class="sub">Game pass &amp; developer product sales &middot; experience 10769399162</p>
    </div>
    <div class="uptime glass">
      <div class="label">Game has been out for</div>
      <div class="clock">
        <div class="unit"><div class="n" id="upD">0</div><div class="u">days</div></div>
        <div class="unit"><div class="n" id="upH">00</div><div class="u">hours</div></div>
        <div class="unit"><div class="n" id="upM">00</div><div class="u">min</div></div>
        <div class="unit"><div class="n" id="upS">00</div><div class="u">sec</div></div>
      </div>
      <div class="since">Released October 5, 2026</div>
    </div>
  </header>

  <section class="stats">
    <div class="stat glass"><div class="label">Total Robux</div><div class="value" id="total">0</div><div class="hint" id="perDay">&nbsp;</div></div>
    <div class="stat glass"><div class="label">Purchases</div><div class="value" id="count">0</div><div class="hint" id="buyers">&nbsp;</div></div>
    <div class="stat glass"><div class="label"><span class="swatch" style="background:var(--gp)"></span>Game passes</div><div class="value" id="gpTotal">0</div><div class="hint" id="gpCount">&nbsp;</div></div>
    <div class="stat glass"><div class="label"><span class="swatch" style="background:var(--dp)"></span>Dev products</div><div class="value" id="dpTotal">0</div><div class="hint" id="dpCount">&nbsp;</div></div>
  </section>

  <section class="grid2">
    <div class="card glass">
      <div class="card-head">
        <div><h2>Robux over time</h2><div class="desc" id="chartDesc">Robux spent per hour</div></div>
        <div class="seg" id="range">
          <button data-range="24h" class="active">24H</button>
          <button data-range="7d">7D</button>
          <button data-range="all">All</button>
        </div>
      </div>
      <div class="chart" id="chart"><svg id="bars" height="240"></svg><div class="tip" id="tip"></div></div>
      <div class="legend">
        <span><span class="swatch" style="background:var(--gp)"></span>Game passes</span>
        <span><span class="swatch" style="background:var(--dp)"></span>Dev products</span>
      </div>
    </div>
    <div class="card glass">
      <div class="card-head"><div><h2>Top sellers</h2><div class="desc">Robux earned by item</div></div></div>
      <div class="items" id="items"></div>
    </div>
  </section>

  <section class="card glass">
    <div class="card-head">
      <div><h2>Recent purchases</h2><div class="desc">Newest first</div></div>
      <div class="toolbar">
        <div class="seg" id="typeFilter">
          <button data-filter="all" class="active">All</button>
          <button data-filter="GamePass">Game passes</button>
          <button data-filter="DevProduct">Dev products</button>
        </div>
        <label class="check"><input type="checkbox" id="hideStudio" checked> Hide Studio tests</label>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Time</th><th>Player</th><th>Type</th><th>Item</th><th class="num">Robux</th></tr></thead>
        <tbody id="rows"></tbody>
      </table>
      <div class="empty" id="empty">No purchases yet.</div>
    </div>
  </section>
</main>

<script>
  var LAUNCH = new Date(2026, 9, 5, 0, 0, 0); // October 5, 2026 (local time)
  var HOUR = 3600000, DAY = 86400000;
  var all = [];
  var filter = "all";
  var range = "24h";
  var fmt = new Intl.NumberFormat();
  var GP = "#3987e5", DP = "#d95926";

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function rbx(n) { return "R$ " + fmt.format(n); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function sum(list) { return list.reduce(function (s, p) { return s + p.price; }, 0); }

  // ---- time since launch
  function tickUptime() {
    var ms = Math.max(0, Date.now() - LAUNCH.getTime());
    var s = Math.floor(ms / 1000);
    document.getElementById("upD").textContent = Math.floor(s / 86400);
    document.getElementById("upH").textContent = pad(Math.floor(s % 86400 / 3600));
    document.getElementById("upM").textContent = pad(Math.floor(s % 3600 / 60));
    document.getElementById("upS").textContent = pad(s % 60);
  }

  function visible() {
    var hide = document.getElementById("hideStudio").checked;
    return all.filter(function (p) { return !(hide && p.studio); });
  }

  // ---- stat tiles
  function renderStats(base) {
    var gp = base.filter(function (p) { return p.type === "GamePass"; });
    var dp = base.filter(function (p) { return p.type === "DevProduct"; });
    var total = sum(base);
    var days = Math.max(1, (Date.now() - LAUNCH.getTime()) / DAY);
    var buyers = {};
    base.forEach(function (p) { buyers[p.userId] = 1; });
    document.getElementById("total").textContent = rbx(total);
    document.getElementById("perDay").textContent = rbx(Math.round(total / days)) + " per day on average";
    document.getElementById("count").textContent = fmt.format(base.length);
    document.getElementById("buyers").textContent = fmt.format(Object.keys(buyers).length) + " unique buyers";
    document.getElementById("gpTotal").textContent = rbx(sum(gp));
    document.getElementById("gpCount").textContent = fmt.format(gp.length) + " sold";
    document.getElementById("dpTotal").textContent = rbx(sum(dp));
    document.getElementById("dpCount").textContent = fmt.format(dp.length) + " sold";
  }

  // ---- stacked bar chart
  var buckets = [];
  function makeBuckets(base) {
    var now = Date.now(), size, start;
    if (range === "24h") {
      size = HOUR;
      var h = new Date(now); h.setMinutes(0, 0, 0);
      start = h.getTime() - 23 * HOUR;
    } else {
      size = DAY;
      var d = new Date(now); d.setHours(0, 0, 0, 0);
      start = range === "7d" ? d.getTime() - 6 * DAY : LAUNCH.getTime();
      if (start < LAUNCH.getTime()) start = LAUNCH.getTime();
    }
    var out = [];
    for (var t = start; t <= now; t += size) out.push({ start: t, size: size, gp: 0, dp: 0, n: 0 });
    base.forEach(function (p) {
      var i = Math.floor((new Date(p.time).getTime() - start) / size);
      if (i >= 0 && i < out.length) {
        out[i][p.type === "GamePass" ? "gp" : "dp"] += p.price;
        out[i].n++;
      }
    });
    return out;
  }

  function niceMax(v) {
    if (v <= 0) return 10;
    var e = Math.pow(10, Math.floor(Math.log10(v)));
    var steps = [1, 2, 2.5, 5, 10];
    for (var i = 0; i < steps.length; i++) if (steps[i] * e >= v) return steps[i] * e;
    return 10 * e;
  }

  function bucketLabel(b) {
    var d = new Date(b.start);
    if (b.size === HOUR) return d.toLocaleTimeString([], { hour: "numeric" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  function renderChart(base) {
    buckets = makeBuckets(base);
    document.getElementById("chartDesc").textContent = range === "24h" ? "Robux spent per hour, last 24 hours"
      : range === "7d" ? "Robux spent per day, last 7 days" : "Robux spent per day since launch";
    var svg = document.getElementById("bars");
    var W = svg.clientWidth || 600, H = 240;
    var padL = 44, padR = 4, padT = 10, padB = 26;
    var max = niceMax(Math.max.apply(null, buckets.map(function (b) { return b.gp + b.dp; }).concat([0])));
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var slot = plotW / buckets.length;
    var bw = Math.max(3, Math.min(36, slot * 0.62));
    var y = function (v) { return padT + plotH - (v / max) * plotH; };
    var parts = [];

    for (var g = 0; g <= 4; g++) {
      var val = max * g / 4, gy = y(val);
      parts.push('<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + gy + '" y2="' + gy + '" stroke="var(--grid)" />');
      parts.push('<text x="' + (padL - 8) + '" y="' + (gy + 4) + '" text-anchor="end">' + fmt.format(Math.round(val)) + "</text>");
    }

    var every = Math.ceil(buckets.length / Math.max(2, Math.floor(plotW / 70)));
    buckets.forEach(function (b, i) {
      var cx = padL + slot * i + slot / 2, x = cx - bw / 2;
      var hGp = (b.gp / max) * plotH, hDp = (b.dp / max) * plotH;
      var gap = b.gp > 0 && b.dp > 0 ? 2 : 0;
      var base0 = padT + plotH;
      if (b.gp > 0) parts.push(barPath(x, base0 - hGp, bw, hGp, b.dp > 0 ? 0 : 4, GP));
      if (b.dp > 0) parts.push(barPath(x, base0 - hGp - gap - hDp, bw, hDp, 4, DP));
      if (i % every === 0) parts.push('<text x="' + cx + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(bucketLabel(b)) + "</text>");
      parts.push('<rect class="hit" data-i="' + i + '" x="' + (padL + slot * i) + '" y="' + padT + '" width="' + slot + '" height="' + plotH + '" fill="transparent" />');
    });
    parts.push('<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + (padT + plotH) + '" y2="' + (padT + plotH) + '" stroke="rgba(255,255,255,0.18)" />');
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.innerHTML = parts.join("");
  }

  // bar with rounded top corners only (r = 0 for a flat top)
  function barPath(x, top, w, h, r, color) {
    if (h <= 0) return "";
    r = Math.min(r, h, w / 2);
    var d = "M" + x + "," + (top + h) + " V" + (top + r) +
      " Q" + x + "," + top + " " + (x + r) + "," + top +
      " H" + (x + w - r) + " Q" + (x + w) + "," + top + " " + (x + w) + "," + (top + r) +
      " V" + (top + h) + " Z";
    return '<path d="' + d + '" fill="' + color + '" />';
  }

  var chartEl = document.getElementById("chart");
  var tip = document.getElementById("tip");
  chartEl.addEventListener("mousemove", function (e) {
    var t = e.target;
    if (!t.classList || !t.classList.contains("hit")) { tip.style.opacity = 0; return; }
    var b = buckets[Number(t.getAttribute("data-i"))];
    var when = b.size === HOUR
      ? new Date(b.start).toLocaleString([], { month: "short", day: "numeric", hour: "numeric" })
      : new Date(b.start).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    tip.innerHTML = '<div class="t">' + esc(when) + " &middot; " + b.n + (b.n === 1 ? " purchase" : " purchases") + "</div>" +
      '<div class="r"><span><span class="swatch" style="background:' + GP + '"></span>Game passes</span><span>' + rbx(b.gp) + "</span></div>" +
      '<div class="r"><span><span class="swatch" style="background:' + DP + '"></span>Dev products</span><span>' + rbx(b.dp) + "</span></div>" +
      '<div class="r tot"><span>Total</span><span>' + rbx(b.gp + b.dp) + "</span></div>";
    var box = chartEl.getBoundingClientRect();
    var x = e.clientX - box.left + 14, yy = e.clientY - box.top - 20;
    if (x + 190 > box.width) x = e.clientX - box.left - 200;
    tip.style.left = x + "px";
    tip.style.top = Math.max(0, yy) + "px";
    tip.style.opacity = 1;
  });
  chartEl.addEventListener("mouseleave", function () { tip.style.opacity = 0; });

  // ---- top sellers
  function renderItems(base) {
    var map = {};
    base.forEach(function (p) {
      var k = p.type + ":" + p.itemId;
      if (!map[k]) map[k] = { name: p.itemName, type: p.type, robux: 0, n: 0 };
      map[k].robux += p.price;
      map[k].n++;
    });
    var list = Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.robux - a.robux || b.n - a.n; }).slice(0, 6);
    var top = list.length ? Math.max(1, list[0].robux) : 1;
    document.getElementById("items").innerHTML = list.length ? list.map(function (it) {
      return '<div class="item" title="' + esc(it.name) + ": " + it.n + ' sold">' +
        '<div class="top"><span class="name">' + esc(it.name) + '</span><span class="amt">' + rbx(it.robux) + " &middot; " + it.n + "</span></div>" +
        '<div class="track"><div class="fill" style="width:' + Math.max(2, it.robux / top * 100) + "%;background:" + (it.type === "GamePass" ? GP : DP) + '"></div></div></div>';
    }).join("") : '<div class="empty">Nothing sold yet.</div>';
  }

  // ---- table
  function renderTable(base) {
    var shown = base.filter(function (p) { return filter === "all" || p.type === filter; }).slice(0, 100);
    document.getElementById("rows").innerHTML = shown.map(function (p) {
      var gp = p.type === "GamePass";
      return "<tr>" +
        '<td class="muted">' + esc(new Date(p.time).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })) + "</td>" +
        '<td><a href="https://www.roblox.com/users/' + Number(p.userId) + '/profile" target="_blank" rel="noopener">' +
          esc(p.displayName || p.username) + '</a> <span class="muted">@' + esc(p.username) + "</span></td>" +
        '<td><span class="pill"><span class="swatch" style="background:' + (gp ? GP : DP) + '"></span>' + (gp ? "Game pass" : "Dev product") + "</span>" +
          (p.studio ? '<span class="studio">Studio</span>' : "") + "</td>" +
        "<td>" + esc(p.itemName) + ' <span class="mono">#' + Number(p.itemId) + "</span></td>" +
        '<td class="num">' + rbx(p.price) + "</td>" +
        "</tr>";
    }).join("");
    document.getElementById("empty").style.display = shown.length ? "none" : "block";
  }

  function render() {
    var base = visible();
    renderStats(base);
    renderChart(base);
    renderItems(base);
    renderTable(base);
  }

  function load() {
    fetch("/api/purchases")
      .then(function (r) { return r.json(); })
      .then(function (data) { all = data; render(); })
      .catch(function (e) { console.error("Could not load purchases", e); });
  }

  function segmented(id, onPick) {
    var el = document.getElementById(id);
    el.addEventListener("click", function (e) {
      var btn = e.target.closest("button");
      if (!btn) return;
      el.querySelectorAll("button").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      onPick(btn);
      render();
    });
  }
  segmented("range", function (b) { range = b.getAttribute("data-range"); });
  segmented("typeFilter", function (b) { filter = b.getAttribute("data-filter"); });
  document.getElementById("hideStudio").addEventListener("change", render);
  window.addEventListener("resize", function () { renderChart(visible()); });

  tickUptime();
  setInterval(tickUptime, 1000);
  load();
  setInterval(load, 5000);
</script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  try {
    if (req.method === "POST" && url.pathname === "/api/purchase") {
      return await handlePurchase(req, res);
    }
    if (req.method === "GET" && url.pathname === "/api/purchases") {
      return sendJson(res, 200, [...purchases].reverse());
    }
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(PAGE);
    }
    sendJson(res, 404, { error: "Not found" });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: "Server error" });
  }
});

server.listen(PORT, () => {
  console.log(`Purchase log running on http://localhost:${PORT}`);
  if (API_KEY === "change-me") console.warn("WARNING: set the API_KEY environment variable before going live!");
});
