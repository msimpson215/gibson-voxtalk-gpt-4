/**
 * Gibson Voice AI Demo — server
 * - Serves static files from /public
 * - Provides GET /token that returns a GA Realtime ephemeral key:
 *     POST https://api.openai.com/v1/realtime/client_secrets
 *
 * Env:
 *   OPENAI_API_KEY=sk-...
 *   PORT=3000 (Render sets PORT automatically)
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

// ---- Static site ----
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

// Health check (optional)
app.get("/health", (_req, res) => res.json({ ok: true }));

/**
 * GET /token
 * Returns: { value: "ek_..." }
 *
 * This uses GA endpoint: /v1/realtime/client_secrets
 * (NOT /v1/realtime/sessions which is beta)
 */
app.get("/token", async (_req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "Missing OPENAI_API_KEY in environment.",
      });
    }

    // You can change these defaults to match your client-side model/voice.
    // Keep it minimal; session can also be updated from the client.
    const body = {
      session: {
        // typical GA usage: voice sessions
        // (your browser will still call /v1/realtime/calls?model=... for WebRTC)
        // Put any safe defaults here if you want:
        // voice: "alloy",
        // modalities: ["audio", "text"],
      },
    };

    const resp = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // IMPORTANT: do NOT send OpenAI-Beta: realtime=v1 for GA calls/models
      },
      body: JSON.stringify(body),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return res.status(resp.status).json({
        error: "Failed to create client secret.",
        status: resp.status,
        details: data,
      });
    }

    // OpenAI returns something like:
    // { client_secret: { value: "ek_...", expires_at: ... }, ... }
    const value = data?.client_secret?.value;

    if (!value) {
      return res.status(500).json({
        error: "No client_secret.value returned from OpenAI.",
        details: data,
      });
    }

    return res.json({ value });
  } catch (err) {
    return res.status(500).json({
      error: "Server error creating client secret.",
      message: err?.message || String(err),
    });
  }
});

// SPA fallback (optional, only if you’re doing client-side routing)
// app.get("*", (req, res) => {
//   res.sendFile(path.join(publicDir, "index.html"));
// });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
