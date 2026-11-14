const events = [
  {
    id: 1,
    title: "Зелёный Бишкек",
    description: "Демонстрационная карточка экологического мероприятия.",
    organizer: "Taza Bishkek — демо",
    date: "Пока не назначена",
    safety: "Демонстрация. Реальное мероприятие не проводится.",
    status: "Демонстрация",
    icon: "🌳"
  }
];

function renderEvents() {
  const list = document.querySelector("#eventsList");
  const counter = document.querySelector("#eventsCount");

  counter.textContent = `Мероприятий: ${events.length}`;

  list.replaceChildren();

  for (const event of events) {
    const card = document.createElement("article");
    card.className = "event-card";

    card.innerHTML = `
      <div class="event-banner"></div>

      <div class="event-content">
        <span class="event-status"></span>
        <h3 class="event-title"></h3>
        <p class="event-description"></p>

        <div class="event-info organizer"></div>
        <div class="event-info date"></div>
        <div class="event-info safety"></div>

        <button class="event-button" disabled>
          Запись пока закрыта
        </button>
      </div>
    `;

    card.querySelector(".event-banner").textContent = event.icon;
    card.querySelector(".event-status").textContent = event.status;
    card.querySelector(".event-title").textContent = event.title;
    card.querySelector(".event-description").textContent = event.description;

    card.querySelector(".organizer").textContent =
      "👥 Организатор: " + event.organizer;

    card.querySelector(".date").textContent =
      "📅 Дата: " + event.date;

    card.querySelector(".safety").textContent =
      "🛡️ " + event.safety;

    list.appendChild(card);
  }
}

renderEvents();