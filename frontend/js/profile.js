document.addEventListener("DOMContentLoaded", async () => {
    const h=window.LearnVaultLearning;if(!h)return;
    h.bindLogout();

    const role=document.body.dataset.role;
    const profileForm=document.getElementById('profileForm');
    const passwordForm=document.getElementById('passwordForm');
    const headerSearch=document.getElementById('integrationHeaderSearch');

    function renderAccess(data){
        const box=document.getElementById('profileAcademicAccess');
        const title=document.getElementById('academicAccessTitle');
        const desc=document.getElementById('academicAccessDescription');

        if(role==='student'){
            const a=data.academic||{};
            title.textContent='Student academic path';
            desc.textContent='Your learning content is filtered using this Course / Program and Current Level / Year.';
            box.innerHTML=`
                <article><span>Domain</span><strong>${h.esc(a.domain_name||'-')}</strong></article>
                <article><span>Course / Program</span><strong>${h.esc(a.course_name||'-')}</strong><small>${h.esc(a.course_code||'')}</small></article>
                <article><span>Current Level / Year</span><strong>${h.esc(a.level_name||'Course-wide')}</strong></article>
                <article><span>Department / Stream</span><strong>${h.esc(a.department_name||'-')}</strong><small>${h.esc(a.department_code||'')}</small></article>`;
            return;
        }

        if(role==='faculty'){
            title.textContent='Assigned teaching subjects';
            desc.textContent='Admin controls subject assignment. You control learning content inside these subjects.';
            const rows=data.subjects||[];
            box.innerHTML=rows.length?rows.map(s=>`<article><span>${h.esc(s.course_name||'')}</span><strong>${h.esc(s.subject_name)}</strong><small>${h.esc(s.subject_code)}${s.level_name?' • '+h.esc(s.level_name):''}</small></article>`).join(''):'<div class="integration-empty">No active subjects are assigned yet.</div>';
            return;
        }

        title.textContent='Administrator access';
        desc.textContent='Admin governs academic structure, users, Faculty assignments, reports and full content oversight.';
        box.innerHTML=`
            <article><span>Role</span><strong>System Administrator</strong></article>
            <article><span>Academic Control</span><strong>Full</strong><small>Domains → Courses → Levels → Subjects</small></article>
            <article><span>Content Visibility</span><strong>System-wide</strong><small>Resources, Questions, Quizzes, Assignments, Skills, Peer Groups</small></article>
            <article><span>Reports</span><strong>Enabled</strong><small>CSV export + database system check</small></article>`;
    }

    function render(data){
        const p=data.profile;
        document.getElementById('profileIdentity').textContent=p.fullName;
        document.getElementById('profileRoleStatus').textContent=`${String(p.role).toUpperCase()} • ${p.status}`;
        document.getElementById('profileUserId').value=p.id;
        document.getElementById('profileUsername').value=p.username||'';
        document.getElementById('profileEmail').value=p.email||'';
        document.getElementById('profileFullName').value=p.fullName||'';
        document.getElementById('profilePhone').value=p.phone||'';
        renderAccess(data);
    }

    async function load(){
        const r=await fetch('/api/integration/profile',{credentials:'same-origin'});
        const data=await r.json();
        if(!r.ok)throw new Error(data.message||'Unable to load profile');
        render(data);
    }

    profileForm.addEventListener('submit',async e=>{
        e.preventDefault();const b=profileForm.querySelector('button[type="submit"]'),old=b.textContent;
        try{b.disabled=true;b.textContent='Saving...';await h.sendJson('/api/integration/profile','PATCH',{fullName:document.getElementById('profileFullName').value.trim(),phone:document.getElementById('profilePhone').value.trim()});h.toast('Profile updated.');await load();}
        catch(error){h.toast(error.message,'error');}finally{b.disabled=false;b.textContent=old;}
    });

    passwordForm.addEventListener('submit',async e=>{
        e.preventDefault();
        const current=document.getElementById('currentPassword').value;
        const next=document.getElementById('newPassword').value;
        const confirm=document.getElementById('confirmPassword').value;
        if(next!==confirm){h.toast('New Password and Confirm Password do not match.','error');return;}
        const b=passwordForm.querySelector('button[type="submit"]'),old=b.textContent;
        try{b.disabled=true;b.textContent='Changing...';await h.sendJson('/api/integration/profile/password','PATCH',{currentPassword:current,newPassword:next,confirmPassword:confirm});passwordForm.reset();h.toast('Password changed successfully.');}
        catch(error){h.toast(error.message,'error');}finally{b.disabled=false;b.textContent=old;}
    });

    headerSearch.addEventListener('keydown',e=>{if(e.key==='Enter'&&headerSearch.value.trim())location.href=`search.html?q=${encodeURIComponent(headerSearch.value.trim())}`;});

    try{await h.requireRole(role);await load();}catch(error){h.toast(error.message,'error');}
});
