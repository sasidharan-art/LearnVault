document.addEventListener("DOMContentLoaded", async () => {
    const h = window.LearnVaultLearning;
    if (!h) return;

    h.bindLogout();

    const role = document.body.dataset.role;
    const list = document.getElementById("universalNotificationList");
    const filter = document.getElementById("universalNotificationFilter");
    const refresh = document.getElementById("refreshNotifications");
    const markAll = document.getElementById("markAllNotificationsRead");
    const headerSearch = document.getElementById("universalHeaderSearch");

    let notifications = [];
    let announcementOptions = null;

    const icons = {
        announcement: "!",
        assignment: "▤",
        grade: "★",
        resource: "▣",
        quiz: "✓",
        skill: "◎",
        peer: "◉",
        academic: "↟",
        academic_request: "↟",
        submission: "↧",
        quiz_attempt: "↗",
        user: "◇"
    };

    function when(value) {
        if (!value) return "-";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "-";

        return date.toLocaleString(undefined, {
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit"
        });
    }

    function render() {
        const selected = filter.value;

        const rows = notifications.filter((item) => {
            if (selected === "unread") return !item.isRead;
            if (!selected) return true;
            return item.priority === selected;
        });

        const unread = notifications.filter((item) => !item.isRead).length;

        document.getElementById("universalUnreadHero").textContent = unread;
        document.getElementById("universalNotificationCount").textContent =
            `${notifications.length} update${notifications.length === 1 ? "" : "s"} • ${unread} unread`;

        if (!rows.length) {
            list.innerHTML = `
                <div class="commercial-positive-state large">
                    <span>✓</span>
                    <div>
                        <strong>No notifications in this view</strong>
                        <small>Your current updates are under control.</small>
                    </div>
                </div>
            `;
            return;
        }

        list.innerHTML = rows.map((item) => `
            <a
                href="${h.esc(item.url)}"
                class="universal-notification-item ${h.esc(item.priority || "normal")} ${item.isRead ? "read" : "unread"}"
                data-notification-key="${h.esc(item.key)}"
            >
                <span class="universal-notification-icon">
                    ${icons[item.type] || "•"}
                </span>

                <div>
                    <div class="universal-notification-meta">
                        <span>${h.esc(item.type)}</span>
                        <small>${h.esc(item.priority || "normal")}</small>
                        ${item.isRead ? "" : "<b>NEW</b>"}
                    </div>

                    <strong>${h.esc(item.title)}</strong>
                    <p>${h.esc(item.detail || "")}</p>
                    <time>${h.esc(when(item.createdAt))}</time>
                </div>

                <em>${h.esc(item.action || "Open")} →</em>
            </a>
        `).join("");

        list.querySelectorAll(".universal-notification-item.unread")
            .forEach((link) => {
                link.addEventListener("click", async () => {
                    try {
                        await h.sendJson(
                            "/api/notifications/read",
                            "POST",
                            { keys: [link.dataset.notificationKey] }
                        );
                    } catch (_) {}
                });
            });
    }

    async function load() {
        refresh.disabled = true;
        refresh.textContent = "Refreshing...";

        try {
            const response = await fetch(
                "/api/notifications",
                { credentials: "same-origin" }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Unable to load notifications");
            }

            notifications = data.notifications || [];
            render();
        } catch (error) {
            h.toast(error.message, "error");
            list.innerHTML = `
                <div class="integration-empty">${h.esc(error.message)}</div>
            `;
        } finally {
            refresh.disabled = false;
            refresh.textContent = "Refresh";
        }
    }

    filter.addEventListener("change", render);
    refresh.addEventListener("click", load);

    markAll.addEventListener("click", async () => {
        try {
            await h.sendJson(
                "/api/notifications/read-all",
                "POST",
                {}
            );

            notifications = notifications.map((item) => ({
                ...item,
                isRead: true
            }));

            render();
            h.toast("All notifications marked as read.");
        } catch (error) {
            h.toast(error.message, "error");
        }
    });

    headerSearch.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && headerSearch.value.trim()) {
            window.location.href =
                `search.html?q=${encodeURIComponent(headerSearch.value.trim())}`;
        }
    });

    const composer = document.getElementById("announcementComposerPanel");
    const announcementForm = document.getElementById("announcementForm");

    function fillSelect(select, rows, valueKey, textBuilder, placeholder) {
        select.innerHTML =
            `<option value="">${placeholder}</option>` +
            rows.map((row) => `
                <option value="${h.esc(row[valueKey])}">
                    ${textBuilder(row)}
                </option>
            `).join("");
    }

    function updateAdminLevels() {
        if (role !== "admin" || !announcementOptions) return;

        const courseId = Number(
            document.getElementById("announcementCourse").value || 0
        );

        const levels = (announcementOptions.levels || [])
            .filter((item) => Number(item.course_id) === courseId);

        fillSelect(
            document.getElementById("announcementLevel"),
            levels,
            "id",
            (item) => h.esc(item.level_name),
            "Select Level / Year"
        );
    }

    function updateAudience() {
        if (role !== "admin") return;

        const type = document.getElementById("announcementTargetType").value;

        [
            "announcementRoleRow",
            "announcementCourseRow",
            "announcementLevelRow",
            "announcementSubjectRow"
        ].forEach((id) => {
            document.getElementById(id).hidden = true;
        });

        if (type === "role") {
            document.getElementById("announcementRoleRow").hidden = false;
        }

        if (type === "course") {
            document.getElementById("announcementCourseRow").hidden = false;
        }

        if (type === "level") {
            document.getElementById("announcementCourseRow").hidden = false;
            document.getElementById("announcementLevelRow").hidden = false;
            updateAdminLevels();
        }

        if (type === "subject") {
            document.getElementById("announcementSubjectRow").hidden = false;
        }
    }

    async function setupComposer() {
        if (!["faculty", "admin"].includes(role)) return;

        const response = await fetch(
            "/api/notifications/announcement-options",
            { credentials: "same-origin" }
        );

        const data = await response.json();

        if (!response.ok) return;

        announcementOptions = data;
        composer.hidden = false;

        if (role === "faculty") {
            document.getElementById("announcementComposerDescription").textContent =
                "Publish an announcement to Students in one of your assigned Subjects.";

            document.getElementById("facultyAnnouncementAudience").hidden = false;

            fillSelect(
                document.getElementById("facultyAnnouncementSubject"),
                data.subjects || [],
                "id",
                (item) =>
                    `${h.esc(item.subject_code)} — ${h.esc(item.subject_name)}`,
                "Select Assigned Subject"
            );
        } else {
            document.getElementById("announcementComposerDescription").textContent =
                "Publish system-wide, role, Course, Level or Subject announcements.";

            document.getElementById("adminAnnouncementAudience").hidden = false;

            fillSelect(
                document.getElementById("announcementCourse"),
                data.courses || [],
                "id",
                (item) =>
                    `${h.esc(item.course_name)}${item.course_code ? " — " + h.esc(item.course_code) : ""}`,
                "Select Course"
            );

            fillSelect(
                document.getElementById("announcementSubject"),
                data.subjects || [],
                "id",
                (item) =>
                    `${h.esc(item.course_name)} • ${h.esc(item.subject_code)} — ${h.esc(item.subject_name)}`,
                "Select Subject"
            );

            document.getElementById("announcementTargetType")
                .addEventListener("change", updateAudience);

            document.getElementById("announcementCourse")
                .addEventListener("change", updateAdminLevels);

            updateAudience();
        }
    }

    announcementForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!["faculty", "admin"].includes(role)) return;

        const payload = {
            title: document.getElementById("announcementTitle").value.trim(),
            body: document.getElementById("announcementBody").value.trim(),
            priority: document.getElementById("announcementPriority").value,
            expiresAt:
                document.getElementById("announcementExpiresAt").value || null
        };

        if (role === "faculty") {
            payload.targetType = "subject";
            payload.subjectId = Number(
                document.getElementById("facultyAnnouncementSubject").value
            );
        } else {
            payload.targetType =
                document.getElementById("announcementTargetType").value;

            payload.targetRole =
                document.getElementById("announcementTargetRole").value;

            payload.courseId =
                Number(document.getElementById("announcementCourse").value || 0) ||
                null;

            payload.courseLevelId =
                Number(document.getElementById("announcementLevel").value || 0) ||
                null;

            payload.subjectId =
                Number(document.getElementById("announcementSubject").value || 0) ||
                null;
        }

        const button = announcementForm.querySelector('button[type="submit"]');
        const old = button.textContent;

        try {
            button.disabled = true;
            button.textContent = "Publishing...";

            await h.sendJson(
                "/api/notifications/announcements",
                "POST",
                payload
            );

            announcementForm.reset();

            if (role === "admin") updateAudience();

            h.toast("Announcement published.");
            await load();
        } catch (error) {
            h.toast(error.message, "error");
        } finally {
            button.disabled = false;
            button.textContent = old;
        }
    });

    try {
        const user = await h.requireRole(role);
        if (!user) return;

        document.getElementById("notificationRoleDescription").textContent =
            role === "student"
                ? "Deadlines, grades, Resources, Quizzes, Skills, academic progression and Peer Learning updates."
                : role === "faculty"
                    ? "Student submissions, Quiz attempts, Subject access, Peer Learning and announcements."
                    : "Student requests, users, learning content, grading workload, moderation and platform announcements.";

        await Promise.all([
            load(),
            setupComposer()
        ]);
    } catch (error) {
        h.toast(error.message, "error");
    }
});
