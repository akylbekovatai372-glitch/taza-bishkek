(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const fields = 'id,title,description,organizer,event_date,safety_rules,status,created_at,location,registration_open';
  const client = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
  let user = null, moderator = false, rows = [], joined = new Set(), version = 0;
  const el = (tag, text, cls) => { const n = document.createElement(tag); n.textContent = text; if (cls) n.className = cls; return n; };
  const dateText = value => value ? I18N.date(value,{long:true,time:true}) + ' · Бишкек' : I18N.t('Дата пока не назначена');
  const fail = error => error?.code === '23505' ? 'Вы уже записаны на это мероприятие. Обновите список.'
    : error?.code === '42501' ? 'Проверьте вход в аккаунт и доступность записи.'
    : 'Проверьте соединение и попробуйте ещё раз.';

  async function load() {
    const current = ++version;
    $('#eventsMessage').textContent = 'Загрузка мероприятий...';
    try {
      const auth = await client.auth.getUser();
      const nextUser = auth.data.user;
      const role = nextUser && !nextUser.is_anonymous ? await client.from('moderators').select('user_id').eq('user_id', nextUser.id).maybeSingle() : {data:null};
      const result = await client.from('cleanup_events').select(fields).order('event_date', {ascending:true, nullsFirst:false});
      if (result.error) throw result.error;
      const participation = nextUser && !nextUser.is_anonymous ? await client.from('event_participants').select('event_id').eq('user_id',nextUser.id) : {data:[]};
      if (participation.error) throw participation.error;
      if (current !== version) return;
      user = nextUser; moderator = !!role.data; rows = result.data || [];
      joined = new Set((participation.data || []).map(r => r.event_id));
      $('#eventAdmin').hidden = !moderator;
      $('#eventsMessage').textContent = '';
      render();
    } catch (error) {
      if (current !== version) return;
      rows = []; moderator = false; $('#eventAdmin').hidden = true; $('#eventsList').replaceChildren();
      $('#eventsMessage').textContent = 'Не удалось загрузить мероприятия. ' + fail(error);
    }
  }
  function render() {
    const mode = $('#eventFilter').value;
    const visible = rows.filter(r => mode === 'mine' ? joined.has(r.id) : mode === 'all' ? true : r.status === 'reviewed' && new Date(r.event_date) > new Date());
    $('#eventsCount').textContent = `Найдено: ${visible.length}`;
    $('#eventsList').replaceChildren();
    if (!visible.length) $('#eventsList').append(el('p', mode === 'mine' ? 'Вы пока не записаны на мероприятия.' : 'Мероприятий с такими условиями пока нет.', 'events-empty'));
    for (const event of visible) {
      const card = el('article','', 'event-card');
      const content = el('div','', 'event-content');
      const future = new Date(event.event_date) > new Date();
      const status = event.status === 'draft' ? 'Черновик' : event.status === 'cancelled' ? 'Отменено' : !future ? 'Прошедшее' : event.registration_open ? 'Запись открыта' : 'Запись закрыта';
      content.append(el('span',status,'event-status'),el('h3',event.title,'event-title'));
      if (event.description) content.append(el('p',event.description,'event-description'));
      for (const text of [' ' + dateText(event.event_date), ' ' + (event.location || I18N.t('Место уточняется')), I18N.t('Организатор: {name}',{name:event.organizer}), I18N.t('Правила участия: {rules}',{rules:event.safety_rules || I18N.t('Уточняются у организатора')})]) content.append(el('p',text,'event-info'));
      const registered = joined.has(event.id);
      const button = el('button', registered ? 'Отменить участие' : !user || user.is_anonymous ? 'Войти для записи' : future && event.registration_open && event.status === 'reviewed' ? 'Записаться' : 'Запись закрыта','event-button');
      button.type = 'button';
      button.disabled = !registered && !(future && event.registration_open && event.status === 'reviewed');
      const message = el('p','','event-feedback'); message.setAttribute('role','status');
      button.onclick = async () => {
        if (!user || user.is_anonymous) { location.href = 'account.html'; return; }
        button.disabled = true;
        try {
          const result = registered ? await client.from('event_participants').delete().eq('event_id',event.id).eq('user_id',user.id) : await client.from('event_participants').insert({event_id:event.id,user_id:user.id});
          if (result.error) throw result.error;
          await load();
        } catch(error) { message.textContent = 'Не удалось изменить участие. ' + fail(error); button.disabled = false; }
      };
      content.append(button, message);
      if (moderator) {
        const edit = el('button','Редактировать','event-edit'); edit.type='button'; edit.onclick=()=>editEvent(event);content.append(edit);
      }
      card.append(content); $('#eventsList').append(card);
    }
  }
  function editEvent(event = null) {
    const form = $('#eventForm'); form.reset(); $('#eventSaveMessage').textContent = '';
    form.elements.namedItem('id').value = event?.id || '';
    for(const key of ['title','description','organizer','location','safety_rules','status']) form.elements.namedItem(key).value = event?.[key] || (key === 'status' ? 'draft' : '');
    form.elements.namedItem('registration_open').checked = !!event?.registration_open;
    form.elements.namedItem('event_date').value = event?.event_date ? new Date(new Date(event.event_date).getTime() + 6*3600000).toISOString().slice(0,16) : '';
    $('#eventEditor').open = true; form.scrollIntoView({behavior:'smooth',block:'start'}); form.elements.namedItem('title').focus();
  }
  $('#eventForm').onsubmit = async e => {
    e.preventDefault(); if(!moderator) return;
    const form = e.target, data = new FormData(form), submit = $('#eventSave');
    const patch = Object.fromEntries(['title','description','organizer','location','safety_rules','status'].map(k=>[k,String(data.get(k)||'').trim()]));
    const date = data.get('event_date');
    patch.event_date = date ? new Date(date + ':00+06:00').toISOString() : null;
    patch.registration_open = data.get('registration_open') === 'on' && patch.status === 'reviewed';
    if (patch.status === 'reviewed' && (!date || new Date(patch.event_date) <= new Date() || !patch.location || patch.safety_rules.length < 10)) {
      $('#eventSaveMessage').textContent = 'Для публикации укажите будущую дату, место и правила участия (не менее 10 символов).';return;
    }
    submit.disabled = true; $('#eventSaveMessage').textContent = 'Сохранение...';
    try {
      const id = data.get('id');
      const query = id ? client.from('cleanup_events').update(patch).eq('id',id) : client.from('cleanup_events').insert(patch);
      const {data:result,error} = await query.select('id').single();
      if(error) throw error; if(!result) throw new Error('Нет доступа к мероприятию.');
      form.elements.namedItem('id').value=result.id;
      $('#eventSaveMessage').textContent = patch.status === 'reviewed' ? 'Мероприятие опубликовано.' : 'Изменения сохранены.';
      await load();
    } catch(error) { $('#eventSaveMessage').textContent = 'Не удалось сохранить. ' + fail(error); }
    finally { submit.disabled=false; }
  };
  if (location.hash === '#mine') $('#eventFilter').value = 'mine';
  window.addEventListener('languagechange',render);
  $('#eventNew').onclick=()=>editEvent();
  $('#eventFilter').onchange=render;
  $('#eventsRefresh').onclick=load;
  client.auth.onAuthStateChange(()=>setTimeout(load,0));
  load();
})();
