document.addEventListener('DOMContentLoaded', async () => {
  const role = document.body.dataset.role || '';
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const toast = msg => { const t=$('toast'); if(!t)return; t.textContent=msg; t.className='toast show'; clearTimeout(t._t); t._t=setTimeout(()=>t.className='toast',2600); };
  const form=$('liveClassForm'), list=$('liveClassList'), subject=$('liveClassSubject');
  async function me(){const r=await fetch('/api/auth/me',{credentials:'same-origin'});const j=await r.json();if(r.status===401){location.replace('../login.html');return null;}if(!r.ok||!j.user||String(j.user.role).toLowerCase()!==role)throw Error('Access denied');const n=$('liveClassHeaderName');if(n)n.textContent=j.user.fullName||role;return j.user;}
  async function loadOptions(){
    if(!subject)return;
    const r=await fetch('/api/live-classes/options',{credentials:'same-origin'}); if(!r.ok)return; const j=await r.json();
    subject.innerHTML='<option value="">General class</option>'+(j.subjects||[]).map(s=>`<option value="${s.id}" data-course="${s.course_id||''}" data-level="${s.course_level_id||''}">${esc(s.subject_code)} — ${esc(s.subject_name)}${s.course_name?' • '+esc(s.course_name):''}</option>`).join('');
  }
  function status(x){return String(x.status||'scheduled').replace('_',' ')}
  function render(items){
    if(!list)return;
    if(!items.length){list.innerHTML='<div class="integration-empty">No Live Classes available yet.</div>';return;}
    list.innerHTML=items.map(x=>`<article class="lv-feature-card"><div class="lv-feature-card-head"><div><span class="eyebrow">${esc(status(x).toUpperCase())}</span><h3>${esc(x.title)}</h3><p>${esc(x.subject_name||'General learning session')} ${x.course_name?'• '+esc(x.course_name):''} ${x.level_name?'• '+esc(x.level_name):''}</p></div><span class="lv-live-badge">${Number(x.participants||0)} joined</span></div><p>${esc(x.description||'Native LearnVault live classroom.')}</p><div class="lv-feature-meta"><span>${x.starts_at?new Date(x.starts_at).toLocaleString():'—'}</span>${x.faculty_name?`<span>Faculty: ${esc(x.faculty_name)}</span>`:''}</div><div class="lv-feature-actions">${role==='student'?`<button class="button button-primary" data-join="${x.id}">${x.status==='live'?(x.joined?'Rejoin Live':'Join Live Now'):'View Class'}</button>`:''}${role!=='student'?`<button class="button button-primary" data-studio="${x.id}">${x.status==='live'?'Open Live Classroom':'Manage Live Class'}</button><button class="button button-soft" data-status="${x.id}" data-next="${x.status==='live'?'completed':'live'}">${x.status==='live'?'End Class':'Start Class'}</button><button class="button button-ghost" data-notify="${x.id}">Notify Students</button><button class="button button-ghost danger-text" data-delete="${x.id}">Delete</button>`:''}</div></article>`).join('');
    list.querySelectorAll('[data-join]').forEach(b=>b.onclick=async()=>{const item=items.find(x=>String(x.id)===String(b.dataset.join));if(item?.status!=='live')return toast('This class is scheduled. You can join when the faculty starts it.');const r=await fetch(`/api/live-classes/${b.dataset.join}/join`,{method:'POST',credentials:'same-origin'});const j=await r.json();if(!r.ok)return toast(j.message||'Unable to join');window.location.href=`watch-live.html?id=${b.dataset.join}`;});
    list.querySelectorAll('[data-studio]').forEach(b=>b.onclick=()=>{const base=role==='admin'?'../admin/live-studio.html':'live-studio.html';window.location.href=`${base}?id=${b.dataset.studio}`;});
    list.querySelectorAll('[data-status]').forEach(b=>b.onclick=async()=>{const r=await fetch(`/api/live-classes/${b.dataset.status}/status`,{method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({status:b.dataset.next})});const j=await r.json();toast(j.message||'Updated');if(r.ok)load();});
    list.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('Delete this Live Class permanently?'))return;const r=await fetch(`/api/live-classes/${b.dataset.delete}`,{method:'DELETE',credentials:'same-origin'});const j=await r.json();toast(j.message||'Deleted');if(r.ok)load();});
    list.querySelectorAll('[data-notify]').forEach(b=>b.onclick=async()=>{const message=prompt('Notification to students:','Your LearnVault Live Class is about to start. Join from Live Classes.');if(!message)return;const r=await fetch(`/api/live-classes/${b.dataset.notify}/notify`,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({message,priority:'important'})});const j=await r.json();toast(j.message||'Notification sent');});
  }
  async function load(){const r=await fetch('/api/live-classes',{credentials:'same-origin'});const j=await r.json();if(!r.ok)throw Error(j.message||'Unable to load Live Classes');render(j.classes||[]);}
  if(form){
    form.onsubmit=async e=>{e.preventDefault();const fd=new FormData(form);const body=Object.fromEntries(fd.entries());body.nativeEnabled=true;body.notifyStudents=$('notifyStudents')?.checked||false;body.notificationMessage=$('notificationMessage')?.value||'';
      const opt=subject?.selectedOptions?.[0]; if(opt){body.courseId=opt.dataset.course||'';body.courseLevelId=opt.dataset.level||'';}
      const r=await fetch('/api/live-classes',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(body)});const j=await r.json();toast(j.message||'Saved');if(r.ok){form.reset();load();}
    };
  }
  try{await me();if(role!=='student'){await loadOptions();}await load();}catch(e){toast(e.message);}
});
