document.addEventListener("DOMContentLoaded", async () => {

    const admin =
        window.LearnVaultAdmin;

    if (!admin) return;


    const user =
        await admin.requireAdmin();

    if (!user) return;


    const loading =
        document.getElementById(
            "academicLoading"
        );

    const content =
        document.getElementById(
            "academicContent"
        );


    const domainForm =
        document.getElementById(
            "domainForm"
        );

    const departmentForm =
        document.getElementById(
            "departmentForm"
        );

    const courseForm =
        document.getElementById(
            "courseForm"
        );

    const levelForm =
        document.getElementById(
            "levelForm"
        );


    const departmentDomainSelect =
        document.getElementById(
            "departmentDomainSelect"
        );

    const courseDomainSelect =
        document.getElementById(
            "courseDomainSelect"
        );

    const courseDepartmentSelect =
        document.getElementById(
            "courseDepartmentSelect"
        );

    const levelCourseSelect =
        document.getElementById(
            "levelCourseSelect"
        );


    const catalogContainer =
        document.getElementById(
            "academicCatalog"
        );


    let catalog = {
        domains: [],
        departments: [],
        courses: [],
        levels: []
    };


    function escapeHtml(value) {

        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");

    }


    function active(item) {

        return Number(item.is_active) === 1;

    }


    function optionMarkup(
        value,
        label
    ) {

        return `
            <option value="${escapeHtml(value)}">
                ${escapeHtml(label)}
            </option>
        `;

    }


    function populateDomainSelects() {

        const domains =
            catalog.domains.filter(active);


        const options =
            domains
                .map(
                    (domain) =>
                        optionMarkup(
                            domain.id,
                            domain.domain_name
                        )
                )
                .join("");


        departmentDomainSelect.innerHTML =
            `
            <option value="">
                Select Education Domain
            </option>
            ${options}
            `;


        courseDomainSelect.innerHTML =
            `
            <option value="">
                Select Education Domain
            </option>
            ${options}
            `;

    }


    function populateCourseDepartments() {

        const domainId =
            String(
                courseDomainSelect.value || ""
            );


        const departments =
            catalog.departments
                .filter(active)
                .filter(
                    (department) =>
                        String(
                            department.domain_id || ""
                        ) === domainId
                );


        courseDepartmentSelect.innerHTML =
            `
            <option value="">
                No department / stream
            </option>
            ${departments
                .map(
                    (department) =>
                        optionMarkup(
                            department.id,
                            `${department.department_name} (${department.department_code})`
                        )
                )
                .join("")}
            `;

    }


    function populateCourseLevels() {

        const courses =
            catalog.courses.filter(active);


        levelCourseSelect.innerHTML =
            `
            <option value="">
                Select Course / Program
            </option>
            ${courses
                .map(
                    (course) =>
                        optionMarkup(
                            course.id,
                            `${course.course_name} (${course.course_code})`
                        )
                )
                .join("")}
            `;

    }


    function buildCatalog() {

        if (!catalogContainer) return;


        if (
            catalog.domains.length === 0
        ) {

            catalogContainer.innerHTML =
                `
                <div class="admin-empty-state large">
                    No education domains have been configured yet.
                </div>
                `;

            return;

        }


        const levelMap =
            new Map();


        catalog.levels.forEach(
            (level) => {

                const key =
                    String(level.course_id);


                if (!levelMap.has(key)) {
                    levelMap.set(key, []);
                }


                levelMap
                    .get(key)
                    .push(level);

            }
        );


        const courseMapByDomain =
            new Map();


        catalog.courses.forEach(
            (course) => {

                const key =
                    String(
                        course.domain_id || ""
                    );


                if (!courseMapByDomain.has(key)) {
                    courseMapByDomain.set(key, []);
                }


                courseMapByDomain
                    .get(key)
                    .push(course);

            }
        );


        const departmentMapByDomain =
            new Map();


        catalog.departments.forEach(
            (department) => {

                const key =
                    String(
                        department.domain_id || ""
                    );


                if (!departmentMapByDomain.has(key)) {
                    departmentMapByDomain.set(key, []);
                }


                departmentMapByDomain
                    .get(key)
                    .push(department);

            }
        );


        catalogContainer.innerHTML =
            catalog.domains
                .map(
                    (domain) => {

                        const domainKey =
                            String(domain.id);


                        const departments =
                            departmentMapByDomain.get(
                                domainKey
                            ) || [];


                        const courses =
                            courseMapByDomain.get(
                                domainKey
                            ) || [];


                        return `
                            <section class="academic-domain-card ${active(domain) ? "" : "inactive-item"}">

                                <div class="academic-domain-head">
                                    <div>
                                        <span class="mini-label">
                                            EDUCATION DOMAIN
                                        </span>

                                        <h3>
                                            ${escapeHtml(domain.domain_name)}
                                        </h3>

                                        <p>
                                            ${courses.length} course${courses.length === 1 ? "" : "s"}
                                            •
                                            ${departments.length} department${departments.length === 1 ? "" : "s"}
                                        </p>
                                    </div>

                                    ${statusButton(
                                        "domains",
                                        domain.id,
                                        active(domain)
                                    )}
                                </div>

                                <div class="academic-department-list">

                                    ${departments.length > 0
                                        ? departments.map(
                                            (department) => {

                                                const departmentCourses =
                                                    courses.filter(
                                                        (course) =>
                                                            Number(course.department_id) ===
                                                            Number(department.id)
                                                    );


                                                return `
                                                    <article class="academic-department-block ${active(department) ? "" : "inactive-item"}">

                                                        <div class="academic-item-head">

                                                            <div>
                                                                <span>
                                                                    ${escapeHtml(department.department_code)}
                                                                </span>

                                                                <strong>
                                                                    ${escapeHtml(department.department_name)}
                                                                </strong>
                                                            </div>

                                                            ${statusButton(
                                                                "departments",
                                                                department.id,
                                                                active(department)
                                                            )}

                                                        </div>

                                                        <div class="academic-course-list">

                                                            ${departmentCourses.length > 0
                                                                ? departmentCourses
                                                                    .map(
                                                                        (course) =>
                                                                            courseCard(
                                                                                course,
                                                                                levelMap.get(
                                                                                    String(course.id)
                                                                                ) || []
                                                                            )
                                                                    )
                                                                    .join("")
                                                                : `
                                                                    <div class="academic-inline-empty">
                                                                        No courses in this department yet.
                                                                    </div>
                                                                `
                                                            }

                                                        </div>

                                                    </article>
                                                `;

                                            }
                                        ).join("")
                                        : `
                                            <div class="academic-inline-empty">
                                                No departments / streams configured for this domain.
                                            </div>
                                        `
                                    }

                                    ${courses
                                        .filter(
                                            (course) =>
                                                !course.department_id
                                        )
                                        .map(
                                            (course) =>
                                                courseCard(
                                                    course,
                                                    levelMap.get(
                                                        String(course.id)
                                                    ) || []
                                                )
                                        )
                                        .join("")}

                                </div>

                            </section>
                        `;

                    }
                )
                .join("");


        catalogContainer
            .querySelectorAll(
                "[data-status-entity]"
            )
            .forEach(
                (button) => {

                    button.addEventListener(
                        "click",
                        async () => {

                            await updateStatus(
                                button.dataset.statusEntity,
                                button.dataset.statusId,
                                button.dataset.currentStatus !== "true"
                            );

                        }
                    );

                }
            );

    }


    function courseCard(
        course,
        levels
    ) {

        return `
            <div class="academic-course-card ${active(course) ? "" : "inactive-item"}">

                <div class="academic-item-head">

                    <div>
                        <span>
                            ${escapeHtml(course.course_code)}
                        </span>

                        <strong>
                            ${escapeHtml(course.course_name)}
                        </strong>

                        <small>
                            ${escapeHtml(
                                formatStructureType(
                                    course.structure_type
                                )
                            )}
                            ${course.duration_years
                                ? ` • ${escapeHtml(course.duration_years)} year${Number(course.duration_years) === 1 ? "" : "s"}`
                                : ""
                            }
                        </small>
                    </div>

                    ${statusButton(
                        "courses",
                        course.id,
                        active(course)
                    )}

                </div>

                <div class="academic-level-row">

                    ${levels.length > 0
                        ? levels.map(
                            (level) => `
                                <span class="academic-level-chip ${active(level) ? "" : "inactive"}">
                                    ${escapeHtml(level.level_name)}

                                    <button
                                        type="button"
                                        title="${active(level) ? "Deactivate level" : "Activate level"}"
                                        data-status-entity="levels"
                                        data-status-id="${escapeHtml(level.id)}"
                                        data-current-status="${active(level)}"
                                    >
                                        ${active(level) ? "×" : "+"}
                                    </button>
                                </span>
                            `
                        ).join("")
                        : `
                            <span class="academic-no-level">
                                No levels required/configured
                            </span>
                        `
                    }

                </div>

            </div>
        `;

    }


    function statusButton(
        entity,
        id,
        isActive
    ) {

        return `
            <button
                type="button"
                class="academic-status-button ${isActive ? "active" : "inactive"}"
                data-status-entity="${escapeHtml(entity)}"
                data-status-id="${escapeHtml(id)}"
                data-current-status="${isActive}"
            >
                ${isActive ? "Active" : "Inactive"}
            </button>
        `;

    }


    function formatStructureType(
        structureType
    ) {

        const names = {
            year_semester:
                "Year based",

            grade:
                "Grade / Class",

            module:
                "Module based",

            exam:
                "Exam stages",

            flexible:
                "Flexible"
        };


        return (
            names[structureType] ||
            "Flexible"
        );

    }


    async function loadCatalog() {

        const response =
            await fetch(
                "/api/academic/admin/catalog",
                {
                    method: "GET",
                    credentials: "same-origin"
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            throw new Error(
                result.message ||
                "Unable to load academic structure."
            );

        }


        catalog =
            result.catalog || {
                domains: [],
                departments: [],
                courses: [],
                levels: []
            };


        populateDomainSelects();
        populateCourseDepartments();
        populateCourseLevels();
        buildCatalog();

    }


    async function sendJson(
        url,
        method,
        body
    ) {

        const response =
            await fetch(
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


        const result =
            await response.json();


        if (!response.ok) {

            throw new Error(
                result.message ||
                "Request failed."
            );

        }


        return result;

    }


    async function updateStatus(
        entity,
        id,
        isActive
    ) {

        try {

            await sendJson(
                `/api/academic/admin/${encodeURIComponent(entity)}/${encodeURIComponent(id)}/status`,
                "PATCH",
                {
                    isActive
                }
            );


            admin.showToast(
                isActive
                    ? "Academic item activated."
                    : "Academic item deactivated."
            );


            await loadCatalog();


        } catch (error) {

            console.error(
                "Academic status error:",
                error
            );


            admin.showToast(
                error.message,
                "error"
            );

        }

    }


    async function submitForm(
        form,
        url,
        payload,
        successMessage
    ) {

        const button =
            form.querySelector(
                'button[type="submit"]'
            );


        const oldText =
            button.textContent;


        try {

            button.disabled = true;
            button.textContent =
                "Saving...";


            await sendJson(
                url,
                "POST",
                payload
            );


            admin.showToast(
                successMessage
            );


            form.reset();

            await loadCatalog();


        } catch (error) {

            console.error(
                "Academic create error:",
                error
            );


            admin.showToast(
                error.message,
                "error"
            );


        } finally {

            button.disabled = false;
            button.textContent =
                oldText;

        }

    }


    domainForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            const data =
                new FormData(
                    domainForm
                );


            await submitForm(
                domainForm,
                "/api/academic/domains",
                {
                    domainName:
                        String(
                            data.get(
                                "domainName"
                            ) || ""
                        ).trim()
                },
                "Education domain added."
            );

        }
    );


    departmentForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            const data =
                new FormData(
                    departmentForm
                );


            await submitForm(
                departmentForm,
                "/api/academic/departments",
                {
                    domainId:
                        Number(
                            data.get(
                                "domainId"
                            )
                        ),

                    departmentCode:
                        String(
                            data.get(
                                "departmentCode"
                            ) || ""
                        ).trim(),

                    departmentName:
                        String(
                            data.get(
                                "departmentName"
                            ) || ""
                        ).trim()
                },
                "Department / stream added."
            );

        }
    );


    courseForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            const data =
                new FormData(
                    courseForm
                );


            await submitForm(
                courseForm,
                "/api/academic/courses",
                {
                    domainId:
                        Number(
                            data.get(
                                "domainId"
                            )
                        ),

                    departmentId:
                        data.get(
                            "departmentId"
                        )
                            ? Number(
                                data.get(
                                    "departmentId"
                                )
                            )
                            : null,

                    courseCode:
                        String(
                            data.get(
                                "courseCode"
                            ) || ""
                        ).trim(),

                    courseName:
                        String(
                            data.get(
                                "courseName"
                            ) || ""
                        ).trim(),

                    durationYears:
                        data.get(
                            "durationYears"
                        )
                            ? Number(
                                data.get(
                                    "durationYears"
                                )
                            )
                            : null,

                    structureType:
                        String(
                            data.get(
                                "structureType"
                            ) || "flexible"
                        )
                },
                "Course / program added."
            );

        }
    );


    levelForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            const data =
                new FormData(
                    levelForm
                );


            const courseId =
                Number(
                    data.get(
                        "courseId"
                    )
                );


            await submitForm(
                levelForm,
                `/api/academic/courses/${courseId}/levels`,
                {
                    levelName:
                        String(
                            data.get(
                                "levelName"
                            ) || ""
                        ).trim(),

                    levelOrder:
                        Number(
                            data.get(
                                "levelOrder"
                            )
                        )
                },
                "Course level added."
            );

        }
    );


    courseDomainSelect.addEventListener(
        "change",
        populateCourseDepartments
    );


    try {

        await loadCatalog();


    } catch (error) {

        console.error(
            "Academic catalog load error:",
            error
        );


        admin.showToast(
            error.message,
            "error"
        );


    } finally {

        if (loading) {
            loading.hidden = true;
        }

        if (content) {
            content.hidden = false;
        }

    }

});
