document.addEventListener("DOMContentLoaded", () => {
    const logoutButton = document.getElementById("logoutButton");
    const toast = document.getElementById("toast");

    function showToast(message, type = "") {
        if (!toast) return;
        toast.textContent = message;
        toast.className = "toast show";
        if (type) toast.classList.add(type);
        clearTimeout(toast.hideTimer);
        toast.hideTimer = setTimeout(() => { toast.className = "toast"; }, 3000);
    }

    async function requireFaculty() {
        try {
            const response = await fetch("/api/auth/me", { credentials: "same-origin" });
            const result = await response.json();
            if (!response.ok || !result.success || !result.user) {
                window.location.href = "../login.html";
                return null;
            }

            const role = String(result.user.role || "").toLowerCase();
            if (role !== "faculty") {
                showToast("Faculty access is required.", "error");
                setTimeout(() => { window.location.href = "../index.html"; }, 500);
                return null;
            }

            const name = document.getElementById("headerFacultyName");
            if (name) name.textContent = result.user.fullName || "Faculty";
            return result.user;
        } catch (error) {
            window.location.href = "../login.html";
            return null;
        }
    }

    if (logoutButton) {
        logoutButton.addEventListener("click", async () => {
            try { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }); }
            finally { window.location.href = "../login.html"; }
        });
    }

    window.LearnVaultFaculty = { showToast, requireFaculty };
});
