const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const csvParser = require("csv-parser"); // Install this with `npm install csv-parser`

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// Load CSV data
let products = [];
const csvFilePath = path.join(__dirname, "../data/gibson.csv");

fs.createReadStream(csvFilePath)
  .pipe(csvParser())
  .on("data", (row) => {
    products.push(row);
  })
  .on("end", () => {
    console.log("CSV file successfully loaded");
  });

// Search functionality
app.post("/search", (req, res) => {
  const query = req.body.query?.toLowerCase() || "";
  const results = products.filter((product) => {
    const name = product["full-unstyled-link"]?.toLowerCase() || "";
    const finish = product["product-flag 2"]?.toLowerCase() || "";
    return name.includes(query) || finish.includes(query);
  });

  res.json(results);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
