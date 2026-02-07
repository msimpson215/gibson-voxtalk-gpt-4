// server/server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { Readable } from "node:stream";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/**
 * Render MUST bind to process.env.PORT.
 */
const PORT = process.env.PORT || 3000;

/**
 * Required env var:
 *   OPENAI_API_KEY=...
 */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY env var.");
}

// ---- Serve /public as static ----
const PUBLIC_DIR = path.join(__dirname, "..", "public");
app.use(express.static(PUBLIC_DIR, { maxAge: "1h" }));

// ---- Health ----
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

/**
 * /token
 * Returns: { value: "ek_..." }
 * Uses: POST /v1/realtime/client_secrets
 */
app.get("/token", async (req, res) => {
  try {
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "Server missing OPENAI_API_KEY" });
    }

    // IMPORTANT: model must be non-empty or the browser call fails with missing_model.
    // You can change this later, but keep it set.
    const MODEL = process.env.REALTIME_MODEL || "gpt-realtime";

    const payload = {
      session: {
        type: "realtime",
        model: MODEL,
        output_modalities: ["audio", "text"],
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

    // OpenAI returns { value: "ek_..." } for client secret
    if (!r.ok) {
      return res.status(r.status).json({
        error: "Failed to create client secret",
        status: r.status,
        details: j,
      });
    }

    if (!j?.value) {
      return res.status(500).json({
        error: "No client_secret.value returned",
        details: j,
      });
    }

    // Return exactly what the browser expects
    return res.json({ value: j.value });
  } catch (err) {
    return res.status(500).json({
      error: "Token server error",
      message: err?.message || String(err),
    });
  }
});

/**
 * IMAGE PROXY
 *
 * Why: Gibson/CDN hotlinking can fail in the browser (blank images).
 * Fix: load server-side, return from your domain.
 *
 * Usage from browser:
 *   /img?url=<encoded image url>
 */
function isAllowedImageUrl(u) {
  try {
    const url = new URL(u);
    if (url.protocol !== "https:") return false;

    const host = url.hostname.toLowerCase();

    // Allowlist: Gibson + Shopify CDN (where Gibson hosts product images)
    if (
      host.endsWith("gibson.com") ||
      host.endsWith("cdn.shopify.com") ||
      host.endsWith("shopify.com")
    ) {
      return true;
    }

    return false;
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
        // These headers help with some hotlink/anti-bot rules
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Referer: "https://www.gibson.com/",
      },
    });

    if (!r.ok) {
      return res.status(502).send(`Image fetch failed (${r.status})`);
    }

    const ct = r.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", ct);

    // Cache to reduce repeated hits
    res.setHeader("Cache-Control", "public, max-age=86400");

    // Stream body to client (Node 18+)
    const body = r.body;
    if (!body) return res.status(502).send("No image body");

    // Convert WebStream to Node stream and pipe
    Readable.fromWeb(body).pipe(res);
  } catch (err) {
    res.status(500).send(`Proxy error: ${err?.message || String(err)}`);
  }
});

// ---- SPA fallback (optional) ----
// If someone requests a route that doesn't exist, serve index.html.
// This prevents "Cannot GET /something" for front-end routes.
// If you don't need it, it doesn't hurt.
app.get("*", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
