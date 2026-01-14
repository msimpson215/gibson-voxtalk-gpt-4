// server/server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve /public as the site root
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

// Browser posts SDP as text
app.use(express.text({ type: ["application/sdp", "text/plain"] }));

app.get("/health", (req, res) => res.json({ ok: true }));

/**
 * WebRTC Realtime: browser creates SDP offer, POSTs it to /session,
 * server forwards it to OpenAI /v1/realtime/calls, returns SDP answer.
 */
app.post("/session", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY in environment" });
    }

    const model = process.env.REALTIME_MODEL || "gpt-realtime";
    const voice = process.env.REALTIME_VOICE || "alloy";

    const sessionConfig = JSON.stringify({
      type: "realtime",
      model,
      audio: { output: { voice } }
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

    const sdpAnswer = await r.text();
    res.setHeader("Content-Type", "application/sdp");
    return res.send(sdpAnswer);
  } catch (err) {
    console.error("Session error:", err);
    return res.status(500).json({ error: "Failed to create realtime session" });
  }
});

// Fallback: serve the app
app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
