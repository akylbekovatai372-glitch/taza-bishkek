(() => {
  'use strict';
  const storageKey = 'taza-reduce-motion';
  const savedMotion = () => { try { return localStorage.getItem(storageKey) === 'true'; } catch { return false; } };
  const applyMotion = value => document.documentElement.classList.toggle('reduce-motion', value);
  applyMotion(savedMotion());
  document.addEventListener('DOMContentLoaded', () => {
    const languageControl = document.querySelector('.language-switch');
    if (!languageControl) return;
    const dialog = document.createElement('dialog');
    dialog.className = 'settings-dialog';
    dialog.id = 'site-settings';
    dialog.setAttribute('aria-labelledby', 'settings-title');
    dialog.innerHTML = `
      <div class="settings-heading"><div><p class="settings-eyebrow" data-no-i18n>Taza Bishkek</p><h2 id="settings-title">Настройки</h2></div><button class="settings-close" type="button" aria-label="Закрыть настройки"><span data-icon="x"></span></button></div>
      <a class="settings-account" href="account.html"><span class="settings-icon" data-icon="user"></span><span><strong>Мой аккаунт</strong><small>Вход, регистрация и мои заявки</small></span><span data-icon="arrow"></span></a>
      <section class="settings-section"><h3>Язык интерфейса</h3><div class="settings-language"></div></section>
      <section class="settings-section"><h3>Удобство</h3><label class="settings-toggle"><span><strong>Меньше анимации</strong><small>Спокойные переходы без движения</small></span><input type="checkbox" id="settings-motion"></label></section>
      <section class="settings-section settings-links"><h3>Полезное</h3><a href="home.html#help"><span data-icon="help"></span><span>Как это работает?</span><span data-icon="arrow"></span></a><a href="home.html#status"><span data-icon="search"></span><span>Проверить статус</span><span data-icon="arrow"></span></a></section>
      <p class="settings-note">Язык и оформление сохраняются в этом браузере.</p>`;
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'settings-trigger';
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', dialog.id);
    trigger.innerHTML = '<span data-icon="settings"></span><span>Настройки</span>';
    languageControl.replaceWith(trigger);
    // Move the existing select to preserve its translation listener and current value.
    dialog.querySelector('.settings-language').append(languageControl);
    languageControl.querySelector('.language-caption')?.remove();
    document.body.append(dialog);
    document.querySelector('.header-actions .profile-link')?.remove();
    const motion = dialog.querySelector('#settings-motion');
    motion.checked = savedMotion();
    motion.addEventListener('change', () => {
      applyMotion(motion.checked);
      try { localStorage.setItem(storageKey, String(motion.checked)); } catch {}
    });
    window.addEventListener('storage', event => {
      if (event.key !== storageKey) return;
      motion.checked = savedMotion();
      applyMotion(motion.checked);
    });
    trigger.addEventListener('click', () => dialog.showModal());
    dialog.querySelector('.settings-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.querySelectorAll('a').forEach(link => link.addEventListener('click', () => dialog.close()));
    dialog.addEventListener('close', () => trigger.focus({preventScroll:true}));
    window.TazaUI?.icons();
    window.I18N?.translate(dialog);
    window.I18N?.translate(trigger);
  });
})();
