document.addEventListener("DOMContentLoaded", async () => {
    const role = String(document.body.dataset.role || "").toLowerCase();
    if (!["student", "faculty", "admin"].includes(role)) return;

    let user = null;
    let timerSeconds = 25 * 60;
    let timerRunning = false;
    let timerHandle = null;
    let timerMode = "focus";

    const roleConfig = {
        student: {
            taskHeading: "Study priorities",
            taskDescription: "Add revision, Quiz, Assignment or Skill goals for today.",
            taskPlaceholder: "Example: Revise DBMS normalization...",
            quickHeading: "Continue learning",
            notesHeading: "Revision notes",
            focusHeading: "25-minute study sprint",
            actions: [
                ["★","Study Hub","study-hub.html","Recommended next learning"],
                ["▣","Resources","resources.html","Notes, files and videos"],
                ["?","Question Bank","questions.html","Practice topic-wise"],
                ["✓","Quizzes","quizzes.html","Assess understanding"],
                ["▤","Assignments","assignments.html","Deadlines and feedback"],
                ["↗","Progress","progress.html","Weak areas and mastery"],
                ["◎","Skills","skills.html","Build measurable skills"],
                ["▦","Calendar","calendar.html","Plan upcoming work"]
            ]
        },
        faculty: {
            taskHeading: "Teaching priorities",
            taskDescription: "Plan class preparation, grading, Questions, Quizzes and Student support.",
            taskPlaceholder: "Example: Grade DBMS Assignment 2...",
            quickHeading: "Teaching tools",
            notesHeading: "Class & teaching notes",
            focusHeading: "25-minute teaching sprint",
            actions: [
                ["▣","Resources","resources.html","Publish learning material"],
                ["?","Question Bank","questions.html","Create practice questions"],
                ["✓","Quizzes","quizzes.html","Build assessments"],
                ["▤","Assignments","assignments.html","Create and grade work"],
                ["↗","Progress","progress.html","Review Student analytics"],
                ["◉","Peer Groups","peer-groups.html","Guide discussions"],
                ["◔","Notifications","notifications.html","Submissions and updates"],
                ["▦","Calendar","calendar.html","Teaching timeline"]
            ]
        },
        admin: {
            taskHeading: "Platform priorities",
            taskDescription: "Track moderation, Student advancement, Faculty access, reports and academic operations.",
            taskPlaceholder: "Example: Review Student promotion requests...",
            quickHeading: "Admin controls",
            notesHeading: "Operations notes",
            focusHeading: "25-minute admin focus block",
            actions: [
                ["◇","Users & Faculty","users.html","Accounts and Faculty access"],
                ["↟","Student Advancement","student-advancement.html","Promotions and history"],
                ["▥","Academic Structure","academic.html","Courses, Levels and Subjects"],
                ["▣","Resources","resources.html","Resource oversight"],
                ["◈","Oversight","approvals.html","Content monitoring"],
                ["◉","Peer Groups","peer-groups.html","Moderation"],
                ["▦","Reports","reports.html","Analytics and database health"],
                ["◔","Notifications","notifications.html","System updates"]
            ]
        }
    }[role];

    function esc(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function toast(message, type = "success") {
        const el = document.getElementById("toast");
        if (!el) return;
        el.textContent = message;
        el.className = `toast show ${type}`;
        window.setTimeout(() => el.classList.remove("show"), 2200);
    }

    async function getMe() {
        const response = await fetch("/api/auth/me", { credentials: "same-origin" });
        if (response.status === 401) {
            window.location.replace("../login.html");
            return null;
        }
        const data = await response.json();
        if (!response.ok || !data.user) throw new Error(data.message || "Unable to load account");
        if (String(data.user.role || "").toLowerCase() !== role) {
            window.location.replace("../login.html");
            return null;
        }
        return data.user;
    }

    function storageKey(name) {
        return `learnvault_${role}_${user?.id || "account"}_${name}`;
    }

    function todayKey() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    }

    function loadTasks() {
        try { return JSON.parse(localStorage.getItem(storageKey("productivity_tasks")) || "[]"); }
        catch (_) { return []; }
    }

    function saveTasks(tasks) {
        localStorage.setItem(storageKey("productivity_tasks"), JSON.stringify(tasks.slice(0, 60)));
    }

    function renderTasks() {
        const tasks = loadTasks();
        const list = document.getElementById("lvTaskList");
        const open = tasks.filter(item => !item.done).length;
        const completedToday = tasks.filter(item => item.done && item.completedOn === todayKey()).length;

        document.getElementById("lvOpenTaskCount").textContent = open;
        document.getElementById("lvCompletedTaskCount").textContent = completedToday;

        if (!tasks.length) {
            list.innerHTML = `<div class="integration-empty">No priorities yet. Add the most important thing you want to complete today.</div>`;
            return;
        }

        list.innerHTML = tasks.map((item, index) => `
            <article class="lv-task-item lv-priority-${esc(item.priority || "normal")} ${item.done ? "done" : ""}">
                <button type="button" class="lv-task-check" data-action="toggle" data-index="${index}" aria-label="${item.done ? "Mark incomplete" : "Mark complete"}">${item.done ? "✓" : ""}</button>
                <div><strong>${esc(item.text)}</strong><small>${esc(item.priority === "high" ? "Urgent" : item.priority === "medium" ? "Important" : "Normal")} • ${esc(item.createdLabel || "Today")}</small></div>
                <button type="button" class="lv-task-delete" data-action="delete" data-index="${index}" aria-label="Delete priority">×</button>
            </article>
        `).join("");

        list.querySelectorAll("button[data-action]").forEach(button => {
            button.addEventListener("click", () => {
                const items = loadTasks();
                const index = Number(button.dataset.index);
                if (!items[index]) return;
                if (button.dataset.action === "delete") items.splice(index, 1);
                else {
                    items[index].done = !items[index].done;
                    items[index].completedOn = items[index].done ? todayKey() : null;
                }
                saveTasks(items);
                renderTasks();
            });
        });
    }

    function renderQuickActions() {
        document.getElementById("lvQuickActions").innerHTML = roleConfig.actions.map(item => `
            <a href="${esc(item[2])}"><span>${esc(item[0])}</span><div><strong>${esc(item[1])}</strong><small>${esc(item[3])}</small></div></a>
        `).join("");
    }

    function getSessions() {
        try { return JSON.parse(localStorage.getItem(storageKey("focus_sessions")) || "[]"); }
        catch (_) { return []; }
    }

    function renderSessions() {
        const today = todayKey();
        const count = getSessions().filter(item => item.date === today).length;
        document.getElementById("lvFocusSessionCount").textContent = count;
    }

    function updateTimer() {
        const minutes = Math.floor(timerSeconds / 60);
        const seconds = timerSeconds % 60;
        document.getElementById("lvTimerDisplay").textContent = `${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`;
        document.getElementById("lvTimerMode").textContent = timerMode === "focus" ? "Focus" : "Break";
        document.getElementById("lvTimerStart").textContent = timerRunning ? "Pause" : "Start";
    }

    function finishTimer() {
        timerRunning = false;
        if (timerHandle) window.clearInterval(timerHandle);
        timerHandle = null;
        if (timerMode === "focus") {
            const sessions = getSessions();
            sessions.push({ date: todayKey(), completedAt: Date.now() });
            localStorage.setItem(storageKey("focus_sessions"), JSON.stringify(sessions.slice(-120)));
            renderSessions();
            toast("Focus session completed.");
        } else {
            toast("Break completed.");
        }
        timerMode = timerMode === "focus" ? "break" : "focus";
        timerSeconds = timerMode === "focus" ? 25 * 60 : 5 * 60;
        updateTimer();
    }

    function toggleTimer() {
        if (timerRunning) {
            timerRunning = false;
            if (timerHandle) window.clearInterval(timerHandle);
            timerHandle = null;
            updateTimer();
            return;
        }
        timerRunning = true;
        timerHandle = window.setInterval(() => {
            timerSeconds -= 1;
            if (timerSeconds <= 0) finishTimer();
            else updateTimer();
        }, 1000);
        updateTimer();
    }

    function setMode(mode) {
        timerRunning = false;
        if (timerHandle) window.clearInterval(timerHandle);
        timerHandle = null;
        timerMode = mode;
        timerSeconds = mode === "focus" ? 25 * 60 : 5 * 60;
        updateTimer();
    }

    async function loadSignals() {
        const signals = [];
        let unread = 0;
        try {
            const response = await fetch("/api/notifications/unread-count", { credentials: "same-origin" });
            if (response.ok) {
                const data = await response.json();
                unread = Number(data.unreadCount || 0);
            }
        } catch (_) {}
        document.getElementById("lvUnreadNotificationCount").textContent = unread;
        signals.push(["Unread notifications", unread]);

        if (role === "admin") {
            try {
                const response = await fetch("/api/academic-progress/admin", { credentials: "same-origin" });
                if (response.ok) {
                    const data = await response.json();
                    const pending = (data.requests || []).filter(item => item.status === "pending").length;
                    signals.push(["Pending progression requests", pending]);
                }
            } catch (_) {}
            try {
                const response = await fetch("/api/integration/admin/system-check", { credentials: "same-origin" });
                if (response.ok) {
                    const data = await response.json();
                    const total = Number(data.totalTables || data.requiredCount || 0);
                    const ready = data.success === true || data.databaseReady === true;
                    signals.push(["Database health", ready ? "Ready" : (total ? `${total} tables` : "Check")]);
                }
            } catch (_) {}
        } else if (role === "faculty") {
            signals.push(["Teaching center", "Ready"]);
            signals.push(["Assigned learning tools", "Available"]);
        } else {
            signals.push(["Study plan", `${loadTasks().filter(item => !item.done).length} open`]);
            signals.push(["Focus sessions today", getSessions().filter(item => item.date === todayKey()).length]);
        }

        document.getElementById("lvLiveSignals").innerHTML = signals.map(item => `<div class="lv-live-signal"><span>${esc(item[0])}</span><strong>${esc(item[1])}</strong></div>`).join("");
    }

    function setupNotes() {
        const note = document.getElementById("lvQuickNote");
        const status = document.getElementById("lvNoteStatus");
        note.value = localStorage.getItem(storageKey("quick_note")) || "";
        let saveHandle = null;
        note.addEventListener("input", () => {
            status.textContent = "Saving...";
            if (saveHandle) window.clearTimeout(saveHandle);
            saveHandle = window.setTimeout(() => {
                localStorage.setItem(storageKey("quick_note"), note.value);
                status.textContent = `Saved ${new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}`;
            }, 350);
        });
    }

    function bindSearch() {
        const input = document.getElementById("universalHeaderSearch");
        input?.addEventListener("keydown", event => {
            if (event.key === "Enter" && input.value.trim()) {
                window.location.href = `search.html?q=${encodeURIComponent(input.value.trim())}`;
            }
        });
    }

    function bindLogout() {
        document.getElementById("logoutButton")?.addEventListener("click", async (event) => {
            event.preventDefault();

            try {
                const response = await fetch(
                    "/api/auth/logout",
                    {
                        method: "POST",
                        credentials: "same-origin",
                        headers: {
                            "Accept": "application/json"
                        }
                    }
                );

                if (response.ok) {
                    try {
                        const result = await response.json();

                        window.location.replace(
                            result.redirectTo || "/"
                        );

                        return;
                    } catch (_) {}
                }
            } catch (_) {}

            window.location.replace("/");
        });
    }

    try {
        user = await getMe();
        if (!user) return;

        const headerName = document.querySelector(".student-head-identity strong");
        if (headerName) headerName.textContent = user.fullName || user.full_name || user.username || (role === "admin" ? "Administrator" : role === "faculty" ? "Faculty" : "Student");

        const first = String(user.fullName || user.full_name || user.username || "there").trim().split(/\s+/)[0];
        document.getElementById("lvProductivityGreeting").textContent = `Hi, ${first}`;
        document.getElementById("lvProductivityHeroDetail").textContent = role === "student" ? "Choose one learning priority and finish it before adding more." : role === "faculty" ? "Keep teaching preparation, grading and Student support visible." : "Keep platform operations, moderation and academic changes visible.";

        document.getElementById("lvTaskHeading").textContent = roleConfig.taskHeading;
        document.getElementById("lvTaskDescription").textContent = roleConfig.taskDescription;
        document.getElementById("lvTaskInput").placeholder = roleConfig.taskPlaceholder;
        document.getElementById("lvQuickHeading").textContent = roleConfig.quickHeading;
        document.getElementById("lvNotesHeading").textContent = roleConfig.notesHeading;
        document.getElementById("lvFocusHeading").textContent = roleConfig.focusHeading;

        renderTasks();
        renderQuickActions();
        renderSessions();
        setupNotes();
        bindSearch();
        bindLogout();
        await loadSignals();

        document.getElementById("lvTaskForm").addEventListener("submit", event => {
            event.preventDefault();
            const input = document.getElementById("lvTaskInput");
            const text = input.value.trim();
            if (!text) return;
            const tasks = loadTasks();
            tasks.unshift({ text, priority: document.getElementById("lvTaskPriority").value, done:false, createdAt:Date.now(), createdLabel:"Today" });
            saveTasks(tasks);
            input.value = "";
            renderTasks();
            loadSignals();
        });

        document.getElementById("lvTimerStart").addEventListener("click", toggleTimer);
        document.getElementById("lvTimerModeButton").addEventListener("click", () => setMode(timerMode === "focus" ? "break" : "focus"));
        document.getElementById("lvTimerReset").addEventListener("click", () => setMode(timerMode));
        updateTimer();
    } catch (error) {
        toast(error.message || "Unable to load workspace", "error");
    }
});
