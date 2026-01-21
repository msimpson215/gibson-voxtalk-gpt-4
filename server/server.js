import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// IMPORTANT: /public is one level ABOVE /server
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const app = express();
app.use(express.json());

// Serve static files from /public correctly (fixes MIME errors)
app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));

// Optional: silence favicon 404
app.get("/favicon.ico", (req, res) => res.status(204).end());

// Health
app.get("/health", (req, res) => res.json({ ok: true }));

/**
 * POST /session
 * Creates OpenAI Realtime session; browser uses returned client_secret.value for WebRTC.
 * English-only lock included (stops Spanish).
 */
app.post("/session", async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    const instructions = `
You are a Gibson Guitar Specialist.
CRITICAL RULE: Respond ONLY in English. Never respond in Spanish.
If the user speaks Spanish, reply in English: "I can only speak English."
Keep answers short and helpful.

When you want the webpage to show product cards, output exactly:
[[SHOW: <search phrase>]]
Example: [[SHOW: sunburst]]
`.trim();

    // Create Realtime session
    const body = {
      model: "gpt-4o-realtime-preview",
      voice: "alloy",
      instructions,

      // If your account/setup ever errors on this, remove this block.
      input_audio_transcription: {
        model: "gpt-4o-mini-transcribe",
        language: "en"
      }
    };

    const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on ${port}`));
