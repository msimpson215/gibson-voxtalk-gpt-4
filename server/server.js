// server/server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { Readable } from "node:stream";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve /public
const PUBLIC_DIR = path.join(__dirname, "..", "public");
app.use(express.static(PUBLIC_DIR, { maxAge: "1h" }));

app.get("/health", (req, res) => res.json({ ok: true }));

// Image proxy: /img?url=<encoded https url>
function isAllowedImageUrl(u) {
  try {
    const url = new URL(u);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return (
      host.endsWith("gibson.com") ||
      host.endsWith("cdn.shopify.com") ||
      host.endsWith("shopify.com")
    );
  } catch {
    return false;
  }
}

app.get("/img", async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).send("Missing url");
    if (!isAllowedImageUrl(url)) return res.status(400).send("Blocked url");

    const r = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Referer: "https://www.gibson.com/"
      }
    });

    if (!r.ok) return res.status(502).send(`Image fetch failed (${r.status})`);

    res.setHeader("Content-Type", r.headers.get("content-type") || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");

    const body = r.body;
    if (!body) return res.status(502).send("No image body");

    Readable.fromWeb(body).pipe(res);
  } catch (err) {
    res.status(500).send(`Proxy error: ${err?.message || String(err)}`);
  }
});

// SPA fallback to index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
