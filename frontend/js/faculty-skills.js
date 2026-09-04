document.addEventListener("DOMContentLoaded", async () => {

    const h =
        window.LearnVaultLearning;

    if (!h) return;

    h.bindLogout();

    const form =
        document.getElementById("facultySkillForm");

    const subject =
        document.getElementById("facultySkillSubject");

    const grid =
        document.getElementById("facultySkillGrid");

    const search =
        document.getElementById("moduleTopSearch");

    let data = null;


    function render() {

        const overview =
            data.overview || {};


        document.getElementById("facultySkillSubjects").textContent =
            overview.assignedSubjects || 0;

        document.getElementById("facultySkillTotal").textContent =
            overview.totalSkills || 0;

        document.getElementById("facultySkillCompleted").textContent =
            overview.completedStudentSkills || 0;

        document.getElementById("facultySkillAverage").textContent =
            h.pct(overview.averageStudentProgress);

        document.getElementById("facultySkillAverageHero").textContent =
            h.pct(overview.averageStudentProgress);

        document.getElementById("facultySkillAverageBar").style.width =
            `${h.clamp(overview.averageStudentProgress)}%`;


        const term =
            search.value.trim().toLowerCase();


        const rows =
            (data.skills || [])
                .filter(
                    (skill) =>
                        !term ||
                        [
                            skill.skill_name,
                            skill.subject_code,
                            skill.subject_name,
                            skill.course_name
                        ]
                            .filter(Boolean)
                            .some(
                                (value) =>
                                    String(value)
                                        .toLowerCase()
                                        .includes(term)
                            )
                );


        if (!rows.length) {

            grid.innerHTML =
                `<div class="progress-empty">
                    No skills found for your assigned subjects.
                </div>`;

            return;
        }


        grid.innerHTML =
            rows.map(
                (skill) => `
                    <article class="skill-card ${
                        Number(skill.is_active) === 1
                            ? ""
                            : "inactive"
                    }">

                        <div class="skill-card-head">
                            <div>
                                <span>
                                    ${h.esc(skill.subject_code)}
                                    • ${h.esc(skill.skill_level)}
                                </span>

                                <h3>${h.esc(skill.skill_name)}</h3>

                                <small>
                                    ${h.esc(skill.subject_name)}
                                </small>
                            </div>

                            <span class="status-pill ${
                                Number(skill.is_active) === 1
                                    ? "approved"
                                    : "rejected"
                            }">
                                ${
                                    Number(skill.is_active) === 1
                                        ? "Published"
                                        : "Hidden"
                                }
                            </span>
                        </div>

                        <p>
                            ${h.esc(
                                skill.description ||
                                "Subject skill"
                            )}
                        </p>

                        <div class="mastery-track compact">
                            <span
                                style="width:${h.clamp(skill.average_progress)}%"
                            ></span>
                        </div>

                        <div class="subject-mastery-metrics">
                            <div>
                                <span>Eligible</span>
                                <strong>
                                    ${Number(skill.eligible_students || 0)}
                                </strong>
                            </div>

                            <div>
                                <span>Completed</span>
                                <strong>
                                    ${Number(skill.completed_students || 0)}
                                </strong>
                            </div>

                            <div>
                                <span>Avg Progress</span>
                                <strong>
                                    ${h.pct(skill.average_progress)}
                                </strong>
                            </div>
                        </div>

                        <div class="skill-admin-actions">
                            <small>Assigned-subject control</small>

                            <button
                                type="button"
                                class="table-action-button"
                                data-skill-status="${skill.id}"
                                data-next-status="${
                                    Number(skill.is_active) === 1
                                        ? "0"
                                        : "1"
                                }"
                            >
                                ${
                                    Number(skill.is_active) === 1
                                        ? "Hide"
                                        : "Publish"
                                }
                            </button>
                        </div>

                    </article>
                `
            ).join("");


        grid
            .querySelectorAll("[data-skill-status]")
            .forEach((button) => {

                button.addEventListener(
                    "click",
                    async () => {

                        try {

                            await h.sendJson(
                                `/api/skills/faculty/${encodeURIComponent(button.dataset.skillStatus)}/status`,
                                "PATCH",
                                {
                                    isActive:
                                        button.dataset.nextStatus === "1"
                                }
                            );


                            h.toast(
                                "Skill publication updated."
                            );


                            await load();


                        } catch (error) {

                            h.toast(
                                error.message,
                                "error"
                            );

                        }

                    }
                );

            });

    }


    async function load() {

        const response =
            await fetch(
                "/api/skills/faculty",
                {
                    credentials:
                        "same-origin"
                }
            );


        data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Unable to load Skills"
            );

        }


        subject.innerHTML =
            `
            <option value="">
                Select Assigned Subject
            </option>

            ${
                (data.subjects || [])
                    .map(
                        (item) => `
                            <option value="${item.id}">
                                ${h.esc(item.subject_code)}
                                — ${h.esc(item.subject_name)}
                                • ${h.esc(item.course_name)}
                            </option>
                        `
                    )
                    .join("")
            }
            `;


        render();

    }


    form.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            const button =
                form.querySelector(
                    'button[type="submit"]'
                );

            const old =
                button.textContent;


            try {

                button.disabled =
                    true;

                button.textContent =
                    "Publishing...";


                await h.sendJson(
                    "/api/skills/faculty",
                    "POST",
                    {
                        subjectId:
                            Number(subject.value),

                        skillName:
                            document.getElementById(
                                "facultySkillName"
                            ).value.trim(),

                        skillLevel:
                            document.getElementById(
                                "facultySkillLevel"
                            ).value,

                        description:
                            document.getElementById(
                                "facultySkillDescription"
                            ).value.trim()
                    }
                );


                h.toast(
                    "Skill published."
                );


                form.reset();

                await load();


            } catch (error) {

                h.toast(
                    error.message,
                    "error"
                );


            } finally {

                button.disabled =
                    false;

                button.textContent =
                    old;

            }

        }
    );


    search.addEventListener(
        "input",
        render
    );


    try {

        await h.requireRole(
            "faculty"
        );


        await load();


    } catch (error) {

        h.toast(
            error.message,
            "error"
        );

    }

});