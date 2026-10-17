'use strict';
document.addEventListener('DOMContentLoaded',async()=>{
 const $=id=>document.getElementById(id);let operationBusy=false,connection='idle',backups=[],adapters=[],lastPing=null;
 const statuses=['status','tools-status','system-status'];
 const text=(id,value)=>{$(id).textContent=value;};
 const fmt=x=>x===null||x===undefined?'—':x+' ms';
 function resultTable(container,headers,rows){container.replaceChildren();const table=document.createElement('table'),thead=document.createElement('thead'),tr=document.createElement('tr');for(const h of headers){const th=document.createElement('th');th.textContent=h;tr.append(th);}thead.append(tr);table.append(thead);const tbody=document.createElement('tbody');for(const row of rows){const tr=document.createElement('tr');for(const value of row){const td=document.createElement('td');td.textContent=value??'—';tr.append(td);}tbody.append(tr);}table.append(tbody);container.append(table);}
 function refreshDisabled(){
  for(const b of document.querySelectorAll('[data-tool]'))b.disabled=operationBusy||connection==='loading';
  $('start-btn').disabled=operationBusy||connection==='loading';
  $('stop-btn').disabled=!['loading','running'].includes(connection);
  $('dns-restore').disabled=operationBusy||connection==='loading'||!backups.includes('dns:'+$('adapter-select').value);
  const selected=adapters.find(x=>x.id===$('adapter-select').value);
  $('dns-apply').disabled=operationBusy||connection==='loading'||!selected||selected.status!=='Up'||!selected.physical;
  $('power-restore').disabled=operationBusy||connection==='loading'||$('power-restore').dataset.hasBackup!=='true';
  $('power-apply').disabled=operationBusy||connection==='loading'||!$('power-select').value;
  $('network-mode').disabled=connection==='loading';
 }
 function connectionState(state,message,verified=false){connection=state;const card=document.querySelector('.connection-card');card.dataset.state=state;
  const data={idle:['Başlamaya hazır','Bir profil seçerek bağlantıyı başlat.','Hazır'],loading:['Bağlantı deneniyor','İstediğin zaman Durdur ile iptal edebilirsin.','Deneniyor'],running:[verified?'HTTPS erişimi doğrulandı':'Motor çalışıyor',verified?'Discord’u açabilirsin. Ses bağlantısını ayrıca dene.':'Uygulama erişimini Ağ ölçümü bölümünden kontrol et.','Çalışıyor'],error:['Bağlantı doğrulanamadı','İşlem durumunu kontrol edip tekrar deneyebilirsin.','Kontrol gerekli']}[state];
  text('connection-title',data[0]);text('connection-description',data[1]);text('connection-badge',data[2]);$('start-btn').classList.toggle('loading',state==='loading');$('start-btn').textContent=state==='loading'?'Deneniyor...':state==='running'?'Yeniden dene':'Bağlantıyı başlat';if(message)text('status',message);refreshDisabled();
 }
 try{text('greeting',await window.api.getUsername());}catch{text('greeting','Yerel kullanıcı');}
 $('close-btn').onclick=()=>window.api.closeApp();$('minimize-btn').onclick=()=>window.api.minimizeWindow();$('maximize-btn').onclick=()=>window.api.maximizeWindow();
 const pages={'bypass-view':['Bağlantı','Bağlantın, kontrolünde.','Ağına uygun profili seç. Gerisini Ata74 denesin.'],'boost-view':['Ağ ölçümü','Önce ölç, sonra karar ver.','Hedefe göre gecikme, paket kaybı, HTTPS ve DNS yanıtları.'],'tools-view':['Araçlar','Kontrollü değişiklikler.','Seçili kart ve güç planı. Önce kaydet, uygula, doğrula.'],'pro-view':['Sistem durumu','Bilgisayarında neler oluyor?','Mevcut ayarları oku. Performans kazancı varsayma.']};
 document.querySelectorAll('.tab-btn').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab-btn').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.view-panel').forEach(p=>p.style.display=p.id===b.dataset.target?'block':'none');const p=pages[b.dataset.target];text('page-label',p[0]);text('page-title',p[1]);text('page-description',p[2]);document.querySelector('.content').scrollTop=0;});
 $('network-mode').onchange=e=>text('profile-caption',e.target.value==='yurt_auto'?'5 yöntem, sırayla':'Tek profil');
 window.api.onLauncherProgress(value=>text('status',value));window.api.onLauncherState(value=>connectionState(value.state,value.message));
 $('start-btn').onclick=async()=>{if(operationBusy||connection==='loading')return;connectionState('loading','Profil hazırlanıyor...');try{const result=await window.api.startLauncher($('network-mode').value);if(result.cancelled){connectionState('idle','Deneme iptal edildi.');return;}if(!result.success)throw Error(result.error);connectionState('running',result.message,result.verified);}catch(e){connectionState('error',e.message);}};
 $('stop-btn').onclick=async()=>{const b=$('stop-btn');b.disabled=true;try{const result=await window.api.stopLauncher();if(!result.success)throw Error(result.error);connectionState('idle','Bağlantı motoru durduruldu.');}catch(e){text('status',e.message);}finally{refreshDisabled();}};
 async function run(action,payload,status,consume){
  if(operationBusy||connection==='loading')return;operationBusy=true;refreshDisabled();if(status)text(status,'İşlem sürüyor...');
  try{const result=await window.api.tool(action,payload);if(!result.success)throw Error(result.error||'İşlem başarısız.');if(consume)await consume(result);if(status&&!['ping-results','https-results','dns-results'].includes(status))text(status,result.message||'İşlem tamamlandı.');}
  catch(e){if(status)text(status,e.message);}
  finally{operationBusy=false;refreshDisabled();}
 }
 function button(id,action,payload,status,consume){$(id).dataset.tool=action;$(id).onclick=()=>run(action,typeof payload==='function'?payload():payload,status,consume);}
 button('ping-test','ping',()=>({target:$('ping-target').value.trim()}),'ping-results',result=>{
  const d=result.data;const rows=[['Bu ölçüm',d.target,fmt(d.avg),fmt(d.min),fmt(d.max),d.lossPct+'%',fmt(d.jitter),d.received+'/'+d.sent]];
  if(lastPing&&lastPing.target===d.target)rows.push(['Önceki ölçüm',lastPing.target,fmt(lastPing.avg),fmt(lastPing.min),fmt(lastPing.max),lastPing.lossPct+'%',fmt(lastPing.jitter),lastPing.received+'/'+lastPing.sent]);
  resultTable($('ping-results'),['Ölçüm','Hedef','Ort. RTT','En az','En çok','Yanıtsız','RTT değişimi','Yanıt'],rows);lastPing=d;text('ping-indicator',d.avg===null?'ICMP yanıtı yok':d.target+' · '+fmt(d.avg));
 });
 button('https-test','https',{},'https-results',result=>resultTable($('https-results'),['Adres','Durum','Toplam yanıt süresi'],result.data.map(x=>[x.url,x.ok?'HTTPS başarılı':x.error||'HTTP '+x.status,fmt(x.ms)])));
 button('dns-test','dns-benchmark',{},'dns-results',result=>{
  resultTable($('dns-results'),['Sağlayıcı','Birincil DNS','Başarılı sorgu','Medyan','Öneri'],result.data.rows.map(x=>[x.name,x.server,x.successes+'/'+x.total,fmt(x.median),x.id===result.data.recommended?'Bu ölçümde en düşük medyan':'']));
  const note=document.createElement('p');note.textContent='Ayarlar değiştirilmedi. Süreler DNS sorgusuna aittir; oyun pingine değil.';$('dns-results').append(note);
 });
 function renderAdapter(){const a=adapters.find(x=>x.id===$('adapter-select').value);text('adapter-info',a?`${a.name} · ${a.status} · IPv4 DNS: ${(a.servers||[]).join(', ')||'Yok'} · ${a.manual?'Elle atanmış':'Otomatik'}`:'Uygun kart bulunamadı.');refreshDisabled();}
 function renderAdapters(result){adapters=Array.isArray(result.data)?result.data:[result.data];backups=result.backups||[];const old=$('adapter-select').value;const physical=adapters.filter(x=>x.physical||backups.includes('dns:'+x.id)).sort((a,b)=>a.metric-b.metric);$('adapter-select').replaceChildren();for(const a of physical){const option=document.createElement('option');option.value=a.id;option.textContent=a.name+' · '+a.status;$('adapter-select').append(option);}if(physical.some(x=>x.id===old))$('adapter-select').value=old;renderAdapter();}
 $('adapter-select').onchange=renderAdapter;
 button('adapters-refresh','adapters',{},'tools-status',renderAdapters);
 async function reloadAdapters(){const result=await window.api.tool('adapters');if(result.success)renderAdapters(result);else throw Error(result.error);}
 button('dns-apply','dns-apply',()=>({id:$('adapter-select').value,provider:$('dns-provider').value}),'tools-status',reloadAdapters);
 button('dns-restore','dns-restore',()=>({id:$('adapter-select').value}),'tools-status',reloadAdapters);
 button('flush-btn','flush',{},'tools-status');
 function renderPower(result){const d=result.data;$('power-select').replaceChildren();for(const p of d.plans){const o=document.createElement('option');o.value=p.id;o.textContent=p.name;$('power-select').append(o);}$('power-select').value=d.active;text('power-info','Etkin: '+(d.plans.find(x=>x.id===d.active)?.name||d.active)+(result.backup?' · Önceki plan kaydedilmiş.':''));$('power-restore').dataset.hasBackup=String(result.backup);}
 button('power-refresh','power-read',{},'tools-status',renderPower);
 async function reloadPower(){const result=await window.api.tool('power-read');if(result.success)renderPower(result);else throw Error(result.error);}
 button('power-apply','power-apply',()=>({id:$('power-select').value}),'tools-status',reloadPower);
 button('power-restore','power-restore',{},'tools-status',reloadPower);
 button('inspect-btn','inspect',{},'system-status',result=>{const d=result.data,c=$('inspect-results');c.replaceChildren();const summary=document.createElement('p');summary.textContent=`Fiziksel bellek: ${d.memoryTotalMB} MB toplam / ${d.memoryFreeMB} MB kullanılabilir. Önbelleğin dolu olması tek başına sorun değildir.`;c.append(summary);for(const [heading,headers,rows] of [['Servisler',['Servis','Durum','Başlangıç'],d.services.map(s=>[s.name,s.status,s.startType])],['Ağ kartı kesme ayarı',['Kart','Okunan değer'],d.interrupt.map(x=>[x.adapter,x.value])],['Kayıtlı TCP değerleri (kaynağı bilinmiyor)',['Konum','Ayar','Değer'],d.legacy.map(x=>[x.location,x.name,x.value])]]){const h=document.createElement('h3');h.textContent=heading;c.append(h);const div=document.createElement('div');resultTable(div,headers,rows);c.append(div);}});
 button('export-btn','export',{},'system-status');
 // Populate read-only configuration serially, without changing system settings.
 await run('adapters',{},'tools-status',renderAdapters);await run('power-read',{},'tools-status',renderPower);
 // Keep action results (tables) instead of replacing them with generic success text.
});
document.addEventListener('DOMContentLoaded',async()=>{
 const $=id=>document.getElementById(id),status=$('update-status'),check=$('update-check'),download=$('update-download'),install=$('update-install');
 function render(state){status.textContent='v'+state.version+' · '+state.message;check.disabled=['checking','downloading','downloaded'].includes(state.status);download.hidden=state.status!=='available';install.hidden=state.status!=='downloaded';}
 window.api.onUpdateState(render);
 async function action(button,fn){button.disabled=true;try{const result=await fn();if(result.success===false)status.textContent=result.message||result.error;else if(result.status)render(result);}catch{status.textContent='Güncelleme işlemi tamamlanamadı. Tekrar deneyin.';}finally{button.disabled=false;}}
 check.onclick=()=>action(check,window.api.checkUpdates);download.onclick=()=>action(download,window.api.downloadUpdate);install.onclick=()=>action(install,window.api.installUpdate);
 try{render(await window.api.getUpdateState());}catch{status.textContent='Güncelleme kontrolüne ulaşılamadı.';}
});
