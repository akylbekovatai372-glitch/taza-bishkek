
"use strict";

// ==========================================
// TAZA BISHKEK 2.0 — ЛИЧНЫЙ КАБИНЕТ
// ==========================================

// Элементы авторизации
const loginTab = document.querySelector("#loginTab");
const registerTab = document.querySelector("#registerTab");
const nameField = document.querySelector("#nameField");
const userName = document.querySelector("#userName");
const userEmail = document.querySelector("#userEmail");
const userPassword = document.querySelector("#userPassword");
const authSubmit = document.querySelector("#authSubmit");
const authForm = document.querySelector("#authForm");
const authMessage = document.querySelector("#authMessage");

// Элементы личного кабинета
const authSection = document.querySelector("#authSection");
const myAccount = document.querySelector("#myAccount");
const accountLogout = document.querySelector("#accountLogout");
const myReports = document.querySelector("#myReports");

// Проверка настроек
const config = window.CONFIG;

if (!config?.SUPABASE_URL || !config?.SUPABASE_KEY) {
  throw new Error("Не настроено подключение к Supabase");
}

// Подключение Supabase
const sb = supabase.createClient(
  config.SUPABASE_URL,
  config.SUPABASE_KEY
);

// Состояние приложения
let authMode = "login";
let currentUser = null;
let allReports = [];
let selectedStatus = "Все";
let searchText = "";
let requestVersion = 0;

// Статусы
const STATUSES = [
  "Новая",
  "Проверена",
  "В работе",
  "Убрано"
];

// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================

function reportCode(id) {
  return "TB-" + String(id).padStart(3, "0");
}

function formatDate(value) {
  if (!value) return "Дата неизвестна";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Дата неизвестна";
  }

  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text !== undefined) {
    element.textContent = String(text);
  }

  return element;
}

function showAuthMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.style.color = isError
    ? "#c92a2a"
    : "#16834a";
}

// ==========================================
// РЕГИСТРАЦИЯ И ВХОД
// ==========================================

function switchAuthMode(mode) {
  authMode = mode;

  const registering = mode === "register";

  loginTab.classList.toggle("active", !registering);
  registerTab.classList.toggle("active", registering);

  nameField.hidden = !registering;
  userName.required = registering;

  userPassword.autocomplete = registering
    ? "new-password"
    : "current-password";

  authSubmit.textContent = registering
    ? "Зарегистрироваться"
    : "Войти";

  authMessage.textContent = "";
}

loginTab.addEventListener("click", () => {
  switchAuthMode("login");
});

registerTab.addEventListener("click", () => {
  switchAuthMode("register");
});

authForm.addEventListener("submit", async event => {
  event.preventDefault();

  const email = userEmail.value.trim();
  const password = userPassword.value;

  authSubmit.disabled = true;
  showAuthMessage("Обработка запроса...");

  try {
    if (authMode === "register") {
      const name = userName.value.trim();

      if (!name) {
        throw new Error("Введите ваше имя.");
      }

      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: new URL(
            "account.html",
            window.location.href
          ).href,
          data: {
            display_name: name
          }
        }
      });

      if (error) throw error;

      userPassword.value = "";

      if (data.session) {
        await updateAccountView();
      } else {
        showAuthMessage(
          "Проверьте электронную почту для подтверждения регистрации."
        );
      }

    } else {
      const { error } = await sb.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      userPassword.value = "";

      await updateAccountView();
    }

  } catch (error) {
    showAuthMessage(
      "Ошибка: " + error.message,
      true
    );
  } finally {
    authSubmit.disabled = false;
  }
});

// ==========================================
// ОТОБРАЖЕНИЕ ЛИЧНОГО КАБИНЕТА
// ==========================================

async function updateAccountView() {
  const version = ++requestVersion;

  const { data, error } = await sb.auth.getUser();

  if (version !== requestVersion) return;

  if (error) {
    console.error("Ошибка авторизации:", error);
    showAuthMessage(
      "Не удалось проверить аккаунт. Обновите страницу.",
      true
    );
    return;
  }

  const user = data?.user;

  const loggedIn = Boolean(
    user && !user.is_anonymous
  );

  currentUser = loggedIn ? user : null;

  authSection.hidden = loggedIn;
  myAccount.hidden = !loggedIn;

  if (!loggedIn) {
    allReports = [];
    myReports.replaceChildren();
    return;
  }

  await loadMyReports(version);
}

// ==========================================
// ЗАГРУЗКА НАСТОЯЩИХ ЗАЯВОК
// ==========================================

async function loadMyReports(version = requestVersion) {
  if (!currentUser) return;

  myReports.replaceChildren(
    createElement(
      "p",
      "reports-loading",
      "Загружаем ваши заявки..."
    )
  );

  try {
    const { data, error } = await sb.rpc(
      "get_my_reports"
    );

    if (version !== requestVersion || !currentUser) {
      return;
    }

    if (error) throw error;

    allReports = Array.isArray(data) ? data : [];
    renderDashboard();

  } catch (error) {
    if (version !== requestVersion) return;

    console.error("Ошибка загрузки заявок:", error);

    myReports.replaceChildren();

    const message = createElement(
      "p",
      "reports-error",
      "Не удалось загрузить заявки: " + error.message
    );

    const retry = createElement(
      "button",
      "reports-btn",
      "Повторить"
    );

    retry.type = "button";

    retry.addEventListener("click", () => {
      loadMyReports().catch(console.error);
    });

    myReports.append(message, retry);
  }
}

// ==========================================
// СТАТИСТИКА
// ==========================================

function createStatCard(title, value) {
  const card = createElement("div", "stat-card");

  const number = createElement(
    "strong",
    "stat-number",
    value
  );

  const label = createElement(
    "span",
    "stat-label",
    title
  );

  card.append(number, label);

  return card;
}

function createStatistics() {
  const stats = createElement(
    "div",
    "account-stats"
  );

  const total = allReports.length;

  const newReports = allReports.filter(
    r => r.status === "Новая"
  ).length;

  const inProgress = allReports.filter(
    r => r.status === "В работе"
  ).length;

  const completed = allReports.filter(
    r => r.status === "Убрано"
  ).length;

  stats.append(
    createStatCard("Всего", total),
    createStatCard("Новые", newReports),
    createStatCard("В работе", inProgress),
    createStatCard("Убрано", completed)
  );

  return stats;
}

// ==========================================
// ФИЛЬТРЫ И ПОИСК
// ==========================================

function getFilteredReports() {
  return allReports.filter(report => {
    const matchesStatus =
      selectedStatus === "Все" ||
      report.status === selectedStatus;

    const query = searchText.trim().toLowerCase();

    const searchable = [
      reportCode(report.id),
      report.type || "",
      report.description || ""
    ].join(" ").toLowerCase();

    return matchesStatus &&
      searchable.includes(query);
  });
}

function createFilters(onChange) {
  const wrapper = createElement(
    "div",
    "reports-filters"
  );

  const search = createElement(
    "input",
    "reports-search"
  );

  search.type = "search";
  search.placeholder = "Поиск TB-025 или описания";
  search.setAttribute(
    "aria-label",
    "Поиск по своим заявкам"
  );
  search.value = searchText;

  search.addEventListener("input", () => {
    searchText = search.value;
    onChange();
  });

  const select = createElement(
    "select",
    "reports-select"
  );

  select.setAttribute(
    "aria-label",
    "Фильтр по статусу"
  );

  for (const status of ["Все", ...STATUSES]) {
    const option = document.createElement("option");

    option.value = status;
    option.textContent = status === "Все"
      ? "Все статусы"
      : status;

    select.appendChild(option);
  }

  select.value = selectedStatus;

  select.addEventListener("change", () => {
    selectedStatus = select.value;
    onChange();
  });

  wrapper.append(search, select);

  return wrapper;
}

// ==========================================
// КАРТОЧКА ЗАЯВКИ
// ==========================================

function createPhoto(url, title) {
  if (!url) return null;

  let parsedUrl;

  try {
    parsedUrl = new URL(url, window.location.href);

    if (!["https:", "http:"].includes(parsedUrl.protocol)) {
      return null;
    }
  } catch {
    return null;
  }

  const link = createElement(
    "a",
    "report-photo"
  );

  link.href = parsedUrl.href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";

  const image = document.createElement("img");

  image.src = parsedUrl.href;
  image.alt = title;
  image.loading = "lazy";

  const caption = createElement(
    "span",
    "",
    title
  );

  link.append(image, caption);

  return link;
}

function createReportCard(report) {
  const card = createElement(
    "article",
    "report-card"
  );

  const header = createElement(
    "div",
    "report-header"
  );

  const title = createElement(
    "h3",
    "report-title",
    reportCode(report.id)
  );

  const status = createElement(
    "span",
    "report-status",
    report.status || "Неизвестно"
  );

  const statusClass = {
    "Новая": "status-new",
    "Проверена": "status-checked",
    "В работе": "status-progress",
    "Убрано": "status-done"
  };

  status.classList.add(
    statusClass[report.status] || "status-new"
  );

  header.append(title, status);

  const type = createElement(
    "p",
    "report-type",
    report.type || "Тип не указан"
  );

  const description = createElement(
    "p",
    "report-description",
    report.description || "Без описания"
  );

  const date = createElement(
    "p",
    "report-date",
    "Создана: " + formatDate(report.created_at)
  );

  card.append(
    header,
    type,
    description,
    date
  );

  // Фотографии
  const photos = createElement(
    "div",
    "report-photos"
  );

  const before = createPhoto(
    report.photo,
    "Фото до уборки"
  );

  const after = createPhoto(
    report.photo_after,
    "Фото после уборки"
  );

  if (before) photos.appendChild(before);
  if (after) photos.appendChild(after);

  if (photos.childElementCount > 0) {
    card.appendChild(photos);
  }

  // Кнопка копирования номера
  const copyButton = createElement(
    "button",
    "report-copy",
    "Копировать номер"
  );

  copyButton.type = "button";

  copyButton.addEventListener("click", async () => {
    const number = reportCode(report.id);

    try {
      await navigator.clipboard.writeText(number);
      copyButton.textContent = "Скопировано!";
    } catch {
      copyButton.textContent = number;
    }
  });

  card.appendChild(copyButton);

  return card;
}

// ==========================================
// РЕНДЕР СПИСКА
// ==========================================

function renderReportList(container) {
  container.replaceChildren();

  const filtered = getFilteredReports();

  if (filtered.length === 0) {
    const empty = createElement(
      "div",
      "reports-empty"
    );

    empty.appendChild(
      createElement(
        "p",
        "",
        allReports.length === 0
          ? "Вы ещё не отправляли заявки из этого аккаунта."
          : "По выбранным фильтрам ничего не найдено."
      )
    );

    if (allReports.length === 0) {
      const link = createElement(
        "a",
        "reports-btn",
        "Создать первую заявку"
      );

      link.href = "index.html";

      empty.appendChild(link);
    }

    container.appendChild(empty);
    return;
  }

  for (const report of filtered) {
    container.appendChild(
      createReportCard(report)
    );
  }
}

// ==========================================
// ГЛАВНАЯ ПАНЕЛЬ АККАУНТА
// ==========================================

// ---- Мои уборки ----

async function renderMyCleanups(container) {
  const version = requestVersion;

  container.textContent = "Загрузка уборок...";

  try {
    const { data, error } = await sb.rpc(
      "get_my_cleanups"
    );

    if (version !== requestVersion || !currentUser) return;
    if (error) throw error;

    container.replaceChildren();

    if (!data || data.length === 0) {
      container.appendChild(
        createElement(
          "p",
          "reports-empty",
          "Вы пока не записаны ни на одну уборку."
        )
      );
      return;
    }

    for (const report of data) {
      const card = createReportCard(report);

      const button = createElement(
        "button",
        "cleanup-leave-btn",
        "Отказаться от участия"
      );

      button.type = "button";

      button.onclick = async () => {
        button.disabled = true;

        try {
          const { error } = await sb.rpc(
            "leave_cleanup",
            { p_report_id: report.id }
          );

          if (error) throw error;

          await renderMyCleanups(container);

        } catch (error) {
          alert(error.message);
          button.disabled = false;
        }
      };

      if (report.status !== "Убрано") {
        card.appendChild(button);
      }

      container.appendChild(card);
    }

  } catch (error) {
    if (version !== requestVersion) return;

    container.textContent =
      "Ошибка загрузки: " + error.message;
  }
}

function renderDashboard() {
  myReports.replaceChildren();

  const profile = createElement(
    "div",
    "account-profile"
  );

  const displayName =
    currentUser?.user_metadata?.display_name ||
    "Пользователь";

  const greeting = createElement(
    "h3",
    "profile-title",
    "Здравствуйте, " + displayName + "!"
  );

  const email = createElement(
    "p",
    "profile-email",
    currentUser?.email || ""
  );

  profile.append(greeting, email);

  const statistics = createStatistics();

  const actions = createElement(
    "div",
    "account-actions"
  );

  const newReport = createElement(
    "a",
    "reports-btn",
    "+ Новая заявка"
  );

  newReport.href = "index.html";

  const refresh = createElement(
    "button",
    "reports-btn reports-btn-secondary",
    "Обновить заявки"
  );

  refresh.type = "button";

  refresh.addEventListener("click", () => {
    loadMyReports().catch(console.error);
  });

  actions.append(newReport, refresh);


  const tabs = createElement("div", "dashboard-tabs");

  const reportsTab = createElement(
    "button", "dashboard-tab active", "Мои заявки"
  );

  const cleanupsTab = createElement(
    "button", "dashboard-tab", "Мои уборки"
  );

  reportsTab.type = "button";
  cleanupsTab.type = "button";

  tabs.append(reportsTab, cleanupsTab);

  const reportsPanel = createElement("section", "dashboard-panel");
  const cleanupPanel = createElement("section", "dashboard-panel");

  const heading = createElement(
    "h3", "reports-heading", "История обращений"
  );

  const list = createElement("div", "reports-list");

  const filters = createFilters(() => {
    renderReportList(list);
  });

  reportsPanel.append(heading, filters, list);

  const cleanupHeading = createElement(
    "h3", "reports-heading", "Мои уборки"
  );

  const cleanupList = createElement("div", "reports-list");

  cleanupPanel.append(cleanupHeading, cleanupList);

  cleanupPanel.hidden = true;

  function switchTab(tab) {
    const showReports = tab === "reports";

    reportsPanel.hidden = !showReports;
    cleanupPanel.hidden = showReports;

    reportsTab.classList.toggle("active", showReports);
    cleanupsTab.classList.toggle("active", !showReports);

    if (!showReports) {
      renderMyCleanups(cleanupList);
    }
  }

  reportsTab.onclick = () => switchTab("reports");
  cleanupsTab.onclick = () => switchTab("cleanups");

  myReports.append(
    profile,
    statistics,
    actions,
    tabs,
    reportsPanel,
    cleanupPanel
  );

  renderReportList(list);

}

// ВЫХОД ИЗ АККАУНТА
// ==========================================

accountLogout.addEventListener("click", async () => {
  accountLogout.disabled = true;

  try {
    const { error } = await sb.auth.signOut();

    if (error) throw error;

    userPassword.value = "";

    currentUser = null;
    allReports = [];

    selectedStatus = "Все";
    searchText = "";

    await updateAccountView();

  } catch (error) {
    alert(
      "Не удалось выйти из аккаунта: " +
      error.message
    );
  } finally {
    accountLogout.disabled = false;
  }
});

// ==========================================
// АВТОМАТИЧЕСКАЯ ПРОВЕРКА СЕССИИ
// ==========================================

sb.auth.onAuthStateChange((event) => {
  if (
    event === "SIGNED_IN" ||
    event === "SIGNED_OUT" ||
    event === "USER_UPDATED" ||
    event === "INITIAL_SESSION"
  ) {
    setTimeout(() => {
      updateAccountView().catch(console.error);
    }, 0);
  }
});

// ==========================================
// ДОПОЛНИТЕЛЬНЫЕ СТИЛИ
// ==========================================

const accountStyles = document.createElement("style");

accountStyles.textContent = `
  main {
    max-width: 920px;
  }

  #authSection {
    max-width: 520px;
    margin: 0 auto;
  }

  #myAccount {
    text-align: left;
  }

  #myAccount > h2,
  #myAccount > .account-icon,
  #myAccount > p {
    text-align: center;
  }

  .account-profile {
    padding: 20px;
    border-radius: 14px;
    background: #f1f8f3;
    margin-bottom: 20px;
  }

  .profile-title {
    margin: 0 0 8px;
    color: #183a2b;
    font-size: 20px;
  }

  .profile-email {
    margin: 0;
    color: #6b7d70;
    overflow-wrap: anywhere;
  }

  .account-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin: 20px 0;
  }

  .stat-card {
    padding: 18px 8px;
    text-align: center;
    border: 1px solid #dfebe2;
    background: #f7faf8;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .stat-number {
    font-size: 28px;
    color: #16834a;
  }

  .stat-label {
    font-size: 12px;
    color: #5e7064;
  }

  .account-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin: 20px 0;
  }

  .reports-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 12px 18px;
    border: 0;
    border-radius: 10px;
    background: #16834a;
    color: white;
    font-size: 14px;
    font-weight: bold;
    text-decoration: none;
    cursor: pointer;
  }

  .reports-btn-secondary {
    background: #e6f3e9;
    color: #16834a;
  }

  .reports-heading {
    margin: 30px 0 18px;
    font-size: 22px;
    color: #183a2b;
  }

  .reports-filters {
    display: grid;
    grid-template-columns: 1fr 180px;
    gap: 12px;
    margin-bottom: 20px;
  }

  .reports-search,
  .reports-select {
    width: 100%;
    min-width: 0;
    padding: 13px;
    border: 1px solid #d5e5da;
    border-radius: 10px;
    background: white;
    color: #183a2b;
    font-size: 14px;
  }

  .reports-list {
    display: grid;
    gap: 15px;
  }

  .report-card {
    padding: 20px;
    border: 1px solid #e0eae3;
    border-radius: 14px;
    background: white;
    box-shadow: 0 4px 14px rgba(0,0,0,0.03);
  }

  .report-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
  }

  .report-title {
    margin: 0;
    color: #183a2b;
  }

  .report-status {
    padding: 7px 12px;
    border-radius: 100px;
    font-size: 12px;
    font-weight: bold;
  }

  .status-new {
    color: #c92a2a;
    background: #fff0f0;
  }

  .status-checked {
    color: #a86600;
    background: #fff4e6;
  }

  .status-progress {
    color: #1864ab;
    background: #e7f5ff;
  }

  .status-done {
    color: #237a36;
    background: #e6f6ea;
  }

  .report-type {
    font-weight: bold;
    margin: 15px 0 5px;
  }

  .report-description {
    line-height: 1.6;
    overflow-wrap: anywhere;
  }

  .report-date {
    font-size: 13px;
    color: #718076;
  }

  .report-photos {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 12px;
  }

  .report-photo {
    flex: 1 1 140px;
    min-width: 0;
    text-align: center;
    text-decoration: none;
    color: #16834a;
    font-size: 13px;
  }

  .report-photo img {
    display: block;
    width: 100%;
    max-height: 180px;
    object-fit: cover;
    border-radius: 10px;
    margin-bottom: 6px;
  }

  .report-copy {
    margin-top: 16px;
    padding: 9px 12px;
    background: #f1f7f3;
    border: 1px solid #dce9df;
    border-radius: 8px;
    color: #16834a;
    cursor: pointer;
  }

  .reports-empty {
    padding: 30px 15px;
    text-align: center;
    background: #f7faf8;
    border-radius: 12px;
  }

  .reports-error {
    color: #c92a2a;
  }

  #accountLogout {
    margin-top: 25px;
    padding: 12px 20px;
    background: #f3f5f4;
    border: 1px solid #dce6df;
    border-radius: 10px;
    color: #3d5545;
    font-size: 14px;
    cursor: pointer;
  }

  @media (max-width: 650px) {
    .account-stats {
      grid-template-columns: repeat(2, 1fr);
    }

    .reports-filters {
      grid-template-columns: 1fr;
    }

    .account-actions {
      flex-direction: column;
    }

    .account-actions > * {
      width: 100%;
    }

    .report-card {
      padding: 15px;
    }
  }
`;

document.head.appendChild(accountStyles);

// ==========================================
// ЗАПУСК
// ==========================================

switchAuthMode("login");

updateAccountView().catch(console.error);
