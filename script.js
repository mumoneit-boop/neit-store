let products = [];
const money = value => `$${value.toFixed(2)}`;
const imageUrl = (id, width = 720) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=82`;
const grid = document.getElementById("productGrid");
const bag = [];
let activeFilter = "All";
let searchTerm = "";
let toastTimer;

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers }
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Something went wrong");
  return result;
}

function renderProducts() {
  const visible = products.filter(product => {
    const matchesCategory = activeFilter === "All" || product.category === activeFilter || (activeFilter === "New" && product.tag === "New");
    const matchesSearch = `${product.name} ${product.category} ${product.detail}`.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });
  document.getElementById("productCount").textContent = `${visible.length} ${visible.length === 1 ? "piece" : "pieces"}`;
  grid.innerHTML = visible.length ? visible.map((product, index) => `
    <article class="product-card" style="animation-delay:${index * 45}ms">
      <div class="product-image">
        <img src="${imageUrl(product.image)}" alt="${product.name} jewelry" loading="lazy">
        ${product.tag ? `<span class="product-tag">${product.tag}</span>` : ""}
        <button class="favorite" aria-label="Add ${product.name} to favorites" aria-pressed="false"><svg viewBox="0 0 24 24"><path d="M20.5 8.7c0 5-8.5 10-8.5 10s-8.5-5-8.5-10a4.5 4.5 0 0 1 8.5-2.1 4.5 4.5 0 0 1 8.5 2.1Z"/></svg></button>
        <button class="quick-add" data-add="${product.id}">Add to bag · ${money(product.price)}</button>
      </div>
      <div class="product-info"><div class="product-topline"><h3 class="product-name">${product.name}</h3><span class="product-price">${money(product.price)}</span></div><p class="product-detail">${product.detail}</p></div>
    </article>`).join("") : `<p class="empty-state">No treasures found. Try another search.</p>`;
  grid.querySelectorAll("[data-add]").forEach(button => button.addEventListener("click", () => addToBag(Number(button.dataset.add))));
  grid.querySelectorAll(".favorite").forEach(button => button.addEventListener("click", () => {
    const pressed = button.getAttribute("aria-pressed") === "true";
    button.setAttribute("aria-pressed", String(!pressed));
    button.setAttribute("aria-label", `${pressed ? "Add" : "Remove"} favorite`);
    showToast(pressed ? "Removed from your favorites" : "Saved to your favorites");
  }));
}
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}
function addToBag(id) {
  const item = bag.find(entry => entry.id === id);
  if (item) item.quantity += 1;
  else bag.push({ id, quantity: 1 });
  updateBag();
  showToast(`${products.find(product => product.id === id).name} added to your bag`);
}
function updateBag() {
  const quantity = bag.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = bag.reduce((sum, item) => sum + products.find(product => product.id === item.id).price * item.quantity, 0);
  document.getElementById("bagCount").textContent = quantity;
  document.getElementById("bagHeadingCount").textContent = `(${quantity})`;
  document.getElementById("bagSubtotal").textContent = money(subtotal);
  document.getElementById("bagItems").innerHTML = bag.length ? bag.map(item => {
    const product = products.find(entry => entry.id === item.id);
    return `<div class="bag-item"><img src="${imageUrl(product.image, 180)}" alt=""><div><h3>${product.name}</h3><p>${money(product.price)} · Qty ${item.quantity}</p><button class="remove-item" data-remove="${product.id}">Remove</button></div><strong>${money(product.price * item.quantity)}</strong></div>`;
  }).join("") : `<p class="bag-empty">Your bag is waiting for something lovely.</p>`;
  document.querySelectorAll("[data-remove]").forEach(button => button.addEventListener("click", () => {
    const index = bag.findIndex(item => item.id === Number(button.dataset.remove));
    if (index >= 0) bag.splice(index, 1);
    updateBag();
  }));
}
function setBagOpen(open) {
  document.getElementById("bagPanel").classList.toggle("open", open);
  document.getElementById("bagPanel").setAttribute("aria-hidden", String(!open));
  document.getElementById("overlay").classList.toggle("open", open);
  document.body.style.overflow = open ? "hidden" : "";
}
document.getElementById("filterRow").addEventListener("click", event => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  activeFilter = button.dataset.filter;
  document.querySelectorAll(".filter-button").forEach(filter => {
    const active = filter === button;
    filter.classList.toggle("active", active);
    filter.setAttribute("aria-pressed", String(active));
  });
  renderProducts();
});
document.querySelectorAll("[data-nav-filter]").forEach(link => link.addEventListener("click", () => {
  activeFilter = link.dataset.navFilter;
  document.querySelectorAll(".filter-button").forEach(button => {
    const active = button.dataset.filter === activeFilter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  renderProducts();
}));
document.getElementById("searchToggle").addEventListener("click", () => {
  const panel = document.getElementById("searchPanel");
  const open = panel.classList.toggle("open");
  document.getElementById("searchToggle").setAttribute("aria-expanded", String(open));
  if (open) document.getElementById("searchInput").focus();
});
document.getElementById("searchInput").addEventListener("input", event => { searchTerm = event.target.value.trim(); renderProducts(); });
document.getElementById("bagToggle").addEventListener("click", () => setBagOpen(true));
document.getElementById("bagClose").addEventListener("click", () => setBagOpen(false));
document.getElementById("overlay").addEventListener("click", () => setBagOpen(false));
document.getElementById("menuToggle").addEventListener("click", event => {
  const open = document.getElementById("mainNav").classList.toggle("open");
  event.currentTarget.setAttribute("aria-expanded", String(open));
});
document.querySelectorAll("#mainNav a").forEach(link => link.addEventListener("click", () => {
  document.getElementById("mainNav").classList.remove("open");
  document.getElementById("menuToggle").setAttribute("aria-expanded", "false");
}));
document.getElementById("newsletterForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button");
  button.disabled = true;
  try {
    await api("/api/newsletter", {
      method: "POST",
      body: JSON.stringify({ email: form.querySelector("input").value })
    });
    form.reset();
    showToast("You're on the list. Talk soon!");
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
  }
});
document.getElementById("checkoutForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!bag.length) return showToast("Your bag is empty");
  const form = event.currentTarget;
  const button = document.getElementById("checkoutButton");
  button.disabled = true;
  try {
    const order = await api("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        name: form.elements.name.value,
        email: form.elements.email.value,
        items: bag.map(item => ({ productId: item.id, quantity: item.quantity }))
      })
    });
    bag.length = 0;
    updateBag();
    form.reset();
    setBagOpen(false);
    showToast(`Order ${order.orderId} saved. Payment is not processed.`);
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
  }
});
api("/api/products").then(result => {
  products = result.products;
  renderProducts();
}).catch(() => {
  grid.innerHTML = '<p class="empty-state">The collection could not be loaded. Please refresh and try again.</p>';
  document.getElementById("productCount").textContent = "";
});
updateBag();
