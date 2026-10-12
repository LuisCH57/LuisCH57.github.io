// ==========================================================
// 1. GUARDAR Y CARGAR DATOS (localStorage)
// ==========================================================

// Nombre con el que guardamos los datos dentro del navegador
const STORAGE_KEY = "control-gastos:expenses";

// Lee los gastos guardados. Si no hay nada, devuelve una lista vacía.
function loadExpenses() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (saved === null) {
    return [];
  }

  try {
    return JSON.parse(saved); // texto JSON -> lista de objetos
  } catch (error) {
    console.error("Los datos guardados están dañados:", error);
    return [];
  }
}

// Guarda la lista completa de gastos como texto JSON
function saveExpenses() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

// ==========================================================
// 2. ESTADO: la única fuente de verdad de la aplicación
// ==========================================================
// Cada gasto es un objeto con esta forma:
// {
//   id: 1727200000000,
//   description: "Almuerzo",
//   amountCents: 1250,        // S/ 12.50 guardado en céntimos
//   category: "Comida",
//   date: "2026-09-24"
// }
let expenses = loadExpenses();

// ==========================================================
// 3. REFERENCIAS A LOS ELEMENTOS DEL HTML
// ==========================================================
const form = document.getElementById("expense-form");
const descriptionInput = document.getElementById("description");
const amountInput = document.getElementById("amount");
const dateInput = document.getElementById("date");
const categoryInput = document.getElementById("category");
const formError = document.getElementById("form-error");

const totalAmount = document.getElementById("total-amount");
const expenseList = document.getElementById("expense-list");
const listEmpty = document.getElementById("list-empty");
const expenseCount = document.getElementById("expense-count");
const categorySummary = document.getElementById("category-summary");
const summaryEmpty = document.getElementById("summary-empty");

// ==========================================================
// 4. FUNCIONES DE AYUDA (formatos)
// ==========================================================

// Convierte céntimos a texto en soles: 1250 -> "S/ 12.50"
const moneyFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
});

function formatMoney(cents) {
  return moneyFormatter.format(cents / 100);
}

// Convierte "2026-09-24" en "24/09/2026"
function formatDate(isoDate) {
  const parts = isoDate.split("-"); // ["2026", "09", "24"]
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// Devuelve la fecha de hoy en formato "2026-09-24" (hora local de Perú)
function getTodayISO() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0"); // los meses empiezan en 0
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTotalCents() {
  let total = 0;
  for (const expense of expenses) {
    total += expense.amountCents;
  }
  return total;
}

function showError(message) {
  formError.textContent = message;
}

// ==========================================================
// 5. DIBUJAR LA PANTALLA (render)
// ==========================================================
// render() redibuja todo a partir de la lista "expenses".
// Se llama cada vez que los datos cambian.
function render() {
  renderTotal();
  renderList();
  renderSummary();
  renderConversion(); // nuevo: el total convertido también cambia
}

function renderTotal() {
  totalAmount.textContent = formatMoney(getTotalCents());
}

function renderList() {
  expenseList.innerHTML = ""; // vaciar la lista antes de dibujarla de nuevo

  // Copia ordenada: fechas más recientes primero
  const sorted = expenses.slice().sort((a, b) => {
    if (a.date !== b.date) {
      return b.date.localeCompare(a.date);
    }
    return b.id - a.id; // misma fecha: el último registrado primero
  });

  for (const expense of sorted) {
    // Crear cada parte del elemento de la lista
    const item = document.createElement("li");
    item.className = "expense-item";

    const info = document.createElement("div");
    info.className = "expense-info";

    const description = document.createElement("span");
    description.className = "expense-description";
    description.textContent = expense.description;

    const meta = document.createElement("span");
    meta.className = "expense-meta";
    meta.textContent = `${expense.category}, ${formatDate(expense.date)}`;

    info.append(description, meta);

    const amount = document.createElement("span");
    amount.className = "expense-amount";
    amount.textContent = formatMoney(expense.amountCents);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.textContent = "Eliminar";
    deleteButton.setAttribute("aria-label", `Eliminar ${expense.description}`);
    deleteButton.addEventListener("click", () => deleteExpense(expense.id));

    // Unir las partes y agregarlas a la página
    item.append(info, amount, deleteButton);
    expenseList.append(item);
  }

  const count = expenses.length;
  expenseCount.textContent = count === 1 ? "1 gasto" : `${count} gastos`;
  listEmpty.hidden = count > 0; // ocultar el mensaje vacío si hay gastos
}

function renderSummary() {
  categorySummary.innerHTML = "";
  const total = getTotalCents();

  // Sumar por categoría. Resultado: { Comida: 3500, Transporte: 1200, ... }
  const totalsByCategory = {};
  for (const expense of expenses) {
    if (totalsByCategory[expense.category] === undefined) {
      totalsByCategory[expense.category] = 0;
    }
    totalsByCategory[expense.category] += expense.amountCents;
  }

  // Convertir a lista de pares [categoría, monto] y ordenar de mayor a menor
  const rows = Object.entries(totalsByCategory).sort((a, b) => b[1] - a[1]);

  for (const row of rows) {
    const category = row[0];
    const cents = row[1];
    const percent = Math.round((cents / total) * 100);

    const item = document.createElement("li");
    item.className = "summary-item";

    const label = document.createElement("div");
    label.className = "summary-label";

    const name = document.createElement("span");
    name.className = "summary-name";
    name.textContent = category;

    const value = document.createElement("span");
    value.className = "summary-value";
    value.textContent = `${formatMoney(cents)} (${percent} %)`;

    label.append(name, value);

    const bar = document.createElement("div");
    bar.className = "summary-bar";

    const fill = document.createElement("div");
    fill.className = "summary-fill";
    fill.style.width = `${percent}%`; // el largo de la barra = porcentaje

    bar.append(fill);
    item.append(label, bar);
    categorySummary.append(item);
  }

  summaryEmpty.hidden = rows.length > 0;
}

// ==========================================================
// 6. ACCIONES: cambiar datos -> guardar -> redibujar
// ==========================================================
function addExpense(description, amountCents, category, date) {
  const expense = {
    id: Date.now(), // número único: milisegundos desde 1970
    description: description,
    amountCents: amountCents,
    category: category,
    date: date,
  };

  expenses.push(expense);
  saveExpenses();
  render();
}

function deleteExpense(id) {
  const expense = expenses.find((item) => item.id === id);
  const confirmed = confirm(`¿Eliminar "${expense.description}"?`);

  if (!confirmed) {
    return;
  }

  // Nueva lista con todos los gastos excepto el eliminado
  expenses = expenses.filter((item) => item.id !== id);
  saveExpenses();
  render();
}

// ==========================================================
// 7. EVENTOS: qué pasa cuando el usuario envía el formulario
// ==========================================================
form.addEventListener("submit", (event) => {
  event.preventDefault(); // evita que la página se recargue al enviar

  // Leer lo que escribió el usuario
  const description = descriptionInput.value.trim(); // trim quita espacios sobrantes
  const amount = Number(amountInput.value);
  const category = categoryInput.value;
  const date = dateInput.value;

  // Validar: si algo está mal, mostrar el error y detenerse
  if (description === "") {
    showError("Escribe una descripción para el gasto.");
    descriptionInput.focus();
    return;
  }

  if (!(amount > 0)) {
    showError("Ingresa un monto mayor que 0.");
    amountInput.focus();
    return;
  }

  if (date === "") {
    showError("Elige la fecha del gasto.");
    dateInput.focus();
    return;
  }

  // Todo correcto: limpiar el error y guardar el gasto
  showError("");
  const amountCents = Math.round(amount * 100); // 12.5 -> 1250
  addExpense(description, amountCents, category, date);

  // Preparar el formulario para el siguiente gasto
  form.reset();
  dateInput.value = getTodayISO();
  descriptionInput.focus();
});

// ==========================================================
// 8. CONVERSIÓN DE MONEDA CON UNA API EXTERNA (nuevo)
// ==========================================================

// Dirección de la API: devuelve cuánto vale 1 sol (PEN) en otras monedas
const RATES_URL = "https://open.er-api.com/v6/latest/PEN";
const RATES_KEY = "control-gastos:rates";

const currencySelect = document.getElementById("currency");
const convertedAmount = document.getElementById("converted-amount");
const rateInfo = document.getElementById("rate-info");
const converterStatus = document.getElementById("converter-status");
const retryButton = document.getElementById("retry-button");

// Tipos de cambio en memoria. Forma:
// { values: { USD: 0.29, EUR: 0.26, ... }, updatedAt: 1791000000, nextUpdate: 1791086400 }
let rates = null;

// Muestra un mensaje de estado. isError = true lo pinta de rojo.
function showConverterStatus(message, isError) {
  converterStatus.textContent = message;
  converterStatus.classList.toggle("is-error", isError);
}

// Devuelve los tipos de cambio guardados, solo si todavía están vigentes
function loadCachedRates() {
  const saved = localStorage.getItem(RATES_KEY);
  if (saved === null) {
    return null;
  }

  try {
    const cached = JSON.parse(saved);
    const nowInSeconds = Date.now() / 1000;
    if (nowInSeconds < cached.nextUpdate) {
      return cached; // todavía no hay datos nuevos en la API
    }
  } catch (error) {
    console.error("Tipos de cambio guardados dañados:", error);
  }
  return null;
}

// Pide los tipos de cambio a la API por internet
async function fetchRates() {
  showConverterStatus("Cargando tipos de cambio...", false);
  retryButton.hidden = true;

  try {
    // 1. Hacer la petición HTTP y ESPERAR la respuesta (await)
    const response = await fetch(RATES_URL);

    // 2. Revisar el código de estado HTTP (200 = todo bien)
    if (!response.ok) {
      throw new Error(`La API respondió con el código ${response.status}`);
    }

    // 3. Convertir el cuerpo de la respuesta (JSON) en un objeto
    const data = await response.json();
    if (data.result !== "success") {
      throw new Error("La API no pudo entregar los tipos de cambio");
    }

    // 4. Guardar solo lo que necesitamos, en memoria y en localStorage
    rates = {
      values: data.rates,
      updatedAt: data.time_last_update_unix,
      nextUpdate: data.time_next_update_unix,
    };
    localStorage.setItem(RATES_KEY, JSON.stringify(rates));

    showConverterStatus("", false);
    renderConversion();
  } catch (error) {
    // Llega aquí si no hay internet, si la API falla o si hubo un throw
    console.error("Error al obtener los tipos de cambio:", error);
    showConverterStatus("No se pudieron cargar los tipos de cambio. Revisa tu conexión e inténtalo de nuevo.", true);
    retryButton.hidden = false;
  }
}

// Dibuja el total convertido a la moneda elegida
function renderConversion() {
  if (rates === null) {
    return; // todavía no tenemos tipos de cambio
  }

  const currency = currencySelect.value; // por ejemplo "USD"
  const rate = rates.values[currency];   // por ejemplo 0.2912

  const totalInSoles = getTotalCents() / 100;
  const converted = totalInSoles * rate;

  const formatter = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: currency,
  });
  convertedAmount.textContent = formatter.format(converted);

  const updated = new Date(rates.updatedAt * 1000).toLocaleDateString("es-PE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  rateInfo.textContent = `1 sol = ${rate.toFixed(4)} ${currency}. Tipo de cambio del ${updated}.`;
}

// Eventos del conversor
currencySelect.addEventListener("change", renderConversion);
retryButton.addEventListener("click", fetchRates);

// ==========================================================
// 9. INICIO: lo que se ejecuta al abrir la página
// ==========================================================
dateInput.value = getTodayISO();
render();

// Usar los tipos de cambio guardados si siguen vigentes; si no, pedirlos a la API
rates = loadCachedRates();
if (rates !== null) {
  renderConversion();
} else {
  fetchRates();
}
