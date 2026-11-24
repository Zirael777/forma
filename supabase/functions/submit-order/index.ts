// Deploy with Supabase CLI. The function is publicly callable, but requires a valid
// Cloudflare Turnstile token and validates all user-supplied fields/files.
import { createClient } from 'npm:@supabase/supabase-js@2';
const env=(k:string)=>Deno.env.get(k)||'';
const originList=()=>env('ALLOWED_ORIGINS').split(',').map(s=>s.trim()).filter(Boolean);
const headersFor=(origin:string)=>({'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'apikey, authorization, content-type, x-client-info','Vary':'Origin'});
const allowedTypes=new Set(['image/jpeg','image/png','image/webp']);
const reply=(body:object,code:number,origin:string)=>new Response(JSON.stringify(body),{status:code,headers:{...headersFor(origin),'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
Deno.serve(async(req)=>{
  const origin=req.headers.get('origin')||'';
  if(!originList().includes(origin))return new Response('Forbidden origin',{status:403});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headersFor(origin)});
  if(req.method!=='POST')return reply({ok:false,error:'Method not allowed'},405,origin);
  const length=Number(req.headers.get('content-length')||0);
  if(length>17*1024*1024)return reply({ok:false,error:'Слишком большой запрос'},413,origin);
  if(!env('TURNSTILE_SECRET_KEY')||!env('SUPABASE_SERVICE_ROLE_KEY')||!env('SUPABASE_URL'))return reply({ok:false,error:'Сервер не настроен'},503,origin);
  try{
    const data=await req.formData();
    const read=(key:string)=>String(data.get(key)||'').trim();
    const customer_name=read('customer_name'),phone=read('phone'),furniture_type=read('furniture_type'),service_type=read('service_type'),description=read('description');
    const consent_given=data.get('consent')==='on';
    if(customer_name.length<1||customer_name.length>150||!/^\+?[\d\s()+\-]{5,40}$/.test(phone)||description.length>5000||!consent_given)return reply({ok:false,error:'Некорректные данные формы'},400,origin);
    if(!['Комод','Стул','Шкаф','Стол','Другое'].includes(furniture_type)||!['Реставрация','Перекраска','Декоративная отделка','Ремонт','Консультация'].includes(service_type))return reply({ok:false,error:'Некорректный выбор'},400,origin);
    const photos=data.getAll('photos').filter(x=>x instanceof File && x.size>0) as File[];
    if(photos.length>3)return reply({ok:false,error:'Максимум три фотографии'},400,origin);
    for(const p of photos){if(!allowedTypes.has(p.type)||p.size>5*1024*1024)return reply({ok:false,error:'Формат или размер фотографии не подходит'},400,origin);}
    const token=read('turnstile_token');if(!token)return reply({ok:false,error:'Пройдите проверку от спама'},403,origin);
    const verification=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({secret:env('TURNSTILE_SECRET_KEY'),response:token})});
    const result=await verification.json();if(!result.success)return reply({ok:false,error:'Проверка от спама не пройдена'},403,origin);
    const supa=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}});
    const id=crypto.randomUUID();const paths:string[]=[];
    for(let i=0;i<photos.length;i++){
      const file=photos[i];const ext=file.type==='image/jpeg'?'jpg':file.type==='image/png'?'png':'webp';const name=`${id}/${crypto.randomUUID()}.${ext}`;
      const bytes=await file.arrayBuffer();
      // Validate file signature to reject falsely labelled uploads.
      const b=new Uint8Array(bytes);const valid=file.type==='image/jpeg'?(b[0]===0xff&&b[1]===0xd8&&b[2]===0xff):file.type==='image/png'?(b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71):([82,73,70,70].every((v,j)=>b[j]===v)&&[87,69,66,80].every((v,j)=>b[j+8]===v));
      if(!valid){if(paths.length)await supa.storage.from('order-photos').remove(paths);return reply({ok:false,error:'Некорректный файл фотографии'},400,origin);}
      const {error}=await supa.storage.from('order-photos').upload(name,bytes,{contentType:file.type,upsert:false});
      if(error){if(paths.length)await supa.storage.from('order-photos').remove(paths);return reply({ok:false,error:'Не удалось сохранить фотографию'},502,origin);}paths.push(name);
    }
    const {error}=await supa.from('orders').insert({id,customer_name,phone,furniture_type,service_type,description,photo_paths:paths,status:'new',consent_given:true});
    if(error){if(paths.length)await supa.storage.from('order-photos').remove(paths);return reply({ok:false,error:'Не удалось создать заявку'},502,origin);}
    return reply({ok:true,order_id:id},200,origin);
  }catch(e){console.error('submit-order failed',e);return reply({ok:false,error:'Ошибка обработки заявки'},500,origin);}
});
