document.addEventListener("DOMContentLoaded", () => {

    /* ======================================================
       GLOBAL MANUAL LOGOUT
       Manual Logout always returns to the public LearnVault home.
       Capture phase + stopImmediatePropagation prevents older page
       scripts from redirecting to login.html after this handler.
    ====================================================== */

    function bindLogoutHomeGlobally() {
        const logoutButton =
            document.getElementById("logoutButton");

        if (!logoutButton) {
            return;
        }

        logoutButton.addEventListener(
            "click",
            async (event) => {

                event.preventDefault();
                event.stopImmediatePropagation();

                if (
                    logoutButton.dataset.lvLogoutBusy ===
                    "true"
                ) {
                    return;
                }

                logoutButton.dataset.lvLogoutBusy =
                    "true";

                const oldText =
                    logoutButton.textContent;

                logoutButton.disabled =
                    true;

                logoutButton.textContent =
                    "Logging out...";

                try {
                    const response =
                        await fetch(
                            "/api/auth/logout",
                            {
                                method:
                                    "POST",
                                credentials:
                                    "same-origin",
                                headers: {
                                    "Accept":
                                        "application/json"
                                }
                            }
                        );

                    /*
                       Even if the network response is unavailable,
                       manual logout must leave the protected page.
                    */
                    if (response.ok) {
                        try {
                            const result =
                                await response.json();

                            const redirect =
                                result.redirectTo ||
                                "/";

                            window.location.replace(
                                redirect
                            );

                            return;

                        } catch (_) {}
                    }

                } catch (_) {
                    /* Final redirect below. */
                }

                window.location.replace("/");

                /*
                   No reset is necessary because navigation starts.
                   The fallback is retained only for completeness.
                */
                window.setTimeout(
                    () => {
                        logoutButton.disabled =
                            false;

                        logoutButton.textContent =
                            oldText;

                        delete logoutButton.dataset.lvLogoutBusy;
                    },
                    1500
                );

            },
            true
        );
    }

    bindLogoutHomeGlobally();


    /* ======================================================
       UNIVERSAL ROLE PAGE MARKER

       Every Student / Faculty / Admin module gets the same
       responsive shell even if its original <body> class has
       a module-specific name such as student-resource-page.
    ====================================================== */

    const rolePath =
        window.location.pathname
            .toLowerCase();

    let roleFromPath =
        null;

    if (rolePath.includes("/student/")) {
        roleFromPath = "student";
    } else if (rolePath.includes("/faculty/")) {
        roleFromPath = "faculty";
    } else if (rolePath.includes("/admin/")) {
        roleFromPath = "admin";
    }

    if (roleFromPath) {

        document.body.classList.add(
            "lv-role-page",
            `${roleFromPath}-page`
        );

        document.body.dataset.lvRole =
            roleFromPath;


        /*
           Install one final runtime structural layer.

           Several historical LearnVault modules were created at
           different phases and some retained old shell geometry.
           This makes the left navigation move inward on certain
           pages such as Student Resources / Continue Learning.

           The runtime layer below is intentionally structural only:
           it does not redesign page cards or module content.
        */
        if (
            !document.getElementById(
                "learnVaultUniversalShellRuntimeStyle"
            )
        ) {

            const runtimeStyle =
                document.createElement(
                    "style"
                );

            runtimeStyle.id =
                "learnVaultUniversalShellRuntimeStyle";

            runtimeStyle.textContent =
                `
                @media (min-width: 901px) {

                    body.lv-role-page .site,
                    body.lv-role-page .student-site,
                    body.lv-role-page .faculty-site,
                    body.lv-role-page .admin-site {
                        width: 100% !important;
                        min-width: 0 !important;
                        min-height: 100dvh !important;

                        display: flex !important;
                        flex-direction: column !important;

                        grid-template-columns: none !important;
                        grid-template-rows: none !important;

                        margin: 0 !important;
                        padding: 0 !important;

                        left: 0 !important;
                        right: auto !important;

                        overflow: visible !important;
                    }

                    body.lv-role-page .page-shell {
                        position: relative !important;
                        left: 0 !important;
                        right: auto !important;

                        width: 100% !important;
                        min-width: 0 !important;

                        display: grid !important;
                        grid-template-columns:
                            220px
                            minmax(0, 1fr) !important;
                        grid-template-rows: auto !important;

                        align-items: start !important;

                        margin: 0 !important;
                        margin-left: 0 !important;

                        padding: 0 !important;
                        padding-left: 0 !important;

                        transform: none !important;
                        overflow: visible !important;
                    }

                    body.lv-role-page.lv-sidebar-collapsed
                        .page-shell {
                        grid-template-columns:
                            68px
                            minmax(0, 1fr) !important;
                    }

                    body.lv-role-page:not(.lv-sidebar-collapsed)
                        .page-shell {
                        grid-template-columns:
                            220px
                            minmax(0, 1fr) !important;
                    }

                    body.lv-role-page .icon-rail {
                        grid-column: 1 !important;
                        grid-row: 1 !important;

                        position: sticky !important;
                        top: 74px !important;
                        left: 0 !important;
                        right: auto !important;

                        width: 100% !important;
                        min-width: 0 !important;

                        height:
                            calc(100dvh - 74px)
                            !important;
                        min-height: 0 !important;
                        max-height:
                            calc(100dvh - 74px)
                            !important;

                        margin: 0 !important;
                        margin-left: 0 !important;

                        padding:
                            10px 8px 18px
                            !important;

                        transform: none !important;

                        display: flex !important;
                        flex-direction: column !important;
                        align-items: stretch !important;

                        overflow-x: hidden !important;
                        overflow-y: auto !important;

                        box-sizing: border-box !important;

                        z-index: 40 !important;
                    }

                    body.lv-role-page .icon-rail .rail-item {
                        width: 100% !important;
                        min-width: 0 !important;

                        margin-left: 0 !important;
                        margin-right: 0 !important;
                    }

                    body.lv-role-page:not(.lv-sidebar-collapsed)
                        .icon-rail
                        .rail-label,
                    body.lv-role-page.lv-sidebar-expanded
                        .icon-rail
                        .rail-label {
                        display: block !important;
                        opacity: 1 !important;
                        visibility: visible !important;
                        width: auto !important;
                        max-width: 150px !important;
                    }

                    body.lv-role-page.lv-sidebar-collapsed
                        .icon-rail
                        .rail-label {
                        display: none !important;
                    }

                    body.lv-role-page .main,
                    body.lv-role-page .dashboard-main {
                        grid-column: 2 !important;
                        grid-row: 1 !important;

                        width: 100% !important;
                        min-width: 0 !important;
                        max-width: none !important;

                        margin: 0 !important;
                        margin-left: 0 !important;

                        padding-left:
                            var(
                                --lv-module-main-padding-left,
                                initial
                            );

                        transform: none !important;

                        box-sizing: border-box !important;
                    }
                }

                @media (max-width: 900px) {

                    body.lv-role-page .site,
                    body.lv-role-page .student-site,
                    body.lv-role-page .faculty-site,
                    body.lv-role-page .admin-site,
                    body.lv-role-page .page-shell,
                    body.lv-role-page .main,
                    body.lv-role-page .dashboard-main {
                        width: 100% !important;
                        min-width: 0 !important;

                        margin-left: 0 !important;
                        padding-left: 0 !important;

                        transform: none !important;
                    }

                    body.lv-role-page .page-shell {
                        display: block !important;
                    }

                    body.lv-role-page .icon-rail {
                        position: fixed !important;
                        top: 70px !important;
                        left: 0 !important;
                        right: auto !important;

                        width:
                            min(270px, 86vw)
                            !important;

                        height:
                            calc(100dvh - 70px)
                            !important;

                        margin: 0 !important;

                        transform:
                            translateX(-112%)
                            !important;
                    }

                    body.lv-role-page.lv-sidebar-mobile-open
                        .icon-rail {
                        transform:
                            translateX(0)
                            !important;
                    }
                }
                `;

            document.head.appendChild(
                runtimeStyle
            );

        }

    }


    const button =
        document.getElementById("mobileNavToggle");

    const sidebar =
        document.getElementById("primaryNavigation");

    const overlay =
        document.getElementById("navOverlay");


    if (!button || !sidebar) {
        return;
    }


    const mobileMedia =
        window.matchMedia("(max-width: 900px)");


    function ensureQuestionBankLink() {

        const path =
            window.location.pathname
                .toLowerCase();

        if (
            sidebar.querySelector(
                'a[href$="questions.html"]'
            )
        ) {
            return;
        }

        let href = null;

        if (
            path.includes("/admin/") ||
            path.includes("/faculty/") ||
            path.includes("/student/")
        ) {
            href = "questions.html";
        }

        if (!href) {
            return;
        }

        const link =
            document.createElement("a");

        link.href =
            href;

        link.className =
            "rail-item";

        link.title =
            "Question Bank";

        link.setAttribute(
            "aria-label",
            "Question Bank"
        );

        link.innerHTML =
            `
            <span class="rail-icon" aria-hidden="true">?</span>
            <span class="rail-label">Question Bank</span>
            `;

        const resourceLink =
            Array.from(
                sidebar.querySelectorAll("a")
            ).find(
                (item) =>
                    String(
                        item.getAttribute("href") || ""
                    )
                        .toLowerCase()
                        .includes("resource")
            );

        if (
            resourceLink &&
            resourceLink.parentNode === sidebar
        ) {
            resourceLink.insertAdjacentElement(
                "afterend",
                link
            );
        } else {
            sidebar.appendChild(link);
        }

    }

    ensureQuestionBankLink();

    function ensureQuizLink() {
        const path = window.location.pathname.toLowerCase();
        if (!(path.includes("/admin/") || path.includes("/faculty/") || path.includes("/student/"))) return;

        const links = Array.from(sidebar.querySelectorAll("a"));
        const existing = links.find((link) => {
            const label = link.querySelector(".rail-label");
            return label && label.textContent.trim().toLowerCase() === "quizzes";
        });

        if (existing) {
            existing.href = "quizzes.html";
            existing.classList.remove("coming-student-link", "coming-student-resource-module", "coming-question-module");
            return;
        }

        const link = document.createElement("a");
        link.href = "quizzes.html";
        link.className = "rail-item";
        link.title = "Quizzes";
        link.setAttribute("aria-label", "Quizzes");
        link.innerHTML = '<span class="rail-icon">✓</span><span class="rail-label">Quizzes</span>';

        const questionLink = links.find((item) => String(item.getAttribute("href") || "").toLowerCase().includes("questions"));
        if (questionLink && questionLink.nextSibling) sidebar.insertBefore(link, questionLink.nextSibling);
        else sidebar.appendChild(link);
    }

    ensureQuizLink();

    function ensureProgressLink() {
        const path = window.location.pathname.toLowerCase();
        if (!(path.includes("/admin/") || path.includes("/faculty/") || path.includes("/student/"))) return;
        const links = Array.from(sidebar.querySelectorAll("a"));
        const existing = links.find(link => { const label=link.querySelector(".rail-label"); return label && label.textContent.trim().toLowerCase()==="progress"; });
        if (existing) { existing.href="progress.html"; existing.classList.remove("coming-student-link","coming-student-resource-module","coming-question-module"); return; }
        const link=document.createElement("a"); link.href="progress.html"; link.className="rail-item"; link.title="Progress"; link.setAttribute("aria-label","Progress");
        link.innerHTML='<span class="rail-icon">↗</span><span class="rail-label">Progress</span>';
        const quiz=links.find(x=>String(x.getAttribute("href")||"").toLowerCase().includes("quizzes"));
        if(quiz&&quiz.parentNode===sidebar) quiz.insertAdjacentElement("afterend",link); else sidebar.appendChild(link);
    }
    ensureProgressLink();


    function ensureHelpSupportLink() {

        const role =
            currentRole();

        if (
            !role ||
            !sidebar
        ) {
            return;
        }


        const existing =
            Array.from(
                sidebar.querySelectorAll(
                    "a"
                )
            )
                .find(
                    (link) =>
                        String(
                            link.textContent ||
                            ""
                        )
                            .trim()
                            .toLowerCase()
                            .includes(
                                "help & support"
                            )
                );


        if (existing) {
            existing.href =
                "../support.html";

            return;
        }


        const link =
            document.createElement(
                "a"
            );

        link.href =
            "../support.html";

        link.className =
            "rail-item lv-support-rail-link";

        link.title =
            "Help & Support";

        link.setAttribute(
            "aria-label",
            "Help & Support"
        );

        link.innerHTML =
            `
            <span class="rail-icon" aria-hidden="true">?</span>
            <span class="rail-label">Help & Support</span>
            `;


        sidebar.appendChild(
            link
        );

    }

    ensureHelpSupportLink();


    function ensureExtraLearningLink(label, href, icon, afterLabel) {
        const path=window.location.pathname.toLowerCase();
        if(!(path.includes('/admin/')||path.includes('/faculty/')||path.includes('/student/'))) return;
        const links=Array.from(sidebar.querySelectorAll('a'));
        const existing=links.find(a=>{const t=a.querySelector('.rail-label');return t&&t.textContent.trim().toLowerCase()===label.toLowerCase();});
        if(existing){existing.href=href;existing.classList.remove('coming-student-link','coming-student-resource-module','coming-question-module','coming-progress-module');return;}
        const link=document.createElement('a');link.href=href;link.className='rail-item';link.title=label;link.setAttribute('aria-label',label);
        link.innerHTML=`<span class="rail-icon">${icon}</span><span class="rail-label">${label}</span>`;
        const anchor=Array.from(sidebar.querySelectorAll('a')).find(a=>{const t=a.querySelector('.rail-label');return t&&t.textContent.trim().toLowerCase()===afterLabel.toLowerCase();});
        if(anchor) anchor.insertAdjacentElement('afterend',link); else sidebar.appendChild(link);
    }


    ensureExtraLearningLink(
        "Assignments",
        "assignments.html",
        "▤",
        "Quizzes"
    );

    ensureExtraLearningLink('Skills','skills.html','◎','Progress');
    ensureExtraLearningLink('Peer Groups','peer-groups.html','◉','Skills');


    sidebar
        .querySelectorAll("a")
        .forEach(
            (link) => {

                const label =
                    link.querySelector(
                        ".rail-label"
                    );

                if (
                    label &&
                    label.textContent
                        .trim()
                        .toLowerCase() ===
                    "approvals"
                ) {

                    label.textContent =
                        "Oversight";

                    link.title =
                        "Content Oversight";

                    link.setAttribute(
                        "aria-label",
                        "Content Oversight"
                    );

                }

            }
        );



    function ensureIntegrationLink(label, href, icon, afterLabel) {
        const path = window.location.pathname.toLowerCase();
        if (!(path.includes("/admin/") || path.includes("/faculty/") || path.includes("/student/"))) return;

        const links = Array.from(sidebar.querySelectorAll("a"));
        const existing = links.find((link) => {
            const text = link.querySelector(".rail-label");
            return text && text.textContent.trim().toLowerCase() === label.toLowerCase();
        });

        if (existing) {
            existing.href = href;
            existing.classList.remove("coming-student-link","coming-student-resource-module","coming-question-module","coming-progress-module");
            return;
        }

        const link = document.createElement("a");
        link.href = href;
        link.className = "rail-item";
        link.title = label;
        link.setAttribute("aria-label", label);
        link.innerHTML = `<span class="rail-icon">${icon}</span><span class="rail-label">${label}</span>`;

        const anchor = Array.from(sidebar.querySelectorAll("a")).find((item) => {
            const text = item.querySelector(".rail-label");
            return text && text.textContent.trim().toLowerCase() === afterLabel.toLowerCase();
        });

        if (anchor) anchor.insertAdjacentElement("afterend", link);
        else sidebar.appendChild(link);
    }

    ensureIntegrationLink("Search","search.html","⌕","Dashboard");
    ensureIntegrationLink("Activity","activity.html","◫","Search");

    if (window.location.pathname.toLowerCase().includes("/student/")) {
        ensureIntegrationLink("Study Hub","study-hub.html","★","Dashboard");
        ensureIntegrationLink("Focus Center","focus-center.html","◴","Study Hub");
        ensureIntegrationLink("Saved Learning","saved.html","☆","Focus Center");
        ensureIntegrationLink("Notifications","notifications.html","◔","Activity");
        ensureIntegrationLink("Calendar","calendar.html","▦","Notifications");
        ensureIntegrationLink("Academic Progress","academic-progress.html","↟","Profile");
    }

    if (window.location.pathname.toLowerCase().includes("/faculty/")) {
        ensureIntegrationLink("Teaching Center","teaching-center.html","◴","Dashboard");
        ensureIntegrationLink("Pinned Teaching","saved.html","☆","Teaching Center");
        ensureIntegrationLink("Notifications","notifications.html","◔","Activity");
        ensureIntegrationLink("Calendar","calendar.html","▦","Notifications");
    }

    if (window.location.pathname.toLowerCase().includes("/admin/")) {
        ensureIntegrationLink("Operations Center","operations-center.html","◴","Dashboard");
        ensureIntegrationLink("Pinned Controls","saved.html","☆","Operations Center");
        ensureIntegrationLink("Notifications","notifications.html","◔","Activity");
        ensureIntegrationLink("Calendar","calendar.html","▦","Notifications");
        ensureIntegrationLink("Student Advancement","student-advancement.html","↟","Users & Faculty");
        ensureIntegrationLink("Reports","reports.html","▥","Progress");
    }

    ensureIntegrationLink("Profile","profile.html","◌","Peer Groups");

    sidebar.querySelectorAll("a").forEach((link) => {
        const label = link.querySelector(".rail-label");
        if (!label) return;
        if (label.textContent.trim().toLowerCase() === "account") {
            link.href = "profile.html";
            label.textContent = "Profile";
            link.title = "Profile";
            link.setAttribute("aria-label","Profile");
        }
    });



    function markCurrentNavigation() {
        const current = window.location.pathname.split("/").pop().toLowerCase();
        sidebar.querySelectorAll("a[href]").forEach((link) => {
            const target = String(link.getAttribute("href") || "").split("?")[0].split("#")[0].toLowerCase();
            if (target && target === current) {
                sidebar.querySelectorAll(".rail-item.active").forEach((a) => a.classList.remove("active"));
                link.classList.add("active");
            }
        });
    }

    markCurrentNavigation();

    async function protectStudentAcademicProfile() {
        const path = window.location.pathname.toLowerCase();
        if (!path.includes("/student/") || path.endsWith("/setup-profile.html")) return;
        try {
            const response = await fetch("/api/auth/me", { credentials: "same-origin" });
            if (response.status === 401) return;
            const result = await response.json();
            if (!response.ok || !result.user || String(result.user.role || "").toLowerCase() !== "student") return;
            if (!result.user.courseId) window.location.replace("setup-profile.html");
        } catch (error) {
            console.warn("Student academic profile guard:", error.message);
        }
    }

    protectStudentAcademicProfile();


    function installNotificationBell() {
        const path = window.location.pathname.toLowerCase();

        const role =
            path.includes("/student/")
                ? "student"
                : path.includes("/faculty/")
                    ? "faculty"
                    : path.includes("/admin/")
                        ? "admin"
                        : null;

        if (!role) return;

        const actions = document.querySelector(".top-actions");
        if (!actions) return;

        let bell = document.getElementById("learnVaultNotificationBell");

        if (!bell) {
            bell = document.createElement("a");
            bell.id = "learnVaultNotificationBell";
            bell.href = "notifications.html";
            bell.className = "lv-notification-bell";
            bell.title = "Notifications";
            bell.setAttribute("aria-label", "Notifications");
            bell.innerHTML = `
                <span class="lv-notification-bell-icon">◔</span>
                <span class="lv-notification-badge" id="learnVaultNotificationBadge" hidden>0</span>
            `;
            actions.insertBefore(bell, actions.firstChild);
        }

        async function loadCount() {
            try {
                const response = await fetch(
                    "/api/notifications/unread-count",
                    { credentials: "same-origin" }
                );

                if (!response.ok) return;

                const result = await response.json();
                const badge = document.getElementById("learnVaultNotificationBadge");

                if (!badge) return;

                const count = Number(result.unreadCount || 0);

                badge.textContent = count > 99 ? "99+" : String(count);
                badge.hidden = count <= 0;
            } catch (_) {}
        }

        loadCount();
        window.setInterval(loadCount, 60000);
    }

    installNotificationBell();


    /* ======================================================
       AUTHENTICATED PAGE STRUCTURE + QUICK ACCESS
       - Normalizes footer placement on every role page.
       - Ctrl/Cmd + K searchable command center.
       - Pin the current module with the ☆ button.
       - Saved / recent workspaces remain per role.
    ====================================================== */

    function currentRole() {
        const path = window.location.pathname.toLowerCase();
        if (path.includes("/student/")) return "student";
        if (path.includes("/faculty/")) return "faculty";
        if (path.includes("/admin/")) return "admin";
        return null;
    }

    function normalizeAuthenticatedShell() {
        const role = currentRole();

        if (!role) {
            return;
        }

        document.body.classList.add(
            "lv-structured-role-page",
            "lv-role-page",
            `${role}-page`
        );

        document.body.dataset.lvRole =
            role;

        const site =
            document.querySelector(
                ".site"
            );

        const shell =
            document.querySelector(
                ".page-shell"
            );

        if (!site || !shell) {
            return;
        }

        let footer =
            document.querySelector(
                ".footer, .student-footer-unified, .admin-full-footer, .commercial-footer"
            );

        if (!footer) {
            footer =
                document.createElement(
                    "footer"
                );

            footer.className =
                "footer commercial-footer";
        }

        /*
           Footer is always the final sibling of page-shell.
           This gives a single predictable document structure on
           Student, Faculty and Admin pages.
        */
        if (
            footer.parentElement !==
            site
        ) {
            site.appendChild(
                footer
            );
        } else {
            site.appendChild(
                footer
            );
        }

        footer.classList.add(
            "lv-fullwidth-footer",
            "lv-role-footer"
        );

        const roleLinks = {
            student: [
                ["Dashboard", "dashboard.html"],
                ["Study Hub", "study-hub.html"],
                ["Search", "search.html"],
                ["Notifications", "notifications.html"],
                ["Calendar", "calendar.html"],
                ["Profile", "profile.html"]
            ],

            faculty: [
                ["Dashboard", "dashboard.html"],
                ["Teaching Center", "teaching-center.html"],
                ["Search", "search.html"],
                ["Notifications", "notifications.html"],
                ["Calendar", "calendar.html"],
                ["Profile", "profile.html"]
            ],

            admin: [
                ["Dashboard", "dashboard.html"],
                ["Operations Center", "operations-center.html"],
                ["Users", "users.html"],
                ["Notifications", "notifications.html"],
                ["Reports", "reports.html"],
                ["Profile", "profile.html"]
            ]
        };

        const links =
            roleLinks[role] ||
            [];

        footer.innerHTML =
            `
            <div class="footer-inner lv-compact-footer-inner">

                <a
                    href="../index.html"
                    class="footer-brand lv-footer-left-brand"
                    aria-label="LearnVault home"
                >
                    <img
                        src="../assets/logo/learnvault-logo.png"
                        alt="LearnVault"
                    >
                </a>

                <nav
                    class="lv-footer-center-links"
                    aria-label="LearnVault support navigation"
                >
                    <a href="../help.html">Help Center</a>
                    <a href="../support.html">Support</a>
                    <a href="../contact.html">Contact</a>
                </nav>

                <span class="lv-footer-tagline">
                    Learn • Practice • Grow
                </span>

            </div>
            `;
    }

    normalizeAuthenticatedShell();


    /* ======================================================
       FOOTER-AWARE DESKTOP SIDEBAR
       When the footer enters the viewport, reduce the visible
       sidebar height by exactly that amount. This prevents the
       footer from covering / cutting navigation while preserving
       the full-width footer.
    ====================================================== */

    function installFooterAwareSidebar() {
        const role =
            currentRole();

        if (!role) {
            return;
        }

        const footer =
            document.querySelector(
                ".lv-role-footer"
            );

        if (!footer) {
            return;
        }

        let frame =
            0;

        function update() {

            frame =
                0;

            if (
                window.matchMedia(
                    "(max-width: 900px)"
                ).matches
            ) {

                document.documentElement
                    .style
                    .setProperty(
                        "--lv-stable-footer-overlap",
                        "0px"
                    );

                return;
            }

            const rect =
                footer.getBoundingClientRect();

            const viewportHeight =
                window.innerHeight ||
                document.documentElement.clientHeight;

            let overlap =
                0;

            if (
                rect.top <
                viewportHeight &&
                rect.bottom >
                0
            ) {

                overlap =
                    Math.max(
                        0,
                        Math.min(
                            rect.height,
                            viewportHeight -
                            Math.max(
                                rect.top,
                                0
                            )
                        )
                    );

            }

            document.documentElement
                .style
                .setProperty(
                    "--lv-stable-footer-overlap",
                    `${Math.ceil(overlap)}px`
                );
        }

        function schedule() {

            if (frame) {
                return;
            }

            frame =
                window.requestAnimationFrame(
                    update
                );
        }

        window.addEventListener(
            "scroll",
            schedule,
            {
                passive:
                    true
            }
        );

        window.addEventListener(
            "resize",
            schedule
        );

        if (
            typeof ResizeObserver !==
            "undefined"
        ) {

            const observer =
                new ResizeObserver(
                    schedule
                );

            observer.observe(
                footer
            );

        }

        update();
    }

    /*
       Disabled in the final shell.
       Desktop navigation now participates in full document flow, so the
       footer naturally begins only after the complete sidebar.
    */
    document.documentElement.style.setProperty(
        "--lv-stable-footer-overlap",
        "0px"
    );

    function installCommercialQuickAccess() {
        const role = currentRole();
        if (!role) return;

        const roleLinks = {
            student: [
                ["⌂", "Dashboard", "dashboard.html", "Learning overview"],
                ["★", "Study Hub", "study-hub.html", "Recommended next actions"],
                ["◴", "Focus Center", "focus-center.html", "Daily goals, focus timer and study notes"],
                ["☆", "Saved Learning", "saved.html", "Pinned and recent learning tools"],
                ["⌕", "Search", "search.html", "Find learning content"],
                ["▣", "Resources", "resources.html", "Notes, files and videos"],
                ["?", "Question Bank", "questions.html", "Topic-wise practice"],
                ["✓", "Quizzes", "quizzes.html", "Assess your knowledge"],
                ["▤", "Assignments", "assignments.html", "Deadlines and feedback"],
                ["▦", "Calendar", "calendar.html", "Learning timeline"],
                ["◔", "Notifications", "notifications.html", "Important updates"],
                ["↗", "Progress", "progress.html", "Mastery and weak areas"],
                ["◎", "Skills", "skills.html", "Build measurable skills"],
                ["◉", "Peer Groups", "peer-groups.html", "Discuss and collaborate"],
                ["↟", "Academic Progress", "academic-progress.html", "Year / Grade progression"],
                ["◌", "Profile", "profile.html", "Account and security"]
            ],
            faculty: [
                ["⌂", "Dashboard", "dashboard.html", "Teaching overview"],
                ["◴", "Teaching Center", "teaching-center.html", "Teaching plan, priorities and class notes"],
                ["☆", "Pinned Teaching", "saved.html", "Pinned and recent teaching tools"],
                ["⌕", "Search", "search.html", "Find content and activity"],
                ["▣", "Resources", "resources.html", "Publish learning resources"],
                ["?", "Question Bank", "questions.html", "Create practice questions"],
                ["✓", "Quizzes", "quizzes.html", "Build assessments"],
                ["▤", "Assignments", "assignments.html", "Create and grade work"],
                ["↗", "Progress", "progress.html", "Student analytics"],
                ["◎", "Skills", "skills.html", "Manage skill outcomes"],
                ["◉", "Peer Groups", "peer-groups.html", "Guide collaboration"],
                ["▦", "Calendar", "calendar.html", "Teaching timeline"],
                ["◔", "Notifications", "notifications.html", "Submissions and updates"],
                ["◌", "Profile", "profile.html", "Faculty profile"]
            ],
            admin: [
                ["⌂", "Dashboard", "dashboard.html", "Platform overview"],
                ["◴", "Operations Center", "operations-center.html", "Daily platform monitoring and admin priorities"],
                ["☆", "Pinned Controls", "saved.html", "Pinned and recent admin controls"],
                ["⌕", "Search", "search.html", "Find users and content"],
                ["▥", "Academic Structure", "academic.html", "Domains, Courses and Subjects"],
                ["◇", "Users & Faculty", "users.html", "Accounts and Faculty access"],
                ["↟", "Student Advancement", "student-advancement.html", "Promotion and academic history"],
                ["▣", "Resources", "resources.html", "Monitor learning resources"],
                ["?", "Question Bank", "questions.html", "Question oversight"],
                ["✓", "Quizzes", "quizzes.html", "Quiz oversight"],
                ["▤", "Assignments", "assignments.html", "Assignment oversight"],
                ["◎", "Skills", "skills.html", "Skill oversight"],
                ["◉", "Peer Groups", "peer-groups.html", "Peer moderation"],
                ["▦", "Calendar", "calendar.html", "Platform learning timeline"],
                ["◔", "Notifications", "notifications.html", "System updates"],
                ["▦", "Reports", "reports.html", "Analytics and database health"],
                ["◈", "Oversight", "approvals.html", "Content monitoring"],
                ["◌", "Profile", "profile.html", "Admin profile"]
            ]
        };

        const links = roleLinks[role] || [];
        const currentFile = window.location.pathname.split("/").pop() || "dashboard.html";
        const currentTitle = document.title.split("|")[0].trim() || currentFile;
        const recentKey = `learnvault_recent_${role}`;
        const pinKey = `learnvault_pinned_${role}`;

        function escapeHtml(value) {
            return String(value ?? "")
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;")
                .replaceAll('"', "&quot;")
                .replaceAll("'", "&#039;");
        }

        function readPins() {
            try {
                return JSON.parse(localStorage.getItem(pinKey) || "[]")
                    .filter((item) => item && item.href && item.label)
                    .slice(0, 12);
            } catch (_) {
                return [];
            }
        }

        function writePins(items) {
            localStorage.setItem(pinKey, JSON.stringify(items.slice(0, 12)));
        }

        function isCurrentPinned() {
            return readPins().some((item) => item.href === currentFile);
        }

        try {
            const recent = JSON.parse(localStorage.getItem(recentKey) || "[]")
                .filter((item) => item && item.href !== currentFile);

            recent.unshift({
                href: currentFile,
                label: currentTitle,
                visitedAt: Date.now()
            });

            localStorage.setItem(recentKey, JSON.stringify(recent.slice(0, 8)));
        } catch (_) {}

        const actions = document.querySelector(".top-actions");

        if (actions && !document.getElementById("learnVaultCommandButton")) {
            const commandButton = document.createElement("button");
            commandButton.type = "button";
            commandButton.id = "learnVaultCommandButton";
            commandButton.className = "lv-command-button";
            commandButton.title = "Quick Access (Ctrl + K)";
            commandButton.setAttribute("aria-label", "Open Quick Access");
            commandButton.textContent = "⌘";

            const bell = document.getElementById("learnVaultNotificationBell");

            if (bell && bell.parentNode === actions) {
                bell.insertAdjacentElement("afterend", commandButton);
            } else {
                actions.insertBefore(commandButton, actions.firstChild);
            }
        }

        let pinButton = document.getElementById("learnVaultPinPageButton");

        if (actions && !pinButton) {
            pinButton = document.createElement("button");
            pinButton.type = "button";
            pinButton.id = "learnVaultPinPageButton";
            pinButton.className = "lv-pin-button";
            pinButton.setAttribute("aria-label", "Pin current LearnVault page");
            pinButton.title = "Pin this page";
            pinButton.textContent = "☆";

            const commandButton = document.getElementById("learnVaultCommandButton");
            if (commandButton) commandButton.insertAdjacentElement("afterend", pinButton);
            else actions.insertBefore(pinButton, actions.firstChild);
        }

        function updatePinButton() {
            if (!pinButton) return;
            const pinned = isCurrentPinned();
            pinButton.classList.toggle("is-pinned", pinned);
            pinButton.textContent = pinned ? "★" : "☆";
            pinButton.title = pinned ? "Unpin this page" : "Pin this page";
            pinButton.setAttribute(
                "aria-label",
                pinned ? "Unpin current LearnVault page" : "Pin current LearnVault page"
            );
        }

        if (pinButton) {
            updatePinButton();
            pinButton.addEventListener("click", () => {
                const pins = readPins();
                const index = pins.findIndex((item) => item.href === currentFile);

                if (index >= 0) {
                    pins.splice(index, 1);
                } else {
                    pins.unshift({
                        href: currentFile,
                        label: currentTitle,
                        savedAt: Date.now()
                    });
                }

                writePins(pins);
                updatePinButton();
            });
        }

        const overlay = document.createElement("div");
        overlay.className = "lv-command-overlay";
        overlay.id = "learnVaultCommandOverlay";
        overlay.setAttribute("aria-hidden", "true");
        overlay.hidden = true;

        overlay.innerHTML = `
            <div class="lv-command-panel" role="dialog" aria-modal="true" aria-label="LearnVault Quick Access">
                <div class="lv-command-head">
                    <span>⌕</span>
                    <input id="learnVaultCommandSearch" type="search" placeholder="Search tools..." autocomplete="off">
                    <span class="lv-command-key">ESC</span>
                </div>

                <div class="lv-command-body">
                    <section class="lv-command-section" id="learnVaultPinnedSection">
                        <h3 class="lv-command-section-title">Pinned</h3>
                        <div class="lv-command-list" id="learnVaultPinnedList"></div>
                    </section>

                    <section class="lv-command-section">
                        <h3 class="lv-command-section-title">Quick Access</h3>
                        <div class="lv-command-list" id="learnVaultCommandList"></div>
                    </section>

                    <section class="lv-command-section" id="learnVaultRecentSection">
                        <h3 class="lv-command-section-title">Recently Visited</h3>
                        <div class="lv-command-list" id="learnVaultRecentList"></div>
                    </section>

                    <section class="lv-command-section">
                        <h3 class="lv-command-section-title">Support</h3>
                        <div class="lv-command-list">
                            <a class="lv-command-item" href="../help.html">
                                <span class="lv-command-item-icon">i</span>
                                <span><strong>Help Center</strong><small>Learn how each LearnVault module works</small></span>
                                <em>→</em>
                            </a>
                            <a class="lv-command-item" href="../index.html">
                                <span class="lv-command-item-icon">LV</span>
                                <span><strong>Public Homepage</strong><small>Return to LearnVault home</small></span>
                                <em>→</em>
                            </a>
                        </div>
                    </section>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const search = overlay.querySelector("#learnVaultCommandSearch");
        const list = overlay.querySelector("#learnVaultCommandList");
        const recentList = overlay.querySelector("#learnVaultRecentList");
        const recentSection = overlay.querySelector("#learnVaultRecentSection");
        const pinnedList = overlay.querySelector("#learnVaultPinnedList");
        const pinnedSection = overlay.querySelector("#learnVaultPinnedSection");

        function renderLinks(query = "") {
            const normalized = String(query || "").trim().toLowerCase();
            const rows = links.filter((item) => {
                if (!normalized) return true;
                return `${item[1]} ${item[3]}`.toLowerCase().includes(normalized);
            });

            list.innerHTML = rows.length
                ? rows.map((item) => `
                    <a class="lv-command-item" href="${escapeHtml(item[2])}">
                        <span class="lv-command-item-icon">${escapeHtml(item[0])}</span>
                        <span>
                            <strong>${escapeHtml(item[1])}</strong>
                            <small>${escapeHtml(item[3])}</small>
                        </span>
                        <em>→</em>
                    </a>
                `).join("")
                : `<div class="lv-command-empty">No matching LearnVault tool.</div>`;
        }

        function renderPinned() {
            const pins = readPins();
            pinnedSection.hidden = pins.length === 0;
            pinnedList.innerHTML = pins.map((item) => `
                <a class="lv-command-item" href="${escapeHtml(item.href)}">
                    <span class="lv-command-item-icon">★</span>
                    <span>
                        <strong>${escapeHtml(item.label)}</strong>
                        <small>Pinned LearnVault workspace</small>
                    </span>
                    <em>→</em>
                </a>
            `).join("");
        }

        function renderRecent() {
            let recent = [];
            try {
                recent = JSON.parse(localStorage.getItem(recentKey) || "[]")
                    .filter((item) => item && item.href && item.label)
                    .slice(0, 5);
            } catch (_) {}

            recentSection.hidden = recent.length === 0;
            recentList.innerHTML = recent.map((item) => `
                <a class="lv-command-item" href="${escapeHtml(item.href)}">
                    <span class="lv-command-item-icon">↻</span>
                    <span>
                        <strong>${escapeHtml(item.label)}</strong>
                        <small>Continue where you left off</small>
                    </span>
                    <em>→</em>
                </a>
            `).join("");
        }

        function openCommand() {
            overlay.hidden = false;
            requestAnimationFrame(() => overlay.classList.add("open"));
            overlay.setAttribute("aria-hidden", "false");
            search.value = "";
            renderLinks();
            renderPinned();
            renderRecent();
            window.setTimeout(() => search.focus(), 30);
        }

        function closeCommand() {
            overlay.classList.remove("open");
            overlay.setAttribute("aria-hidden", "true");
            window.setTimeout(() => {
                if (!overlay.classList.contains("open")) overlay.hidden = true;
            }, 180);
        }

        const commandButton = document.getElementById("learnVaultCommandButton");
        if (commandButton) commandButton.addEventListener("click", openCommand);

        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) closeCommand();
        });

        search.addEventListener("input", () => renderLinks(search.value));

        document.addEventListener("keydown", (event) => {
            const target = event.target;
            const typing = target && (
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.tagName === "SELECT" ||
                target.isContentEditable
            );

            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
                event.preventDefault();
                if (overlay.classList.contains("open")) closeCommand();
                else openCommand();
                return;
            }

            if (event.key === "Escape" && overlay.classList.contains("open")) {
                closeCommand();
                return;
            }

            if (!typing && event.altKey) {
                const key = event.key.toLowerCase();
                const center = role === "student"
                    ? "focus-center.html"
                    : role === "faculty"
                        ? "teaching-center.html"
                        : "operations-center.html";

                const destinations = {
                    "1": "dashboard.html",
                    "2": center,
                    "n": "notifications.html",
                    "c": "calendar.html",
                    "s": "saved.html"
                };

                if (destinations[key]) {
                    event.preventDefault();
                    window.location.href = destinations[key];
                }
            }
        });
    }

    installCommercialQuickAccess();


    function installBackToTop() {
        if (document.getElementById("learnVaultBackToTop")) return;

        const button = document.createElement("button");
        button.type = "button";
        button.id = "learnVaultBackToTop";
        button.className = "lv-back-to-top";
        button.title = "Back to top";
        button.setAttribute("aria-label", "Back to top");
        button.textContent = "↑";
        document.body.appendChild(button);

        function update() {
            button.classList.toggle("show", window.scrollY > 420);
        }

        update();
        window.addEventListener("scroll", update, { passive: true });
        button.addEventListener("click", () => {
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }

    installBackToTop();


    function upgradeFooterNavigation() {
        const footer = document.querySelector(".footer, .student-footer-unified, .commercial-footer");
        if (!footer) return;

        const nav = footer.querySelector("nav");
        if (!nav) return;

        const hasHelp = Array.from(nav.querySelectorAll("a"))
            .some((link) => String(link.textContent || "").trim().toLowerCase() === "help");

        if (!hasHelp) {
            const help = document.createElement("a");
            help.href = "../help.html";
            help.textContent = "Help";
            nav.appendChild(help);
        }
    }

    upgradeFooterNavigation();


    /* ======================================================
       ROLE SIDEBAR SCROLL MEMORY
       Applies to Student, Faculty and Admin pages.

       - remembers rail position during navigation
       - restores it on the next role page
       - ensures the currently active page is visible
    ====================================================== */

    function installSidebarScrollMemory() {

        const role =
            currentRole();

        const rail =
            document.querySelector(
                ".icon-rail"
            );

        if (
            !role ||
            !rail
        ) {
            return;
        }

        const storageKey =
            `learnvault_sidebar_scroll_${role}`;

        function isDesktop() {
            return !window.matchMedia(
                "(max-width: 900px)"
            ).matches;
        }

        function activeItem() {
            return rail.querySelector(
                ".rail-item.active"
            );
        }

        function revealActiveItem() {

            if (
                !isDesktop()
            ) {
                return;
            }

            const active =
                activeItem();

            if (
                !active
            ) {
                return;
            }

            const railTop =
                rail.scrollTop;

            const railBottom =
                railTop +
                rail.clientHeight;

            const itemTop =
                active.offsetTop;

            const itemBottom =
                itemTop +
                active.offsetHeight;

            const safePadding =
                18;

            if (
                itemTop <
                railTop +
                safePadding ||
                itemBottom >
                railBottom -
                safePadding
            ) {

                rail.scrollTo({
                    top:
                        Math.max(
                            0,
                            itemTop -
                            (rail.clientHeight / 2) +
                            (active.offsetHeight / 2)
                        ),
                    behavior:
                        "auto"
                });

            }

        }

        if (
            isDesktop()
        ) {

            const remembered =
                Number(
                    sessionStorage.getItem(
                        storageKey
                    ) ||
                    0
                );

            if (
                Number.isFinite(
                    remembered
                ) &&
                remembered >
                0
            ) {

                rail.scrollTop =
                    remembered;

            }

        }

        let saveFrame =
            0;

        rail.addEventListener(
            "scroll",
            () => {

                if (
                    !isDesktop()
                ) {
                    return;
                }

                if (
                    saveFrame
                ) {
                    return;
                }

                saveFrame =
                    window.requestAnimationFrame(
                        () => {

                            saveFrame =
                                0;

                            sessionStorage.setItem(
                                storageKey,
                                String(
                                    Math.round(
                                        rail.scrollTop
                                    )
                                )
                            );

                        }
                    );

            },
            {
                passive:
                    true
            }
        );

        window.requestAnimationFrame(
            () => {

                window.requestAnimationFrame(
                    revealActiveItem
                );

            }
        );

        window.addEventListener(
            "resize",
            () => {

                window.requestAnimationFrame(
                    revealActiveItem
                );

            }
        );

    }

    installSidebarScrollMemory();




    function isHomePage() {

        const path =
            window.location.pathname
                .toLowerCase();

        return (
            path === "/" ||
            path.endsWith("/index.html")
        );

    }


    function isMobile() {

        return mobileMedia.matches;

    }


    function setDesktopExpanded(expanded) {

        document.body.classList.toggle(
            "lv-sidebar-expanded",
            expanded
        );

        document.body.classList.toggle(
            "lv-sidebar-collapsed",
            !expanded
        );


        button.classList.toggle(
            "active",
            expanded
        );

        button.setAttribute(
            "aria-expanded",
            String(expanded)
        );

        button.setAttribute(
            "aria-label",
            expanded
                ? "Collapse navigation"
                : "Expand navigation"
        );

    }


    function setMobileOpen(open) {

        document.body.classList.toggle(
            "lv-sidebar-mobile-open",
            open
        );


        if (overlay) {

            overlay.classList.toggle(
                "show",
                open
            );

        }


        button.classList.toggle(
            "active",
            open
        );

        button.setAttribute(
            "aria-expanded",
            String(open)
        );

        button.setAttribute(
            "aria-label",
            open
                ? "Close navigation"
                : "Open navigation"
        );

    }


    function initializeNavigation() {

        /*
           Remove old sidebar state classes from previous
           LearnVault versions so they cannot conflict.
        */
        document.body.classList.remove(
            "nav-open",
            "nav-mobile-open"
        );


        if (isMobile()) {

            /*
               Minimized/mobile:
               hidden by default.
            */
            setMobileOpen(false);

            return;
        }


        /*
           Full/Desktop:
           ALL authenticated role pages start expanded with labels.
           The user can still collapse it manually using the menu
           button, but navigating to another role module returns to
           the full desktop navigation.
        */
        setDesktopExpanded(
            true
        );

    }


    function toggleNavigation() {

        if (isMobile()) {

            const open =
                document.body.classList.contains(
                    "lv-sidebar-mobile-open"
                );


            setMobileOpen(
                !open
            );

            return;
        }


        const expanded =
            document.body.classList.contains(
                "lv-sidebar-expanded"
            );


        setDesktopExpanded(
            !expanded
        );

    }


    button.addEventListener(
        "click",
        (event) => {

            event.preventDefault();
            event.stopPropagation();

            toggleNavigation();

        }
    );


    if (overlay) {

        overlay.addEventListener(
            "click",
            () => {

                if (isMobile()) {

                    setMobileOpen(false);

                }

            }
        );

    }


    sidebar
        .querySelectorAll("a")
        .forEach((link) => {

            link.addEventListener(
                "click",
                () => {

                    /*
                       Desktop:
                       navigating never changes sidebar state.

                       Mobile:
                       close sidebar after selecting a tool.
                    */
                    if (isMobile()) {

                        setMobileOpen(false);

                    }

                }
            );

        });


    function handleViewportChange() {

        document.body.classList.remove(
            "lv-sidebar-mobile-open"
        );


        if (overlay) {

            overlay.classList.remove(
                "show"
            );

        }


        if (isMobile()) {

            setMobileOpen(false);

        } else {

            /*
               Preserve the current desktop state if one
               already exists. Otherwise use page default.
            */
            const hasDesktopState =
                document.body.classList.contains(
                    "lv-sidebar-expanded"
                ) ||
                document.body.classList.contains(
                    "lv-sidebar-collapsed"
                );


            if (!hasDesktopState) {

                setDesktopExpanded(
                    true
                );

            } else {

                const expanded =
                    document.body.classList.contains(
                        "lv-sidebar-expanded"
                    );


                setDesktopExpanded(
                    expanded
                );

            }

        }

    }


    if (mobileMedia.addEventListener) {

        mobileMedia.addEventListener(
            "change",
            handleViewportChange
        );

    } else {

        mobileMedia.addListener(
            handleViewportChange
        );

    }


    initializeNavigation();

});
