document.addEventListener("DOMContentLoaded", async () => {
    const role = document.body.dataset.commercialRole ||
        (location.pathname.includes("/faculty/") ? "faculty" : location.pathname.includes("/admin/") ? "admin" : "student");
    const $ = (id) => document.getElementById(id);
    const esc = (v) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    const pageLabel = (v) => String(v || "").split("/").pop().replace(/\.html$/i, "").replaceAll("-", " ").replace(/\b\w/g, x => x.toUpperCase()) || "Learning workspace";
    const time = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit", second:"2-digit"}); };
    const ago = (v) => { const d = new Date(v), sec = Math.max(0, Math.floor((Date.now()-d.getTime())/1000)); return sec < 60 ? `${sec}s ago` : `${Math.floor(sec/60)}m ago`; };
    const pct = (v) => `${Number(v || 0).toFixed(0)}%`;

    function setConnection(text, live = true) {
        $("liveConnectionState").textContent = text;
        $("liveConnectionState").classList.toggle("is-live", live);
    }

    function renderPages(data) {
        const box = $("liveActivePages");
        const pages = data.activePages || [];
        if (!pages.length) { box.innerHTML = `<div class="lv-live-empty">No active page signal yet.</div>`; return; }
        const max = Math.max(1, ...pages.map(x => Number(x.count || 0)));
        box.innerHTML = pages.map(x => `<div class="lv-live-page-row"><div class="lv-live-page-label"><strong>${esc(pageLabel(x.page))}</strong><span>${x.count} online</span></div><div class="lv-live-bar"><span style="width:${Math.max(8, Number(x.count||0)/max*100)}%"></span></div></div>`).join("");
    }

    function renderEvents(data) {
        const box = $("liveEventStream");
        const events = data.recentEvents || [];
        if (!events.length) { box.innerHTML = `<div class="lv-live-empty">Waiting for the first live learning event.</div>`; return; }
        box.innerHTML = events.slice(0, 12).map(x => `<div class="lv-live-event"><span class="lv-live-event-icon">${x.type === "page_view" ? "↗" : "•"}</span><div><strong>${esc(x.userName)}</strong><span>${esc(x.type.replaceAll("_", " "))} · ${esc(pageLabel(x.page))}</span></div><time>${esc(ago(x.createdAt))}</time></div>`).join("");
    }

    function renderRisk(data) {
        const box = $("liveRiskList");
        if (role === "student") {
            const p = data.personal || {};
            const risk = p.averageScore > 0 && p.averageScore < 50;
            $("liveRiskTitle").textContent = risk ? "Your current risk signal" : "Your learning health";
            $("liveRiskDescription").textContent = risk ? "Your current assessment average is below 50%. Use the recommended practice path before the next assessment." : "Live signals show whether your current learning pace needs attention.";
            box.innerHTML = `<article class="lv-live-risk-card ${risk ? "danger" : "good"}"><strong>${risk ? "Attention recommended" : "On track"}</strong><span>Average score: ${pct(p.averageScore)} · Attempts: ${p.attempts || 0} · Due soon: ${p.dueSoon || 0}</span><a href="progress.html">Open Progress →</a></article>`;
            return;
        }
        const source = role === "faculty" ? data.faculty : data.admin;
        const count = Number(source?.atRiskLearners || 0);
        const learners = source?.riskLearners || [];
        if (!count) {
            box.innerHTML = `<article class="lv-live-risk-card good"><strong>No high-risk learners detected</strong><span>Risk signal uses stored assessment performance and current learning activity.</span><a href="progress.html">Open Analytics →</a></article>`;
            return;
        }
        box.innerHTML = learners.map(x => `<article class="lv-live-risk-card danger"><div><strong>${esc(x.name)}</strong><span>Average score ${pct(x.averageScore)} · ${x.attempts} attempts</span></div><a href="progress.html">Review →</a></article>`).join("");
    }

    function renderRole(data) {
        const box = $("liveRoleMetrics");
        if (role === "student") {
            const p = data.personal || {};
            $("liveRoleTitle").textContent = "Your live learning pulse";
            box.innerHTML = [
                ["Current session", `${p.sessionMinutes || 0} min`],
                ["Events today", p.eventsToday || 0],
                ["Quizzes today", p.quizzesToday || 0],
                ["Assignments submitted", p.submissionsToday || 0],
                ["Average quiz score", pct(p.averageScore)],
                ["Assignments due soon", p.dueSoon || 0]
            ].map(x => `<div><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join("");
            $("liveOnlineMeta").textContent = `${p.online ? "You are online" : "Your session is idle"} · ${data.onlineByRole?.student || 0} students online`;
        } else if (role === "faculty") {
            const f = data.faculty || {};
            $("liveRoleTitle").textContent = "Teaching intervention pulse";
            box.innerHTML = [
                ["Assigned subjects", f.assignedSubjects || 0],
                ["Learners reached", f.learners || 0],
                ["Average score", pct(f.averageScore)],
                ["Quiz attempts today", f.attemptsToday || 0],
                ["Submissions today", f.submissionsToday || 0],
                ["At-risk learners", f.atRiskLearners || 0]
            ].map(x => `<div><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join("");
            $("liveOnlineMeta").textContent = `${data.onlineByRole?.student || 0} students · ${data.onlineByRole?.faculty || 0} faculty online`;
        } else {
            const a = data.admin || {};
            $("liveRoleTitle").textContent = "Platform control pulse";
            box.innerHTML = [
                ["Active users", a.activeUsers || 0],
                ["Students online", data.onlineByRole?.student || 0],
                ["Faculty online", data.onlineByRole?.faculty || 0],
                ["At-risk learners", a.atRiskLearners || 0],
                ["Approved resources", a.approvedResources || 0],
                ["Published quizzes", a.publishedQuizzes || 0]
            ].map(x => `<div><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join("");
            $("liveOnlineMeta").textContent = `${data.onlineByRole?.student || 0} students · ${data.onlineByRole?.faculty || 0} faculty · ${data.onlineByRole?.admin || 0} admins online`;
        }
    }

    function render(data) {
        $("liveOnlineNow").textContent = data.onlineNow || 0;
        $("liveEvents15m").textContent = data.eventsLast15m || 0;
        $("liveQuizzesToday").textContent = data.quizzesToday || 0;
        $("liveSubmissionsToday").textContent = data.submissionsToday || 0;
        $("liveLastUpdated").textContent = time(data.generatedAt);
        renderRole(data); renderPages(data); renderRisk(data); renderEvents(data);
    }

    try {
        const first = await fetch("/api/live/snapshot", { credentials: "same-origin" });
        const initial = await first.json();
        if (first.status === 401) { location.href = "../login.html"; return; }
        if (!first.ok) throw new Error(initial.message || "Unable to load live analytics");
        render(initial.data);
        setConnection("Live stream connected", true);

        const source = new EventSource("/api/live/stream");
        source.addEventListener("snapshot", (event) => {
            try { render(JSON.parse(event.data)); setConnection("Live stream connected", true); } catch (_) {}
        });
        source.onerror = () => setConnection("Reconnecting live stream...", false);
        window.addEventListener("beforeunload", () => source.close(), { once: true });
    } catch (error) {
        setConnection("Live stream unavailable", false);
        if (window.LearnVaultLearning?.toast) window.LearnVaultLearning.toast(error.message, "error");
    }
});
