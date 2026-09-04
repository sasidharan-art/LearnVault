document.addEventListener("DOMContentLoaded", async () => {
    const h=window.LearnVaultLearning;if(!h)return;
    h.bindLogout();
    const headerSearch=document.getElementById('integrationHeaderSearch');

    function renderReports(data){
        const o=data.overview||{};
        document.getElementById('reportStudents').textContent=o.students||0;
        document.getElementById('reportUsersText').textContent=`${o.totalUsers||0} total users • ${o.activeUsers||0} active`;
        document.getElementById('reportResources').textContent=o.resources||0;
        document.getElementById('reportQuizAttempts').textContent=o.quizAttempts||0;
        document.getElementById('reportQuizAverage').textContent=`${Number(o.averageQuizScore||0).toFixed(0)}% average score`;
        document.getElementById('reportSubmissions').textContent=o.submissions||0;
        document.getElementById('reportPendingGrading').textContent=`${o.pendingGrading||0} awaiting grading`;

        const courses=data.courses||[];
        document.getElementById('courseReportBody').innerHTML=courses.length?courses.map(c=>`<tr><td><strong>${h.esc(c.course_name)}</strong><small>${h.esc(c.course_code||'')}</small></td><td>${Number(c.students||0)}</td><td>${Number(c.subjects||0)}</td><td>${Number(c.published_resources||0)}</td><td>${Number(c.published_quizzes||0)}</td><td>${Number(c.published_assignments||0)}</td><td>${Number(c.average_quiz_score||0).toFixed(0)}%</td></tr>`).join(''):'<tr><td colspan="7">No active Courses found.</td></tr>';

        const faculty=data.faculty||[];
        document.getElementById('facultyReportBody').innerHTML=faculty.length?faculty.map(f=>`<tr><td><strong>${h.esc(f.full_name)}</strong><small>${h.esc(f.username||f.email||'')}</small></td><td>${Number(f.assigned_subjects||0)}</td><td>${Number(f.resources||0)}</td><td>${Number(f.questions||0)}</td><td>${Number(f.quizzes||0)}</td><td>${Number(f.assignments||0)}</td><td>${Number(f.peer_groups||0)}</td></tr>`).join(''):'<tr><td colspan="7">No Faculty accounts found.</td></tr>';
    }

    function renderCheck(data){
        document.getElementById('reportSystemHealth').textContent=data.healthy?'Database Ready':'Database Needs Attention';
        document.getElementById('reportSystemDetail').textContent=data.healthy?`${data.existingRequiredTables}/${data.expectedTables} required tables found • MySQL ${data.mysqlVersion}`:`${data.missing.length} required table${data.missing.length===1?'':'s'} missing`;
        document.getElementById('systemTableCheckGrid').innerHTML=(data.tables||[]).map(t=>`<article class="${t.exists?'ok':'missing'}"><span>${t.exists?'✓':'!'}</span><strong>${h.esc(t.name)}</strong><small>${t.exists?'Available':'Missing'}</small></article>`).join('');
    }

    headerSearch.addEventListener('keydown',e=>{if(e.key==='Enter'&&headerSearch.value.trim())location.href=`search.html?q=${encodeURIComponent(headerSearch.value.trim())}`;});

    try{
        await h.requireRole('admin');
        const [rr,sr]=await Promise.all([
            fetch('/api/integration/admin/reports',{credentials:'same-origin'}),
            fetch('/api/integration/admin/system-check',{credentials:'same-origin'})
        ]);
        const reports=await rr.json(),system=await sr.json();
        if(!rr.ok)throw new Error(reports.message||'Unable to load reports');
        if(!sr.ok)throw new Error(system.message||'Unable to run system check');
        renderReports(reports);renderCheck(system);
    }catch(error){h.toast(error.message,'error');}
});
