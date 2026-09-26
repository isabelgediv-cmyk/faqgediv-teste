
const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSGl48MRFhtfZLirpHIvW9ySawBxitDg0w5m6wHLqo4KnJTXUHd-M-OA1mr9gpl0whhonMwvw0cZojj/pub?gid=1686832610&single=true&output=csv";

let DATA = [];
let activeCategory = "Todas";

const searchInput = document.getElementById("searchInput");
const categoriesEl = document.getElementById("categories");
const faqList = document.getElementById("faqList");
const resultCount = document.getElementById("resultCount");
const sectionTitle = document.getElementById("sectionTitle");
const emptyState = document.getElementById("emptyState");
const clearFilter = document.getElementById("clearFilter");

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell);
      if (row.some(value => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell);
    if (row.some(value => value.trim() !== "")) rows.push(row);
  }

  return rows;
}

function normalize(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatAnswer(text) {
  return escapeHtml(text).replace(/\r?\n/g, "<br>");
}

function loadCSV(text) {
  const rows = parseCSV(text);

  if (rows.length < 2) {
    throw new Error("A planilha não possui dados suficientes.");
  }

  const headers = rows[0].map(normalize);
  const categoriaIndex = headers.findIndex(h => h === "categoria");
  const perguntaIndex = headers.findIndex(h => h === "pergunta");
  const respostaIndex = headers.findIndex(h => h === "resposta");

  if (categoriaIndex === -1 || perguntaIndex === -1 || respostaIndex === -1) {
    throw new Error("As colunas Categoria, Pergunta e Resposta não foram encontradas.");
  }

  return rows.slice(1)
    .map(row => ({
      categoria: (row[categoriaIndex] || "").trim(),
      pergunta: (row[perguntaIndex] || "").trim(),
      resposta: (row[respostaIndex] || "").trim()
    }))
    .filter(item => item.pergunta && item.resposta);
}

function getCategories() {
  return [
    "Todas",
    ...new Set(DATA.map(item => item.categoria).filter(Boolean))
  ];
}

function updateClearButton() {
  const hasFilter = activeCategory !== "Todas" || searchInput.value.trim() !== "";
  clearFilter.hidden = !hasFilter;
}

function renderCategories() {
  categoriesEl.innerHTML = getCategories().map(category => `
    <button
      type="button"
      class="category ${category === activeCategory ? "active" : ""}"
      data-category="${escapeHtml(category)}"
      aria-pressed="${category === activeCategory}"
    >${escapeHtml(category)}</button>
  `).join("");

  categoriesEl.querySelectorAll(".category").forEach(button => {
    button.addEventListener("click", () => {
      activeCategory = button.dataset.category;
      renderCategories();
      render();

      document.querySelector(".results-head")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  });
}

function getFiltered() {
  const search = normalize(searchInput.value);

  return DATA.filter(item => {
    const matchesCategory =
      activeCategory === "Todas" || item.categoria === activeCategory;

    const searchableText = normalize(
      `${item.categoria} ${item.pergunta} ${item.resposta}`
    );

    return matchesCategory && (!search || searchableText.includes(search));
  });
}

function render() {
  const filtered = getFiltered();

  resultCount.textContent =
    `${filtered.length} ${filtered.length === 1 ? "resultado" : "resultados"}`;

  sectionTitle.textContent =
    activeCategory === "Todas" ? "Perguntas frequentes" : activeCategory;

  updateClearButton();

  if (filtered.length === 0) {
    faqList.innerHTML = "";
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  faqList.innerHTML = filtered.map(item => `
    <article class="faq-item">
      <button
        type="button"
        class="faq-question"
        aria-expanded="false"
      >
        <span>${escapeHtml(item.pergunta)}</span>
        <span class="chevron" aria-hidden="true">⌄</span>
      </button>
      <div class="faq-answer">
        ${formatAnswer(item.resposta)}
      </div>
    </article>
  `).join("");

  faqList.querySelectorAll(".faq-question").forEach(button => {
    button.addEventListener("click", () => {
      const item = button.closest(".faq-item");
      const willOpen = !item.classList.contains("open");

      faqList.querySelectorAll(".faq-item.open").forEach(openItem => {
        openItem.classList.remove("open");
        openItem.querySelector(".faq-question").setAttribute("aria-expanded", "false");
      });

      if (willOpen) {
        item.classList.add("open");
        button.setAttribute("aria-expanded", "true");
      }
    });
  });
}

async function loadData() {
  try {
    const response = await fetch(SHEET_URL);

    if (!response.ok) {
      throw new Error("Não foi possível acessar a planilha.");
    }

    DATA = loadCSV(await response.text());

    renderCategories();
    render();
  } catch (error) {
    console.error("Erro ao carregar o FAQ:", error);

    if (Array.isArray(window.FAQ_DATA) && window.FAQ_DATA.length > 0) {
      DATA = window.FAQ_DATA;
      renderCategories();
      render();
    } else {
      resultCount.textContent = "";
      faqList.innerHTML = "";
      emptyState.hidden = false;
      emptyState.querySelector("h3").textContent = "Não foi possível carregar as perguntas";
      emptyState.querySelector("p").textContent =
        "Atualize a página ou tente novamente mais tarde.";
    }
  }
}

searchInput.addEventListener("input", render);

clearFilter.addEventListener("click", () => {
  activeCategory = "Todas";
  searchInput.value = "";
  renderCategories();
  render();
});

loadData();
