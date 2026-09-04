document.addEventListener("DOMContentLoaded", async () => {

    const toast = document.getElementById("toast");
    const loading = document.getElementById("studentQuestionLoading");
    const content = document.getElementById("studentQuestionContent");
    const logoutButton = document.getElementById("logoutButton");

    const search = document.getElementById("studentQuestionSearch");
    const topSearch = document.getElementById("studentQuestionTopSearch");
    const subject = document.getElementById("studentQuestionSubject");
    const unit = document.getElementById("studentQuestionUnit");
    const type = document.getElementById("studentQuestionType");
    const difficulty = document.getElementById("studentQuestionDifficulty");
    const clear = document.getElementById("studentQuestionClear");
    const list = document.getElementById("studentQuestionList");

    let subjects = [];
    let units = [];
    let timer;

    function showToast(message) {
        if (!toast) return;

        toast.textContent = message;
        toast.classList.add("show");

        clearTimeout(toast.hideTimer);

        toast.hideTimer =
            setTimeout(
                () => toast.classList.remove("show"),
                2800
            );
    }

    function esc(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function setText(id, value) {
        const element =
            document.getElementById(id);

        if (!element) return;

        element.textContent =
            value === null ||
            value === undefined ||
            value === ""
                ? "-"
                : String(value);
    }

    async function requireStudent() {
        const response = await fetch(
            "/api/auth/me",
            { credentials: "same-origin" }
        );

        const result = await response.json();

        if (response.status === 401) {
            window.location.replace("../login.html");
            return null;
        }

        if (!response.ok || !result.user) {
            throw new Error(
                result.message ||
                "Unable to load your account"
            );
        }

        if (
            String(result.user.role || "")
                .toLowerCase() !==
            "student"
        ) {
            throw new Error("Student access only");
        }

        setText(
            "headerStudentName",
            result.user.fullName
        );

        return result.user;
    }

    function renderUnitOptions() {
        const selectedSubject =
            subject.value;

        const available =
            units.filter((item) =>
                !selectedSubject ||
                String(item.subject_id) ===
                String(selectedSubject)
            );

        const current =
            unit.value;

        unit.innerHTML = `
            <option value="">All Units</option>
            ${available.map((item) => `
                <option value="${esc(item.id)}">
                    ${esc(item.unit_name)}
                </option>
            `).join("")}
        `;

        if (
            Array.from(unit.options)
                .some((option) =>
                    option.value === current
                )
        ) {
            unit.value = current;
        }
    }

    async function loadMeta() {
        const response = await fetch(
            "/api/question-bank/student/meta",
            { credentials: "same-origin" }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message ||
                "Unable to load your Question Bank"
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

        const profile =
            result.profile || {};

        setText(
            "questionDomain",
            profile.domainName ||
            "General"
        );

        setText(
            "questionCourse",
            profile.courseName
        );

        setText(
            "questionLevel",
            profile.levelName ||
            "Course-wide"
        );

        subject.innerHTML = `
            <option value="">All Subjects</option>
            ${subjects.map((item) => `
                <option value="${esc(item.id)}">
                    ${esc(item.subject_code)}
                    — ${esc(item.subject_name)}
                </option>
            `).join("")}
        `;

        renderUnitOptions();
    }

    function typeLabel(value) {
        return {
            mcq: "MCQ",
            true_false: "True / False",
            short_answer: "Short Answer"
        }[value] || value;
    }

    async function loadQuestions() {
        const params =
            new URLSearchParams();

        if (search.value.trim()) {
            params.set(
                "search",
                search.value.trim()
            );
        }

        if (subject.value) {
            params.set(
                "subjectId",
                subject.value
            );
        }

        if (unit.value) {
            params.set(
                "unitId",
                unit.value
            );
        }

        if (type.value) {
            params.set(
                "questionType",
                type.value
            );
        }

        if (difficulty.value) {
            params.set(
                "difficulty",
                difficulty.value
            );
        }

        list.innerHTML =
            `<div class="admin-empty-state">Loading approved questions...</div>`;

        try {
            const response = await fetch(
                `/api/question-bank/student/questions?${params.toString()}`,
                { credentials: "same-origin" }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message ||
                    "Unable to load questions"
                );
            }

            const questions =
                Array.isArray(result.questions)
                    ? result.questions
                    : [];

            setText(
                "studentQuestionCount",
                `${questions.length} approved question${
                    questions.length === 1
                        ? ""
                        : "s"
                }`
            );

            setText(
                "studentQuestionResultText",
                questions.length
                    ? "Practice approved questions for your current filters."
                    : "No approved questions match these filters yet."
            );

            if (!questions.length) {
                list.innerHTML = `
                    <div class="admin-empty-state large">
                        <strong>No approved questions found</strong>
                        <span>
                            Try another subject/unit or wait for Faculty questions to be approved.
                        </span>
                    </div>
                `;
                return;
            }

            list.innerHTML = questions.map((item, index) => `
                <article class="student-question-card">

                    <div class="student-question-number">
                        ${index + 1}
                    </div>

                    <div class="student-question-card-content">

                        <div class="question-card-tags">
                            <span>${esc(typeLabel(item.questionType))}</span>
                            <span>${esc(item.difficulty)}</span>
                            <span>
                                ${esc(item.marks)}
                                mark${Number(item.marks) === 1 ? "" : "s"}
                            </span>
                        </div>

                        <h3>${esc(item.questionText)}</h3>

                        ${
                            item.options &&
                            item.options.length
                                ? `
                                    <div class="student-mcq-options">
                                        ${item.options.map((option) => `
                                            <div>
                                                <span>${esc(option.label)}</span>
                                                <p>${esc(option.text)}</p>
                                            </div>
                                        `).join("")}
                                    </div>
                                `
                                : ""
                        }

                        <div class="student-question-context">
                            <span>
                                ${esc(item.subjectCode)}
                                — ${esc(item.subjectName)}
                            </span>

                            ${
                                item.unitName
                                    ? `<span>${esc(item.unitName)}</span>`
                                    : ""
                            }
                        </div>

                        <div
                            class="student-answer-box"
                            id="answer-${esc(item.id)}"
                            hidden
                        ></div>

                        <button
                            type="button"
                            class="button button-soft"
                            data-reveal-answer="${esc(item.id)}"
                        >
                            Reveal Answer
                        </button>

                    </div>

                </article>
            `).join("");

            list.querySelectorAll("[data-reveal-answer]")
                .forEach((button) => {
                    button.addEventListener("click", async () => {
                        const id =
                            button.dataset.revealAnswer;

                        const box =
                            document.getElementById(
                                `answer-${id}`
                            );

                        if (!box.hidden) {
                            box.hidden = true;
                            button.textContent =
                                "Reveal Answer";
                            return;
                        }

                        try {
                            button.disabled = true;
                            button.textContent =
                                "Loading...";

                            const response = await fetch(
                                `/api/question-bank/student/questions/${encodeURIComponent(id)}/answer`,
                                { credentials: "same-origin" }
                            );

                            const result = await response.json();

                            if (!response.ok) {
                                throw new Error(
                                    result.message ||
                                    "Unable to reveal answer"
                                );
                            }

                            const answer =
                                result.answer || {};

                            let answerText = "";

                            if (
                                answer.questionType === "mcq"
                            ) {
                                answerText =
                                    (answer.correctOptions || [])
                                        .map((option) =>
                                            `${option.label} — ${option.text}`
                                        )
                                        .join(", ");
                            } else {
                                answerText =
                                    answer.correctAnswer || "-";
                            }

                            box.innerHTML = `
                                <span>Correct Answer</span>
                                <strong>${esc(answerText)}</strong>

                                ${
                                    answer.explanation
                                        ? `<p>${esc(answer.explanation)}</p>`
                                        : ""
                                }
                            `;

                            box.hidden = false;
                            button.textContent =
                                "Hide Answer";
                        } catch (error) {
                            showToast(error.message);
                            button.textContent =
                                "Reveal Answer";
                        } finally {
                            button.disabled = false;
                        }
                    });
                });

        } catch (error) {
            list.innerHTML =
                `<div class="admin-empty-state large">${esc(error.message)}</div>`;

            showToast(error.message);
        }
    }

    function scheduleSearch() {
        clearTimeout(timer);

        timer =
            setTimeout(
                loadQuestions,
                260
            );
    }

    subject.addEventListener("change", () => {
        renderUnitOptions();
        loadQuestions();
    });

    unit.addEventListener(
        "change",
        loadQuestions
    );

    type.addEventListener(
        "change",
        loadQuestions
    );

    difficulty.addEventListener(
        "change",
        loadQuestions
    );

    search.addEventListener(
        "input",
        scheduleSearch
    );

    topSearch.addEventListener("input", () => {
        search.value = topSearch.value;
        scheduleSearch();
    });

    clear.addEventListener("click", () => {
        search.value = "";
        topSearch.value = "";
        subject.value = "";
        type.value = "";
        difficulty.value = "";

        renderUnitOptions();
        unit.value = "";

        loadQuestions();
    });

    document
        .querySelectorAll(".coming-question-module")
        .forEach((link) => {
            link.addEventListener("click", (event) => {
                event.preventDefault();

                showToast(
                    "This module is planned and will connect after Question Bank."
                );
            });
        });

    if (logoutButton) {
        logoutButton.addEventListener("click", async () => {
            try {
                await fetch(
                    "/api/auth/logout",
                    {
                        method: "POST",
                        credentials: "same-origin"
                    }
                );
            } finally {
                window.location.replace("../login.html");
            }
        });
    }

    try {
        const user = await requireStudent();
        if (!user) return;

        await loadMeta();
        await loadQuestions();

        loading.hidden = true;
        content.hidden = false;
    } catch (error) {
        loading.innerHTML = `
            <strong>${esc(error.message)}</strong>
            <span>
                Ask Admin to configure your Course / Level if required.
            </span>
        `;

        showToast(error.message);
    }

});