import express from "express";

const app = express();
app.use(express.json());

// Serve everything in /public so these work:
// / (index.html), /styles.css, /gipson.js, /data/gibson.csv
app.use(express.static("public", { extensions: ["html"] }));

app.get("/health", (req, res) => res.json({ ok: true }));

/**
 * POST /session
 * Returns an OpenAI Realtime session object that includes client_secret.value
 * Used by the browser to complete WebRTC SDP exchange.
 */
app.post("/session", async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    // HARD LOCK: English only. This prevents Spanish responses even if ASR hears “hola”.
    const instructions = `
You are a Gibson Guitar Specialist helping users browse guitars from a CSV catalog.
CRITICAL RULE: Respond ONLY in English. Never respond in Spanish.
If the user speaks Spanish, reply in English: "I can only speak English."
Keep responses short, helpful, and friendly.

When you want the UI to show product cards, output exactly one line like:
[[SHOW: <search phrase>]]
Example: [[SHOW: les paul sunburst]]
    `.trim();

    // Realtime session create
    // NOTE: If your working deploy uses a different model string, keep your known-good.
    const body = {
      model: "gpt-4o-realtime-preview",
      voice: "alloy",
      instructions,

      // Helps stop the “hello -> hola” thing when supported; if it ever errors, remove this block.
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
app.listen(port, () => console.log(`Server listening on ${port}`));
