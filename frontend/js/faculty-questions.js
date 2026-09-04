document.addEventListener("DOMContentLoaded", async () => {

    const faculty = window.LearnVaultFaculty;
    const helper = window.LearnVaultQuestionForm;

    if (!faculty || !helper) return;

    const user = await faculty.requireFaculty();
    if (!user) return;

    const unitForm = document.getElementById("facultyUnitForm");
    const unitSubject = document.getElementById("facultyUnitSubject");
    const unitName = document.getElementById("facultyUnitName");
    const unitOrder = document.getElementById("facultyUnitOrder");

    const form = document.getElementById("facultyQuestionForm");
    const subject = document.getElementById("facultyQuestionSubject");
    const unit = document.getElementById("facultyQuestionUnit");
    const type = document.getElementById("facultyQuestionType");
    const difficulty = document.getElementById("facultyQuestionDifficulty");
    const marks = document.getElementById("facultyQuestionMarks");
    const questionText = document.getElementById("facultyQuestionText");
    const explanation = document.getElementById("facultyQuestionExplanation");
    const correctAnswer = document.getElementById("facultyCorrectAnswer");
    const mcqEditor = document.getElementById("facultyMcqEditor");
    const simpleWrap = document.getElementById("facultySimpleAnswerWrap");
    const list = document.getElementById("facultyQuestionList");
    const topSearch = document.getElementById("facultyQuestionTopSearch");

    let subjects = [];
    let units = [];
    let allQuestions = [];

    const esc = helper.escapeHtml;

    helper.setupQuestionType(
        type,
        mcqEditor,
        simpleWrap,
        correctAnswer,
        "faculty"
    );

    function updateUnits() {
        const available =
            units.filter(
                (item) =>
                    String(item.subject_id) ===
                    String(subject.value)
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
                "Unable to load assigned subjects"
            );
        }

        subjects =
            Array.isArray(result.subjects)
                ? result.subjects
                : [];

        units =
            Array.isArray(result.units)
                ? result.units
                : [];

        const subjectOptions =
            subjects.map((item) => `
                <option value="${esc(item.id)}">
                    ${esc(item.subject_code)}
                    — ${esc(item.subject_name)}
                    • ${esc(item.course_name)}
                </option>
            `).join("");

        subject.innerHTML = `
            <option value="">Select Assigned Subject</option>
            ${subjectOptions}
        `;

        unitSubject.innerHTML = `
            <option value="">Select Assigned Subject</option>
            ${subjectOptions}
        `;

        updateUnits();
    }

    async function loadMine() {
        const response = await fetch(
            "/api/question-bank/questions/mine",
            { credentials: "same-origin" }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message ||
                "Unable to load your questions"
            );
        }

        allQuestions =
            Array.isArray(result.questions)
                ? result.questions
                : [];

        renderQuestions();
    }

    function renderQuestions() {
        const term =
            topSearch.value
                .trim()
                .toLowerCase();

        const questions =
            allQuestions.filter((item) => {
                if (!term) return true;

                return [
                    item.question_text,
                    item.subject_name,
                    item.subject_code,
                    item.course_name,
                    item.unit_name
                ]
                    .filter(Boolean)
                    .some((value) =>
                        String(value)
                            .toLowerCase()
                            .includes(term)
                    );
            });

        if (!questions.length) {
            list.innerHTML =
                `<div class="admin-empty-state large">No questions found.</div>`;
            return;
        }

        list.innerHTML = questions.map((item) => `
            <article class="faculty-question-card">

                <div>
                    <div class="question-card-tags">
                        <span>
                            ${esc(
                                String(item.question_type)
                                    .replace("_", " ")
                            )}
                        </span>

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

                    <span class="status-pill ${esc(item.verification_status)}">
                        ${
                            item.verification_status === "approved"
                                ? "Published"
                                : item.verification_status === "rejected"
                                    ? "Hidden"
                                    : "Legacy Pending"
                        }
                    </span>
                </div>

                <div class="faculty-content-control-actions">
                    <button
                        type="button"
                        class="table-action-button"
                        data-question-publication="${esc(item.id)}"
                        data-next-publication="${item.verification_status === "approved" ? "0" : "1"}"
                    >
                        ${item.verification_status === "approved" ? "Unpublish" : "Publish"}
                    </button>

                    <button
                        type="button"
                        class="table-action-button reject"
                        data-delete-question="${esc(item.id)}"
                    >
                        Delete
                    </button>
                </div>

            </article>
        `).join("");

        list.querySelectorAll("[data-question-publication]")
            .forEach((button) => {
                button.addEventListener("click", async () => {
                    try {
                        const response = await fetch(
                            `/api/question-bank/questions/${encodeURIComponent(button.dataset.questionPublication)}/publication`,
                            {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                credentials: "same-origin",
                                body: JSON.stringify({
                                    isPublished:
                                        button.dataset.nextPublication === "1"
                                })
                            }
                        );

                        const result = await response.json();

                        if (!response.ok) {
                            throw new Error(
                                result.message ||
                                "Unable to update publication"
                            );
                        }

                        faculty.showToast(result.message);
                        await loadMine();

                    } catch (error) {
                        faculty.showToast(error.message, "error");
                    }
                });
            });


        list.querySelectorAll("[data-delete-question]")
            .forEach((button) => {
                button.addEventListener("click", async () => {
                    if (!window.confirm("Delete this question?")) {
                        return;
                    }

                    try {
                        const response = await fetch(
                            `/api/question-bank/questions/${encodeURIComponent(button.dataset.deleteQuestion)}`,
                            {
                                method: "DELETE",
                                credentials: "same-origin"
                            }
                        );

                        const result = await response.json();

                        if (!response.ok) {
                            throw new Error(
                                result.message ||
                                "Unable to delete question"
                            );
                        }

                        faculty.showToast("Question deleted.");

                        await loadMine();
                    } catch (error) {
                        faculty.showToast(
                            error.message,
                            "error"
                        );
                    }
                });
            });
    }


    unitForm.addEventListener(
        "submit",
        async (event) => {
            event.preventDefault();

            const button =
                unitForm.querySelector('button[type="submit"]');

            const oldText =
                button.textContent;

            try {
                button.disabled = true;
                button.textContent = "Adding...";

                const response = await fetch(
                    "/api/question-bank/units",
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "same-origin",
                        body: JSON.stringify({
                            subjectId: Number(unitSubject.value),
                            unitName: unitName.value.trim(),
                            unitOrder: Number(unitOrder.value || 1)
                        })
                    }
                );

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(
                        result.message ||
                        "Unable to add unit"
                    );
                }

                faculty.showToast("Unit / Module added.");

                const selectedSubjectId =
                    unitSubject.value;

                unitForm.reset();
                unitOrder.value = "1";

                await loadMeta();

                if (selectedSubjectId) {
                    subject.value =
                        selectedSubjectId;
                    updateUnits();
                }

            } catch (error) {
                faculty.showToast(error.message, "error");
            } finally {
                button.disabled = false;
                button.textContent = oldText;
            }
        }
    );


    subject.addEventListener(
        "change",
        updateUnits
    );

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const button =
            form.querySelector('button[type="submit"]');

        const oldText =
            button.textContent;

        try {
            button.disabled = true;
            button.textContent = "Publishing...";

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
                        "faculty"
                });

            const response = await fetch(
                "/api/question-bank/questions",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    credentials:
                        "same-origin",

                    body:
                        JSON.stringify(payload)
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message ||
                    "Unable to save question"
                );
            }

            faculty.showToast(
                result.message
            );

            form.reset();
            marks.value = "1";
            type.value = "mcq";

            type.dispatchEvent(
                new Event("change")
            );

            updateUnits();

            await loadMine();
        } catch (error) {
            faculty.showToast(
                error.message,
                "error"
            );
        } finally {
            button.disabled = false;
            button.textContent = oldText;
        }
    });

    topSearch.addEventListener(
        "input",
        renderQuestions
    );

    try {
        await loadMeta();
        await loadMine();
    } catch (error) {
        faculty.showToast(
            error.message,
            "error"
        );
    }

});