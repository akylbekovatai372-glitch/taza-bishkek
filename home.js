const homeClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

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

    const sb = homeClient;

    const countReports = async (status) => {
      let query = sb
        .from("reports")
      .select("id", { count: "exact", head: true });

      if (status) {
        query = query.eq("status", status);
      }

      const { count, error } = await query;

      if (error) throw error;

      return count ?? 0;
    };

    const [total, cleaned] =
      await Promise.all([
        countReports(),
        countReports("Убрано")
      ]);

    totalElement.textContent = total;
    activeElement.textContent = total - cleaned;
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
let lastStatusReport = null;

statusForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const input = document.querySelector("#reportCode");
  const value = input.value.trim().toUpperCase();

  lastStatusReport = null;
  const match = /^TB-(\d{1,12})$/.exec(value);

  if (!match || Number(match[1]) === 0) {
    statusResult.textContent =
      "Введите корректный номер, например TB-012.";
    return;
  }

  const reportId = Number(match[1]);

  statusResult.textContent = "Поиск заявки...";

  try {
    const client = homeClient;

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

    lastStatusReport = data;
    renderStatusResult();

  } catch (error) {
    console.error("Status search error:", error);
    statusResult.textContent =
      "Не удалось проверить статус. Попробуйте позже.";
  }
});


function renderStatusResult() {
  if(!lastStatusReport) return;
  const data = lastStatusReport;
  statusResult.replaceChildren();
  const title = document.createElement("strong");
  title.textContent = "TB-" + String(data.id).padStart(3,"0");
  const details = document.createElement("p");
  details.dataset.userContent = "";
  details.textContent = I18N.t("{type} — статус: {status}", {type:I18N.category(data.type),status:I18N.t(data.status)});
  statusResult.append(title,details);
}
window.addEventListener('languagechange',renderStatusResult);

// Public data powers the city preview and recent activity; no demo metrics.
let recentPublicReports = [], upcomingPublicEvents = [];
let activityLoaded=false, reportLoadError=false, eventLoadError=false;
let previewMap = null, previewLayer = null;
function uiElement(tag,text,className) {
  const element=document.createElement(tag); if(text!==null)element.textContent=text;
  if(className)element.className=className; return element;
}
function renderPublicActivity() {
  const root=document.querySelector('#recentReports');root.replaceChildren();
  for(const report of recentPublicReports.slice(0,3)) {
    const card=uiElement('a',null,'report-preview');card.href='index.html?report='+encodeURIComponent(report.id);
    const image=uiElement('div',null,'report-image');
    const placeholder=()=>{const icon=uiElement('span',null);icon.dataset.icon='map';image.replaceChildren(icon);TazaUI.icons(image);};
    const url=report.photo_after||report.photo;
    let valid=false;try{valid=!!url && new URL(url,location.href).protocol==='https:';}catch{}
    if(valid){const img=document.createElement('img');img.src=url;img.alt=I18N.t(report.photo_after?'Фото после уборки':'Фото до уборки');img.loading='lazy';img.onerror=placeholder;image.append(img);}else placeholder();
    const body=uiElement('div',null,'report-preview-content');
    const meta=uiElement('div',null,'report-meta');meta.append(uiElement('span','TB-'+String(report.id).padStart(3,'0')),uiElement('span',I18N.t(report.status),'preview-status'));
    const title=uiElement('h3',I18N.category(report.type));title.dataset.userContent='';
    const bottom=uiElement('div',null,'report-preview-bottom');bottom.append(uiElement('span',I18N.t('Посмотреть на карте')));const arrow=uiElement('span',null);arrow.dataset.icon='arrow';bottom.append(arrow);
    body.append(meta,title,bottom);card.append(image,body);root.append(card);
  }
  if(!recentPublicReports.length || reportLoadError)root.replaceChildren(uiElement('p',reportLoadError ? 'Не удалось загрузить заявки. Откройте карту или попробуйте позже.' : !activityLoaded ? 'Загрузка заявок' : 'Заявок пока нет. Первая может быть вашей.','empty-note'));
  const events=document.querySelector('#homeEvents');events.replaceChildren();
  for(const event of upcomingPublicEvents){
    const a=uiElement('a',null,'home-event');a.href='events.html';
    const title=uiElement('h3',event.title);title.dataset.userContent='';
    const place=uiElement('p',event.location||'');place.dataset.userContent='';
    a.append(uiElement('span',I18N.date(event.event_date,{long:true,time:true}),'home-event-date'),title,place,uiElement('span',I18N.t('Подробнее о мероприятии')+' →','text-link'));events.append(a);
  }
  if(!upcomingPublicEvents.length || eventLoadError)events.replaceChildren(uiElement('p',eventLoadError ? 'Не удалось загрузить мероприятия. Попробуйте позже.' : !activityLoaded ? 'Загрузка мероприятий...' : 'Новых уборок пока нет. Как только организатор опубликует мероприятие, оно появится здесь.','empty-note'));
  TazaUI.icons(root);
}
async function loadPublicActivity(){
  if(window.L){
    previewMap=L.map('cityPreview',{zoomControl:false,scrollWheelZoom:false,dragging:false,doubleClickZoom:false,keyboard:false,touchZoom:false,boxZoom:false}).setView([42.8746,74.5698],12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(previewMap);previewLayer=L.layerGroup().addTo(previewMap);
  }
  const results=await Promise.allSettled([
    homeClient.from('reports').select('id,type,status,lat,lng,photo,photo_after,created_at').order('id',{ascending:false}).limit(1000),
    homeClient.from('cleanup_events').select('id,title,location,event_date').eq('status','reviewed').gte('event_date',new Date().toISOString()).order('event_date').limit(2)
  ]);
  const reportResult=results[0].status==='fulfilled'?results[0].value:null;
  const eventResult=results[1].status==='fulfilled'?results[1].value:null;
  if(reportResult&&!reportResult.error){recentPublicReports=reportResult.data||[];
    const colors={'Новая':'#c85a49','Проверена':'#b38d41','В работе':'#5b8295','Убрано':'#5d874b'};
    for(const report of recentPublicReports.filter(r=>r.status!=='Убрано')){
      if(previewLayer&&Number.isFinite(report.lat)&&Number.isFinite(report.lng))L.circleMarker([report.lat,report.lng],{radius:5,color:'#fff',weight:2,fillColor:colors[report.status]||'#607553',fillOpacity:1}).addTo(previewLayer);
    }
  }
  if(eventResult&&!eventResult.error)upcomingPublicEvents=eventResult.data||[];
  activityLoaded=true;reportLoadError=!reportResult||!!reportResult.error;eventLoadError=!eventResult||!!eventResult.error;
  renderPublicActivity();
  if(!reportResult||reportResult.error)document.querySelector('#recentReports').replaceChildren(uiElement('p','Не удалось загрузить заявки. Откройте карту или попробуйте позже.','empty-note'));
  if(!eventResult||eventResult.error)document.querySelector('#homeEvents').replaceChildren(uiElement('p','Не удалось загрузить мероприятия. Попробуйте позже.','empty-note'));
}
window.addEventListener('languagechange',renderPublicActivity);
loadPublicActivity().catch(()=>{document.querySelector('#recentReports').textContent='Не удалось загрузить заявки. Откройте карту или попробуйте позже.';});
