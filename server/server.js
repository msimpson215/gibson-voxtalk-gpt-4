// server/server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ----- Config -----
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY in environment.");
}

// Serve static files from /public
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir, { extensions: ["html"] }));

// Health
app.get("/health", (req, res) => res.json({ ok: true }));

/**
 * Mint an ephemeral Realtime client secret for browser use.
 * Uses OpenAI REST endpoint:
 *   POST https://api.openai.com/v1/realtime/client_secrets
 */
app.get("/token", async (req, res) => {
  try {
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "Server missing OPENAI_API_KEY" });
    }

    // Session config attached to the client secret.
    // Keep it small; we'll do session.update from the browser too.
    const body = {
      expires_after: { anchor: "created_at", seconds: 600 },
      session: {
        type: "realtime",
        model: process.env.REALTIME_MODEL || "gpt-realtime",
        audio: {
          output: { voice: process.env.REALTIME_VOICE || "marin" },
        },
      },
    };

    const r = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await r.text();
    let data;
    try {
      data =
