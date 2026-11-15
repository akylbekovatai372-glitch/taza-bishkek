(() => {
  let step=1, prepared=null, previewURL=null, photoSizes=null, processing=false, errorKey='', revision=0, pointGetter=()=>null;
  let reportIntent=new URLSearchParams(location.search).get('task')==='report';
  const $=s=>document.querySelector(s);
  function clearPhoto(){revision++;prepared=null;photoSizes=null;processing=false;errorKey='';if(previewURL)URL.revokeObjectURL(previewURL);previewURL=null;$('#photoPreview').removeAttribute('src');$('#photoPreview').hidden=true;$('#photoRemove').hidden=true;$('#photoFeedback').textContent='';updateButtons();}
  function updateButtons(){ $('#wizardNext').disabled=processing;$('#wizardSend').disabled=processing; }
  function renderGuidance(){
    const hasPoint=!!pointGetter();
    if(hasPoint)reportIntent=true;
    $('#startReport').hidden=reportIntent||step!==1;
    $('#mapNext').hidden=!hasPoint||step!==1;
    $('#mapStepHint').textContent=I18N.t(!reportIntent&&step===1?'Карта заявок':['Шаг 1 из 3: выбери место','Шаг 2 из 3: описание и фото','Шаг 3 из 3: проверь и отправь'][step-1]);
    $('#mapStageHelp').textContent=I18N.t(!reportIntent&&step===1?'Цветные точки — заявки жителей. Нажми на точку для подробностей или создай новую заявку.':step===1?(hasPoint?'Место выбрано. Нажми «Далее» под картой.':'Нажми на место с мусором на карте. Затем нажми «Далее».'):step===2?'Выбери категорию. Описание и фото можно добавить по желанию.':'Проверь место и детали перед отправкой.');
    $('#wizardNext').textContent=I18N.t(step===1?'Далее: описание и фото':'Далее: проверить заявку');
  }
  function scrollToStep(){
    if(!window.matchMedia('(max-width:700px)').matches)return;
    const target=step===1?document.querySelector('.mobile-map-intro'):document.querySelector('.wizard-progress');
    target.scrollIntoView({block:'start',behavior:'instant'});
    if(step!==1)target.focus({preventScroll:true});
  }
  function renderPoint(){const p=pointGetter();$('#wizardLocation').textContent=p ? I18N.t('Место выбрано на карте')+` · ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}` : I18N.t('Точка пока не выбрана');$('#wizardLocation').classList.toggle('has-point',!!p);renderGuidance();if(step===3)review();}
  function review(){const form=$('#form'),p=pointGetter();$('#reviewType').textContent=I18N.category(form.elements.namedItem('type').value);$('#reviewDescription').textContent=form.elements.namedItem('desc').value||I18N.t('Без описания');$('#reviewLocation').textContent=p?`${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`:'';$('#reviewPhoto').hidden=!previewURL;if(previewURL)$('#reviewPhoto').src=previewURL;else $('#reviewPhoto').removeAttribute('src');}
  function show(next){const changed=step!==next;step=next;document.querySelectorAll('[data-wizard-step]').forEach(n=>n.hidden=Number(n.dataset.wizardStep)!==step);document.querySelectorAll('.wizard-progress li').forEach((n,i)=>{n.classList.toggle('is-current',i+1===step);n.classList.toggle('is-done',i+1<step);if(i+1===step)n.setAttribute('aria-current','step');else n.removeAttribute('aria-current');});$('#wizardBack').hidden=step===1;$('#wizardNext').hidden=step===3;$('#wizardSend').hidden=step!==3;$('#wizardMessage').textContent='';if(step===3)review();renderGuidance();updateButtons();if(changed)scrollToStep();}
  function validateDetails(){for(const name of ['type','desc']){const input=$('#form').elements.namedItem(name);if(!input.checkValidity()){show(2);input.reportValidity();return false;}}if(processing||errorKey){show(2);$('#wizardMessage').textContent=I18N.t(processing?'Сначала дождитесь обработки фото.':errorKey);return false;}return true;}
  function ready(){if(!pointGetter()){show(1);$('#wizardMessage').textContent='Сначала отметьте место на карте.';return false;}if(!validateDetails())return false;if(step!==3){show(3);return false;}return true;}
  async function prepare(file){
    clearPhoto();if(!file)return;
    const ticket=revision;
    processing=true;updateButtons();$('#photoFeedback').textContent='Подготавливаем фото...';
    let sourceURL=null,image=null;
    try {
      if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Выберите JPG, PNG или WebP.');
      if(file.size>15*1024*1024)throw new Error('Фото слишком большое. Максимум 15 МБ.');
      sourceURL=URL.createObjectURL(file);image=new Image();image.src=sourceURL;await image.decode();
      if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>40000000)throw new Error('Слишком большое разрешение фото. Выберите другой снимок.');
      const ratio=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Не удалось обработать фото. Попробуйте другой снимок.');
      ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
      const encode=q=>new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',q));
      let blob=await encode(.82);if(blob&&blob.size>1200*1024)blob=await encode(.65);
      canvas.width=1;canvas.height=1;
      if(!blob||blob.size>2*1024*1024)throw new Error('Не удалось обработать фото. Попробуйте другой снимок.');
      if(ticket!==revision)return;
      if(file.size<blob.size && ratio===1)blob=file;
      const extension=blob.type==='image/png'?'png':blob.type==='image/webp'?'webp':'jpg';
      prepared=new File([blob],'report-photo.'+extension,{type:blob.type});previewURL=URL.createObjectURL(blob);$('#photoPreview').src=previewURL;$('#photoPreview').hidden=false;$('#photoRemove').hidden=false;
      photoSizes={before:Math.round(file.size/1024),after:Math.round(blob.size/1024)};
      $('#photoFeedback').textContent=I18N.t('Готово: {before} → {after} КБ',photoSizes);
    } catch(error){if(ticket===revision){errorKey=['Выберите JPG, PNG или WebP.','Фото слишком большое. Максимум 15 МБ.','Слишком большое разрешение фото. Выберите другой снимок.'].includes(error.message)?error.message:'Не удалось обработать фото. Попробуйте другой снимок.';$('#photoFeedback').textContent=I18N.t(errorKey);$('#photoRemove').hidden=false;}}
    finally{if(sourceURL)URL.revokeObjectURL(sourceURL);if(image)image.src='';if(ticket===revision){processing=false;updateButtons();}}
  }
  window.ReportWizard={
    init({getPoint}){pointGetter=getPoint;$('#startReport').onclick=()=>{reportIntent=true;renderGuidance();};$('#mapNext').onclick=()=>$('#wizardNext').click();$('#wizardNext').onclick=()=>{if(step===1){if(!getPoint()){$('#wizardMessage').textContent='Сначала отметьте место на карте.';scrollToStep();return;}show(2);}else if(validateDetails())show(3);};$('#wizardBack').onclick=()=>show(Math.max(1,step-1));$('#photoInput').onchange=e=>prepare(e.target.files[0]);$('#photoRemove').onclick=()=>{$('#photoInput').value='';clearPhoto();};$('#form').addEventListener('reset',()=>{clearPhoto();show(1);setTimeout(renderPoint,0);});window.addEventListener('languagechange',()=>{renderPoint();if(step===3)review();if(errorKey)$('#photoFeedback').textContent=I18N.t(errorKey);else if(photoSizes)$('#photoFeedback').textContent=I18N.t('Готово: {before} → {after} КБ',photoSizes);});show(1);renderPoint();},
    onPoint:renderPoint, ready, getFile:()=>prepared
  };
})();
