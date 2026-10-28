
/* TAZA BISHKEK 2.0 — STATISTICS */

async function loadStatistics() {
  const message = document.querySelector("#statsMessage");

  const totalElement = document.querySelector("#totalReports");
  const activeElement = document.querySelector("#activeReports");
  const cleanedElement = document.querySelector("#cleanedReports");

  try {
    if (!window.CONFIG?.SUPABASE_URL ||
        !window.CONFIG?.SUPABASE_KEY ||
        !window.supabase) {
      throw new Error("Supabase не подключён");
    }

    const sb = window.supabase.createClient(
      window.CONFIG.SUPABASE_URL,
      window.CONFIG.SUPABASE_KEY
    );

    const countReports = async (status) => {
      let query = sb
        .from("reports")
        .select("*", { count: "exact", head: true });

      if (status) {
        query = query.eq("status", status);
      }

      const { count, error } = await query;

      if (error) throw error;

      return count ?? 0;
    };

    const [total, verified, inProgress, cleaned] =
      await Promise.all([
        countReports(),
        countReports("Проверена"),
        countReports("В работе"),
        countReports("Убрано")
      ]);

    totalElement.textContent = total;
    activeElement.textContent = verified + inProgress;
    cleanedElement.textContent = cleaned;

    message.textContent = "Статистика обновлена";
  } catch (error) {
    console.error("Statistics error:", error);
    message.textContent =
      "Не удалось загрузить статистику. Попробуйте обновить страницу.";
  }
}

loadStatistics();

/* ===== REPORT STATUS SEARCH ===== */

const statusForm = document.querySelector("#statusForm");
const statusResult = document.querySelector("#statusResult");

statusForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const input = document.querySelector("#reportCode");
  const value = input.value.trim().toUpperCase();

  const match = /^TB-(\d{1,12})$/.exec(value);

  if (!match || Number(match[1]) === 0) {
    statusResult.textContent =
      "Введите корректный номер, например TB-012.";
    return;
  }

  const reportId = Number(match[1]);

  statusResult.textContent = "Поиск заявки...";

  try {
    const client = window.supabase.createClient(
      window.CONFIG.SUPABASE_URL,
      window.CONFIG.SUPABASE_KEY
    );

    const { data, error } = await client
      .from("reports")
      .select("id, type, status")
      .eq("id", reportId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      statusResult.textContent = "Заявка не найдена.";
      return;
    }

    const formattedId =
      "TB-" + String(data.id).padStart(3, "0");

    statusResult.replaceChildren();

    const title = document.createElement("strong");
    title.textContent = formattedId;

    const details = document.createElement("p");
    details.textContent =
      `${data.type} — статус: ${data.status}`;

    statusResult.append(title, details);

  } catch (error) {
    console.error("Status search error:", error);
    statusResult.textContent =
      "Не удалось проверить статус. Попробуйте позже.";
  }
});

