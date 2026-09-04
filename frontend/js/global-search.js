document.addEventListener("DOMContentLoaded", async () => {
    const h = window.LearnVaultLearning;
    if (!h) return;

    h.bindLogout();

    const role = document.body.dataset.role;
    const form = document.getElementById("globalSearchForm");
    const input = document.getElementById("globalSearchInput");
    const type = document.getElementById("globalSearchType");
    const results = document.getElementById("globalSearchResults");
    const summary = document.getElementById("globalSearchSummary");
    const scope = document.getElementById("globalSearchScope");
    const headerSearch = document.getElementById("integrationHeaderSearch");

    const labels = {resource:"Resource",question:"Question",quiz:"Quiz",assignment:"Assignment",skill:"Skill",peer_group:"Peer Group"};
    const icons = {resource:"▣",question:"?",quiz:"✓",assignment:"▤",skill:"◎",peer_group:"◉"};

    function initialQuery() {
        const p = new URLSearchParams(location.search);
        return p.get("q") || p.get("search") || "";
    }

    function render(data) {
        summary.textContent = data.count
            ? `${data.count} result${data.count===1?"":"s"} for “${data.query}”`
            : `No results for “${data.query}”`;

        const n = Array.isArray(data.subjects) ? data.subjects.length : 0;
        scope.textContent = role === "admin"
            ? `${n} active subjects are searchable.`
            : role === "faculty"
                ? `${n} assigned subjects are searchable.`
                : `${n} course-relevant subjects are searchable.`;

        if (!data.results || !data.results.length) {
            results.innerHTML = `<div class="integration-empty"><strong>Nothing matched this search</strong><span>Try a subject code, topic, quiz title, skill or assignment name.</span></div>`;
            return;
        }

        results.innerHTML = data.results.map(item => `
            <a class="global-search-result" href="${h.esc(item.url)}">
                <div class="global-search-icon">${icons[item.type] || "•"}</div>
                <div class="global-search-copy">
                    <div class="global-search-meta"><span>${h.esc(labels[item.type] || item.type)}</span><small>${h.esc(item.state || "")}</small></div>
                    <h3>${h.esc(item.title)}</h3>
                    <p>${h.esc(item.subtitle || "")}</p>
                    <small>${h.esc(item.detail || "")}</small>
                </div>
                <span class="global-search-open">Open →</span>
            </a>
        `).join("");
    }

    async function runSearch() {
        const q = input.value.trim();
        if (q.length < 2) {
            summary.textContent = "Enter at least 2 characters to search.";
            scope.textContent = "";
            results.innerHTML = `<div class="integration-empty"><strong>Search LearnVault</strong><span>Use a subject, topic, question, quiz, assignment or skill name.</span></div>`;
            return;
        }

        results.innerHTML = `<div class="integration-empty">Searching LearnVault...</div>`;

        try {
            const p = new URLSearchParams({q});
            if (type.value) p.set("type",type.value);

            const r = await fetch(`/api/integration/search?${p.toString()}`,{credentials:"same-origin"});
            const data = await r.json();
            if (!r.ok) throw new Error(data.message || "Unable to search");

            render(data);

            const u = new URL(location.href);
            u.searchParams.set("q",q);
            if (type.value) u.searchParams.set("type",type.value); else u.searchParams.delete("type");
            history.replaceState(null,"",u);

        } catch (error) {
            h.toast(error.message,"error");
            results.innerHTML = `<div class="integration-empty">${h.esc(error.message)}</div>`;
        }
    }

    form.addEventListener("submit",e=>{e.preventDefault();runSearch();});
    type.addEventListener("change",()=>{if(input.value.trim().length>=2)runSearch();});
    headerSearch.addEventListener("keydown",e=>{if(e.key==="Enter"){input.value=headerSearch.value;runSearch();}});

    try {
        await h.requireRole(role);
        const q = initialQuery();
        const p = new URLSearchParams(location.search);
        if (p.get("type")) type.value = p.get("type");
        if (q) { input.value=q; headerSearch.value=q; await runSearch(); }
        input.focus();
    } catch (error) {
        h.toast(error.message,"error");
    }
});
