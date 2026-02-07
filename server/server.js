// server/server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { Readable } from "node:stream";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// IMPORTANT: realtime model
const REALTIME_MODEL = process.env.REALTIME_MODEL || "gpt-4o-realtime-preview";

// Serve /public
const PUBLIC_DIR = path.join(__dirname, "..", "public");
app.use(express.static(PUBLIC_DIR, { maxAge: "1h" }));

app.get("/health", (req, res) => res.json({ ok: true }));

// /token -> { value: "ek_..." }
app.get("/token", async (req, res) => {
  try {
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY on server" });
    }

    // FIX: output_modalities must be ONLY ['audio'] OR ONLY ['text']
    const payload = {
      session: {
        type: "realtime",
        model: REALTIME_MODEL,
        output_modalities: ["audio"],
      },
    };

    const r = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const j = await r.json().catch(() => ({}));

    if (!r.ok) {
      return res.status(r.status).json({
        error: "Failed to create client secret",
        status: r.status,
        details: j,
        model_used: REALTIME_MODEL,
      });
    }

    if (!j?.value) {
      return res.status(500).json({
        error: "No value returned from client_secrets",
        details: j,
        model_used: REALTIME_MODEL,
      });
    }

    return res.json({ value: j.value });
  } catch (err) {
    return res.status(500).json({
      error: "Token server error",
      message: err?.message || String(err),
    });
  }
});

// --- Image proxy ---
function isAllowedImageUrl(u) {
  try {
    const url = new URL(u);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return (
      host.endsWith("gibson.com") ||
      host.endsWith("cdn.shopify.com") ||
      host.endsWith("shopify.com")
    );
  } catch {
    return false;
  }
}

app.get("/img", async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).send("Missing url");
    if (!isAllowedImageUrl(url)) return res.status(400).send("Blocked url");

    const r = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Referer: "https://www.gibson.com/",
      },
    });

    if (!r.ok) return res.status(502).send(`Image fetch failed (${r.status})`);

    const ct = r.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=86400");

    const body = r.body;
    if (!body) return res.status(502).send("No image body");
    Readable.fromWeb(body).pipe(res);
  } catch (err) {
    res.status(500).send(`Proxy error: ${err?.message || String(err)}`);
  }
});

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
