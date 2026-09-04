document.addEventListener("DOMContentLoaded", async () => {

    const faculty =
        window.LearnVaultFaculty;

    const quizBuilder =
        window.LearnVaultQuizBuilder;

    const questionHelper =
        window.LearnVaultQuestionForm;


    if (
        !faculty ||
        !quizBuilder ||
        !questionHelper
    ) {
        return;
    }


    if (
        !(
            await faculty.requireFaculty()
        )
    ) {
        return;
    }


    const form =
        document.getElementById(
            "facultyQuizForm"
        );

    const subject =
        document.getElementById(
            "facultyQuizSubject"
        );

    const unit =
        document.getElementById(
            "facultyQuizUnit"
        );

    const picker =
        document.getElementById(
            "facultyQuizQuestionPicker"
        );

    const list =
        document.getElementById(
            "facultyQuizList"
        );

    const topSearch =
        document.getElementById(
            "facultyQuizTopSearch"
        );


    const addQuestionButton =
        document.getElementById(
            "facultyAddQuizQuestion"
        );

    const inlineEditor =
        document.getElementById(
            "facultyInlineQuestionEditor"
        );

    const cancelInline =
        document.getElementById(
            "facultyCancelInlineQuestion"
        );

    const resetInline =
        document.getElementById(
            "facultyResetInlineQuestion"
        );

    const saveInline =
        document.getElementById(
            "facultySaveInlineQuestion"
        );

    const inlineType =
        document.getElementById(
            "facultyInlineQuestionType"
        );

    const inlineDifficulty =
        document.getElementById(
            "facultyInlineQuestionDifficulty"
        );

    const inlineMarks =
        document.getElementById(
            "facultyInlineQuestionMarks"
        );

    const inlineText =
        document.getElementById(
            "facultyInlineQuestionText"
        );

    const inlineUnit =
        document.getElementById(
            "facultyInlineQuestionUnit"
        );

    const inlineMcq =
        document.getElementById(
            "facultyInlineMcqEditor"
        );

    const inlineSimpleWrap =
        document.getElementById(
            "facultyInlineSimpleAnswerWrap"
        );

    const inlineCorrect =
        document.getElementById(
            "facultyInlineCorrectAnswer"
        );

    const inlineExplanation =
        document.getElementById(
            "facultyInlineQuestionExplanation"
        );


    let allQuizzes = [];


    const builder =
        quizBuilder.create({
            subject,
            unit,
            picker,

            count:
                document.getElementById(
                    "facultyBuilderCount"
                ),

            selected:
                document.getElementById(
                    "facultySelectedCount"
                ),

            selectAll:
                document.getElementById(
                    "facultySelectAllQuestions"
                )
        });


    questionHelper.setupQuestionType(
        inlineType,
        inlineMcq,
        inlineSimpleWrap,
        inlineCorrect,
        "facultyInlineQuiz"
    );


    function esc(value) {
        return quizBuilder.esc(value);
    }


    function syncInlineUnits() {

        const rows =
            builder.unitsForSelectedSubject();


        inlineUnit.innerHTML =
            `
            <option value="">
                General / No Unit
            </option>

            ${
                rows.map(
                    (row) => `
                        <option value="${esc(row.id)}">
                            ${esc(row.unit_name)}
                        </option>
                    `
                ).join("")
            }
            `;


        if (
            unit.value
        ) {
            inlineUnit.value =
                unit.value;

            inlineUnit.disabled =
                true;

        } else {

            inlineUnit.disabled =
                false;

        }

    }


    function resetInlineQuestion() {

        inlineType.value =
            "mcq";

        inlineType.dispatchEvent(
            new Event(
                "change"
            )
        );

        inlineDifficulty.value =
            "medium";

        inlineMarks.value =
            "1";

        inlineText.value =
            "";

        inlineCorrect.value =
            "";

        inlineExplanation.value =
            "";


        inlineMcq
            .querySelectorAll(
                "[data-mcq-option]"
            )
            .forEach(
                (input) => {
                    input.value =
                        "";
                }
            );


        const firstCorrect =
            inlineMcq.querySelector(
                'input[type="radio"]'
            );


        if (firstCorrect) {
            firstCorrect.checked =
                true;
        }


        syncInlineUnits();

    }


    function openInlineQuestion() {

        if (
            !subject.value
        ) {
            faculty.showToast(
                "Select an Assigned Subject first.",
                "error"
            );

            subject.focus();

            return;
        }


        syncInlineUnits();

        inlineEditor.hidden =
            false;


        addQuestionButton.textContent =
            "Question Editor Open";


        setTimeout(
            () => {
                inlineText.focus();
            },
            30
        );

    }


    function closeInlineQuestion() {

        inlineEditor.hidden =
            true;

        addQuestionButton.textContent =
            "+ Add New Question";

    }


    addQuestionButton.addEventListener(
        "click",
        () => {

            if (
                inlineEditor.hidden
            ) {
                openInlineQuestion();
            } else {
                closeInlineQuestion();
            }

        }
    );


    cancelInline.addEventListener(
        "click",
        closeInlineQuestion
    );


    resetInline.addEventListener(
        "click",
        resetInlineQuestion
    );


    subject.addEventListener(
        "change",
        () => {

            closeInlineQuestion();

        }
    );


    unit.addEventListener(
        "change",
        () => {

            if (
                !inlineEditor.hidden
            ) {
                syncInlineUnits();
            }

        }
    );


    saveInline.addEventListener(
        "click",
        async () => {

            if (
                !subject.value
            ) {
                faculty.showToast(
                    "Select an Assigned Subject first.",
                    "error"
                );

                return;
            }


            const oldText =
                saveInline.textContent;


            try {

                saveInline.disabled =
                    true;

                saveInline.textContent =
                    "Saving Question...";


                const payload =
                    questionHelper.buildQuestionPayload({
                        subjectSelect:
                            subject,

                        unitSelect:
                            inlineUnit,

                        typeSelect:
                            inlineType,

                        difficultySelect:
                            inlineDifficulty,

                        marksInput:
                            inlineMarks,

                        textInput:
                            inlineText,

                        explanationInput:
                            inlineExplanation,

                        correctAnswerInput:
                            inlineCorrect,

                        mcqEditor:
                            inlineMcq,

                        prefix:
                            "facultyInlineQuiz"
                    });


                const response =
                    await fetch(
                        "/api/quizzes/builder/questions",
                        {
                            method:
                                "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            credentials:
                                "same-origin",

                            body:
                                JSON.stringify(
                                    payload
                                )
                        }
                    );


                const result =
                    await response.json();


                if (!response.ok) {

                    throw new Error(
                        result.message ||
                        "Unable to add quiz question"
                    );

                }


                faculty.showToast(
                    result.message
                );


                await builder.loadQuestions();


                builder.selectQuestion(
                    result.question.id
                );


                resetInlineQuestion();

                closeInlineQuestion();


            } catch (error) {

                faculty.showToast(
                    error.message,
                    "error"
                );


            } finally {

                saveInline.disabled =
                    false;

                saveInline.textContent =
                    oldText;

            }

        }
    );


    form.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            const button =
                form.querySelector(
                    'button[type="submit"]'
                );

            const oldText =
                button.textContent;


            try {

                button.disabled =
                    true;

                button.textContent =
                    "Submitting...";


                const response =
                    await fetch(
                        "/api/quizzes",
                        {
                            method:
                                "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            credentials:
                                "same-origin",

                            body:
                                JSON.stringify({
                                    subjectId:
                                        Number(
                                            subject.value
                                        ),

                                    unitId:
                                        unit.value
                                            ? Number(
                                                unit.value
                                            )
                                            : null,

                                    title:
                                        document.getElementById(
                                            "facultyQuizTitle"
                                        ).value.trim(),

                                    description:
                                        document.getElementById(
                                            "facultyQuizDescription"
                                        ).value.trim(),

                                    timeLimitMinutes:
                                        Number(
                                            document.getElementById(
                                                "facultyQuizTime"
                                            ).value
                                        ),

                                    passPercentage:
                                        Number(
                                            document.getElementById(
                                                "facultyQuizPass"
                                            ).value
                                        ),

                                    maxAttempts:
                                        Number(
                                            document.getElementById(
                                                "facultyQuizAttemptsMax"
                                            ).value
                                        ),

                                    questionIds:
                                        builder.selectedIds()
                                })
                        }
                    );


                const result =
                    await response.json();


                if (!response.ok) {

                    throw new Error(
                        result.message ||
                        "Unable to create quiz"
                    );

                }


                faculty.showToast(
                    result.message
                );


                form.reset();


                document.getElementById(
                    "facultyQuizTime"
                ).value =
                    "15";

                document.getElementById(
                    "facultyQuizPass"
                ).value =
                    "50";

                document.getElementById(
                    "facultyQuizAttemptsMax"
                ).value =
                    "1";


                unit.innerHTML =
                    '<option value="">All / General</option>';


                picker.innerHTML =
                    '<div class="admin-empty-state">Select an assigned subject first.</div>';


                document.getElementById(
                    "facultySelectedCount"
                ).textContent =
                    "0 questions";


                closeInlineQuestion();


                await loadQuizzes();


            } catch (error) {

                faculty.showToast(
                    error.message,
                    "error"
                );


            } finally {

                button.disabled =
                    false;

                button.textContent =
                    oldText;

            }

        }
    );


    async function loadQuizzes() {

        const response =
            await fetch(
                "/api/quizzes/mine",
                {
                    credentials:
                        "same-origin"
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            throw new Error(
                result.message ||
                "Unable to load quizzes"
            );

        }


        allQuizzes =
            Array.isArray(
                result.quizzes
            )
                ? result.quizzes
                : [];


        renderQuizzes();

    }


    function renderQuizzes() {

        const term =
            topSearch.value
                .trim()
                .toLowerCase();


        const rows =
            allQuizzes.filter(
                (quiz) =>
                    !term
                    ||
                    [
                        quiz.title,
                        quiz.subject_name,
                        quiz.subject_code,
                        quiz.unit_name
                    ]
                        .filter(Boolean)
                        .some(
                            (value) =>
                                String(value)
                                    .toLowerCase()
                                    .includes(term)
                        )
            );


        if (
            !rows.length
        ) {

            list.innerHTML =
                '<div class="admin-empty-state large">No quizzes found.</div>';

            return;

        }


        list.innerHTML =
            rows.map(
                (quiz) => `
                    <article class="faculty-quiz-card">

                        <div>
                            <div class="quiz-tag-row">
                                <span>
                                    ${esc(quiz.subject_code)}
                                    — ${esc(quiz.subject_name)}
                                </span>

                                ${
                                    quiz.unit_name
                                        ? `<span>${esc(quiz.unit_name)}</span>`
                                        : ""
                                }

                                <span>
                                    ${quiz.question_count} Q
                                </span>
                            </div>

                            <h3>
                                ${esc(quiz.title)}
                            </h3>

                            <p>
                                ${esc(
                                    quiz.description ||
                                    "No description"
                                )}
                            </p>

                            <div class="faculty-quiz-meta">
                                <span>
                                    ${quiz.time_limit_minutes} min
                                </span>

                                <span>
                                    Pass ${quiz.pass_percentage}%
                                </span>

                                <span>
                                    Max ${quiz.max_attempts} attempt${
                                        Number(
                                            quiz.max_attempts
                                        ) === 1
                                            ? ""
                                            : "s"
                                    }
                                </span>
                            </div>
                        </div>

                        <div class="faculty-quiz-actions">
                            <span class="status-pill ${quiz.verification_status}">
                                ${
                                    quiz.verification_status === "approved"
                                        ? "published"
                                        : "hidden"
                                }
                            </span>

                            <span class="publish-pill ${
                                Number(quiz.is_published) === 1
                                    ? "published"
                                    : "unpublished"
                            }">
                                ${
                                    Number(quiz.is_published) === 1
                                        ? "Student Visible"
                                        : "Not Visible"
                                }
                            </span>

                            <button
                                class="table-action-button"
                                data-quiz-publication="${quiz.id}"
                                data-next-publication="${
                                    Number(quiz.is_published) === 1
                                        ? "0"
                                        : "1"
                                }"
                            >
                                ${
                                    Number(quiz.is_published) === 1
                                        ? "Unpublish"
                                        : "Publish"
                                }
                            </button>

                            <button
                                class="table-action-button reject"
                                data-delete="${quiz.id}"
                            >
                                Delete
                            </button>
                        </div>

                    </article>
                `
            ).join("");


        list
            .querySelectorAll(
                "[data-quiz-publication]"
            )
            .forEach(
                (button) => {
                    button.addEventListener(
                        "click",
                        async () => {
                            try {
                                const response =
                                    await fetch(
                                        `/api/quizzes/${encodeURIComponent(button.dataset.quizPublication)}/publication`,
                                        {
                                            method: "PATCH",
                                            headers: {
                                                "Content-Type":
                                                    "application/json"
                                            },
                                            credentials:
                                                "same-origin",
                                            body:
                                                JSON.stringify({
                                                    isPublished:
                                                        button.dataset.nextPublication === "1"
                                                })
                                        }
                                    );

                                const result =
                                    await response.json();

                                if (!response.ok) {
                                    throw new Error(
                                        result.message ||
                                        "Unable to update quiz publication"
                                    );
                                }

                                faculty.showToast(
                                    result.message
                                );

                                await loadQuizzes();

                            } catch (error) {
                                faculty.showToast(
                                    error.message,
                                    "error"
                                );
                            }
                        }
                    );
                }
            );


        list
            .querySelectorAll(
                "[data-delete]"
            )
            .forEach(
                (button) => {

                    button.addEventListener(
                        "click",
                        async () => {

                            if (
                                !confirm(
                                    "Delete this quiz?"
                                )
                            ) {
                                return;
                            }


                            try {

                                const response =
                                    await fetch(
                                        `/api/quizzes/${button.dataset.delete}`,
                                        {
                                            method:
                                                "DELETE",

                                            credentials:
                                                "same-origin"
                                        }
                                    );


                                const result =
                                    await response.json();


                                if (!response.ok) {

                                    throw new Error(
                                        result.message ||
                                        "Unable to delete quiz"
                                    );

                                }


                                faculty.showToast(
                                    result.message
                                );


                                await loadQuizzes();


                            } catch (error) {

                                faculty.showToast(
                                    error.message,
                                    "error"
                                );

                            }

                        }
                    );

                }
            );

    }


    topSearch.addEventListener(
        "input",
        renderQuizzes
    );


    try {

        await builder.loadMeta();

        await loadQuizzes();


    } catch (error) {

        faculty.showToast(
            error.message,
            "error"
        );

    }

});
