document.addEventListener("DOMContentLoaded", () => {
    const admin = window.LearnVaultAdmin;
    const form = document.getElementById("adminResourceUploadForm");
    if (!admin || !form) return;
    const subject = document.getElementById("adminUploadSubject");
    const type = document.getElementById("adminUploadType");
    const button = document.getElementById("adminUploadResourceButton");
    const esc = v => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');

    async function loadMeta() {
        const response = await fetch('/api/content/meta', { credentials:'same-origin' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Unable to load upload options');
        subject.innerHTML = '<option value="">Select Subject</option>' + (result.subjects||[]).map(s => `<option value="${s.id}">${esc(s.subject_code)} — ${esc(s.subject_name)} • ${esc(s.course_name)}${s.level_name ? ' • '+esc(s.level_name) : ''}</option>`).join('');
        type.innerHTML = '<option value="">Select Resource Type</option>' + (result.resourceTypes||[]).map(t => `<option value="${t.id}">${esc(t.type_name)}</option>`).join('');
    }

    form.addEventListener('submit', async e => {
        e.preventDefault();
        try {
            button.disabled = true; button.textContent = 'Saving...';
            const response = await fetch('/api/content/resources', { method:'POST', credentials:'same-origin', body:new FormData(form) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Unable to add resource');
            admin.showToast(result.message); form.reset(); await loadMeta();
            document.getElementById('refreshResources')?.click();
        } catch (error) { admin.showToast(error.message, 'error'); }
        finally { button.disabled = false; button.textContent = 'Add Resource'; }
    });

    loadMeta().catch(error => admin.showToast(error.message, 'error'));
});
