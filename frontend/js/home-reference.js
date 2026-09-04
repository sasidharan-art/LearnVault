document.addEventListener("DOMContentLoaded", () => {
    const body = document.body;
    const header = document.getElementById("homeHeader");
    const nav = document.getElementById("homeNavigation");
    const menuButton = document.getElementById("homeMenuButton");
    const overlay = document.getElementById("homeMobileOverlay");

    const loginButton = document.getElementById("homeLoginButton");
    const createButton = document.getElementById("homeCreateButton");
    const dashboardButton = document.getElementById("homeDashboardButton");

    const searchForm = document.getElementById("homeSearchForm");
    const searchInput = document.getElementById("homeSearchInput");

    let authenticatedUser = null;

    function closeMenu() {
        body.classList.remove("lv-home-menu-open", "no-scroll");
        menuButton.setAttribute("aria-expanded", "false");
    }

    function toggleMenu() {
        const open = !body.classList.contains("lv-home-menu-open");

        body.classList.toggle("lv-home-menu-open", open);
        body.classList.toggle("no-scroll", open);

        menuButton.setAttribute(
            "aria-expanded",
            String(open)
        );
    }

    menuButton.addEventListener("click", toggleMenu);
    overlay.addEventListener("click", closeMenu);

    nav.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", closeMenu);
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 900) {
            closeMenu();
        }
    });

    function updateHeader() {
        header.classList.toggle(
            "is-scrolled",
            window.scrollY > 10
        );
    }

    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });


    function dashboardForRole(role) {
        const normalized = String(role || "").toLowerCase();

        if (normalized === "student") {
            return "student/dashboard.html";
        }

        if (normalized === "faculty") {
            return "faculty/dashboard.html";
        }

        if (normalized === "admin") {
            return "admin/dashboard.html";
        }

        return "login.html";
    }


    async function detectLogin() {
        try {
            const response = await fetch(
                "/api/auth/me",
                {
                    credentials: "same-origin"
                }
            );

            if (!response.ok) {
                return;
            }

            const result = await response.json();

            if (!result.user) {
                return;
            }

            authenticatedUser = result.user;

            const dashboard = dashboardForRole(
                result.user.role
            );

            /*
               Keep public authentication actions visible at all times.
               A logged-in user gets an additional Dashboard action instead
               of replacing Login / Create Account.
            */
            loginButton.textContent = "Login";
            loginButton.href = "login.html";

            createButton.textContent = "Create Account";
            createButton.href = "register.html";

            if (dashboardButton) {
                dashboardButton.href = dashboard;
                dashboardButton.hidden = false;
            }

        } catch (_) {
            // Public homepage still works when backend is unavailable.
        }
    }


    searchForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const query = searchInput.value.trim();

        if (!query) {
            searchInput.focus();
            return;
        }

        if (
            authenticatedUser &&
            String(authenticatedUser.role || "").toLowerCase() === "student"
        ) {
            window.location.href =
                `student/search.html?q=${encodeURIComponent(query)}`;

            return;
        }

        if (authenticatedUser) {
            window.location.href =
                dashboardForRole(authenticatedUser.role);

            return;
        }

        sessionStorage.setItem(
            "learnvault_public_search",
            query
        );

        window.location.href = "login.html";
    });


    detectLogin();
});
