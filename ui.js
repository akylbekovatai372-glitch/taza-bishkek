(() => {
  const paths={
    leaf:'M5 19c0-9 5-14 15-15 0 10-5 15-15 15Zm0 0 10-10M4 21l3-5',
    home:'m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9',
    map:'m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16',
    pin:'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0ZM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
    calendar:'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm2-3v6m10-6v6M3 11h18m-14 4h2m4 0h2',
    user:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2',
    arrow:'M5 12h14m-6-6 6 6-6 6',plus:'M12 5v14M5 12h14',
    menu:'M4 6h16M4 12h16M4 18h16',x:'m6 6 12 12M6 18 18 6',
    camera:'M8 5l2-2h4l2 2h4a2 2 0 0 1 2 2v12H2V7a2 2 0 0 1 2-2h4Zm8 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    check:'m5 12 4 4L19 6',locate:'M12 2v3m0 14v3M2 12h3m14 0h3M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-5 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
    shield:'m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6',
    search:'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-2 5 6 6'
  };
  function icons(root=document) {
    for(const n of root.querySelectorAll('[data-icon]:not([data-icon-ready])')){
      const key=n.dataset.icon;if(!paths[key])continue;
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');
      const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',paths[key]);svg.append(path);n.replaceChildren(svg);n.dataset.iconReady='true';
    }
  }
  window.TazaUI={icons};
  document.addEventListener('DOMContentLoaded',()=>{
    icons();
    const menu=document.querySelector('.menu-toggle'),nav=document.querySelector('#mobile-navigation');
    if(menu&&nav){
      const close=()=>{nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Открыть меню');menu.innerHTML='<span data-icon="menu"></span>';icons(menu);};
      menu.onclick=()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Закрыть меню':'Открыть меню');menu.innerHTML=`<span data-icon="${open?'x':'menu'}"></span>`;icons(menu);};
      nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',close));
      document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
    }
  });
})();
