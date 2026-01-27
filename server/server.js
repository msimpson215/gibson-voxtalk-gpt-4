// server/server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Serve /public
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir, { extensions: ["html"] }));

app.get("/health", (req, res) => res.json({ ok: true }));

// Mint ephemeral token for browser WebRTC Realtime
app.get("/token", async (req, res) => {
  try {
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY on server" });
    }

    const body = {
      expires_after: { anchor: "created_at", seconds: 600 },
      session: {
        type: "realtime",
        model: process.env.REALTIME_MODEL || "gpt-realtime",
        audio: { output: { voice: process.env.REALTIME_VOICE || "marin" } }
      }
    };

    const r = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!r.ok) {
      return res.status(r.status).json({
        error: "OpenAI token mint failed",
        status: r.status,
        data
      });
    }

    return res.json(data);
  } catch (err) {
    console.error("Token mint error:", err);
    return res.status(500).json({ error: "Token mint error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
