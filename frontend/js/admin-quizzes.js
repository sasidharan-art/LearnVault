document.addEventListener("DOMContentLoaded", async () => {
    const admin=window.LearnVaultAdmin, h=window.LearnVaultQuizBuilder; if(!admin||!h)return;
    if(!(await admin.requireAdmin()))return;
    const form=document.getElementById('adminQuizForm'),subject=document.getElementById('adminQuizSubject'),unit=document.getElementById('adminQuizUnit'),picker=document.getElementById('adminQuizQuestionPicker');
    const builder=h.create({subject,unit,picker,count:document.getElementById('adminBuilderCount'),selected:document.getElementById('adminSelectedCount'),selectAll:document.getElementById('adminSelectAllQuestions')});
    const search=document.getElementById('adminQuizSearch'),top=document.getElementById('adminQuizTopSearch'),status=document.getElementById('adminQuizStatus'),list=document.getElementById('adminQuizList'); let timer;
    async function json(url,method,body){const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(body)}),j=await r.json();if(!r.ok)throw new Error(j.message||'Request failed');return j;}

    form.addEventListener('submit',async e=>{e.preventDefault();const b=form.querySelector('button[type="submit"]'),old=b.textContent;try{b.disabled=true;b.textContent='Creating...';const j=await json('/api/quizzes','POST',{subjectId:Number(subject.value),unitId:unit.value?Number(unit.value):null,title:document.getElementById('adminQuizTitle').value.trim(),description:document.getElementById('adminQuizDescription').value.trim(),timeLimitMinutes:Number(document.getElementById('adminQuizTime').value),passPercentage:Number(document.getElementById('adminQuizPass').value),maxAttempts:Number(document.getElementById('adminQuizAttemptsMax').value),questionIds:builder.selectedIds()});admin.showToast(j.message);form.reset();document.getElementById('adminQuizTime').value='15';document.getElementById('adminQuizPass').value='50';document.getElementById('adminQuizAttemptsMax').value='1';unit.innerHTML='<option value="">All / General</option>';picker.innerHTML='<div class="admin-empty-state">Select a subject first.</div>';document.getElementById('adminSelectedCount').textContent='0 questions';await load();}catch(err){admin.showToast(err.message,'error');}finally{b.disabled=false;b.textContent=old;}});

    async function load(){const p=new URLSearchParams();if(search.value.trim())p.set('search',search.value.trim());if(status.value)p.set('status',status.value);list.innerHTML='<div class="admin-empty-state">Loading quizzes...</div>';try{const r=await fetch(`/api/quizzes/admin?${p}`,{credentials:'same-origin'}),j=await r.json();if(!r.ok)throw new Error(j.message||'Unable to load quizzes');const q=Array.isArray(j.quizzes)?j.quizzes:[];document.getElementById('adminQuizTotal').textContent=q.length;document.getElementById('adminQuizPending').textContent=q.filter(x=>x.verification_status==='pending').length;document.getElementById('adminQuizPublished').textContent=q.filter(x=>Number(x.is_published)===1).length;document.getElementById('adminQuizAttempts').textContent=q.reduce((s,x)=>s+Number(x.attempt_count||0),0);if(!q.length){list.innerHTML='<div class="admin-empty-state large">No quizzes match the current filters.</div>';return;}list.innerHTML=q.map(x=>`<article class="quiz-management-card"><div><div class="quiz-tag-row"><span>${h.esc(x.subject_code)} — ${h.esc(x.subject_name)}</span>${x.unit_name?`<span>${h.esc(x.unit_name)}</span>`:''}<span>${x.question_count} Q</span><span>${x.time_limit_minutes} min</span></div><h3>${h.esc(x.title)}</h3><p>${h.esc(x.description||'No description')}</p><small>
Created by ${h.esc(x.creator_name)}
• ${x.attempt_count} attempt${Number(x.attempt_count)===1?'':'s'}
${Number(x.pending_question_count||0)>0
    ? ` • ${Number(x.pending_question_count)} new question${Number(x.pending_question_count)===1?'':'s'} included`
    : ''}
</small>
${Number(x.pending_question_count||0)>0 && x.verification_status==='pending'
    ? `<div class="quiz-inline-approval-note">Approving this quiz will also approve these ${Number(x.pending_question_count)} new Faculty question${Number(x.pending_question_count)===1?'':'s'}.</div>`
    : ''}</div><div class="quiz-management-actions"><span class="status-pill ${x.verification_status}">${
    x.verification_status === "approved"
        ? "Published"
        : x.verification_status === "rejected"
            ? "Hidden"
            : "Legacy Pending"
}</span><span class="publish-pill ${Number(x.is_published)===1?'published':'unpublished'}">${Number(x.is_published)===1?'Published':'Not Published'}</span>${
    x.verification_status === "approved"
        ? `<button class="table-action-button reject" data-verify="rejected" data-id="${x.id}">Hide</button>`
        : `<button class="table-action-button approve" data-verify="approved" data-id="${x.id}">Restore</button>`
}
${
    x.verification_status === "approved"
        ? `<button class="table-action-button" data-pub="${Number(x.is_published)===1?'0':'1'}" data-id="${x.id}">${Number(x.is_published)===1?'Unpublish':'Publish'}</button>`
        : ""
}</div></article>`).join('');list.querySelectorAll('[data-verify]').forEach(b=>b.addEventListener('click',async()=>{try{const j=await json(`/api/quizzes/admin/${b.dataset.id}/verification`,'PATCH',{status:b.dataset.verify});admin.showToast(j.message);await load();}catch(e){admin.showToast(e.message,'error');}}));list.querySelectorAll('[data-pub]').forEach(b=>b.addEventListener('click',async()=>{try{const j=await json(`/api/quizzes/admin/${b.dataset.id}/publish`,'PATCH',{isPublished:b.dataset.pub==='1'});admin.showToast(j.message);await load();}catch(e){admin.showToast(e.message,'error');}}));}catch(e){list.innerHTML=`<div class="admin-empty-state large">${h.esc(e.message)}</div>`;}}
    const schedule=()=>{clearTimeout(timer);timer=setTimeout(load,250)};search.addEventListener('input',schedule);top.addEventListener('input',()=>{search.value=top.value;schedule()});status.addEventListener('change',load);document.getElementById('adminQuizRefresh').addEventListener('click',load);
    try{await builder.loadMeta();await load();}catch(e){admin.showToast(e.message,'error');}
});
