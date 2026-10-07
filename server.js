// Purchase log server for Roblox experience 10769399162.
// Roblox servers POST purchases to /api/purchase, the dashboard reads /api/purchases.
// No npm packages needed: run with `node server.js`.

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "change-me"; // must match API_KEY in the Roblox script
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "purchases.json");
const INDEX_FILE = path.join(__dirname, "public", "index.html");

let purchases = [];
try {
  purchases = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
} catch {
  purchases = [];
}
const seenIds = new Set(purchases.map((p) => p.purchaseId));

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(purchases, null, 2));
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
      return fs.createReadStream(INDEX_FILE).pipe(res);
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
