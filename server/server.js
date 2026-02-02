/**
 * Gibson Voice AI Demo — server (GA Realtime)
 * - Serves /public
 * - GET /token returns { value: "ek_..." } using /v1/realtime/client_secrets
 *
 * Env:
 *   OPENAI_API_KEY=sk-...
 *   PORT is set by Render
 */

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve your static Gibson page + assets
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

app.get("/health", (_req, res) => res.json({ ok: true }));

// GA ephemeral key for browser WebRTC
app.get("/token", async (_req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY." });
    }

    const resp = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: {
          // Keep empty unless you have a specific default.
          // The browser can still specify model/voice on /v1/realtime/calls
        },
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return res.status(resp.status).json({
        error: "Failed to create client secret",
        status: resp.status,
        details: data,
      });
    }

    const value = data?.client_secret?.value;
    if (!value) {
      return res.status(500).json({
        error: "No client_secret.value returned",
        details: data,
      });
    }

    return res.json({ value });
  } catch (e) {
    return res.status(500).json({
      error: "Token server error",
      message: e?.message || String(e),
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
