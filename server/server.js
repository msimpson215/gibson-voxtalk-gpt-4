// server/server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json({ limit: "2mb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ This is the critical line: serve /public at site root
const PUBLIC_DIR = path.join(__dirname, "..", "public");
app.use(express.static(PUBLIC_DIR, {
  extensions: ["html"],
  setHeaders(res, filePath) {
    // stop aggressive caching while debugging
    res.setHeader("Cache-Control", "no-store");
  }
}));

// health check
app.get("/health", (req, res) => res.status(200).send("ok"));

// token endpoint for Realtime ephemeral key
app.get("/token", async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY in Render env vars" });
    }

    // Use OpenAI ephemeral session token endpoint
    const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.REALTIME_MODEL || "gpt-4o-realtime-preview",
        voice: process.env.REALTIME_VOICE || "alloy"
      })
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: "Realtime session create failed", details: data });
    }

    // Return standard shape used by your frontend
    res.json({ client_secret: data.client_secret });
  } catch (err) {
    res.status(500).json({ error: "Token error", details: String(err?.message || err) });
  }
});

// Serve the SPA (index.html) for root explicitly
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  console.log(`Serving static from: ${PUBLIC_DIR}`);
});
