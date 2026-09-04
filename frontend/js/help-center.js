document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("helpSearch");
    const searchable = Array.from(document.querySelectorAll("[data-help]"));

    function applySearch() {
        const query = input.value.trim().toLowerCase();

        searchable.forEach((element) => {
            const haystack = `${element.dataset.help || ""} ${element.textContent || ""}`.toLowerCase();
            element.classList.toggle(
                "lv-help-search-hidden",
                Boolean(query) && !haystack.includes(query)
            );
        });
    }

    input.addEventListener("input", applySearch);
});
