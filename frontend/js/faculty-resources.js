document.addEventListener("DOMContentLoaded", async () => {
    const app = window.LearnVaultFaculty;
    if (!app) return;
    const user = await app.requireFaculty();
    if (!user) return;

    const form = document.getElementById("facultyResourceForm");
    const subjectSelect = document.getElementById("facultySubjectSelect");
    const typeSelect = document.getElementById("facultyResourceTypeSelect");
    const list = document.getElementById("facultyResourceList");
    const editSection = document.getElementById("editResourceSection");
    const editForm = document.getElementById("facultyEditResourceForm");
    let resources = [];

    const escapeHtml = v => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

    async function loadMeta() {
        const response = await fetch("/api/content/meta", { credentials: "same-origin" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Unable to load upload options");
        const subjects = result.subjects || [];
        const types = result.resourceTypes || [];
        subjectSelect.innerHTML = '<option value="">Select Assigned Subject</option>' + subjects.map(s => `<option value="${s.id}">${escapeHtml(s.subject_code)} — ${escapeHtml(s.subject_name)} • ${escapeHtml(s.course_name)}${s.level_name ? ' • ' + escapeHtml(s.level_name) : ''}</option>`).join('');
        typeSelect.innerHTML = '<option value="">Select Resource Type</option>' + types.map(t => `<option value="${t.id}">${escapeHtml(t.type_name)}</option>`).join('');
        if (!subjects.length) {
            subjectSelect.innerHTML = '<option value="">No subjects assigned by Admin</option>';
            subjectSelect.disabled = true;
        }
    }

    async function loadResources() {
        const response = await fetch("/api/content/resources/mine", { credentials: "same-origin" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Unable to load resources");
        resources = Array.isArray(result.resources) ? result.resources : [];
        if (!resources.length) {
            list.innerHTML = '<div class="admin-empty-state large">You have not uploaded any resources yet.</div>';
            return;
        }
        list.innerHTML = resources.map(r => `
            <article class="faculty-resource-card">
                <div class="faculty-resource-head"><div><span class="mini-label">${escapeHtml(r.resource_type || 'RESOURCE')}</span><h3>${escapeHtml(r.title)}</h3><p>${escapeHtml(r.subject_code)} ${escapeHtml(r.subject_name)} • ${escapeHtml(r.course_name)}${r.level_name ? ' • ' + escapeHtml(r.level_name) : ''}</p></div><span class="status-pill ${escapeHtml(r.verification_status)}">${
                    r.verification_status === "approved"
                        ? "Published"
                        : r.verification_status === "rejected"
                            ? "Hidden"
                            : "Legacy Pending"
                }</span></div>
                <p class="faculty-resource-description">${escapeHtml(r.description || 'No description')}</p>
                <div class="faculty-resource-actions">
                    <button class="button button-soft" type="button" data-edit-id="${r.id}">Edit Details</button>
                    <button
                        class="table-action-button"
                        type="button"
                        data-publication-id="${r.id}"
                        data-publication-next="${r.verification_status === "approved" ? "0" : "1"}"
                    >
                        ${r.verification_status === "approved" ? "Unpublish" : "Publish"}
                    </button>
                    <button class="table-action-button reject" type="button" data-delete-id="${r.id}">Delete</button>
                </div>
            </article>
        `).join('');

        list.querySelectorAll('[data-edit-id]').forEach(
            btn => btn.addEventListener('click', () => openEdit(Number(btn.dataset.editId)))
        );

        list.querySelectorAll('[data-publication-id]').forEach(
            btn => btn.addEventListener(
                'click',
                () => setResourcePublication(
                    Number(btn.dataset.publicationId),
                    btn.dataset.publicationNext === "1"
                )
            )
        );

        list.querySelectorAll('[data-delete-id]').forEach(
            btn => btn.addEventListener('click', () => deleteResource(Number(btn.dataset.deleteId)))
        );
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();
        const button = document.getElementById("facultyUploadButton");
        try {
            button.disabled = true; button.textContent = "Uploading...";
            const response = await fetch("/api/content/resources", { method: "POST", credentials: "same-origin", body: new FormData(form) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || "Upload failed");
            app.showToast(result.message);
            form.reset();
            await loadResources();
        } catch (error) { app.showToast(error.message, "error"); }
        finally { button.disabled = false; button.textContent = "Publish Resource"; }
    });

    function openEdit(id) {
        const r = resources.find(item => Number(item.id) === id);
        if (!r) return;
        document.getElementById("editResourceId").value = r.id;
        document.getElementById("editResourceTitle").value = r.title || '';
        document.getElementById("editResourceDescription").value = r.description || '';
        document.getElementById("editResourceUrl").value = r.external_url || '';
        editSection.hidden = false;
        editSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    document.getElementById("cancelEditResource").addEventListener("click", () => { editSection.hidden = true; });

    editForm.addEventListener("submit", async event => {
        event.preventDefault();
        const id = document.getElementById("editResourceId").value;
        try {
            const response = await fetch(`/api/content/resources/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({
                    title: document.getElementById("editResourceTitle").value.trim(),
                    description: document.getElementById("editResourceDescription").value.trim(),
                    externalUrl: document.getElementById("editResourceUrl").value.trim()
                })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || "Update failed");
            app.showToast(result.message);
            editSection.hidden = true;
            await loadResources();
        } catch (error) { app.showToast(error.message, "error"); }
    });


    async function setResourcePublication(id, isPublished) {
        try {
            const response = await fetch(
                `/api/content/resources/${encodeURIComponent(id)}/publication`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    credentials: "same-origin",
                    body: JSON.stringify({ isPublished })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message ||
                    "Unable to update resource publication"
                );
            }

            app.showToast(result.message);
            await loadResources();

        } catch (error) {
            app.showToast(error.message, "error");
        }
    }

    async function deleteResource(id) {
        if (!window.confirm("Delete this resource?")) return;
        try {
            const response = await fetch(`/api/content/resources/${id}`, { method: "DELETE", credentials: "same-origin" });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || "Delete failed");
            app.showToast(result.message);
            await loadResources();
        } catch (error) { app.showToast(error.message, "error"); }
    }

    try { await loadMeta(); await loadResources(); }
    catch (error) { app.showToast(error.message, "error"); }
});
