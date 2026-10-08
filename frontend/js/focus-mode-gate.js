document.addEventListener("DOMContentLoaded", async () => {
    const gate = document.getElementById("focusModeGate");
    const start = document.getElementById("startMandatoryFocus");
    const violationToast = document.getElementById("focusViolationToast");
    if (!gate || !start) return;

    let active = false;
    let seconds = 25 * 60;
    let interval = null;
    let violations = 0;
    let warningTimer = null;

    const showViolation = (message) => {
        violations++;
        violationToast.textContent = `${message} • Violation ${violations}`;
        violationToast.style.display = "block";
        clearTimeout(warningTimer);
        warningTimer = setTimeout(() => violationToast.style.display = "none", 3000);
        try {
            const key = "learnvault_focus_violations";
            const data = JSON.parse(localStorage.getItem(key) || "[]");
            data.push({ at: new Date().toISOString(), violations, message });
            localStorage.setItem(key, JSON.stringify(data.slice(-100)));
        } catch (_) {}
    };

    const finish = () => {
        active = false;
        clearInterval(interval);
        interval = null;
        document.body.classList.remove("focus-locked");
        gate.classList.add("hidden");
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        try {
            const sessions = JSON.parse(localStorage.getItem("learnvault_focus_sessions") || "[]");
            sessions.push({ completedAt: new Date().toISOString(), duration: 25 * 60, violations });
            localStorage.setItem("learnvault_focus_sessions", JSON.stringify(sessions.slice(-100)));
        } catch (_) {}
        alert("Focus Mode completed. Your learning workspace is now unlocked.");
    };

    const tick = () => {
        seconds--;
        if (seconds <= 0) {
            finish();
            return;
        }
        const m = Math.floor(seconds / 60), s = seconds % 60;
        start.textContent = `Focus Mode Active • ${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
    };

    const begin = async () => {
        active = true;
        document.body.classList.add("focus-locked");
        gate.classList.add("hidden");
        try { await document.documentElement.requestFullscreen(); } catch (_) {}
        start.textContent = "Focus Mode Active • 25:00";
        interval = setInterval(tick, 1000);
    };

    start.addEventListener("click", begin);

    document.addEventListener("visibilitychange", () => {
        if (active && document.hidden) showViolation("You switched away from LearnVault");
    });

    window.addEventListener("blur", () => {
        if (active) showViolation("LearnVault lost focus");
    });

    document.addEventListener("fullscreenchange", () => {
        if (active && !document.fullscreenElement) showViolation("Fullscreen was exited");
    });

    document.addEventListener("click", (event) => {
        if (!active) return;
        const link = event.target.closest("a");
        if (link && link.href && !link.href.startsWith("javascript:")) {
            event.preventDefault();
            showViolation("Navigation is restricted during Focus Mode");
        }
    }, true);

    window.addEventListener("beforeunload", (event) => {
        if (!active) return;
        event.preventDefault();
        event.returnValue = "Focus Mode is active. Your session is still running.";
    });

    // Always require the prompt on a fresh student login.
    gate.classList.remove("hidden");
});
