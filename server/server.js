const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json()); // To parse JSON in POST requests
app.use(express.static(path.join(__dirname, "../public"))); // Serve static files

// Load CSV data into memory
let products = [];
const csvFilePath = path.join(__dirname, "../data/gibson.csv");

function loadCSV() {
  const csvData = fs.readFileSync(csvFilePath, "utf8");
  const rows = csvData.split("\n");
  const headers = rows.shift().split(","); // First row = column headers

  products = rows.map((row) => {
    const values = row.split(",");
    return headers.reduce((obj, header, index) => {
      obj[header.trim()] = values[index]?.trim() || "";
      return obj;
    }, {});
  });
}

loadCSV(); // Load CSV data on server start

// Search products by query
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
