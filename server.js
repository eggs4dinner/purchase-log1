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
<title>Purchase Log</title>
<style>
  :root {
    --bg: #f5f6f8; --card: #ffffff; --text: #16181d; --muted: #6b7280;
    --border: #e3e5e9; --gp: #2563eb; --dp: #b45309;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #111316; --card: #1a1d21; --text: #eceef1; --muted: #9aa1ab;
      --border: #2a2e34; --gp: #6ea0ff; --dp: #f0a54a;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text);
    font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 1000px; margin: 0 auto; padding: 24px 16px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: var(--muted); margin: 0 0 20px; font-size: 14px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px; }
  .stat { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; }
  .stat .label { color: var(--muted); font-size: 13px; }
  .stat .value { font-size: 24px; font-weight: 650; font-variant-numeric: tabular-nums; }
  .toolbar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; align-items: center; }
  .toolbar button { background: var(--card); color: var(--text); border: 1px solid var(--border);
    border-radius: 999px; padding: 6px 14px; cursor: pointer; font: inherit; font-size: 14px; }
  .toolbar button.active { border-color: var(--text); font-weight: 600; }
  .toolbar label { margin-left: auto; color: var(--muted); font-size: 14px; }
  .table-wrap { background: var(--card); border: 1px solid var(--border); border-radius: 10px; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; min-width: 620px; }
  th, td { text-align: left; padding: 10px 14px; border-bottom: 1px solid var(--border); white-space: nowrap; }
  th { color: var(--muted); font-weight: 500; font-size: 13px; }
  tr:last-child td { border-bottom: none; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  a { color: inherit; }
  .muted { color: var(--muted); }
  .tag { font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 999px; border: 1px solid currentColor; }
  .tag.GamePass { color: var(--gp); }
  .tag.DevProduct { color: var(--dp); }
  .studio { color: var(--muted); font-size: 12px; margin-left: 6px; }
  .empty { padding: 40px; text-align: center; color: var(--muted); }
</style>
</head>
<body>
<main>
  <h1>Purchase Log</h1>
  <p class="sub">Game passes and developer products bought in experience 10769399162 &middot; refreshes every 5 seconds</p>

  <div class="stats">
    <div class="stat"><div class="label">Total Robux</div><div class="value" id="total">0</div></div>
    <div class="stat"><div class="label">Purchases</div><div class="value" id="count">0</div></div>
    <div class="stat"><div class="label">Game passes</div><div class="value" id="gpCount">0</div></div>
    <div class="stat"><div class="label">Dev products</div><div class="value" id="dpCount">0</div></div>
  </div>

  <div class="toolbar">
    <button data-filter="all" class="active">All</button>
    <button data-filter="GamePass">Game passes</button>
    <button data-filter="DevProduct">Dev products</button>
    <label><input type="checkbox" id="hideStudio" checked> Hide Studio tests</label>
  </div>

  <div class="table-wrap">
    <table>
      <thead><tr><th>Time</th><th>Player</th><th>Type</th><th>Item</th><th class="num">Price</th></tr></thead>
      <tbody id="rows"></tbody>
    </table>
    <div class="empty" id="empty">No purchases yet.</div>
  </div>
</main>

<script>
  var all = [];
  var filter = "all";
  var fmt = new Intl.NumberFormat();
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function render() {
    var hideStudio = document.getElementById("hideStudio").checked;
    var base = all.filter(function (p) { return !(hideStudio && p.studio); });
    var shown = base.filter(function (p) { return filter === "all" || p.type === filter; });

    document.getElementById("total").textContent = "R$ " + fmt.format(base.reduce(function (s, p) { return s + p.price; }, 0));
    document.getElementById("count").textContent = fmt.format(base.length);
    document.getElementById("gpCount").textContent = fmt.format(base.filter(function (p) { return p.type === "GamePass"; }).length);
    document.getElementById("dpCount").textContent = fmt.format(base.filter(function (p) { return p.type === "DevProduct"; }).length);

    document.getElementById("rows").innerHTML = shown.map(function (p) {
      return "<tr>" +
        "<td>" + esc(new Date(p.time).toLocaleString()) + "</td>" +
        '<td><a href="https://www.roblox.com/users/' + Number(p.userId) + '/profile" target="_blank" rel="noopener">' +
          esc(p.displayName || p.username) + '</a> <span class="muted">@' + esc(p.username) + "</span></td>" +
        '<td><span class="tag ' + esc(p.type) + '">' + (p.type === "GamePass" ? "Game pass" : "Dev product") + "</span>" +
          (p.studio ? '<span class="studio">Studio</span>' : "") + "</td>" +
        "<td>" + esc(p.itemName) + ' <span class="muted">#' + Number(p.itemId) + "</span></td>" +
        '<td class="num">R$ ' + fmt.format(p.price) + "</td>" +
        "</tr>";
    }).join("");
    document.getElementById("empty").style.display = shown.length ? "none" : "block";
  }

  function load() {
    fetch("/api/purchases")
      .then(function (r) { return r.json(); })
      .then(function (data) { all = data; render(); })
      .catch(function (e) { console.error("Could not load purchases", e); });
  }

  document.querySelectorAll("[data-filter]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll("[data-filter]").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      filter = btn.dataset.filter;
      render();
    });
  });
  document.getElementById("hideStudio").addEventListener("change", render);

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
