document.addEventListener("DOMContentLoaded", async () => {
    const h = window.LearnVaultLearning;
    if (!h) return;

    h.bindLogout();

    const role = document.body.dataset.role;
    const agenda = document.getElementById("learningCalendarAgenda");
    const filter = document.getElementById("calendarFilter");
    const refresh = document.getElementById("calendarRefresh");
    const search = document.getElementById("universalHeaderSearch");

    let events = [];

    const icons = {
        assignment: "▤",
        quiz: "✓",
        announcement: "!",
        academic: "↟",
        academic_request: "↟"
    };

    function dateKey(value) {
        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return "Unknown";

        return date.toLocaleDateString(undefined, {
            weekday: "short",
            day: "numeric",
            month: "long",
            year: "numeric"
        });
    }

    function time(value) {
        const date = new Date(value);

        return Number.isNaN(date.getTime())
            ? "-"
            : date.toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit"
            });
    }

    function render() {
        const selected = filter.value;
        const rows = events.filter((item) => !selected || item.type === selected);

        document.getElementById("calendarEventCount").textContent =
            `${events.length} event${events.length === 1 ? "" : "s"}`;

        document.getElementById("calendarAssignments").textContent =
            events.filter((item) => item.type === "assignment").length;

        document.getElementById("calendarQuizzes").textContent =
            events.filter((item) => item.type === "quiz").length;

        document.getElementById("calendarAnnouncements").textContent =
            events.filter((item) => item.type === "announcement").length;

        document.getElementById("calendarAcademic").textContent =
            events.filter((item) =>
                ["academic", "academic_request"].includes(item.type)
            ).length;

        if (!rows.length) {
            agenda.innerHTML = `
                <div class="commercial-positive-state large">
                    <span>✓</span>
                    <div>
                        <strong>No events in this view</strong>
                        <small>Your current calendar is clear.</small>
                    </div>
                </div>
            `;
            return;
        }

        const groups = new Map();

        rows.forEach((item) => {
            const key = dateKey(item.date);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(item);
        });

        agenda.innerHTML = Array.from(groups.entries())
            .map(([date, items]) => `
                <section class="calendar-day-group">
                    <div class="calendar-day-heading">
                        <span>${h.esc(date)}</span>
                        <small>${items.length} event${items.length === 1 ? "" : "s"}</small>
                    </div>

                    <div class="calendar-day-events">
                        ${items.map((item) => `
                            <a href="${h.esc(item.url)}" class="calendar-event-item">
                                <span class="calendar-event-icon">
                                    ${icons[item.type] || "•"}
                                </span>

                                <div>
                                    <small>${h.esc(item.type)}</small>
                                    <strong>${h.esc(item.title)}</strong>
                                    <p>${h.esc(item.detail || "")}</p>
                                </div>

                                <time>${h.esc(time(item.date))}</time>
                            </a>
                        `).join("")}
                    </div>
                </section>
            `).join("");
    }

    async function load() {
        refresh.disabled = true;
        refresh.textContent = "Refreshing...";

        try {
            const response = await fetch(
                "/api/calendar",
                { credentials: "same-origin" }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Unable to load Learning Calendar");
            }

            events = data.events || [];
            render();
        } catch (error) {
            h.toast(error.message, "error");
            agenda.innerHTML = `
                <div class="integration-empty">${h.esc(error.message)}</div>
            `;
        } finally {
            refresh.disabled = false;
            refresh.textContent = "Refresh";
        }
    }

    filter.addEventListener("change", render);
    refresh.addEventListener("click", load);

    search.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && search.value.trim()) {
            window.location.href =
                `search.html?q=${encodeURIComponent(search.value.trim())}`;
        }
    });

    try {
        const user = await h.requireRole(role);
        if (!user) return;
        await load();
    } catch (error) {
        h.toast(error.message, "error");
    }
});
