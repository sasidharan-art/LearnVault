document.addEventListener("DOMContentLoaded", () => {
    const admin = window.LearnVaultAdmin;
    const form = document.getElementById("adminSubjectForm");
    if (!admin || !form) return;
    const courseSelect = document.getElementById("adminSubjectCourse");
    const levelSelect = document.getElementById("adminSubjectLevel");
    const list = document.getElementById("adminSubjectList");
    let meta = { courses:[], levels:[], subjects:[] };
    const esc = v => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

    function renderLevels() {
        const courseId = Number(courseSelect.value);
        const levels = meta.levels.filter(l => Number(l.course_id) === courseId && Number(l.is_active) === 1);
        levelSelect.innerHTML = '<option value="">No level / not required</option>' + levels.map(l => `<option value="${l.id}">${esc(l.level_name)}</option>`).join('');
    }

    function renderSubjects() {
        if (!meta.subjects.length) { list.innerHTML = '<div class="admin-empty-state">No subjects configured yet.</div>'; return; }
        list.innerHTML = meta.subjects.map(s => `<article class="admin-subject-item ${Number(s.is_active) === 1 ? '' : 'inactive-item'}"><div><span>${esc(s.subject_code)}</span><strong>${esc(s.subject_name)}</strong><small>${esc(s.course_name)}${s.level_name ? ' • ' + esc(s.level_name) : ''}</small></div><button type="button" class="academic-status-button ${Number(s.is_active)===1?'active':'inactive'}" data-subject-status="${s.id}" data-next="${Number(s.is_active)===1?'0':'1'}">${Number(s.is_active)===1?'Active':'Inactive'}</button></article>`).join('');
        list.querySelectorAll('[data-subject-status]').forEach(btn => btn.addEventListener('click', async () => {
            const response = await fetch(`/api/admin/subjects/${btn.dataset.subjectStatus}/status`, { method:'PATCH', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body: JSON.stringify({ isActive: btn.dataset.next === '1' }) });
            const result = await response.json();
            if (!response.ok) return admin.showToast(result.message || 'Unable to update subject', 'error');
            admin.showToast(result.message); await load();
        }));
    }

    async function load() {
        const response = await fetch('/api/admin/academic-subjects/meta', { credentials:'same-origin' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Unable to load subjects');
        meta = result;
        courseSelect.innerHTML = '<option value="">Select Course / Program</option>' + meta.courses.filter(c => Number(c.is_active)===1).map(c => `<option value="${c.id}">${esc(c.course_name)} (${esc(c.course_code)})</option>`).join('');
        renderLevels(); renderSubjects();
    }

    courseSelect.addEventListener('change', renderLevels);
    form.addEventListener('submit', async e => {
        e.preventDefault();
        const response = await fetch('/api/admin/subjects', { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body: JSON.stringify({ courseId:Number(courseSelect.value), courseLevelId: levelSelect.value ? Number(levelSelect.value) : null, subjectCode:document.getElementById('adminSubjectCode').value.trim(), subjectName:document.getElementById('adminSubjectName').value.trim() }) });
        const result = await response.json();
        if (!response.ok) return admin.showToast(result.message || 'Unable to add subject', 'error');
        admin.showToast(result.message); form.reset(); await load();
    });

    load().catch(error => admin.showToast(error.message, 'error'));
});
