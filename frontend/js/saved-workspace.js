document.addEventListener("DOMContentLoaded", async () => {
    const h = window.LearnVaultLearning;
    if (!h) return;

    h.bindLogout();

    const role = String(document.body.dataset.role || "").toLowerCase();
    const pinnedHost = document.getElementById("lvPinnedWorkspace");
    const recentHost = document.getElementById("lvRecentWorkspace");
    const countHost = document.getElementById("lvSavedCount");
    const search = document.getElementById("universalHeaderSearch");

    const pinKey = `learnvault_pinned_${role}`;
    const recentKey = `learnvault_recent_${role}`;

    function esc(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function read(key, limit = 20) {
        try {
            return JSON.parse(localStorage.getItem(key) || "[]")
                .filter((item) => item && item.href && item.label)
                .slice(0, limit);
        } catch (_) {
            return [];
        }
    }

    function iconFor(href) {
        const icons = {
            "dashboard.html":"⌂","study-hub.html":"★","focus-center.html":"◴",
            "teaching-center.html":"◴","operations-center.html":"◴","search.html":"⌕",
            "resources.html":"▣","questions.html":"?","quizzes.html":"✓",
            "assignments.html":"▤","calendar.html":"▦","notifications.html":"◔",
            "progress.html":"↗","skills.html":"◎","peer-groups.html":"◉",
            "academic-progress.html":"↟","student-advancement.html":"↟",
            "academic.html":"▥","users.html":"◇","reports.html":"▦",
            "approvals.html":"◈","profile.html":"◌"
        };
        return icons[href] || "LV";
    }

    function card(item, removable) {
        return `
            <article class="lv-saved-card">
                <span>${esc(iconFor(item.href))}</span>
                <div><strong>${esc(item.label)}</strong><small>${removable ? "Pinned LearnVault module" : "Recently visited module"}</small></div>
                <div class="lv-saved-card-actions">
                    <a href="${esc(item.href)}">Open</a>
                    ${removable ? `<button type="button" data-unpin="${esc(item.href)}">Unpin</button>` : ""}
                </div>
            </article>
        `;
    }

    function render() {
        const pins = read(pinKey, 12);
        const recent = read(recentKey, 8).filter((item) => item.href !== "saved.html");

        countHost.textContent = pins.length;

        pinnedHost.innerHTML = pins.length
            ? pins.map((item) => card(item, true)).join("")
            : `<div class="integration-empty">Nothing pinned yet. Open any LearnVault page and click the ☆ button in the header.</div>`;

        recentHost.innerHTML = recent.length
            ? recent.map((item) => card(item, false)).join("")
            : `<div class="integration-empty">Recently visited LearnVault modules will appear here.</div>`;

        pinnedHost.querySelectorAll("button[data-unpin]").forEach((button) => {
            button.addEventListener("click", () => {
                const next = read(pinKey, 12).filter((item) => item.href !== button.dataset.unpin);
                localStorage.setItem(pinKey, JSON.stringify(next));
                render();
            });
        });
    }

    search.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && search.value.trim()) {
            window.location.href = `search.html?q=${encodeURIComponent(search.value.trim())}`;
        }
    });

    try {
        const user = await h.requireRole(role);
        if (!user) return;
        render();
    } catch (error) {
        h.toast(error.message, "error");
    }
});
