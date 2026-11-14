const C = window.CONFIG;
if (window.matchMedia("(max-width: 700px)").matches) document.querySelector(".map-filters").open = false;
const ST = ["Новая", "Проверена", "В работе", "Убрано"];
const COL = ["#e03131", "#f08c00", "#1c7ed6", "#2f9e44"];
const $ = s => document.querySelector(s);
const code = id => "TB-" + String(id).padStart(3, "0");
const esc = s => String(s).replace(/[&<>"']/g, c => "&#" + c.charCodeAt(0) + ";");
const sb = C.SUPABASE_URL && C.SUPABASE_KEY ? supabase.createClient(C.SUPABASE_URL, C.SUPABASE_KEY) : null;
let isModerator = false;
let modPage = 1;
const MOD_PAGE_SIZE = 12;
let modBusy = false;
// ---- Система волонтёров ----

async function getHelpersCount(reportId) {
  if (!sb) return 0;

  const { data, error } = await sb.rpc(
    "get_helpers_count",
    { p_report_id: reportId }
  );

  if (error) throw error;

  return Number(data || 0);
}

async function isJoined(reportId) {
  if (!sb) return false;

  const { data: { user } } = await sb.auth.getUser();

  if (!user || user.is_anonymous) return false;

  const { data, error } = await sb
    .from("report_helpers")
    .select("id")
    .eq("report_id", reportId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;

  return !!data;
}

async function toggleCleanup(reportId) {
  if (!sb) return;

  const { data: { user } } = await sb.auth.getUser();

  if (!user || user.is_anonymous) {
    window.location.href = "account.html";
    return;
  }

  const joined = await isJoined(reportId);

  const { error } = await sb.rpc(
    joined ? "leave_cleanup" : "join_cleanup",
    { p_report_id: reportId }
  );

  if (error) throw error;
}
async function renderVolunteerBox(container, report) {
  if (!sb || !container) return;

  if (!report.cleanup_enabled || !["Проверена", "В работе"].includes(report.status)) {
    container.hidden = true;
    return;
  }

  try {
    const count = await getHelpersCount(report.id);
    const joined = await isJoined(report.id);

    container.innerHTML = `
      <div class="volunteer-count">
        👥 Участников: ${count}
      </div>

      <button class="volunteer-btn ${joined ? "joined" : ""}">
        ${joined ? "Отказаться от участия" : "Хочу помочь"}
      </button>

      <small class="volunteer-note">
        Участие только в организованных безопасных уборках.
      </small>
    `;

    const button = container.querySelector("button");

    button.onclick = async () => {
      button.disabled = true;

      try {
        await toggleCleanup(report.id);
        await renderVolunteerBox(container, report);
      } catch (error) {
        alert("Ошибка: " + error.message);
        button.disabled = false;
      }
    };

  } catch (error) {
    container.textContent = "Не удалось загрузить участников.";
    console.error(error);
  }
}

async function ensureAnonymousUser() {
  if (!sb) return;

  const { data: { session }, error } =
    await sb.auth.getSession();

  if (error) throw error;
  if (session) return;

  const result = await sb.auth.signInAnonymously();

  if (result.error) throw result.error;
}

// ---- Хранилище: Supabase или localStorage (демо) ----
const store = sb ? {

async list() {
  const { data, error } = await sb
    .from("reports")
    .select("id,type,description,lat,lng,status,photo,photo_after,created_at,cleanup_enabled")
    .order("id");

  if (error) throw error;
  return data;
},

  async add(r, file) {
    await ensureAnonymousUser();
    const { data: { user }, error: authError } = await sb.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error("Не удалось войти. Попробуйте отправить заявку ещё раз.");
    r.user_id = user.id;
    r.status = "Новая";
    r.photo_after = null;
    r.cleanup_enabled = false;
    if (file) {
      const p = "before/" + crypto.randomUUID() + "." + (file.name.split(".").pop() || "jpg").toLowerCase();
      const { error: e1 } = await sb.storage.from("photos").upload(p, file);
      if (e1) throw e1;
      r.photo = sb.storage.from("photos").getPublicUrl(p).data.publicUrl;
    }
    
const { data, error } = await sb
  .from("reports")
  .insert(r)
  .select("id")
  .single();

    if (error) throw error; return data;
  },
  async setStatus(id, status, file) {
    const patch = { status };
    if (!isModerator) throw new Error("Нет прав модератора");
    if (file) {
      const p = "after/" + crypto.randomUUID() + "." + (file.name.split(".").pop() || "jpg").toLowerCase();
      const { error: e1 } = await sb.storage.from("photos").upload(p, file);
      if (e1) throw e1;
      patch.photo_after = sb.storage.from("photos").getPublicUrl(p).data.publicUrl;
    }
    const { data, error } = await sb.from("reports").update(patch).eq("id", id).select("id");
    if (error) throw error;
    if (!data?.length) throw new Error("Заявка недоступна или права изменились.");
  }
} : {
  async list() { return JSON.parse(localStorage.tz || "[]"); },
  async add(r, file) {
    const a = await this.list(); r.id = a.length + 1; r.created_at = new Date().toISOString();
    if (file) r.photo = await new Promise(ok => { const f = new FileReader(); f.onload = () => ok(f.result); f.readAsDataURL(file); });
    a.push(r); localStorage.tz = JSON.stringify(a); return r;
  },
  async setStatus(id, status, file) {
    if (!isModerator) throw new Error("Нет прав модератора");
    const a = await this.list(), r = a.find(x => x.id == id); r.status = status;
    if (file) r.photo_after = await new Promise(ok => { const f = new FileReader(); f.onload = () => ok(f.result); f.readAsDataURL(file); });
    localStorage.tz = JSON.stringify(a);
  }
};

// ---- Карта ----

const BISHKEK_VIEW_BOUNDS = L.latLngBounds(
  [42.76, 74.40],
  [42.98, 74.80]
);

const map = L.map("map", {
  maxBounds: BISHKEK_VIEW_BOUNDS,
  maxBoundsViscosity: 1.0,
  minZoom: 11,
  maxZoom: 19
}).setView([42.8746, 74.5698], 12);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(map);
const layer = L.layerGroup().addTo(map);
const dot = c => L.divIcon({ className: "", html: `<span class="pin" style="background:${c}"></span>`, iconSize: [18, 18] });
let pick = null, pickMarker = null, reports = [];


function setPick(ll) {
  if (!BISHKEK_VIEW_BOUNDS.contains(ll)) {
    alert("Пока заявки принимаются только в Бишкеке.");
    return;
  }

  pick = ll;

  if (pickMarker) {
    pickMarker.setLatLng(ll);
  } else {
    pickMarker = L.marker(ll, {
      draggable: true
    }).addTo(map);

    pickMarker.on("dragend", e => {
      const newPoint = e.target.getLatLng();

      if (!BISHKEK_VIEW_BOUNDS.contains(newPoint)) {
        e.target.setLatLng(pick);
        alert("Точка находится вне разрешённой области.");
        return;
      }

      setPick(newPoint);
    });
  }

  checkDup();
}

map.on("click", e => setPick(e.latlng));
$("#geo").onclick = () => navigator.geolocation.getCurrentPosition(p => {
  const ll = L.latLng(p.coords.latitude, p.coords.longitude);
  setPick(ll);
  if (BISHKEK_VIEW_BOUNDS.contains(ll)) map.setView(ll, 16);
}, () => {
  $("#msg").textContent = "Не удалось определить местоположение. Отметьте место на карте вручную.";
});

// Дубликаты: незакрытая точка ближе 30 м
function checkDup() {
  const near = pick && reports.filter(r => r.status !== "Убрано" && map.distance(pick, [r.lat, r.lng]) < 30);
  $("#dup").hidden = !(near && near.length);
  if (near && near.length) $("#dup").textContent = "Рядом уже есть заявка: " + near.map(r => code(r.id)).join(", ") + ". Возможно, это дубликат.";
}

async function load() {
  reports = await store.list();

  renderMap();
  renderList();
  checkDup();
}

function renderMap() {
  layer.clearLayers();

  const fields = new FormData($("#mapFilters"));
  const status = fields.get("status");
  const type = fields.get("type");
  const since = fields.get("since");
  const visible = reports.filter(r => {
    if (status === "active" && r.status === "Убрано") return false;
    if (!["active", "all"].includes(status) && r.status !== status) return false;
    if (type && r.type !== type) return false;
    if (since && (!r.created_at || new Date(r.created_at) < new Date(since + "T00:00:00"))) return false;
    return true;
  });
  $("#filterCount").textContent = `На карте: ${visible.length} из ${reports.length} заявок`;
  visible
    .forEach(r => {

      const marker = L.marker(
        [r.lat, r.lng],
        { icon: dot(COL[ST.indexOf(r.status)]) }
      ).addTo(layer);

      marker.bindPopup(`
        <b>${code(r.id)}</b> · ${esc(r.status)}
        <br>${esc(r.type)}
        <br>${esc(r.description || "")}

        <div class="ba">
          ${r.photo ? `
            <figure>
              До
              <img src="${esc(r.photo)}">
            </figure>
          ` : ""}

          ${r.photo_after ? `
            <figure>
              После
              <img src="${esc(r.photo_after)}">
            </figure>
          ` : ""}
        </div>

        <div class="volunteer-box">
          Загрузка...
        </div>
      `);

      marker.on("popupopen", e => {
        const container = e.popup
          .getElement()
          .querySelector(".volunteer-box");

        renderVolunteerBox(container, r);
      });

    });

}

$("#mapFilters").addEventListener("change", renderMap);
$("#mapFilters").addEventListener("submit", e => e.preventDefault());
$("#mapFilters").addEventListener("reset", () => setTimeout(renderMap, 0));

// ---- Форма ----
$("#form").onsubmit = async e => {
  e.preventDefault();
  if (!pick) return ($("#msg").textContent = "Сначала отметьте место на карте.");
  const f = e.target;
  const submitButton = f.querySelector('[type="submit"]');
  if (submitButton?.disabled) return;
  if (submitButton) submitButton.disabled = true;
  $("#msg").textContent = "Отправка заявки...";
  try {
    const fields = new FormData(f);
    const r = await store.add({ type: fields.get("type"), description: fields.get("desc"), lat: pick.lat, lng: pick.lng, ...(sb ? {} : { status: "Новая" }) }, f.elements.namedItem("photo").files[0]);
    $("#msg").textContent = "Заявка принята. Ваш номер: " + code(r.id);
    f.reset(); await load();
  } catch (err) { $("#msg").textContent = "Ошибка: " + (err.message || err); }
  finally { if (submitButton) submitButton.disabled = false; }
};

// ---- Модератор ----
// Роль проверяется и в интерфейсе, и в Supabase RLS.
async function syncModerator() {
  isModerator = false;
  if (sb) {
    const { data: { user }, error } = await sb.auth.getUser();
    if (!error && user) {
      const result = await sb.from("moderators").select("user_id").eq("user_id", user.id).maybeSingle();
      isModerator = !result.error && !!result.data;
    }
  }
  $("#login").hidden = isModerator;
  $("#list").hidden = !isModerator;
  $("#modWorkspace").hidden = !isModerator;
  $("#logoutBtn").hidden = !isModerator;
  $("#modHelp").textContent = !sb
    ? "Демо-режим: доступ модератора отключён. Подключите Supabase."
    : isModerator ? "Вы вошли как модератор." : "Войдите с учётной записью модератора Supabase.";
  if (isModerator) renderList();
  else $("#list").replaceChildren();
}
$("#login").onsubmit = async e => {
  e.preventDefault();
  if (!sb) return alert("Для безопасной модерации подключите Supabase.");
  const email = $("#email").value.trim();
  const password = $("#pw").value;
  if (!email || !password) return alert("Введите email и пароль.");
  $("#loginBtn").disabled = true;
  try {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await syncModerator();
    if (!isModerator) {
      await sb.auth.signOut();
      alert("Эта учётная запись не назначена модератором.");
    }
  } catch (e) { alert("Не удалось войти: " + e.message); }
  finally { $("#pw").value = ""; $("#loginBtn").disabled = false; }
};
$("#logoutBtn").onclick = async () => {
  if (sb) await sb.auth.signOut();
  await syncModerator();
};
function filteredModerationReports() {
  const query = $("#modSearch").value.trim().toLowerCase();
  const status = $("#modStatus").value;
  return reports.filter(r => {
    if (status === "active" && r.status === "Убрано") return false;
    if (!["active", "all"].includes(status) && r.status !== status) return false;
    return !query || `${code(r.id)} ${r.type} ${r.description || ""}`.toLowerCase().includes(query);
  }).sort((a, b) => $("#modSort").value === "old" ? a.id - b.id : b.id - a.id);
}

function renderList() {
  if (!isModerator) return;
  $("#modSummary").innerHTML = ST.map((status, i) => `<div class="mod-stat"><span>${esc(status)}</span><strong>${reports.filter(r => r.status === status).length}</strong></div>`).join("");
  const filtered = filteredModerationReports();
  const pages = Math.max(1, Math.ceil(filtered.length / MOD_PAGE_SIZE));
  modPage = Math.min(modPage, pages);
  $("#modCount").textContent = `Найдено: ${filtered.length} · Всего заявок: ${reports.length}`;
  $("#modPage").textContent = `${modPage} / ${pages}`;
  $("#modPrev").disabled = modPage <= 1;
  $("#modNext").disabled = modPage >= pages;
  $("#list").innerHTML = filtered.slice((modPage - 1) * MOD_PAGE_SIZE, modPage * MOD_PAGE_SIZE).map(r => {
    const date = new Date(r.created_at);
    const stamp = Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("ru-RU");
    return `<details class="mod-card" data-id="${r.id}">
      <summary><span class="mod-card-code">${code(r.id)}</span><span class="mod-card-title">${esc(r.type)}<small>${esc(stamp)}</small></span><span class="mod-badge status-${ST.indexOf(r.status)}">${esc(r.status)}</span><span class="mod-expand" aria-hidden="true">⌄</span></summary>
      <div class="mod-card-body">
       <p class="mod-description">${esc(r.description || "Описание не добавлено.")}</p>
       <div class="mod-photos"></div>
       <div class="mod-edit"><label>Новый статус<select class="mod-status">${ST.map(status => `<option${status === r.status ? " selected" : ""}>${status}</option>`).join("")}</select></label>
       <label>Фото «после»${r.photo_after ? ' <small>Уже добавлено · можно заменить</small>' : ""}<input type="file" accept="image/*" class="after"></label>
       <button type="button" class="mod-save">Сохранить изменения</button></div>
       ${r.cleanup_enabled ? `<div class="mod-cleanup">Запись на уборку открыта <button type="button" class="cleanup-close">Закрыть запись</button></div>` : ""}
       <p class="mod-card-message" role="status" aria-live="polite"></p>
      </div></details>`;
  }).join("") || '<div class="mod-empty"><h3>Здесь чисто</h3><p>Заявок с такими условиями нет. Измените фильтр или поиск.</p></div>';
  document.querySelectorAll(".mod-card").forEach(card => {
    const report = reports.find(r => String(r.id) === card.dataset.id);
    for (const [url, caption] of [[report.photo, "До"], [report.photo_after, "После"]]) {
      if (!url) continue;
      try {
        const parsed = new URL(url, window.location.href);
        if (!["https:", "http:"].includes(parsed.protocol)) continue;
        const link = document.createElement("a");
        link.href = parsed.href; link.target = "_blank"; link.rel = "noopener noreferrer";
        const image = document.createElement("img"); image.src = parsed.href; image.alt = caption; image.loading = "lazy";
        link.append(image, document.createTextNode(caption)); card.querySelector(".mod-photos").append(link);
      } catch {}
    }
  });
}

for (const id of ["modSearch", "modStatus", "modSort"]) {
  $("#" + id).addEventListener(id === "modSearch" ? "input" : "change", () => { modPage = 1; renderList(); });
}
$("#modPrev").onclick = () => { modPage--; renderList(); };
$("#modNext").onclick = () => { modPage++; renderList(); };
$("#modRefresh").onclick = async () => {
  if (modBusy) return;
  $("#modRefresh").disabled = true;
  try { await load(); $("#modMessage").textContent = "Заявки обновлены."; }
  catch { $("#modMessage").textContent = "Не удалось обновить заявки. Попробуйте ещё раз."; }
  finally { $("#modRefresh").disabled = false; }
};
$("#list").addEventListener("click", async e => {
  const button = e.target.closest(".mod-save, .cleanup-close");
  if (!button || !isModerator || !sb || modBusy) return;
  const card = button.closest(".mod-card");
  const report = reports.find(r => String(r.id) === card.dataset.id);
  const message = card.querySelector(".mod-card-message");
  const status = card.querySelector(".mod-status").value;
  const file = card.querySelector(".after").files[0];
  const closing = button.classList.contains("cleanup-close");
  if (!closing && status === "Убрано" && !file && !report.photo_after) {
    message.textContent = "Добавьте фото «после», чтобы подтвердить уборку."; return;
  }
  if (!closing && file && (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024)) {
    message.textContent = "Выберите изображение размером до 10 МБ."; return;
  }
  modBusy = true; button.disabled = true; message.textContent = "Сохранение...";
  try {
    if (closing) {
      const {data, error} = await sb.from("reports").update({cleanup_enabled:false}).eq("id", report.id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Заявка недоступна или права изменились.");
    } else { await store.setStatus(report.id, status, file); }
    $("#modMessage").textContent = `${code(report.id)}: ${closing ? "запись закрыта" : "изменения сохранены"}.`;
    await load();
  } catch (error) { message.textContent = "Не удалось сохранить: " + error.message; }
  finally { modBusy = false; button.disabled = false; }
});
if (sb) sb.auth.onAuthStateChange(() => {
  // Не вызываем методы Supabase синхронно из auth callback.
  setTimeout(() => syncModerator().catch(console.error), 0);
});


// ---- Вкладки и легенда ----
document.querySelectorAll("nav button").forEach(b => b.onclick = () => {
  document.querySelectorAll("nav button").forEach(x => x.classList.toggle("on", x == b));
  $("#v-map").hidden = b.dataset.v !== "map"; $("#v-mod").hidden = b.dataset.v !== "mod";
  document.body.classList.toggle("moderator-view", b.dataset.v === "mod");
  history.replaceState(null, "", b.dataset.v === "mod" ? "#moderator" : "#map");
  if (b.dataset.v === "map") requestAnimationFrame(() => map.invalidateSize());
});
if (window.location.hash === "#moderator") document.querySelector('nav button[data-v="mod"]').click();
$("#legend").innerHTML = ST.map((s, i) => `<span><i class="pin" style="background:${COL[i]}"></i>${s}</span>`).join("");

async function startApp() {
  let step = "Проверка модератора";

  try {
    await syncModerator();

    step = "Загрузка заявок";
    await load();

  } catch (err) {
    console.error(step, err);

    alert(
      "Этап: " + step +
      "\nОшибка: " + (err.message || err)
    );
  }
}

startApp();

