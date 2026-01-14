// server/server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve the public folder
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

// Parse raw SDP payloads posted from the browser
app.use(express.text({ type: ["application/sdp", "text/plain"] }));

// Health check
app.get("/health", (req, res) => res.json({ ok: true }));

// Create a Realtime session via the unified interface (WebRTC)
// Browser POSTs SDP -> we forward to OpenAI -> return SDP answer (text)
app.post("/session", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY in .env" });
    }

    const model = process.env.REALTIME_MODEL || "gpt-realtime";
    const voice = process.env.REALTIME_VOICE || "alloy";

    // Session config per OpenAI docs (unified interface)
    const sessionConfig = JSON.stringify({
      type: "realtime",
      model,
      audio: { output: { voice } },
      // Keep it simple: server-side VAD (turn detection) is the most reliable default.
      // You can later tune turn_detection via a session.update event from the client.
    });

    const fd = new FormData();
    fd.set("sdp", req.body);
    fd.set("session", sessionConfig);

    const r = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: fd,
    });

    if (!r.ok) {
      const txt = await r.text();
      console.error("OpenAI /realtime/calls error:", r.status, txt);
      return res.status(500).send(txt);
    }

    // Return SDP answer (plain text)
    const sdpAnswer = await r.text();
    res.setHeader("Content-Type", "application/sdp");
    res.send(sdpAnswer);
  } catch (err) {
    console.error("Session error:", err);
    res.status(500).json({ error: "Failed to create realtime session" });
  }
});

// SPA-ish fallback (optional): serve index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
