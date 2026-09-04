window.LearnVaultQuizBuilder = (() => {
    const esc = (v) => String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");

    function create(cfg) {
        let units = [], questions = [];
        const selectedIds = () => Array.from(cfg.picker.querySelectorAll('[data-quiz-question]:checked')).map(x => Number(x.value));
        const syncSelected = () => { const n = selectedIds().length; cfg.selected.textContent = `${n} question${n===1?"":"s"}`; };

        function updateUnits() {
            const rows = units.filter(u => String(u.subject_id) === String(cfg.subject.value));
            cfg.unit.innerHTML = `<option value="">All / General</option>${rows.map(u=>`<option value="${esc(u.id)}">${esc(u.unit_name)}</option>`).join("")}`;
        }

        function renderQuestions() {
            if (!questions.length) {
                cfg.picker.innerHTML = `<div class="admin-empty-state large">No quiz questions are available for this selection yet.</div>`;
                cfg.count.textContent = "0 questions available";
                syncSelected();
                return;
            }

            const pending =
                questions.filter(
                    (question) =>
                        question.verification_status ===
                        "pending"
                ).length;

            cfg.count.textContent =
                `${questions.length} question${questions.length===1?"":"s"} available${
                    pending
                        ? ` • ${pending} new pending`
                        : ""
                }`;

            cfg.picker.innerHTML =
                questions.map(
                    (q, i) => {

                        const pendingQuestion =
                            q.verification_status ===
                            "pending";

                        return `
                            <label class="quiz-picker-item ${pendingQuestion ? "pending-inline-question" : ""}">
                                <input
                                    type="checkbox"
                                    value="${q.id}"
                                    data-quiz-question
                                >

                                <span class="quiz-picker-number">
                                    ${i + 1}
                                </span>

                                <span class="quiz-picker-copy">
                                    <strong>${esc(q.question_text)}</strong>

                                    <small>
                                        ${esc(String(q.question_type).replace("_"," "))}
                                        • ${esc(q.difficulty)}
                                        • ${esc(q.marks)} mark${Number(q.marks)===1?"":"s"}
                                        ${q.unit_name ? " • " + esc(q.unit_name) : ""}
                                    </small>

                                    ${
                                        pendingQuestion
                                            ? `<em class="inline-question-status">New • Pending with quiz approval</em>`
                                            : ""
                                    }
                                </span>
                            </label>
                        `;

                    }
                )
                .join("");

            cfg.picker
                .querySelectorAll(
                    "[data-quiz-question]"
                )
                .forEach(
                    (checkbox) =>
                        checkbox.addEventListener(
                            "change",
                            syncSelected
                        )
                );

            syncSelected();
        }

        async function loadMeta() {
            const r = await fetch('/api/quizzes/builder/meta',{credentials:'same-origin'}), j = await r.json();
            if (!r.ok) throw new Error(j.message || 'Unable to load Quiz Builder');
            const subjects = Array.isArray(j.subjects)?j.subjects:[]; units = Array.isArray(j.units)?j.units:[];
            cfg.subject.innerHTML = `<option value="">Select Subject</option>${subjects.map(s=>`<option value="${s.id}">${esc(s.subject_code)} — ${esc(s.subject_name)} • ${esc(s.course_name)}</option>`).join("")}`;
            updateUnits();
        }

        async function loadQuestions() {
            if (!cfg.subject.value) { questions=[]; cfg.picker.innerHTML='<div class="admin-empty-state">Select a subject first.</div>'; cfg.count.textContent='Select a subject to load questions.'; syncSelected(); return; }
            const p = new URLSearchParams({subjectId:cfg.subject.value}); if(cfg.unit.value)p.set('unitId',cfg.unit.value);
            cfg.picker.innerHTML='<div class="admin-empty-state">Loading approved questions...</div>';
            const r=await fetch(`/api/quizzes/builder/questions?${p}`,{credentials:'same-origin'}),j=await r.json(); if(!r.ok)throw new Error(j.message||'Unable to load questions'); questions=Array.isArray(j.questions)?j.questions:[]; renderQuestions();
        }

        cfg.subject.addEventListener('change',async()=>{updateUnits();await loadQuestions();}); cfg.unit.addEventListener('change',loadQuestions);
        cfg.selectAll.addEventListener('click',()=>{const boxes=Array.from(cfg.picker.querySelectorAll('[data-quiz-question]'));const on=boxes.some(b=>!b.checked);boxes.forEach(b=>b.checked=on);cfg.selectAll.textContent=on?'Clear All':'Select All';syncSelected();});
        function unitsForSelectedSubject() {
            return units.filter(
                (item) =>
                    String(item.subject_id) ===
                    String(cfg.subject.value)
            );
        }

        function selectQuestion(questionId) {
            const checkbox =
                cfg.picker.querySelector(
                    `[data-quiz-question][value="${Number(questionId)}"]`
                );

            if (!checkbox) {
                return false;
            }

            checkbox.checked =
                true;

            syncSelected();

            checkbox
                .closest(".quiz-picker-item")
                ?.scrollIntoView({
                    behavior:
                        "smooth",
                    block:
                        "nearest"
                });

            return true;
        }

        return {
            loadMeta,
            loadQuestions,
            selectedIds,
            unitsForSelectedSubject,
            selectQuestion,
            esc
        };
    }
    return {create,esc};
})();
