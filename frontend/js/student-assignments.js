document.addEventListener("DOMContentLoaded", async () => {
    const h = window.LearnVaultLearning;
    if (!h) return;
    h.bindLogout();

    const list = document.getElementById("studentAssignmentList");
    const filter = document.getElementById("studentAssignmentFilter");
    const search = document.getElementById("assignmentTopSearch");
    const empty = document.getElementById("studentAssignmentEmpty");
    const detail = document.getElementById("studentAssignmentDetail");
    const form = document.getElementById("studentAssignmentSubmitForm");
    const gradePanel = document.getElementById("studentGradePanel");

    let data = null;
    let current = null;

    function dateTime(value) {
        if (!value) return "No deadline";
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return "-";
        return d.toLocaleString(undefined, { day:"numeric", month:"short", year:"numeric", hour:"numeric", minute:"2-digit" });
    }

    function state(a) {
        if (a.submission_status === "graded") return { label:"Graded", cls:"approved" };
        if (a.submission_id) return { label:"Submitted", cls:"pending" };
        if (a.is_overdue && !a.can_submit) return { label:"Closed", cls:"rejected" };
        if (a.is_overdue) return { label:"Late Allowed", cls:"pending" };
        return { label:"Open", cls:"approved" };
    }

    function renderStats() {
        const rows = data.assignments || [];
        const now = Date.now();
        const seven = now + 7*24*60*60*1000;
        document.getElementById("studentAssignmentTotal").textContent = rows.length;
        document.getElementById("studentAssignmentSubmitted").textContent = rows.filter(x => x.submission_id).length;
        document.getElementById("studentAssignmentGraded").textContent = rows.filter(x => x.submission_status === "graded").length;
        document.getElementById("studentAssignmentDueSoon").textContent = rows.filter(x => {
            if (!x.due_at || x.submission_id) return false;
            const t = new Date(x.due_at).getTime();
            return t >= now && t <= seven;
        }).length;
    }

    function renderList() {
        const term = search.value.trim().toLowerCase();
        const rows = (data.assignments || []).filter(a => {
            if (filter.value && String(a.subject_id) !== String(filter.value)) return false;
            if (!term) return true;
            return [a.title,a.subject_code,a.subject_name,a.faculty_name].filter(Boolean).some(v => String(v).toLowerCase().includes(term));
        });

        if (!rows.length) {
            list.innerHTML = `<div class="progress-empty"><strong>No assignments found</strong><span>Faculty assignments for your Course and Level will appear here.</span></div>`;
            return;
        }

        list.innerHTML = rows.map(a => {
            const s = state(a);
            return `<button type="button" class="assignment-list-card ${current && Number(current.id)===Number(a.id)?"active":""}" data-assignment-id="${a.id}">
                <div><span>${h.esc(a.subject_code)}</span><h3>${h.esc(a.title)}</h3><small>${h.esc(a.subject_name)}</small></div>
                <div class="assignment-list-meta"><span class="status-pill ${s.cls}">${s.label}</span><small>${h.esc(dateTime(a.due_at))}</small></div>
            </button>`;
        }).join("");

        list.querySelectorAll("[data-assignment-id]").forEach(btn => btn.addEventListener("click", () => openAssignment(Number(btn.dataset.assignmentId))));
    }

    function fillDetail() {
        if (!current) return;
        const s = state(current);
        document.getElementById("studentAssignmentSubject").textContent = `${current.subject_code} — ${current.subject_name}`;
        document.getElementById("studentAssignmentTitle").textContent = current.title;
        document.getElementById("studentAssignmentDescription").textContent = current.description || "No description";
        document.getElementById("studentAssignmentDue").textContent = dateTime(current.due_at);
        document.getElementById("studentAssignmentMarks").textContent = Number(current.total_marks || 0);
        document.getElementById("studentAssignmentFaculty").textContent = current.faculty_name || "Faculty";
        document.getElementById("studentAssignmentLate").textContent = Number(current.allow_late_submission)===1 ? "Allowed" : "Not allowed";
        document.getElementById("studentAssignmentInstructions").textContent = current.instructions || "Follow the Faculty instructions provided in class.";
        const stateEl = document.getElementById("studentAssignmentState");
        stateEl.textContent = s.label;
        stateEl.className = `status-pill ${s.cls}`;
        document.getElementById("studentSubmissionText").value = current.submission_text || "";
        document.getElementById("studentSubmissionUrl").value = current.submission_url || "";
        document.getElementById("studentSubmissionFile").value = "";

        const existing = document.getElementById("studentSubmissionExisting");
        existing.innerHTML = current.submission_id
            ? `${current.original_file_name ? `<a href="/api/assignments/submissions/${current.submission_id}/file">${h.esc(current.original_file_name)}</a> • ` : ""}Submitted ${h.esc(dateTime(current.submitted_at))}`
            : "No submission yet";

        const submitButton = form.querySelector('button[type="submit"]');
        const locked = current.submission_status === "graded" || !current.can_submit;
        form.querySelectorAll("textarea,input,button").forEach(el => el.disabled = locked);
        submitButton.textContent = current.submission_id ? "Update Submission" : "Submit Assignment";

        if (current.submission_status === "graded") {
            gradePanel.hidden = false;
            document.getElementById("studentGradeScore").textContent = Number(current.marks_awarded || 0);
            document.getElementById("studentGradeTotal").textContent = `/ ${Number(current.total_marks || 0)}`;
            document.getElementById("studentGradeFeedback").textContent = current.feedback || "No written feedback.";
        } else {
            gradePanel.hidden = true;
        }
    }

    function openAssignment(id) {
        current = (data.assignments || []).find(x => Number(x.id) === Number(id));
        if (!current) return;
        empty.hidden = true;
        detail.hidden = false;
        renderList();
        fillDetail();
    }

    function buildFilters() {
        const map = new Map();
        for (const a of data.assignments || []) map.set(String(a.subject_id), { id:a.subject_id, code:a.subject_code, name:a.subject_name });
        filter.innerHTML = `<option value="">All Subjects</option>${[...map.values()].map(s => `<option value="${s.id}">${h.esc(s.code)} — ${h.esc(s.name)}</option>`).join("")}`;
    }

    async function load() {
        const response = await fetch("/api/assignments/student", { credentials:"same-origin" });
        data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to load assignments");
        buildFilters(); renderStats(); renderList();
        if (current) {
            const refreshed = data.assignments.find(x => Number(x.id)===Number(current.id));
            current = refreshed || null;
            if (current) fillDetail(); else { detail.hidden=true; empty.hidden=false; }
        }
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (!current) return;
        const button = form.querySelector('button[type="submit"]');
        const old = button.textContent;
        try {
            button.disabled = true; button.textContent = "Submitting...";
            const fd = new FormData();
            fd.append("submissionText", document.getElementById("studentSubmissionText").value.trim());
            fd.append("submissionUrl", document.getElementById("studentSubmissionUrl").value.trim());
            const file = document.getElementById("studentSubmissionFile").files[0];
            if (file) fd.append("file", file);
            const response = await fetch(`/api/assignments/student/${encodeURIComponent(current.id)}/submit`, { method:"POST", credentials:"same-origin", body:fd });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || "Unable to submit assignment");
            h.toast(result.message); await load();
        } catch (error) { h.toast(error.message,"error"); }
        finally { button.disabled=false; button.textContent=old; }
    });

    filter.addEventListener("change", renderList);
    search.addEventListener("input", renderList);

    try { await h.requireRole("student"); await load(); }
    catch (error) { h.toast(error.message,"error"); }
});
