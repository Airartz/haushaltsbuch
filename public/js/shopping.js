// ═══════════════════════════════════════════════════════════════════════════════
//  SHOPPING VIEW
// ═══════════════════════════════════════════════════════════════════════════════
let _shoppingItems = [];

async function loadShopping() {
  showLoading();
  try {
    const res      = await fetch('/api/shopping');
    _shoppingItems = await res.json();
    renderShoppingPage();
  } catch (_) {
    document.getElementById('main-content').innerHTML =
      `<div class="empty-state">${Icons.alert_circle}<h3>Ladefehler</h3></div>`;
  }
}

function renderShoppingPage() {
  const inCartCount = _shoppingItems.filter(i => i.in_cart).length;

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h2>Einkaufsliste</h2>
        <p class="page-subtitle">Gemeinsame Liste</p>
      </div>
      <button class="btn btn-outline btn-sm" id="btn-finish-shopping"
              onclick="finishShopping()"
              style="${inCartCount > 0 ? '' : 'display:none'}">
        Einkauf abschliessen
      </button>
    </div>

    <div class="shopping-add-form">
      <input type="text"   id="shop-name" class="shopping-input form-input"
             placeholder="Artikel hinzufügen..."
             onkeydown="if(event.key==='Enter')addShoppingItem()">
      <input type="text"   id="shop-qty"  class="shopping-qty-input form-input"
             placeholder="Menge"
             onkeydown="if(event.key==='Enter')addShoppingItem()">
      <button class="btn btn-primary" onclick="addShoppingItem()" title="Hinzufügen">
        ${Icons.plus}
      </button>
    </div>

    <div id="shopping-list-container"></div>`;

  renderShoppingItems(_shoppingItems);

  // Fokus auf Eingabefeld
  setTimeout(() => document.getElementById('shop-name')?.focus(), 100);
}

// Wird auch von Socket.io aufgerufen
function renderShoppingItems(items) {
  _shoppingItems = items;

  // Header-Button aktualisieren
  const finishBtn = document.getElementById('btn-finish-shopping');
  if (finishBtn) {
    const inCartCount = items.filter(i => i.in_cart).length;
    finishBtn.style.display = inCartCount > 0 ? '' : 'none';
  }

  const container = document.getElementById('shopping-list-container');
  if (!container) return;

  const toGet  = items.filter(i => !i.in_cart);
  const inCart = items.filter(i =>  i.in_cart);

  if (toGet.length === 0 && inCart.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        ${Icons.shopping_lg}
        <h3>Liste ist leer</h3>
        <p>Gib oben einen Artikel ein, um ihn hinzuzufügen.</p>
      </div>`;
    return;
  }

  let html = '';

  if (toGet.length > 0) {
    html += `<div class="section-label">${Icons.list} Zu kaufen (${toGet.length})</div>`;
    html += `<div class="shopping-items-list">`;
    toGet.forEach(item => { html += renderShoppingItem(item, false); });
    html += `</div>`;
  }

  if (inCart.length > 0) {
    html += `<div class="section-label section-label-success">${Icons.cart_in} Im Wagen (${inCart.length})</div>`;
    html += `<div class="shopping-items-list">`;
    inCart.forEach(item => { html += renderShoppingItem(item, true); });
    html += `</div>`;
  }

  container.innerHTML = html;
}

function renderShoppingItem(item, isInCart) {
  if (isInCart) {
    return `
      <div class="shopping-item shopping-item-cart" id="sitem-${item.id}">
        <div class="shopping-item-info">
          <span class="shopping-item-name shopping-item-done">${escapeHtml(item.name)}</span>
          ${item.quantity ? `<span class="shopping-item-qty">${escapeHtml(item.quantity)}</span>` : ''}
        </div>
        <div class="shopping-item-actions">
          <button class="btn-icon" onclick="toggleCart(${item.id})" title="Zurücklegen">${Icons.undo}</button>
          <button class="btn-icon btn-icon-danger" onclick="deleteShoppingItem(${item.id})" title="Löschen">${Icons.trash}</button>
        </div>
      </div>`;
  }

  return `
    <div class="shopping-item" id="sitem-${item.id}">
      <div class="shopping-item-info">
        <span class="shopping-item-name">${escapeHtml(item.name)}</span>
        ${item.quantity ? `<span class="shopping-item-qty">${escapeHtml(item.quantity)}</span>` : ''}
        <span class="shopping-item-added">von ${escapeHtml(item.added_by_name)}</span>
      </div>
      <div class="shopping-item-actions">
        <button class="btn btn-outline-primary btn-sm" onclick="toggleCart(${item.id})" title="In Wagen legen">
          ${Icons.cart_in} In Wagen
        </button>
        <button class="btn-icon btn-icon-danger" onclick="deleteShoppingItem(${item.id})" title="Löschen">
          ${Icons.trash}
        </button>
      </div>
    </div>`;
}

// ─── Aktionen ────────────────────────────────────────────────────────────────
async function addShoppingItem() {
  const nameInput = document.getElementById('shop-name');
  const qtyInput  = document.getElementById('shop-qty');
  const name      = nameInput?.value?.trim();
  const quantity  = qtyInput?.value?.trim();

  if (!name) {
    nameInput?.classList.add('input-error');
    setTimeout(() => nameInput?.classList.remove('input-error'), 800);
    return;
  }

  const res = await fetch('/api/shopping', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ name, quantity })
  });

  if (res.ok) {
    if (nameInput) nameInput.value = '';
    if (qtyInput)  qtyInput.value  = '';
    nameInput?.focus();
    // Socket.io aktualisiert die Liste automatisch
  } else {
    showToast('Fehler beim Hinzufügen', 'error');
  }
}

async function toggleCart(itemId) {
  await fetch(`/api/shopping/${itemId}/cart`, { method: 'PATCH' });
  // Echtzeit-Update kommt von Socket.io
}

async function deleteShoppingItem(itemId) {
  await fetch(`/api/shopping/${itemId}`, { method: 'DELETE' });
}

async function finishShopping() {
  const count = _shoppingItems.filter(i => i.in_cart).length;
  if (count === 0) return;
  if (!confirm(`${count} Artikel aus dem Wagen entfernen und Einkauf abschließen?`)) return;

  const res = await fetch('/api/shopping/cart/clear', { method: 'DELETE' });
  if (res.ok) showToast('Einkauf abgeschlossen!', 'success');
}
