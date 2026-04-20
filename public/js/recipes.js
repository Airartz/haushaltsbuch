// ═══════════════════════════════════════════════════════════════════════════════
//  REZEPTE & ESSENSPLAN
// ═══════════════════════════════════════════════════════════════════════════════

const Recipes = {
  weekStart:   getMondayOfCurrentWeek(),
  recipes:     [],
  entries:     [],
  manageOpen:  false,
  slideIndex:  0,
  slideTimer:  null
};

// ─── Statische Rezept-Datenbank für Slideshow ─────────────────────────────────
const RECIPE_SUGGESTIONS = [
  {
    id:'rs1', title:'Spaghetti Bolognese', emoji:'🍝',
    bg:'linear-gradient(135deg,#fef9c3,#fde68a)',
    img:'https://images.unsplash.com/photo-1567620905732-b5a8e95cf6d9?w=400&h=220&fit=crop&q=75',
    time:'40 Min', servings:4, category:'Mittag · Abend',
    ingredients:['400 g Spaghetti','500 g Rinderhackfleisch','2 Zwiebeln','3 Knoblauchzehen','400 g Dosentomaten','2 EL Tomatenmark','Olivenöl, Salz, Pfeffer','1 TL Oregano, Basilikum','Parmesan zum Servieren'],
    steps:['Zwiebeln und Knoblauch fein hacken und in Olivenöl 3 Min. anschwitzen.','Hackfleisch dazugeben, krümelig braten, würzen.','Tomatenmark einrühren, 1 Min. mitrösten.','Dosentomaten und Kräuter dazu, 20 Min. köcheln.','Spaghetti al dente kochen, abgießen.','Sauce über Pasta, mit Parmesan servieren.']
  },
  {
    id:'rs2', title:'Pizza Margherita', emoji:'🍕',
    bg:'linear-gradient(135deg,#fee2e2,#fecaca)',
    img:'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=220&fit=crop&q=75',
    time:'45 Min', servings:2, category:'Mittag · Abend',
    ingredients:['250 g Pizzateig','150 ml Tomatensauce','150 g Mozzarella','Frisches Basilikum','Olivenöl, Salz, Oregano'],
    steps:['Backofen auf 230 °C vorheizen.','Teig dünn ausrollen, auf Backblech legen.','Tomatensauce verteilen, würzen.','Mozzarella in Stücke reißen und verteilen.','20–25 Min. backen bis der Rand goldbraun ist.','Basilikum und Olivenöl drüber geben.']
  },
  {
    id:'rs3', title:'Caesar Salad', emoji:'🥗',
    bg:'linear-gradient(135deg,#dcfce7,#bbf7d0)',
    img:'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=220&fit=crop&q=75',
    time:'20 Min', servings:2, category:'Mittag · Abend',
    ingredients:['1 Römersalat','80 g Parmesan','100 g Croutons','3 EL Caesar-Dressing','Optional: gegrillte Hähnchenbrust'],
    steps:['Salat waschen, trocknen, in mundgerechte Stücke zupfen.','Parmesan hobeln.','Salat mit Dressing vermengen.','Croutons und Parmesan darüberstreuen.','Optional: Hähnchen in Streifen obendrauf legen.']
  },
  {
    id:'rs4', title:'Hähnchen-Curry', emoji:'🍛',
    bg:'linear-gradient(135deg,#fef3c7,#fde68a)',
    img:'https://images.unsplash.com/photo-1565557623262-b51831df9710?w=400&h=220&fit=crop&q=75',
    time:'35 Min', servings:4, category:'Mittag · Abend',
    ingredients:['600 g Hähnchenbrust','1 Dose Kokosmilch (400 ml)','2 EL rote Currypaste','1 Zwiebel','2 Knoblauchzehen','Salz, Zucker','Frischer Koriander','Reis zum Servieren'],
    steps:['Hähnchen in Würfel schneiden.','Öl erhitzen, Zwiebel und Knoblauch anschwitzen.','Currypaste 2 Min. mitbraten.','Hähnchen rundherum anbraten (5 Min.).','Kokosmilch angießen, 15 Min. köcheln.','Mit Salz und Zucker abschmecken, mit Reis und Koriander servieren.']
  },
  {
    id:'rs5', title:'Amerikanische Pancakes', emoji:'🥞',
    bg:'linear-gradient(135deg,#ede9fe,#ddd6fe)',
    img:'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&h=220&fit=crop&q=75',
    time:'20 Min', servings:2, category:'Frühstück',
    ingredients:['200 g Mehl','2 TL Backpulver','1 EL Zucker','1 Prise Salz','250 ml Milch','1 Ei','2 EL geschmolzene Butter','Ahornsirup und Beeren'],
    steps:['Trockene Zutaten mischen.','Milch, Ei und Butter unterrühren – nicht zu lange.','Teig 5 Min. ruhen lassen.','Pfanne bei mittlerer Hitze leicht einfetten.','Je 1 Kelle Teig, wenden wenn Blasen erscheinen (ca. 2 Min.).','Mit Ahornsirup und Beeren servieren.']
  },
  {
    id:'rs6', title:'Tomatensuppe', emoji:'🍅',
    bg:'linear-gradient(135deg,#fee2e2,#fed7aa)',
    img:'https://images.unsplash.com/photo-1547592180-85f173990554?w=400&h=220&fit=crop&q=75',
    time:'30 Min', servings:4, category:'Mittag',
    ingredients:['800 g Tomaten (frisch oder Dose)','1 Zwiebel','2 Knoblauchzehen','500 ml Gemüsebrühe','1 TL Zucker','Salz, Pfeffer','Basilikum, Sahne optional'],
    steps:['Zwiebel und Knoblauch in Olivenöl anschwitzen.','Tomaten dazu, 5 Min. mitköcheln.','Brühe angießen, 15 Min. köcheln.','Alles pürieren, durch Sieb streichen.','Mit Zucker, Salz und Pfeffer abschmecken.','Mit Basilikum und Sahne servieren.']
  },
  {
    id:'rs7', title:'Rührei mit Toast', emoji:'🍳',
    bg:'linear-gradient(135deg,#fef9c3,#fef08a)',
    img:'https://images.unsplash.com/photo-1525351484163-7529414f2171?w=400&h=220&fit=crop&q=75',
    time:'10 Min', servings:2, category:'Frühstück',
    ingredients:['4 Eier','2 EL Butter','2 EL Milch','Salz, Pfeffer','4 Scheiben Toast','Optional: Schnittlauch, Käse'],
    steps:['Eier mit Milch verquirlen, würzen.','Butter bei niedriger Hitze schmelzen.','Eiermasse langsam vom Rand zur Mitte schieben.','Vom Herd nehmen wenn noch leicht feucht (gart nach).','Toast toasten, Rührei darauf anrichten.']
  },
  {
    id:'rs8', title:'Cheeseburger', emoji:'🍔',
    bg:'linear-gradient(135deg,#fef3c7,#fde68a)',
    img:'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=220&fit=crop&q=75',
    time:'25 Min', servings:2, category:'Mittag · Abend',
    ingredients:['2 Burgerbrötchen','400 g Rinderhackfleisch','2 Scheiben Cheddar','Salat, Tomate, Zwiebel','Ketchup, Senf, Mayonnaise','Salz, Pfeffer'],
    steps:['Hack würzen, zu 2 Patties formen.','Pfanne/Grill stark erhitzen, 3–4 Min. pro Seite.','1 Min. vor Ende Käse auflegen.','Brötchen kurz toasten.','Alles schichten und servieren.']
  },
  {
    id:'rs9', title:'Linsensuppe', emoji:'🥣',
    bg:'linear-gradient(135deg,#d1fae5,#a7f3d0)',
    img:'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=220&fit=crop&q=75',
    time:'40 Min', servings:4, category:'Mittag',
    ingredients:['300 g rote Linsen','2 Karotten','1 Zwiebel','2 Knoblauchzehen','1 L Gemüsebrühe','1 TL Kreuzkümmel','1 TL Kurkuma','Salz, Pfeffer, Zitrone'],
    steps:['Linsen abspülen. Gemüse würfeln.','In Öl anschwitzen, Gewürze einrühren.','Linsen und Brühe dazu, 20 Min. köcheln.','Halb pürieren für cremige Konsistenz.','Mit Zitrone, Salz, Pfeffer abschmecken.']
  },
  {
    id:'rs10', title:'Tacos mit Hackfleisch', emoji:'🌮',
    bg:'linear-gradient(135deg,#fef3c7,#fed7aa)',
    img:'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&h=220&fit=crop&q=75',
    time:'25 Min', servings:4, category:'Mittag · Abend',
    ingredients:['8 Taco-Schalen','400 g Rinderhack','1 Zwiebel','1 Packung Taco-Gewürz','Saure Sahne, Käse','Salsa, Guacamole, Salat'],
    steps:['Zwiebel würfeln, in Öl anschwitzen.','Hack hinzufügen, krümelig braten.','Taco-Gewürz und 50 ml Wasser, 5 Min. einköcheln.','Taco-Schalen bei 160 °C erwärmen (5 Min.).','Schalen füllen und mit Beilagen servieren.']
  },
  {
    id:'rs11', title:'Gemüse-Risotto', emoji:'🍚',
    bg:'linear-gradient(135deg,#e0f2fe,#bae6fd)',
    img:'https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=400&h=220&fit=crop&q=75',
    time:'35 Min', servings:4, category:'Mittag · Abend',
    ingredients:['320 g Arborio-Reis','1 L Gemüsebrühe (warm)','1 Zucchini','1 Paprika','100 ml Weißwein','50 g Parmesan','2 EL Butter','Olivenöl, Salz, Pfeffer'],
    steps:['Brühe warm halten, Gemüse würfeln.','Zwiebel anschwitzen, Reis 2 Min. mitrösten.','Mit Weißwein ablöschen.','Brühe schöpfkellenweis einrühren (18–20 Min.).','Gemüse in letzten 5 Min. unterheben.','Butter und Parmesan unterrühren, abschmecken.']
  },
  {
    id:'rs12', title:'Käse-Omelette', emoji:'🥚',
    bg:'linear-gradient(135deg,#fef9c3,#fef08a)',
    img:'https://images.unsplash.com/photo-1510693206972-df098062cb71?w=400&h=220&fit=crop&q=75',
    time:'10 Min', servings:1, category:'Frühstück · Mittag',
    ingredients:['3 Eier','2 EL Milch','50 g Käse gerieben','1 TL Butter','Salz, Pfeffer','Optional: Schnittlauch, Pilze'],
    steps:['Eier mit Milch verquirlen, würzen.','Butter bei mittlerer Hitze schmelzen.','Eiermasse hineingeben, Ränder zur Mitte falten.','Käse auf eine Hälfte streuen.','Zusammenklappen, 1 Min. stocken lassen.']
  },
  {
    id:'rs13', title:'Wok-Gemüse mit Nudeln', emoji:'🍜',
    bg:'linear-gradient(135deg,#fce7f3,#fbcfe8)',
    img:'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400&h=220&fit=crop&q=75',
    time:'20 Min', servings:2, category:'Mittag · Abend',
    ingredients:['200 g Eiernudeln','1 Paprika','1 Zucchini','2 Karotten','100 g Pilze','3 EL Sojasoße','1 EL Sesamöl','Knoblauch, Ingwer'],
    steps:['Nudeln kochen, abgießen.','Gemüse in Streifen schneiden.','Wok stark erhitzen, Knoblauch und Ingwer 30 Sek. anbraten.','Hartes Gemüse zuerst, dann weiches Gemüse dazu.','Nudeln und Würzsaucen hinzufügen, vermischen.','Sofort servieren.']
  },
  {
    id:'rs14', title:'Overnight Oats', emoji:'🌾',
    bg:'linear-gradient(135deg,#d1fae5,#a7f3d0)',
    img:'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=400&h=220&fit=crop&q=75',
    time:'5 Min + Nacht', servings:1, category:'Frühstück',
    ingredients:['80 g Haferflocken','200 ml Milch','1 EL Joghurt','1 TL Honig','Früchte, Nüsse, Samen'],
    steps:['Haferflocken, Milch, Joghurt und Honig verrühren.','In ein Glas füllen und verschließen.','Mind. 6 Std. im Kühlschrank quellen lassen.','Mit Früchten und Nüssen toppen.','Kalt genießen oder kurz erwärmen.']
  },
  {
    id:'rs15', title:'Schnitzel mit Kartoffeln', emoji:'🍽️',
    bg:'linear-gradient(135deg,#fef3c7,#fde68a)',
    img:'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=220&fit=crop&q=75',
    time:'30 Min', servings:2, category:'Mittag · Abend',
    ingredients:['2 Schweineschnitzel','Mehl, Ei, Paniermehl','Salz, Pfeffer','Öl zum Braten','500 g Kartoffeln','Zitrone zum Servieren'],
    steps:['Schnitzel dünn klopfen, würzen.','In Mehl, Ei und Paniermehl wenden.','Öl erhitzen, 3–4 Min. pro Seite goldbraun braten.','Kartoffeln kochen oder als Bratkartoffeln zubereiten.','Schnitzel auf Küchenpapier abtropfen, mit Zitrone servieren.']
  },
  {
    id:'rs16', title:'Griechischer Salat', emoji:'🫒',
    bg:'linear-gradient(135deg,#dcfce7,#bbf7d0)',
    img:'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=220&fit=crop&q=75',
    time:'15 Min', servings:2, category:'Mittag · Abend',
    ingredients:['2 Tomaten','1 Gurke','1 rote Zwiebel','1 Paprika','100 g Feta','Kalamata-Oliven','Olivenöl, Oregano, Salz'],
    steps:['Tomaten, Gurke und Paprika grob würfeln.','Zwiebel in Ringe schneiden.','Alles in eine Schüssel geben.','Feta in Stücken und Oliven darüber.','Mit Olivenöl, Oregano und Salz würzen und vermengen.']
  }
];

const MEAL_TYPES = [
  { key: 'fruehstueck', label: 'Frühstück' },
  { key: 'mittag',      label: 'Mittag'    },
  { key: 'abend',       label: 'Abend'     }
];

const DAY_NAMES = ['Mo','Di','Mi','Do','Fr','Sa','So'];
const DAY_NAMES_FULL = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];
const MONTH_NAMES_SHORT = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

function getMondayOfCurrentWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  return d;
}

function dateToStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

async function loadRecipes() {
  stopSuggestionSlider();
  const mc = document.getElementById('main-content');
  if (!mc) return;
  mc.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

  try {
    const [recRes] = await Promise.all([fetch('/api/recipes')]);
    Recipes.recipes = await recRes.json();
  } catch { Recipes.recipes = []; }

  await loadMealPlanEntries();
}

async function loadMealPlanEntries() {
  const from = dateToStr(Recipes.weekStart);
  const end  = new Date(Recipes.weekStart);
  end.setDate(end.getDate() + 6);
  const to = dateToStr(end);

  try {
    const res = await fetch(`/api/mealplan?from=${from}&to=${to}`);
    Recipes.entries = await res.json();
  } catch { Recipes.entries = []; }

  renderRecipes();
}

function renderRecipes() {
  const mc = document.getElementById('main-content');
  if (!mc) return;

  const today     = dateToStr(new Date());
  const weekEnd   = new Date(Recipes.weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const kw        = getWeekNumber(Recipes.weekStart);
  const year      = Recipes.weekStart.getFullYear();

  // Build entries map: { date: { meal_type: entry } }
  const map = {};
  Recipes.entries.forEach(e => {
    if (!map[e.meal_date]) map[e.meal_date] = {};
    map[e.meal_date][e.meal_type] = e;
  });

  // Week days
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(Recipes.weekStart);
    d.setDate(d.getDate() + i);
    days.push({ d, str: dateToStr(d), isToday: dateToStr(d) === today });
  }

  // Meal grid rows
  const rows = days.map((day, i) => {
    const cells = MEAL_TYPES.map(mt => {
      const entry = map[day.str]?.[mt.key];
      if (entry) {
        return `<td class="mp-cell mp-cell-filled" onclick="openMealModal('${day.str}','${mt.key}','${escapeHtml(mt.label)}')">
          <div class="mp-meal-title">${escapeHtml(entry.title)}</div>
          ${entry.recipe_name ? `<div class="mp-meal-recipe">${escapeHtml(entry.recipe_name)}</div>` : ''}
        </td>`;
      }
      return `<td class="mp-cell mp-cell-empty" onclick="openMealModal('${day.str}','${mt.key}','${escapeHtml(mt.label)}')">
        <span class="mp-add-btn">${Icons.plus}</span>
      </td>`;
    }).join('');

    const isToday = day.isToday;
    return `<tr class="${isToday ? 'mp-row-today' : ''}">
      <th class="mp-day-th">
        <span class="mp-day-name">${DAY_NAMES[i]}</span>
        <span class="mp-day-date${isToday ? ' mp-today-badge' : ''}">${day.d.getDate()}. ${MONTH_NAMES_SHORT[day.d.getMonth()]}</span>
      </th>
      ${cells}
    </tr>`;
  }).join('');

  // Recipes manage section
  const recipeList = Recipes.recipes.length === 0
    ? `<p class="dp-empty-hint">Noch keine Rezepte gespeichert</p>`
    : Recipes.recipes.map(r => `
        <div class="mp-recipe-item">
          <span class="mp-recipe-name">${escapeHtml(r.name)}</span>
          ${r.description ? `<span class="mp-recipe-desc">${escapeHtml(r.description)}</span>` : ''}
          <button class="btn-icon btn-icon-danger" onclick="deleteRecipe(${r.id})" title="Löschen">${Icons.trash}</button>
        </div>`).join('');

  const manageBody = Recipes.manageOpen ? `
    <div class="dp-manage-body">
      <div class="mp-recipe-list">${recipeList}</div>
      <div class="mp-add-recipe">
        <input type="text" id="recipe-name" placeholder="Rezeptname (z.B. Spaghetti Bolognese)" maxlength="50">
        <input type="text" id="recipe-desc" placeholder="Beschreibung (optional)" maxlength="100">
        <button class="btn btn-primary btn-sm" onclick="saveRecipe()">${Icons.plus} Rezept speichern</button>
      </div>
    </div>` : '';

  mc.innerHTML = `
    <div class="page-header">
      <div>
        <h2>Rezepte</h2>
        <p class="page-subtitle">Essensplan der Woche</p>
      </div>
    </div>

    <div class="cal-container" style="padding-bottom:4px">
      <div class="cal-nav">
        <button class="cal-nav-btn" onclick="changeWeek(-1)">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="cal-month-label">
          <span class="cal-month-name">KW ${kw}</span>
          <span class="cal-year">${year}</span>
        </div>
        <button class="cal-nav-btn" onclick="changeWeek(1)">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>

    <div class="mp-table-wrapper">
      <table class="mp-table">
        <thead>
          <tr>
            <th class="mp-day-col"></th>
            ${MEAL_TYPES.map(mt => `<th class="mp-type-th">${mt.label}</th>`).join('')}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div class="dp-manage-section" style="margin-top:16px">
      <button class="dp-manage-toggle" onclick="Recipes.manageOpen=!Recipes.manageOpen; renderRecipes()">
        <span>Rezepte verwalten</span>
        <svg class="dp-chevron${Recipes.manageOpen ? ' open' : ''}" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      ${manageBody}
    </div>

    ${_renderSuggestions()}
  `;

  setTimeout(() => startSuggestionSlider(), 80);
}

function changeWeek(delta) {
  Recipes.weekStart.setDate(Recipes.weekStart.getDate() + delta * 7);
  loadMealPlanEntries();
}

function openMealModal(dateStr, mealType, mealLabel) {
  const dateObj  = new Date(dateStr + 'T00:00:00');
  const dayIdx   = (dateObj.getDay() + 6) % 7;
  const title    = `${DAY_NAMES_FULL[dayIdx]}, ${dateObj.getDate()}. ${MONTH_NAMES_SHORT[dateObj.getMonth()]} – ${mealLabel}`;
  const existing = Recipes.entries.find(e => e.meal_date === dateStr && e.meal_type === mealType);

  const recipeBtns = Recipes.recipes.length === 0 ? '' : `
    <div class="form-group">
      <label>Aus Rezepten wählen</label>
      <div class="mp-recipe-picker">
        ${Recipes.recipes.map(r => `
          <button class="mp-recipe-btn${existing?.recipe_id === r.id ? ' active' : ''}"
            onclick="selectRecipeForMeal('${dateStr}','${mealType}',${r.id},'${escapeHtml(r.name)}',this)">
            ${escapeHtml(r.name)}
          </button>`).join('')}
      </div>
    </div>`;

  const deleteBtn = existing
    ? `<button class="btn btn-outline btn-sm" onclick="deleteMealEntry(${existing.id})">Eintrag löschen</button>`
    : '';

  openModal(title, `
    ${recipeBtns}
    <div class="form-group">
      <label for="meal-title">Mahlzeit eintragen</label>
      <input type="text" id="meal-title" placeholder="z.B. Spaghetti Bolognese" value="${escapeHtml(existing?.title || '')}" maxlength="60">
    </div>
  `, `
    ${deleteBtn}
    <button class="btn btn-outline" onclick="closeModal()">Abbrechen</button>
    <button class="btn btn-primary" onclick="saveMealEntry('${dateStr}','${mealType}')">Speichern</button>
  `);

  setTimeout(() => document.getElementById('meal-title')?.focus(), 150);
}

function selectRecipeForMeal(_dateStr, _mealType, recipeId, recipeName, btn) {
  const input = document.getElementById('meal-title');
  if (input) { input.value = recipeName; input.setAttribute('data-recipe-id', recipeId); }
  document.querySelectorAll('.mp-recipe-btn').forEach(b => b.classList.remove('active'));
  btn?.classList.add('active');
}

async function saveMealEntry(dateStr, mealType) {
  const input     = document.getElementById('meal-title');
  const title     = input?.value?.trim();
  const recipe_id = input?.getAttribute('data-recipe-id') || null;

  if (!title) { showToast('Mahlzeit eingeben', 'error'); return; }

  const res = await fetch('/api/mealplan', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ meal_date: dateStr, meal_type: mealType, title, recipe_id })
  });

  if (res.ok) {
    closeModal();
    showToast('Gespeichert!', 'success');
    await loadMealPlanEntries();
  } else {
    const d = await res.json();
    showToast(d.error || 'Fehler', 'error');
  }
}

async function deleteMealEntry(entryId) {
  const res = await fetch(`/api/mealplan/${entryId}`, { method: 'DELETE' });
  if (res.ok) {
    closeModal();
    showToast('Gelöscht', 'success');
    await loadMealPlanEntries();
  } else {
    showToast('Fehler beim Löschen', 'error');
  }
}

async function saveRecipe() {
  const name = document.getElementById('recipe-name')?.value?.trim();
  if (!name) { showToast('Name erforderlich', 'error'); return; }
  const description = document.getElementById('recipe-desc')?.value?.trim() || '';

  const btn = document.querySelector('.mp-add-recipe .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = '…'; }

  try {
    const res  = await fetch('/api/recipes', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, description })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`"${name}" gespeichert!`, 'success');
      Recipes.recipes.push(data);
      Recipes.manageOpen = true;
      renderRecipes();
    } else {
      showToast(data.error || 'Fehler', 'error');
      if (btn) { btn.disabled = false; btn.textContent = '+ Rezept speichern'; }
    }
  } catch (err) {
    showToast('Fehler: ' + err.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '+ Rezept speichern'; }
  }
}

async function deleteRecipe(recipeId) {
  if (!confirm('Rezept wirklich löschen?')) return;
  const res = await fetch(`/api/recipes/${recipeId}`, { method: 'DELETE' });
  if (res.ok) {
    Recipes.recipes = Recipes.recipes.filter(r => r.id !== recipeId);
    showToast('Rezept gelöscht', 'success');
    Recipes.manageOpen = true;
    renderRecipes();
  } else {
    showToast('Fehler beim Löschen', 'error');
  }
}

// ─── RECIPE SUGGESTION SLIDESHOW ─────────────────────────────────────────────

// TheMealDB Suchbegriffe – nur Begriffe die die DB sicher kennt
const RS_IMG_QUERIES = {
  rs1: 'Spaghetti Bolognese',
  rs2: 'Pizza',
  rs3: 'Chicken salad',   // Caesar Salad nicht in DB
  rs4: 'Chicken Curry',
  rs5: 'Pancakes',
  rs6: 'Tomato Soup',
  rs7: 'Omelette',
  rs8: 'Burger',          // Beef Burger nicht in DB
  rs9: 'Lentil',          // Lentil Soup nicht in DB
  rs10:'Tacos',
  rs11:'Risotto',
  rs12:'Omelette',
  rs13:'Noodles',
  rs14:'Porridge',
  rs15:'Tonkatsu pork',   // Wiener Schnitzel nicht in DB → ähnliches paniertes Gericht
  rs16:'Greek salad'
};
// Kein JS-Fetch nötig – img.src zeigt direkt auf den Server-Proxy

function _weekSuggestions() {
  const kw  = getWeekNumber(new Date());
  const yr  = new Date().getFullYear();
  const off = (yr * 53 + kw) % RECIPE_SUGGESTIONS.length;
  const result = [];
  for (let i = 0; i < RECIPE_SUGGESTIONS.length; i++) {
    result.push(RECIPE_SUGGESTIONS[(i + off) % RECIPE_SUGGESTIONS.length]);
  }
  return result.slice(0, 8);
}

function _renderSuggestions() {
  const sugg  = _weekSuggestions();
  const kw    = getWeekNumber(new Date());
  const pages = Math.ceil(sugg.length / 2);

  const cards = sugg.map(r => {
    const q = encodeURIComponent(RS_IMG_QUERIES[r.id] || r.title);
    return `
    <div class="rs-card" data-rsid="${r.id}" onclick="openSuggestionModal('${r.id}')">
      <div class="rs-card-img-area" style="background:${r.bg}">
        <img class="rs-card-img" src="/api/meal-image?q=${q}"
             style="opacity:0" loading="lazy" alt=""
             onload="this.style.opacity=1" onerror="this.style.opacity=0">
      </div>
      <div class="rs-card-body">
        <div class="rs-card-title">${escapeHtml(r.title)}</div>
        <div class="rs-card-meta">${r.time} · ${r.category.split(' · ')[0]}</div>
      </div>
    </div>`;
  }).join('');

  const dots = Array.from({ length: pages }, (_, i) =>
    `<button class="rs-dot${i === Recipes.slideIndex ? ' active' : ''}" onclick="setSuggestionSlide(${i})"></button>`
  ).join('');

  return `
    <div class="rs-section">
      <div class="rs-section-header">
        <span class="rs-section-title">Rezept-Ideen · KW ${kw}</span>
      </div>
      <div class="rs-track-wrapper">
        <div class="rs-track" id="rs-track">${cards}</div>
      </div>
      <div class="rs-nav">
        <button class="rs-nav-btn" onclick="changeSuggestionSlide(-1)">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="rs-dots">${dots}</div>
        <button class="rs-nav-btn" onclick="changeSuggestionSlide(1)">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>`;
}

function _applySuggestionSlide() {
  const track = document.getElementById('rs-track');
  if (!track) { stopSuggestionSlider(); return; }
  const w = track.parentElement.offsetWidth;
  track.style.transform = `translateX(${-Recipes.slideIndex * (w + 10)}px)`;
  document.querySelectorAll('.rs-dot').forEach((d, i) =>
    d.classList.toggle('active', i === Recipes.slideIndex));
}

function changeSuggestionSlide(delta) {
  const pages = Math.ceil(_weekSuggestions().length / 2);
  Recipes.slideIndex = (Recipes.slideIndex + delta + pages) % pages;
  _applySuggestionSlide();
  startSuggestionSlider();
}

function setSuggestionSlide(idx) {
  Recipes.slideIndex = idx;
  _applySuggestionSlide();
  startSuggestionSlider();
}

function startSuggestionSlider() {
  stopSuggestionSlider();
  Recipes.slideTimer = setInterval(() => {
    const pages = Math.ceil(_weekSuggestions().length / 2);
    Recipes.slideIndex = (Recipes.slideIndex + 1) % pages;
    _applySuggestionSlide();
  }, 5000);
}

function stopSuggestionSlider() {
  if (Recipes.slideTimer) { clearInterval(Recipes.slideTimer); Recipes.slideTimer = null; }
}

function openSuggestionModal(recipeId) {
  const recipe = _weekSuggestions().find(r => r.id === recipeId);
  if (!recipe) return;

  const q      = encodeURIComponent(RS_IMG_QUERIES[recipe.id] || recipe.title);
  const imgSrc = `/api/meal-image?q=${q}`;

  const dayOpts = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Recipes.weekStart);
    d.setDate(d.getDate() + i);
    return `<option value="${dateToStr(d)}">${DAY_NAMES[i]}, ${d.getDate()}. ${MONTH_NAMES_SHORT[d.getMonth()]}</option>`;
  }).join('');

  const body = `
    <div class="rs-img-wrap" style="background:${recipe.bg}">
      <img class="rs-detail-img" src="${imgSrc}"
           style="opacity:0" alt=""
           onload="this.style.opacity=1" onerror="this.style.opacity=0">
    </div>
    <div class="rs-meta-row">
      <span class="rs-meta-badge">${Icons.clock_sm} ${recipe.time}</span>
      <span class="rs-meta-badge">👤 ${recipe.servings} Pers.</span>
      <span class="rs-meta-badge">${recipe.category}</span>
    </div>
    <div class="rs-ingredients">
      <h4>Zutaten</h4>
      <ul>${recipe.ingredients.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>
    </div>
    <div class="rs-steps">
      <h4>Zubereitung</h4>
      <ol>${recipe.steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
    </div>
    <div class="rs-add-to-plan">
      <h4>Zum Essensplan hinzufügen</h4>
      <div class="rs-add-row">
        <select id="rs-day">${dayOpts}</select>
        <select id="rs-meal">
          ${MEAL_TYPES.map(m => `<option value="${m.key}">${m.label}</option>`).join('')}
        </select>
      </div>
    </div>`;

  openModal(recipe.title, body, `
    <button class="btn btn-outline" onclick="closeModal()">Schließen</button>
    <button class="btn btn-primary" onclick="addSuggestionToMeal('${recipe.id}')">Zum Essensplan</button>
  `);
}

async function addSuggestionToMeal(recipeId) {
  const recipe   = _weekSuggestions().find(r => r.id === recipeId);
  const dateStr  = document.getElementById('rs-day')?.value;
  const mealType = document.getElementById('rs-meal')?.value;
  if (!recipe || !dateStr || !mealType) return;

  const res = await fetch('/api/mealplan', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ meal_date: dateStr, meal_type: mealType, title: recipe.title })
  });

  if (res.ok) {
    closeModal();
    showToast(`"${recipe.title}" zum Essensplan hinzugefügt!`, 'success');
    await loadMealPlanEntries();
  } else {
    const d = await res.json();
    showToast(d.error || 'Fehler beim Hinzufügen', 'error');
  }
}
