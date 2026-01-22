import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// IMPORTANT: public is one level up from /server
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const app = express();
app.use(express.json());

// Serve static from /public correctly (CSS/JS/CSV)
app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));

app.get("/favicon.ico", (req, res) => res.status(204).end());

app.get("/health", (req, res) => res.json({ ok: true }));

app.post("/session", async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    const instructions = `
You are a Gibson Guitar Specialist helping a user browse guitars from the on-page catalog.

RULES:
- Respond ONLY in English. Never respond in Spanish.
- Keep replies short and helpful.

PRODUCT SHOW COMMAND (REQUIRED):
If the user asks to see, show, pull up, list, compare, browse, or view guitars, you MUST output a SHOW command.

Output format (exactly):
[[SHOW: <search phrase>]]

Examples:
User: "show sunburst" -> [[SHOW: sunburst]]
User: "show les paul custom" -> [[SHOW: les paul custom]]
User: "what les pauls do you have?" -> [[SHOW: les paul]]
User: "show custom shop" -> [[SHOW: custom]]

After outputting the SHOW command, you may add ONE short sentence in English.
`.trim();

    const body = {
      model: "gpt-4o-realtime-preview",
      voice: "alloy",
      instructions,
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
