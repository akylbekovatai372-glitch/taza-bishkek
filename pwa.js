(() => {
  'use strict';
  let installPrompt = null;
  let installedThisSession = false;
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const t = text => window.I18N?.t(text) || text;
  function render() {
    document.querySelectorAll('[data-app-install]').forEach(button => {
      button.disabled = standalone() || installedThisSession;
      button.textContent = t(standalone() ? 'Приложение уже открыто' : installedThisSession ? 'Приложение установлено' : 'Установить приложение');
    });
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    render();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    installedThisSession = true;
    render();
    const status = document.querySelector('[data-install-status]');
    if (status) status.textContent = t('Готово! Ищи Taza Bishkek среди приложений.');
  });
  document.addEventListener('DOMContentLoaded', () => {
    render();
    document.querySelectorAll('[data-app-install]').forEach(button => button.addEventListener('click', async () => {
      const status = document.querySelector('[data-install-status]');
      if (installPrompt) {
        const prompt = installPrompt;
        installPrompt = null;
        try {
          await prompt.prompt();
          const result = await prompt.userChoice;
          if (status) status.textContent = t(result.outcome === 'accepted' ? 'Установка началась. Иконка появится среди приложений.' : 'Установка отменена. Можно вернуться к ней позже.');
        } catch {
          if (status) status.textContent = t('Открой меню браузера и выбери установку приложения.');
        }
      } else {
        const help = document.querySelector('[data-install-help]');
        if (help) { help.hidden = false; const reduced = document.documentElement.classList.contains('reduce-motion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches; help.scrollIntoView({behavior: reduced ? 'instant' : 'smooth', block: 'start'}); help.focus({preventScroll:true}); }
        if (status) status.textContent = t('Выбери инструкцию для своего устройства ниже.');
      }
    }));
    const networkNote = document.createElement('p');
    networkNote.className = 'app-network-note';
    networkNote.setAttribute('role', 'status');
    const network = () => {
      networkNote.hidden = navigator.onLine;
      networkNote.textContent = t('Нет интернета. Для карты и отправки заявок нужно подключение.');
    };
    document.body.append(networkNote);
    window.addEventListener('online', network);
    window.addEventListener('offline', network);
    window.addEventListener('languagechange', () => {render();network();});
    network();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js', {scope:'./', updateViaCache:'none'}).then(() => navigator.serviceWorker.ready).then(() => {
        const note = document.querySelector('[data-offline-status]');
        if (note) note.textContent = t('Без интернета откроется страница подключения.');
      }).catch(() => {
        const note = document.querySelector('[data-offline-status]');
        if (note) note.textContent = t('Офлайн-страница пока недоступна. Повтори попытку при стабильном соединении.');
      });
    }
  });
})();
