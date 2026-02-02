// server/server.js (ESM)
// Fixes:
// 1) Serves /public at site root (so /assets and /data work)
// 2) /token returns a GA client secret from /v1/realtime/client_secrets (fixes api_version_mismatch)

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json({ limit: "2mb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static frontend
const PUBLIC_DIR = path.join(__dirname, "..", "public");
app.use(express.static(PUBLIC_DIR, {
  extensions: ["html"],
  setHeaders(res) {
    // avoid caching while debugging
    res.setHeader("Cache-Control", "no-store");
  }
}));

app.get("/health", (req, res) => res.status(200).send("ok"));

/**
 * GA Realtime: create an ephemeral client secret for browser use
 * POST https://api.openai.com/v1/realtime/client_secrets
 */
app.get("/token", async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY in Render env vars" });
    }

    const model = process.env.REALTIME_MODEL || "gpt-realtime";
    const voice = process.env.REALTIME_VOICE || "alloy";

    const body = {
      session: {
        type: "realtime",
        model,
        audio: {
          output: { voice }
        }
      }
    };

    const r = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: "client_secrets failed", details: data });
    }

    // GA returns { value: "ek_..." , ... }
    res.json({ value: data.value });
  } catch (err) {
    res.status(500).json({ error: "Token error", details: String(err?.message || err) });
  }
});

// Serve index explicitly
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  console.log(`Serving static from: ${PUBLIC_DIR}`);
});
