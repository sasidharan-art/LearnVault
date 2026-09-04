window.LearnVaultQuestionForm = (() => {

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function renderMcqEditor(container, prefix) {
        const labels = ["A", "B", "C", "D"];

        container.innerHTML = `
            <div class="mcq-editor-head">
                <span>MCQ Options</span>
                <small>Select exactly one correct option.</small>
            </div>

            ${labels.map((label, index) => `
                <label class="mcq-option-row">
                    <input
                        type="radio"
                        name="${prefix}CorrectOption"
                        value="${label}"
                        ${index === 0 ? "checked" : ""}
                    >

                    <span>${label}</span>

                    <input
                        type="text"
                        data-mcq-option="${label}"
                        placeholder="Option ${label}"
                        required
                    >
                </label>
            `).join("")}
        `;
    }

    function setupQuestionType(
        typeSelect,
        mcqEditor,
        simpleWrap,
        correctAnswerInput,
        prefix
    ) {
        renderMcqEditor(mcqEditor, prefix);

        function sync() {
            const type = typeSelect.value;
            const mcq = type === "mcq";

            mcqEditor.hidden = !mcq;
            simpleWrap.hidden = mcq;

            const optionInputs =
                mcqEditor.querySelectorAll("[data-mcq-option]");

            optionInputs.forEach((input) => {
                input.required = mcq;
            });

            if (mcq) {
                correctAnswerInput.required = false;
                correctAnswerInput.value = "";
            } else {
                correctAnswerInput.required = true;

                correctAnswerInput.placeholder =
                    type === "true_false"
                        ? "Enter true or false"
                        : "Enter the expected answer";
            }
        }

        typeSelect.addEventListener("change", sync);
        sync();
    }

    function buildQuestionPayload({
        subjectSelect,
        unitSelect,
        typeSelect,
        difficultySelect,
        marksInput,
        textInput,
        explanationInput,
        correctAnswerInput,
        mcqEditor,
        prefix
    }) {
        const type = typeSelect.value;

        const payload = {
            subjectId: Number(subjectSelect.value),

            unitId:
                unitSelect.value
                    ? Number(unitSelect.value)
                    : null,

            questionType: type,

            difficulty: difficultySelect.value,

            marks: Number(marksInput.value || 1),

            questionText: textInput.value.trim(),

            explanation: explanationInput.value.trim(),

            correctAnswer: correctAnswerInput.value.trim(),

            options: []
        };

        if (type === "mcq") {
            const selected =
                document.querySelector(
                    `input[name="${prefix}CorrectOption"]:checked`
                );

            payload.options =
                Array.from(
                    mcqEditor.querySelectorAll("[data-mcq-option]")
                )
                    .map((input) => ({
                        label: input.dataset.mcqOption,
                        text: input.value.trim(),

                        isCorrect:
                            selected
                                ? selected.value ===
                                  input.dataset.mcqOption
                                : false
                    }))
                    .filter((option) => option.text);
        }

        return payload;
    }

    return {
        escapeHtml,
        setupQuestionType,
        buildQuestionPayload
    };

})();