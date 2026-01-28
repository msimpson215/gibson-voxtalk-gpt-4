document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#searchForm");
  const queryInput = document.querySelector("#query");
  const resultsContainer = document.querySelector("#results");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const query = queryInput.value;

    // Send query to the backend
    const response = await fetch("/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    const products = await response.json();
    displayResults(products);
  });

  function displayResults(products) {
    resultsContainer.innerHTML = "";

    if (products.length === 0) {
      resultsContainer.innerHTML = "<p>No products found.</p>";
      return;
    }

    products.forEach((product) => {
      const productCard = document.createElement("div");
      productCard.className = "product-card";

      productCard.innerHTML = `
        <img src="${product['motion-reduce src']}" alt="${product['full-unstyled-link']}" />
        <h3>${product['full-unstyled-link']}</h3>
        <p>Price: ${product['price-item']}</p>
        <a href="${product['full-unstyled-link href']}" target="_blank">View Product</a>
      `;

      resultsContainer.appendChild(productCard);
    });
  }
});
