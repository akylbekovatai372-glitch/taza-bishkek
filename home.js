
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
