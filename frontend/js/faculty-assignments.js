document.addEventListener("DOMContentLoaded", async () => {
    const h = window.LearnVaultLearning;
    if (!h) return;
    h.bindLogout();

    const form = document.getElementById("facultyAssignmentForm");
    const subject = document.getElementById("facultyAssignmentSubject");
    const list = document.getElementById("facultyAssignmentList");
    const search = document.getElementById("assignmentTopSearch");
    const empty = document.getElementById("facultySubmissionEmpty");
    const workspace = document.getElementById("facultySubmissionWorkspace");
    const submissionList = document.getElementById("facultySubmissionList");

    let assignments = [];
    let currentId = null;

    function dt(value) {
        if (!value) return "No deadline";
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return "-";
        return d.toLocaleString(undefined,{day:"numeric",month:"short",year:"numeric",hour:"numeric",minute:"2-digit"});
    }

    async function loadMeta() {
        const r = await fetch("/api/assignments/faculty/meta",{credentials:"same-origin"});
        const data = await r.json();
        if (!r.ok) throw new Error(data.message || "Unable to load assigned subjects");
        subject.innerHTML = `<option value="">Select Assigned Subject</option>${(data.subjects||[]).map(s=>`<option value="${s.id}">${h.esc(s.subject_code)} — ${h.esc(s.subject_name)} • ${h.esc(s.course_name)}</option>`).join("")}`;
    }

    function renderAssignments() {
        const term = search.value.trim().toLowerCase();
        const rows = assignments.filter(a => !term || [a.title,a.subject_code,a.subject_name,a.course_name].filter(Boolean).some(v=>String(v).toLowerCase().includes(term)));
        if (!rows.length) { list.innerHTML = `<div class="progress-empty">No assignments found.</div>`; return; }
        list.innerHTML = rows.map(a=>`<article class="assignment-manage-card ${Number(a.id)===Number(currentId)?"active":""}">
            <div class="assignment-manage-head"><div><span>${h.esc(a.subject_code)}</span><h3>${h.esc(a.title)}</h3><small>${h.esc(a.subject_name)} • ${h.esc(dt(a.due_at))}</small></div><span class="status-pill ${a.status==='published'?'approved':'rejected'}">${a.status}</span></div>
            <div class="assignment-manage-metrics"><span>${Number(a.submission_count||0)} submissions</span><span>${Number(a.awaiting_grade_count||0)} awaiting grade</span><span>${Number(a.graded_count||0)} graded</span></div>
            <div class="assignment-manage-actions"><button type="button" class="button button-soft compact" data-open-assignment="${a.id}">Review Submissions</button><button type="button" class="table-action-button" data-assignment-publication="${a.id}" data-next-publication="${a.status==='published'?'0':'1'}">${a.status==='published'?'Hide':'Publish'}</button></div>
        </article>`).join("");
        list.querySelectorAll("[data-open-assignment]").forEach(b=>b.addEventListener("click",()=>loadSubmissions(Number(b.dataset.openAssignment))));
        list.querySelectorAll("[data-assignment-publication]").forEach(b=>b.addEventListener("click",async()=>{
            try { await h.sendJson(`/api/assignments/faculty/${encodeURIComponent(b.dataset.assignmentPublication)}/publication`,`PATCH`,{isPublished:b.dataset.nextPublication==='1'}); h.toast("Assignment publication updated."); await loadAssignments(); }
            catch(e){ h.toast(e.message,"error"); }
        }));
    }

    async function loadAssignments() {
        const r = await fetch("/api/assignments/faculty",{credentials:"same-origin"});
        const data = await r.json();
        if (!r.ok) throw new Error(data.message || "Unable to load assignments");
        assignments = data.assignments || []; renderAssignments();
        if (currentId) {
            const exists = assignments.some(x=>Number(x.id)===Number(currentId));
            if (exists) await loadSubmissions(currentId); else { currentId=null; workspace.hidden=true; empty.hidden=false; }
        }
    }

    async function loadSubmissions(id) {
        currentId = id; renderAssignments();
        const r = await fetch(`/api/assignments/faculty/${encodeURIComponent(id)}/submissions`,{credentials:"same-origin"});
        const data = await r.json();
        if (!r.ok) throw new Error(data.message || "Unable to load submissions");
        empty.hidden=true; workspace.hidden=false;
        document.getElementById("facultySubmissionSubject").textContent = `${data.assignment.subjectCode} — ${data.assignment.subjectName}`;
        document.getElementById("facultySubmissionTitle").textContent = data.assignment.title;
        document.getElementById("facultySubmissionSummary").textContent = `${data.submissions.length} submission${data.submissions.length===1?'':'s'}`;
        if (!data.submissions.length) { submissionList.innerHTML = `<div class="progress-empty">No student submissions yet.</div>`; return; }
        submissionList.innerHTML = data.submissions.map(s=>`<article class="submission-card">
            <div class="submission-card-head"><div><span>${h.esc(s.username)}</span><h3>${h.esc(s.student_name)}</h3><small>${h.esc(s.email)} • ${h.esc(dt(s.submitted_at))}</small></div><span class="status-pill ${s.status==='graded'?'approved':'pending'}">${s.status}</span></div>
            ${s.submission_text?`<div class="submission-content"><span>STUDENT NOTES</span><p>${h.esc(s.submission_text)}</p></div>`:''}
            <div class="submission-links">${s.submission_url?`<a href="${h.esc(s.submission_url)}" target="_blank" rel="noopener">Open Submission Link ↗</a>`:''}${s.original_file_name?`<a href="/api/assignments/submissions/${s.id}/file">Download ${h.esc(s.original_file_name)}</a>`:''}</div>
            <form class="grade-form" data-grade-submission="${s.id}"><label><span>Marks / ${Number(data.assignment.totalMarks)}</span><input name="marks" type="number" min="0" max="${Number(data.assignment.totalMarks)}" step="0.5" value="${s.marks_awarded ?? ''}" required></label><label><span>Feedback</span><textarea name="feedback" rows="3" placeholder="Give specific feedback...">${h.esc(s.feedback||'')}</textarea></label><button type="submit" class="button button-primary compact">${s.status==='graded'?'Update Grade':'Save Grade'}</button></form>
        </article>`).join("");
        submissionList.querySelectorAll("[data-grade-submission]").forEach(f=>f.addEventListener("submit",async event=>{
            event.preventDefault();
            const button=f.querySelector('button[type="submit"]'); const old=button.textContent;
            try { button.disabled=true; button.textContent="Saving..."; await h.sendJson(`/api/assignments/faculty/submissions/${encodeURIComponent(f.dataset.gradeSubmission)}/grade`,`PATCH`,{marksAwarded:Number(f.elements.marks.value),feedback:f.elements.feedback.value.trim()}); h.toast("Grade saved."); await loadAssignments(); }
            catch(e){h.toast(e.message,"error");}
            finally{button.disabled=false;button.textContent=old;}
        }));
    }

    form.addEventListener("submit",async event=>{
        event.preventDefault(); const button=form.querySelector('button[type="submit"]'); const old=button.textContent;
        try { button.disabled=true; button.textContent="Publishing..."; await h.sendJson("/api/assignments/faculty","POST",{subjectId:Number(subject.value),title:document.getElementById("facultyAssignmentTitle").value.trim(),description:document.getElementById("facultyAssignmentDescription").value.trim(),instructions:document.getElementById("facultyAssignmentInstructions").value.trim(),dueAt:document.getElementById("facultyAssignmentDue").value || null,totalMarks:Number(document.getElementById("facultyAssignmentMarks").value),allowLateSubmission:document.getElementById("facultyAssignmentLate").checked}); h.toast("Assignment published."); form.reset(); document.getElementById("facultyAssignmentMarks").value="100"; await loadAssignments(); }
        catch(e){h.toast(e.message,"error");}
        finally{button.disabled=false;button.textContent=old;}
    });

    search.addEventListener("input",renderAssignments);
    try { await h.requireRole("faculty"); await loadMeta(); await loadAssignments(); }
    catch(e){h.toast(e.message,"error");}
});
