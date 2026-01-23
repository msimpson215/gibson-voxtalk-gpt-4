// server/server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve /public
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir, {
  etag: true,
  lastModified: true
}));

// Browser posts SDP as text
app.use(express.text({ type: ["application/sdp", "text/plain"] }));

app.get("/health", (req, res) => res.json({ ok: true }));

/**
 * WebRTC Realtime session
 * The client posts SDP offer, server returns SDP answer.
 */
app.post("/session", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY in environment" });
    }

    const model = process.env.REALTIME_MODEL || "gpt-realtime";
    const voice = process.env.REALTIME_VOICE || "alloy";

    // Safe defaults; the client will still send session.update with exact instructions.
    const sessionConfig = JSON.stringify({
      type: "realtime",
      model,
      audio: { output: { voice } },
      instructions:
        "You are Gibson's friendly, no-pressure guitar salesperson. " +
        "Answer in English. Keep answers short. " +
        "If the user asks to show/list/browse guitars, include [[SHOW: <query>]] in your text."
    });

    const fd = new FormData();
    fd.set("sdp", req.body);
    fd.set("session", sessionConfig);

    const r = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: fd
    });

    if (!r.ok) {
      const txt = await r.text();
      console.error("OpenAI /realtime/calls error:", r.status, txt);
      return res.status(500).send(txt);
    }

    const sdpAnswer = await r.text();
    res.setHeader("Content-Type", "application/sdp");
    return res.send(sdpAnswer);
  } catch (err) {
    console.error("Session error:", err);
    return res.status(500).json({ error: "Failed to create realtime session" });
  }
});

// Fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
