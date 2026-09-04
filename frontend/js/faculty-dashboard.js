document.addEventListener("DOMContentLoaded", async () => {
    const app = window.LearnVaultFaculty;
    if (!app) return;
    const user = await app.requireFaculty();
    if (!user) return;

    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value ?? "-"; };
    setText("facultyAccountName", user.fullName);
    setText("facultyUsername", user.username);
    setText("facultyUserId", user.id);
    setText("facultyEmail", user.email);
    setText("facultyStatus", user.status);

    try {
        const response = await fetch("/api/faculty/dashboard", { credentials: "same-origin" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Unable to load faculty dashboard");
        const data = result.dashboard || {};
        setText("facultyAssignmentCount", data.assignmentCount || 0);
        setText("facultyTotalUploads", data.totalUploads || 0);
        setText("facultyApprovedUploads", data.publishedUploads || data.approvedUploads || 0);
        setText("facultyHiddenUploads", data.hiddenUploads || data.rejectedUploads || 0);

        const grid = document.getElementById("facultySubjectGrid");
        const subjects = Array.isArray(data.assignments) ? data.assignments : [];
        if (!subjects.length) {
            grid.innerHTML = '<div class="admin-empty-state large">No subjects assigned yet. Ask LearnVault Admin to assign your teaching subjects.</div>';
            return;
        }
        grid.innerHTML = subjects.map(s => `
            <article class="faculty-subject-card">
                <span>${escapeHtml(s.subject_code)}</span>
                <strong>${escapeHtml(s.subject_name)}</strong>
                <p>${escapeHtml(s.course_name)}${s.level_name ? ' • ' + escapeHtml(s.level_name) : ''}</p>
                <small>${escapeHtml(s.domain_name || 'General')}${s.department_name ? ' • ' + escapeHtml(s.department_name) : ''}</small>
            </article>
        `).join('');
    } catch (error) {
        app.showToast(error.message, "error");
    }

    function escapeHtml(v) { return String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
});
