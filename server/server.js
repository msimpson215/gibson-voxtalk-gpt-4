const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const csvParser = require("csv-parser"); // We'll use this to parse CSV files

const app = express();
const PORT = 3000;

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
    console.log("Product catalog loaded!");
  });

// Search products
app.post("/search", (req, res) => {
  const query = req.body.query?.toLowerCase() || "";

  const results = products.filter((product) => {
    const name = product["full-unstyled-link"]?.toLowerCase() || "";
    const finish = product["product-flag 2"]?.toLowerCase() || "";
    return name.includes(query) || finish.includes(query);
  });

  res.json(results);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server started at http://localhost:${PORT}`);
});
