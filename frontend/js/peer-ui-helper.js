window.LearnVaultPeerUI=(()=>{
const h=window.LearnVaultLearning;
const text=(v,fallback='—')=>{const s=String(v??'').trim();return s?s:fallback;};
const date=(v)=>{const d=new Date(v);return Number.isNaN(d.getTime())?'Just now':d.toLocaleString(undefined,{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'});};
function posts(items,role){
if(!Array.isArray(items)||!items.length)return '<div class="progress-empty"><strong>No discussions yet</strong><span>Start the first academic discussion.</span></div>';
return items.map(p=>{
const author=text(p.author_name,'Student');
const authorRole=text(p.author_role,'Student');
const title=text(p.title,'Untitled discussion');
const body=text(p.body,'No discussion content available.');
const status=text(p.status,'visible');
return `<article class="peer-post ${status==='hidden'?'hidden-content':''}">
<div class="peer-post-head"><div><span>${h.esc(authorRole)}</span><strong>${h.esc(author)}</strong><small>${date(p.created_at)}</small></div>${role==='admin'?`<button class="table-action-button" data-post-mod="${p.id}" data-next="${status==='hidden'?'visible':'hidden'}">${status==='hidden'?'Show':'Hide'}</button>`:''}</div>
<h3>${h.esc(title)}</h3><p>${h.esc(body)}</p>
<div class="peer-comment-list">${(Array.isArray(p.comments)?p.comments:[]).map(c=>`<article class="peer-comment ${c.status==='hidden'?'hidden-content':''}"><div><strong>${h.esc(text(c.author_name,'Student'))}</strong><span>${h.esc(text(c.author_role,'Student'))}</span><small>${date(c.created_at)}</small></div><p>${h.esc(text(c.body,'No reply content available.'))}</p>${role==='admin'?`<button class="table-action-button" data-comment-mod="${c.id}" data-next="${c.status==='hidden'?'visible':'hidden'}">${c.status==='hidden'?'Show':'Hide'}</button>`:''}</article>`).join('')}</div>
<form class="peer-reply-form" data-reply="${p.id}"><input name="reply" required placeholder="Write a helpful reply..."><button class="button button-soft compact" type="submit">Reply</button></form>
</article>`;
}).join('');
}
function bindReplies(container,reload){container.querySelectorAll('[data-reply]').forEach(f=>f.addEventListener('submit',async e=>{e.preventDefault();try{await h.sendJson(`/api/peer/posts/${f.dataset.reply}/comments`,'POST',{body:f.elements.reply.value.trim()});f.reset();h.toast('Reply added successfully.');await reload();}catch(er){h.toast(er?.message||'Unable to add reply.','error');}}));}
return{posts,bindReplies};})();
