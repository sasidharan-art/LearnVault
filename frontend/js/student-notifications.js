document.addEventListener("DOMContentLoaded", async () => {
    const h = window.LearnVaultLearning;
    if (!h) return;
    h.bindLogout();

    const list = document.getElementById("studentNotificationList");
    const filter = document.getElementById("notificationFilter");
    const refresh = document.getElementById("notificationRefresh");
    const search = document.getElementById("studentFeatureSearch");
    let notifications = [];
    const icons = { assignment:"▤", grade:"★", resource:"▣", quiz:"✓", peer:"◉" };

    function dateText(value) {
        const date = new Date(value);
        if (!value || Number.isNaN(date.getTime())) return "-";
        return date.toLocaleString(undefined, { day:"numeric", month:"short", hour:"numeric", minute:"2-digit" });
    }

    function render() {
        const rows = notifications.filter((item) => !filter.value || item.severity === filter.value);
        document.getElementById("notificationCountHero").textContent = `${notifications.length} notification${notifications.length===1?"":"s"}`;
        if (!rows.length) {
            list.innerHTML = '<div class="commercial-positive-state large"><span>✓</span><div><strong>No notifications in this filter</strong><small>Your academic updates are under control.</small></div></div>';
            return;
        }
        list.innerHTML = rows.map((item) => `
            <a class="student-notification-item ${h.esc(item.severity || "normal")}" href="${h.esc(item.url)}">
                <span class="student-notification-icon">${icons[item.type] || "•"}</span>
                <div><div class="student-notification-meta"><span>${h.esc(item.type)}</span><small>${h.esc(item.severity || "normal")}</small></div><strong>${h.esc(item.title)}</strong><p>${h.esc(item.detail || "")}</p><time>${h.esc(dateText(item.createdAt))}</time></div>
                <b>${h.esc(item.action || "Open")} →</b>
            </a>
        `).join("");
    }

    async function load() {
        refresh.disabled = true;
        refresh.textContent = "Refreshing...";
        try {
            const response = await fetch("/api/student-experience/notifications", { credentials:"same-origin" });
            const data = await response.json();
            if (response.status === 409 && data.code === "STUDENT_PROFILE_REQUIRED") {
                location.replace("setup-profile.html");
                return;
            }
            if (!response.ok) throw new Error(data.message || "Unable to load notifications");
            notifications = data.notifications || [];
            render();
        } catch (error) {
            h.toast(error.message, "error");
            list.innerHTML = `<div class="integration-empty">${h.esc(error.message)}</div>`;
        } finally {
            refresh.disabled = false;
            refresh.textContent = "Refresh";
        }
    }

    filter.addEventListener("change", render);
    refresh.addEventListener("click", load);
    search.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && search.value.trim()) location.href = `search.html?q=${encodeURIComponent(search.value.trim())}`;
    });

    try {
        const user = await h.requireRole("student");
        if (!user) return;
        await load();
    } catch (error) {
        h.toast(error.message, "error");
    }
});
