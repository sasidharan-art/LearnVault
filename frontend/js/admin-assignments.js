document.addEventListener("DOMContentLoaded", async () => {
    const h = window.LearnVaultLearning;
    if (!h) return;
    h.bindLogout();

    const list = document.getElementById("adminAssignmentList");
    const filter = document.getElementById("adminAssignmentStatusFilter");
    const search = document.getElementById("assignmentTopSearch");
    let rows = [];

    function dt(value) {
        if (!value) return "No deadline";
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return "-";
        return d.toLocaleString(undefined,{day:"numeric",month:"short",year:"numeric",hour:"numeric",minute:"2-digit"});
    }

    function render() {
        document.getElementById("adminAssignmentTotal").textContent = rows.length;
        document.getElementById("adminAssignmentPublished").textContent = rows.filter(x=>x.status==='published').length;
        document.getElementById("adminAssignmentSubmissions").textContent = rows.reduce((s,x)=>s+Number(x.submission_count||0),0);
        document.getElementById("adminAssignmentAwaiting").textContent = rows.reduce((s,x)=>s+Number(x.awaiting_grade_count||0),0);
        const term = search.value.trim().toLowerCase();
        const filtered = rows.filter(x => {
            if (filter.value && x.status !== filter.value) return false;
            if (!term) return true;
            return [x.title,x.subject_code,x.subject_name,x.course_name,x.faculty_name,x.level_name].filter(Boolean).some(v=>String(v).toLowerCase().includes(term));
        });
        if (!filtered.length) { list.innerHTML=`<div class="progress-empty">No assignments match this view.</div>`; return; }
        list.innerHTML = filtered.map(x=>`<article class="admin-assignment-card">
            <div class="assignment-manage-head"><div><span>${h.esc(x.subject_code)} • ${h.esc(x.course_name)}</span><h3>${h.esc(x.title)}</h3><small>${h.esc(x.subject_name)}${x.level_name?' • '+h.esc(x.level_name):''}</small></div><span class="status-pill ${x.status==='published'?'approved':'rejected'}">${x.status}</span></div>
            <p>${h.esc(x.description||'No description')}</p>
            <div class="assignment-manage-metrics"><span>Faculty: ${h.esc(x.faculty_name)}</span><span>Due: ${h.esc(dt(x.due_at))}</span><span>${Number(x.submission_count||0)} submissions</span><span>${Number(x.awaiting_grade_count||0)} awaiting grade</span></div>
            <div class="assignment-manage-actions"><button type="button" class="table-action-button ${x.status==='published'?'reject':'approve'}" data-admin-publication="${x.id}" data-next-publication="${x.status==='published'?'0':'1'}">${x.status==='published'?'Hide':'Restore'}</button></div>
        </article>`).join("");
        list.querySelectorAll("[data-admin-publication]").forEach(b=>b.addEventListener("click",async()=>{
            try { await h.sendJson(`/api/assignments/admin/${encodeURIComponent(b.dataset.adminPublication)}/publication`,`PATCH`,{isPublished:b.dataset.nextPublication==='1'}); h.toast("Assignment oversight updated."); await load(); }
            catch(e){h.toast(e.message,"error");}
        }));
    }

    async function load() {
        const r=await fetch("/api/assignments/admin",{credentials:"same-origin"});
        const data=await r.json();
        if(!r.ok) throw new Error(data.message||"Unable to load assignments");
        rows=data.assignments||[]; render();
    }

    filter.addEventListener("change",render); search.addEventListener("input",render);
    try { await h.requireRole("admin"); await load(); }
    catch(e){h.toast(e.message,"error");}
});
