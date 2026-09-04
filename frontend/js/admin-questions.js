document.addEventListener("DOMContentLoaded", async () => {

    const admin = window.LearnVaultAdmin;
    const helper = window.LearnVaultQuestionForm;

    if (!admin || !helper) return;

    const user = await admin.requireAdmin();
    if (!user) return;

    const unitForm = document.getElementById("adminUnitForm");
    const unitSubject = document.getElementById("adminUnitSubject");
    const unitName = document.getElementById("adminUnitName");
    const unitOrder = document.getElementById("adminUnitOrder");

    const form = document.getElementById("adminQuestionForm");
    const subject = document.getElementById("adminQuestionSubject");
    const unit = document.getElementById("adminQuestionUnit");
    const type = document.getElementById("adminQuestionType");
    const difficulty = document.getElementById("adminQuestionDifficulty");
    const marks = document.getElementById("adminQuestionMarks");
    const questionText = document.getElementById("adminQuestionText");
    const explanation = document.getElementById("adminQuestionExplanation");
    const correctAnswer = document.getElementById("adminCorrectAnswer");
    const mcqEditor = document.getElementById("adminMcqEditor");
    const simpleWrap = document.getElementById("adminSimpleAnswerWrap");

    const search = document.getElementById("adminQuestionSearch");
    const topSearch = document.getElementById("adminQuestionTopSearch");
    const statusFilter = document.getElementById("adminQuestionStatus");
    const subjectFilter = document.getElementById("adminQuestionSubjectFilter");
    const refresh = document.getElementById("adminQuestionRefresh");
    const list = document.getElementById("adminQuestionList");

    let subjects = [];
    let units = [];
    let searchTimer;

    const esc = helper.escapeHtml;

    helper.setupQuestionType(
        type,
        mcqEditor,
        simpleWrap,
        correctAnswer,
        "admin"
    );

    function updateUnitSelect() {
        const available = units.filter(
            (item) => String(item.subject_id) === String(subject.value)
        );

        unit.innerHTML = `
            <option value="">General / No Unit</option>
            ${available.map((item) => `
                <option value="${esc(item.id)}">
                    ${esc(item.unit_name)}
                </option>
            `).join("")}
        `;
    }

    async function loadMeta() {
        const response = await fetch(
            "/api/question-bank/meta",
            { credentials: "same-origin" }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message ||
                "Unable to load Question Bank options"
            );
        }

        subjects = Array.isArray(result.subjects)
            ? result.subjects
            : [];

        units = Array.isArray(result.units)
            ? result.units
            : [];

        const options = subjects.map((item) => `
            <option value="${esc(item.id)}">
                ${esc(item.subject_code)} — ${esc(item.subject_name)}
                • ${esc(item.course_name)}
            </option>
        `).join("");

        unitSubject.innerHTML =
            `<option value="">Select Subject</option>${options}`;

        subject.innerHTML =
            `<option value="">Select Subject</option>${options}`;

        subjectFilter.innerHTML =
            `<option value="">All Subjects</option>${options}`;

        updateUnitSelect();
    }

    async function sendJson(url, method, body) {
        const response = await fetch(
            url,
            {
                method,
                headers: {
                    "Content-Type":
                        "application/json"
                },
                credentials:
                    "same-origin",
                body:
                    JSON.stringify(body)
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message ||
                "Request failed"
            );
        }

        return result;
    }

    unitForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const button =
            unitForm.querySelector('button[type="submit"]');

        const oldText = button.textContent;

        try {
            button.disabled = true;
            button.textContent = "Adding...";

            await sendJson(
                "/api/question-bank/units",
                "POST",
                {
                    subjectId:
                        Number(unitSubject.value),

                    unitName:
                        unitName.value.trim(),

                    unitOrder:
                        Number(unitOrder.value || 1)
                }
            );

            admin.showToast("Subject unit added.");

            unitForm.reset();
            unitOrder.value = "1";

            await loadMeta();
        } catch (error) {
            admin.showToast(
                error.message,
                "error"
            );
        } finally {
            button.disabled = false;
            button.textContent = oldText;
        }
    });

    subject.addEventListener(
        "change",
        updateUnitSelect
    );

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const button =
            form.querySelector('button[type="submit"]');

        const oldText = button.textContent;

        try {
            button.disabled = true;
            button.textContent = "Saving...";

            const payload =
                helper.buildQuestionPayload({
                    subjectSelect:
                        subject,
                    unitSelect:
                        unit,
                    typeSelect:
                        type,
                    difficultySelect:
                        difficulty,
                    marksInput:
                        marks,
                    textInput:
                        questionText,
                    explanationInput:
                        explanation,
                    correctAnswerInput:
                        correctAnswer,
                    mcqEditor,
                    prefix:
                        "admin"
                });

            await sendJson(
                "/api/question-bank/questions",
                "POST",
                payload
            );

            admin.showToast(
                "Question added and approved."
            );

            form.reset();
            marks.value = "1";
            type.value = "mcq";

            type.dispatchEvent(
                new Event("change")
            );

            updateUnitSelect();

            await loadQuestions();
        } catch (error) {
            admin.showToast(
                error.message,
                "error"
            );
        } finally {
            button.disabled = false;
            button.textContent = oldText;
        }
    });

    async function loadQuestions() {
        const params = new URLSearchParams();

        if (search.value.trim()) {
            params.set(
                "search",
                search.value.trim()
            );
        }

        if (statusFilter.value) {
            params.set(
                "status",
                statusFilter.value
            );
        }

        if (subjectFilter.value) {
            params.set(
                "subjectId",
                subjectFilter.value
            );
        }

        list.innerHTML =
            `<div class="admin-empty-state">Loading Question Bank...</div>`;

        try {
            const response = await fetch(
                `/api/question-bank/admin/questions?${params.toString()}`,
                { credentials: "same-origin" }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message ||
                    "Unable to load Question Bank"
                );
            }

            const questions =
                Array.isArray(result.questions)
                    ? result.questions
                    : [];

            document.getElementById("adminQuestionTotal").textContent =
                String(questions.length);

            document.getElementById("adminQuestionPending").textContent =
                String(
                    questions.filter(
                        (item) =>
                            item.verification_status === "pending"
                    ).length
                );

            document.getElementById("adminQuestionApproved").textContent =
                String(
                    questions.filter(
                        (item) =>
                            item.verification_status === "approved"
                    ).length
                );

            document.getElementById("adminQuestionRejected").textContent =
                String(
                    questions.filter(
                        (item) =>
                            item.verification_status === "rejected"
                    ).length
                );

            if (!questions.length) {
                list.innerHTML =
                    `<div class="admin-empty-state large">No questions match the current filters.</div>`;
                return;
            }

            list.innerHTML = questions.map((item) => `
                <article class="question-review-card">

                    <div>
                        <div class="question-card-tags">
                            <span>${esc(
                                String(item.question_type)
                                    .replace("_", " ")
                            )}</span>

                            <span>${esc(item.difficulty)}</span>

                            <span>
                                ${esc(item.marks)}
                                mark${Number(item.marks) === 1 ? "" : "s"}
                            </span>
                        </div>

                        <h3>${esc(item.question_text)}</h3>

                        <p>
                            ${esc(item.subject_code)}
                            — ${esc(item.subject_name)}
                            ${item.unit_name
                                ? " • " + esc(item.unit_name)
                                : ""}
                        </p>

                        <small>
                            Created by ${esc(item.creator_name)}
                            • ${esc(item.course_name)}
                        </small>
                    </div>

                    <div class="question-review-card-actions">

                        <span class="status-pill ${esc(item.verification_status)}">
                            ${
                                item.verification_status === "approved"
                                    ? "Published"
                                    : item.verification_status === "rejected"
                                        ? "Hidden"
                                        : "Legacy Pending"
                            }
                        </span>

                        ${
                            item.verification_status === "approved"
                                ? `
                                    <button
                                        type="button"
                                        class="table-action-button reject"
                                        data-question-id="${esc(item.id)}"
                                        data-status="rejected"
                                    >
                                        Hide
                                    </button>
                                `
                                : `
                                    <button
                                        type="button"
                                        class="table-action-button approve"
                                        data-question-id="${esc(item.id)}"
                                        data-status="approved"
                                    >
                                        Restore
                                    </button>
                                `
                        }
                    </div>

                </article>
            `).join("");

            list.querySelectorAll("[data-question-id]")
                .forEach((button) => {
                    button.addEventListener("click", async () => {
                        try {
                            await sendJson(
                                `/api/question-bank/admin/questions/${encodeURIComponent(button.dataset.questionId)}/verification`,
                                "PATCH",
                                {
                                    status:
                                        button.dataset.status
                                }
                            );

                            admin.showToast(
                                button.dataset.status === "approved"
                                    ? "Question restored and published."
                                    : "Question hidden from students."
                            );

                            await loadQuestions();
                        } catch (error) {
                            admin.showToast(
                                error.message,
                                "error"
                            );
                        }
                    });
                });
        } catch (error) {
            list.innerHTML =
                `<div class="admin-empty-state large">${esc(error.message)}</div>`;
        }
    }

    search.addEventListener("input", () => {
        clearTimeout(searchTimer);

        searchTimer =
            setTimeout(
                loadQuestions,
                260
            );
    });

    topSearch.addEventListener("input", () => {
        search.value = topSearch.value;

        clearTimeout(searchTimer);

        searchTimer =
            setTimeout(
                loadQuestions,
                260
            );
    });

    statusFilter.addEventListener(
        "change",
        loadQuestions
    );

    subjectFilter.addEventListener(
        "change",
        loadQuestions
    );

    refresh.addEventListener(
        "click",
        loadQuestions
    );

    try {
        await loadMeta();
        await loadQuestions();
    } catch (error) {
        admin.showToast(
            error.message,
            "error"
        );
    }

});