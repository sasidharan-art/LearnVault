document.addEventListener("DOMContentLoaded", async () => {
    const h = window.LearnVaultLearning;
    if (!h) return;
    h.bindLogout();

    const container = document.getElementById("studyHubRecommendations");
    const refresh = document.getElementById("refreshStudyHub");
    const search = document.getElementById("studentFeatureSearch");
    const icons = { assignment:"▤", quiz:"✓", skill:"◎", resource:"▣", peer:"◉" };

    function render(data) {
        const items = data.recommendations || [];
        document.getElementById("studyHubCount").textContent = items.length ? `${items.length} recommended next steps` : "You are caught up";
        document.getElementById("studyHubCourse").textContent = `${data.profile?.course_name || "Your Course"}${data.profile?.level_name ? " • " + data.profile.level_name : ""}`;
        document.getElementById("studyHubHighPriority").textContent = items.filter((x) => Number(x.priority) >= 85).length;
        document.getElementById("studyHubLearningItems").textContent = items.filter((x) => ["resource","skill"].includes(x.type)).length;
        document.getElementById("studyHubSubjects").textContent = (data.subjects || []).length;
        document.getElementById("studyHubPeerItems").textContent = items.filter((x) => x.type === "peer").length;

        if (!items.length) {
            container.innerHTML = '<div class="commercial-positive-state large"><span>✓</span><div><strong>You are caught up</strong><small>Explore Resources, practise Questions or join a Peer Group to continue learning.</small></div></div>';
            return;
        }

        container.innerHTML = items.map((item) => `
            <a class="recommendation-card priority-${Number(item.priority)>=85?"high":Number(item.priority)>=65?"medium":"normal"}" href="${h.esc(item.url)}">
                <span class="recommendation-icon">${icons[item.type] || "•"}</span>
                <div class="recommendation-copy">
                    <div class="recommendation-meta"><span>${h.esc(item.type)}</span><small>${h.esc(item.subjectCode || "")}</small></div>
                    <h3>${h.esc(item.title)}</h3><p>${h.esc(item.subjectName || "")}</p><small>${h.esc(item.detail || "")}</small>
                </div>
                <strong class="recommendation-action">${h.esc(item.action || "Open")} →</strong>
            </a>
        `).join("");
    }

    async function load() {
        refresh.disabled = true;
        refresh.textContent = "Refreshing...";
        try {
            const response = await fetch("/api/student-experience/recommendations", { credentials:"same-origin" });
            const data = await response.json();
            if (response.status === 409 && data.code === "STUDENT_PROFILE_REQUIRED") {
                location.replace("setup-profile.html");
                return;
            }
            if (!response.ok) throw new Error(data.message || "Unable to load recommendations");
            render(data);
        } catch (error) {
            h.toast(error.message, "error");
            container.innerHTML = `<div class="integration-empty">${h.esc(error.message)}</div>`;
        } finally {
            refresh.disabled = false;
            refresh.textContent = "Refresh";
        }
    }

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
