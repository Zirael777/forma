(()=>{'use strict';
const toggle=document.querySelector('#menu-toggle'), menu=document.querySelector('#nav-links');
toggle?.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));menu.classList.toggle('is-open',open);});
menu?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{menu.classList.remove('is-open');toggle?.setAttribute('aria-expanded','false');}));
const gallery=document.querySelector('.works-cards');
document.querySelector('#works-next')?.addEventListener('click',()=>{if(gallery?.firstElementChild)gallery.append(gallery.firstElementChild);});
document.querySelector('#works-prev')?.addEventListener('click',()=>{if(gallery?.lastElementChild)gallery.prepend(gallery.lastElementChild);});
const cfg=window.FORMA_CONFIG||{},live=/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cfg.supabaseUrl||'') && !!cfg.supabasePublishableKey && !!cfg.turnstileSiteKey;
const alert=document.querySelector('#demo-alert'),form=document.querySelector('#order-form'),msg=document.querySelector('#form-message'),input=document.querySelector('#photos'),filesInfo=document.querySelector('#file-count'),btn=document.querySelector('#submit-order');
if(live){alert.hidden=true;startTurnstile();}else{alert.hidden=false;}
input?.addEventListener('change',()=>{const files=[...input.files];filesInfo.textContent=files.length?files.map(f=>f.name).join(' · '):'Выбрать фотографии';});
let captchaToken='';
function startTurnstile(){const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.defer=true;script.onload=()=>window.turnstile?.render('#turnstile-container',{sitekey:cfg.turnstileSiteKey,callback:(token)=>{captchaToken=token;},'expired-callback':()=>{captchaToken='';}});document.head.appendChild(script);}
function say(text,error=false){msg.textContent=text;msg.style.color=error?'#ffdac5':'#dce9d2';}
form?.addEventListener('submit',async(ev)=>{ev.preventDefault();say('');if(!form.reportValidity())return;
if(!live){say('Демо-режим: заявка не отправлена. Настройте подключение по README.',true);return;}
const fileList=[...input.files];if(fileList.length>3){say('Можно приложить не более трёх файлов.',true);return;}for(const f of fileList){if(f.size>5*1024*1024 || !['image/jpeg','image/png','image/webp'].includes(f.type)){say('Фото должны быть JPG, PNG или WebP размером до 5 МБ.',true);return;}}
if(!captchaToken){say('Подтвердите проверку от спама.',true);return;}
const data=new FormData(form);data.set('turnstile_token',captchaToken);btn.disabled=true;btn.textContent='Отправляем…';
try{const r=await fetch(cfg.supabaseUrl+'/functions/v1/'+(cfg.functionName||'submit-order'),{method:'POST',headers:{apikey:cfg.supabasePublishableKey},body:data});const out=await r.json().catch(()=>({}));if(!r.ok||!out.ok)throw new Error(out.error||'Ошибка соединения с сервером');form.reset();filesInfo.textContent='Выбрать фотографии';say('Заявка №'+String(out.order_id||'').slice(0,8)+' принята. Спасибо!');}
catch(e){say('Не удалось отправить заявку: '+e.message,true);}
finally{btn.disabled=false;btn.innerHTML='Отправить заявку <span aria-hidden="true">↗</span>';captchaToken='';window.turnstile?.reset?.();}
});
})();
