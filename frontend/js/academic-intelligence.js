document.addEventListener("DOMContentLoaded", async () => {
    const path = window.location.pathname.toLowerCase();
    const role = path.includes("/faculty/") ? "faculty" : path.includes("/admin/") ? "admin" : "student";
    const api = role === "student" ? "/api/intelligence/student" : role === "faculty" ? "/api/intelligence/faculty/risk" : "/api/intelligence/admin/overview";
    const root = document.getElementById("intelligenceRoot");
    const rail = document.getElementById("primaryNavigation");
    if (rail && !rail.children.length) {
        const links = role === "student" ? [
            ["dashboard.html","Dashboard"],["resources.html","Resources"],["quizzes.html","Quizzes"],["assignments.html","Assignments"],["academic-intelligence.html","Academic Intelligence"],["career-center.html","Career Center"],["innovation-center.html","Innovation Lab"],["profile.html","Profile"]
        ] : role === "faculty" ? [
            ["dashboard.html","Dashboard"],["resources.html","Resources"],["assignments.html","Assignments"],["academic-intelligence.html","Early Risk Monitor"],["live-classes.html","Live Classes"],["innovation-center.html","Innovation Center"],["profile.html","Profile"]
        ] : [
            ["dashboard.html","Dashboard"],["users.html","Users"],["catalog-studio.html","Catalog Studio"],["academic-intelligence.html","Academic Intelligence"],["student-advancement.html","Student Advancement"],["live-analytics.html","Live Intelligence"],["reports.html","Reports"]
        ];
        rail.innerHTML = links.map(([href,label]) => `<a href="${href}" class="rail-item ${href==='academic-intelligence.html'?'active':''}"><span class="rail-label">${label}</span></a>`).join("");
    }
    const esc = value => String(value ?? "-").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
    try {
        const response = await fetch(api, {credentials:"same-origin"});
        const data = await response.json();
        if(response.status===401){window.location.replace("../login.html");return;}
        if(!response.ok) throw new Error(data.message||"Unable to load Academic Intelligence");
        if(role === "student") renderStudent(data);
        else if(role === "faculty") renderFaculty(data);
        else renderAdmin(data);
    } catch(error){ root.innerHTML=`<div class="commercial-dashboard-panel"><h2>Academic Intelligence unavailable</h2><p>${esc(error.message)}</p></div>`; }

    function renderStudent(data){
        const s=data.signals||{};
        const score=Number(s.score||0);
        root.innerHTML=`
        <div class="commercial-dashboard-panel">
          <div class="commercial-dashboard-panel-head"><span class="eyebrow">AI STUDENT SUCCESS CENTER</span><h1>Academic Intelligence</h1><p>Explainable signals from your attendance, assessments, assignments, engagement and skill progress.</p></div>
          <div class="lv-intelligence-grid">
            <div class="lv-intelligence-card"><div class="lv-label">AI Success Score</div><div class="lv-score-ring" style="--score:${score}"><div class="lv-score-inner"><strong>${score}</strong><span>/ 100</span></div></div><div style="text-align:center;font-weight:800">${esc(s.label)}</div></div>
            <div class="lv-intelligence-card"><div class="lv-label">Attendance</div><div class="lv-value">${Number(s.attendanceRate||0)}%</div><p>Transparent attendance signal used for early intervention.</p></div>
            <div class="lv-intelligence-card"><div class="lv-label">Quiz Average</div><div class="lv-value">${Number(s.quizAverage||0)}%</div><p>${Number(s.attempts||0)} submitted attempt(s).</p></div>
            <div class="lv-intelligence-card"><div class="lv-label">Assignments</div><div class="lv-value">${Number(s.assignmentCompletion||0)}%</div><p>Completion across published course assignments.</p></div>
          </div>
        </div>
        <div class="commercial-dashboard-panel"><div class="commercial-dashboard-panel-head"><span class="eyebrow">EARLY INTERVENTION</span><h2>Signals that need attention</h2></div>${(s.alerts||[]).length ? s.alerts.map(a=>`<div class="lv-alert ${a.severity==='medium'?'medium':''}"><strong>${esc(a.type)}</strong><div>${esc(a.message)}</div></div>`).join("") : '<div class="lv-demo-note"><strong>You are on track.</strong><div>No high-priority learning risk signal is currently detected.</div></div>'}</div>
        <div class="commercial-dashboard-panel"><div class="commercial-dashboard-panel-head"><span class="eyebrow">PERSONALIZED ACTIONS</span><h2>Recommended next steps</h2></div><ol>${(s.recommendations||[]).map(r=>`<li style="margin:10px 0">${esc(r)}</li>`).join("")}</ol><div class="lv-demo-note"><strong>Database innovation:</strong> ${esc(data.innovation?.name)}. Formula: ${esc(data.innovation?.formula)}</div></div>`;
    }
    function renderFaculty(data){
        const rows=data.students||[];
        root.innerHTML=`<div class="commercial-dashboard-panel"><div class="commercial-dashboard-panel-head"><span class="eyebrow">FACULTY PRODUCTIVITY + EARLY RISK MONITOR</span><h1>Students Requiring Attention</h1><p>Prioritize mentoring using transparent academic signals rather than waiting for final results.</p></div><div class="lv-risk-list">${rows.length?rows.map(s=>`<div class="lv-risk-row"><div><strong>${esc(s.full_name)}</strong><div>${esc(s.course_name||"")} · Attendance ${Number(s.attendanceRate||0)}% · Quiz ${Number(s.quizAverage||0)}%</div></div><div><strong>${Number(s.score||0)}</strong><div>Success Score</div></div><div class="lv-risk-badge lv-risk-${s.band}">${esc(s.label)}</div></div>`).join(""):'<div class="lv-demo-note">No assigned learners with activity data were found.</div>'}</div></div>`;
    }
    function renderAdmin(data){
        const o=data.overview||{}; const rows=data.atRisk||[];
        root.innerHTML=`<div class="commercial-dashboard-panel"><div class="commercial-dashboard-panel-head"><span class="eyebrow">SMART EDUCATION ANALYTICS</span><h1>Institutional Academic Intelligence</h1><p>One view of student risk, learning quality and intervention readiness.</p></div><div class="lv-intelligence-grid">
          ${card("Active Students",o.studentCount)}${card("Average Success",o.averageSuccessScore+"%")} ${card("Average Attendance",o.averageAttendance+"%")} ${card("Assignment Completion",o.averageAssignmentCompletion+"%")} ${card("High Risk",o.highRisk)} ${card("Needs Attention",o.needsAttention)} ${card("On Track",o.onTrack)} ${card("Graduation Readiness",o.graduationReadiness+"%")}
        </div></div><div class="commercial-dashboard-panel"><div class="commercial-dashboard-panel-head"><span class="eyebrow">EARLY WARNING</span><h2>Priority Learners</h2></div><div class="lv-risk-list">${rows.length?rows.map(s=>`<div class="lv-risk-row"><div><strong>${esc(s.full_name)}</strong><div>${esc(s.course_name||"")} · ${esc(s.department_name||"")}</div></div><div><strong>${Number(s.score||0)}</strong><div>Success Score</div></div><div class="lv-risk-badge lv-risk-${s.band}">${esc(s.label)}</div></div>`).join(""):'<div class="lv-demo-note">No priority learners detected.</div>'}</div></div><div class="commercial-dashboard-panel"><div class="lv-demo-note"><strong>Novel DBMS innovation:</strong> Explainable Early Intervention Engine. Risk is calculated from relational signals stored in MySQL and surfaced through indexed, role-protected queries. The system supports intervention—not automatic academic punishment.</div></div>`;
    }
    function card(label,value){return `<div class="lv-intelligence-card"><div class="lv-label">${esc(label)}</div><div class="lv-value">${esc(value)}</div></div>`;}
});
