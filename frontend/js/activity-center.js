document.addEventListener("DOMContentLoaded", async () => {
    const h = window.LearnVaultLearning;
    if (!h) return;

    h.bindLogout();

    const role = document.body.dataset.role;
    const feed = document.getElementById("activityFeed");
    const count = document.getElementById("activityCountHero");
    const refresh = document.getElementById("activityRefreshButton");
    const headerSearch = document.getElementById("integrationHeaderSearch");

    const icons={resource:"▣",quiz:"✓",assignment:"▤",grade:"★",peer:"◉",submission:"↧",quiz_attempt:"↗",user:"◇"};

    function fmt(value){
        if(!value)return "-";
        const d=new Date(value);
        if(Number.isNaN(d.getTime()))return "-";
        return d.toLocaleString(undefined,{day:"numeric",month:"short",hour:"numeric",minute:"2-digit"});
    }

    function render(items){
        count.textContent=`${items.length} update${items.length===1?"":"s"}`;
        if(!items.length){feed.innerHTML='<div class="integration-empty"><strong>No recent activity yet</strong><span>New learning activity will appear here automatically.</span></div>';return;}
        feed.innerHTML=items.map(item=>`
            <a class="activity-item" href="${h.esc(item.url||"#")}">
                <span class="activity-icon">${icons[item.type]||"•"}</span>
                <div><strong>${h.esc(item.title)}</strong><p>${h.esc(item.detail||"")}</p></div>
                <time>${h.esc(fmt(item.createdAt))}</time>
            </a>`).join("");
    }

    async function load(){
        refresh.disabled=true;refresh.textContent="Refreshing...";
        try{
            const r=await fetch('/api/integration/activity',{credentials:'same-origin'});
            const data=await r.json();
            if(!r.ok)throw new Error(data.message||'Unable to load Activity Center');
            render(data.activity||[]);
        }catch(error){
            h.toast(error.message,'error');
            feed.innerHTML=`<div class="integration-empty">${h.esc(error.message)}</div>`;
        }finally{refresh.disabled=false;refresh.textContent="Refresh";}
    }

    refresh.addEventListener('click',load);
    headerSearch.addEventListener('keydown',e=>{if(e.key==='Enter'&&headerSearch.value.trim())location.href=`search.html?q=${encodeURIComponent(headerSearch.value.trim())}`;});

    try{await h.requireRole(role);await load();}catch(error){h.toast(error.message,'error');}
});
