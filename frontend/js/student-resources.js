document.addEventListener("DOMContentLoaded", async () => {

    const loading =
        document.getElementById(
            "studentResourceLoading"
        );

    const content =
        document.getElementById(
            "studentResourceContent"
        );

    const toast =
        document.getElementById(
            "toast"
        );

    const logoutButton =
        document.getElementById(
            "logoutButton"
        );

    const search =
        document.getElementById(
            "resourceSearch"
        );

    const topSearch =
        document.getElementById(
            "topResourceSearch"
        );

    const subjectFilter =
        document.getElementById(
            "resourceSubjectFilter"
        );

    const typeFilter =
        document.getElementById(
            "resourceTypeFilter"
        );

    const clearFilters =
        document.getElementById(
            "clearResourceFilters"
        );

    const typeChips =
        document.getElementById(
            "resourceTypeChips"
        );

    const grid =
        document.getElementById(
            "studentResourceGrid"
        );


    let meta = {
        profile: {},
        subjects: [],
        resourceTypes: []
    };


    let searchTimer;


    function showToast(message) {

        if (!toast) {
            console.log(message);
            return;
        }


        toast.textContent =
            message;


        toast.classList.add(
            "show"
        );


        clearTimeout(
            toast.hideTimer
        );


        toast.hideTimer =
            setTimeout(
                () =>
                    toast.classList.remove(
                        "show"
                    ),
                2800
            );

    }


    function escapeHtml(value) {

        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");

    }


    function setText(
        id,
        value
    ) {

        const element =
            document.getElementById(
                id
            );


        if (!element) {
            return;
        }


        element.textContent =
            value === null ||
            value === undefined ||
            value === ""
                ? "-"
                : String(value);

    }


    function formatBytes(bytes) {

        const value =
            Number(bytes || 0);


        if (!value) {
            return "";
        }


        if (value < 1024) {
            return `${value} B`;
        }


        if (
            value <
            1024 * 1024
        ) {

            return `${
                (
                    value /
                    1024
                ).toFixed(1)
            } KB`;

        }


        return `${
            (
                value /
                (
                    1024 *
                    1024
                )
            ).toFixed(1)
        } MB`;

    }


    function formatDate(value) {

        if (!value) {
            return "";
        }


        const date =
            new Date(value);


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "";
        }


        return date
            .toLocaleDateString(
                undefined,
                {
                    day:
                        "numeric",

                    month:
                        "short",

                    year:
                        "numeric"
                }
            );

    }


    function typeClass(type) {

        return String(
            type || "resource"
        )
            .trim()
            .toLowerCase()
            .replace(
                /[^a-z0-9]+/g,
                "-"
            );

    }


    function typeIcon(type) {

        const name =
            String(
                type || ""
            ).toLowerCase();


        if (
            name.includes(
                "video"
            )
        ) {
            return "▶";
        }


        if (
            name.includes(
                "pdf"
            )
        ) {
            return "PDF";
        }


        if (
            name.includes(
                "presentation"
            )
        ) {
            return "PPT";
        }


        if (
            name.includes(
                "image"
            )
        ) {
            return "IMG";
        }


        if (
            name.includes(
                "link"
            )
        ) {
            return "↗";
        }


        if (
            name.includes(
                "question"
            )
        ) {
            return "?";
        }


        if (
            name.includes(
                "note"
            )
        ) {
            return "N";
        }


        return "DOC";

    }


    async function requireStudent() {

        const response =
            await fetch(
                "/api/auth/me",
                {
                    credentials:
                        "same-origin"
                }
            );


        const result =
            await response.json();


        if (
            response.status === 401
        ) {

            window.location.replace(
                "../login.html"
            );

            return null;

        }


        if (
            !response.ok ||
            !result.user
        ) {

            throw new Error(
                result.message ||
                "Unable to load your account"
            );

        }


        if (
            String(
                result.user.role ||
                ""
            ).toLowerCase() !==
            "student"
        ) {

            showToast(
                "Student access only."
            );


            setTimeout(
                () =>
                    window.location.replace(
                        "../index.html"
                    ),
                700
            );


            return null;

        }


        setText(
            "headerStudentName",
            result.user.fullName
        );


        return result.user;

    }


    async function loadMeta() {

        const response =
            await fetch(
                "/api/student/resources/meta",
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
                "Unable to load resource filters"
            );

        }


        meta = {
            profile:
                result.profile || {},

            subjects:
                Array.isArray(
                    result.subjects
                )
                    ? result.subjects
                    : [],

            resourceTypes:
                Array.isArray(
                    result.resourceTypes
                )
                    ? result.resourceTypes
                    : []
        };


        setText(
            "resourceDomain",
            meta.profile.domainName ||
            "General"
        );

        setText(
            "resourceCourse",
            meta.profile.courseName
        );

        setText(
            "resourceLevel",
            meta.profile.levelName ||
            "Course-wide"
        );

        setText(
            "resourceSubjectCount",
            meta.subjects.length
        );


        subjectFilter.innerHTML =
            `
            <option value="">
                All Subjects
            </option>
            ${
                meta.subjects
                    .map(
                        (subject) => `
                            <option value="${escapeHtml(subject.id)}">
                                ${escapeHtml(subject.subject_code)}
                                — ${escapeHtml(subject.subject_name)}
                            </option>
                        `
                    )
                    .join("")
            }
            `;


        typeFilter.innerHTML =
            `
            <option value="">
                All Types
            </option>
            ${
                meta.resourceTypes
                    .map(
                        (type) => `
                            <option value="${escapeHtml(type.id)}">
                                ${escapeHtml(type.type_name)}
                            </option>
                        `
                    )
                    .join("")
            }
            `;


        typeChips.innerHTML =
            `
            <button
                type="button"
                class="student-type-chip active"
                data-type-id=""
            >
                All
            </button>

            ${
                meta.resourceTypes
                    .map(
                        (type) => `
                            <button
                                type="button"
                                class="student-type-chip"
                                data-type-id="${escapeHtml(type.id)}"
                            >
                                <span>${escapeHtml(typeIcon(type.type_name))}</span>
                                ${escapeHtml(type.type_name)}
                            </button>
                        `
                    )
                    .join("")
            }
            `;


        typeChips
            .querySelectorAll(
                "[data-type-id]"
            )
            .forEach(
                (button) => {

                    button.addEventListener(
                        "click",
                        () => {

                            typeFilter.value =
                                button.dataset.typeId ||
                                "";


                            updateTypeChipState();

                            loadResources();

                        }
                    );

                }
            );


        const params =
            new URLSearchParams(
                window.location.search
            );


        if (
            params.get("view") ===
            "videos"
        ) {

            const videoType =
                meta.resourceTypes.find(
                    (type) =>
                        String(
                            type.type_name
                        )
                            .trim()
                            .toLowerCase() ===
                        "video"
                );


            if (videoType) {

                typeFilter.value =
                    String(
                        videoType.id
                    );

            }

        }


        updateTypeChipState();

    }


    function updateTypeChipState() {

        typeChips
            .querySelectorAll(
                "[data-type-id]"
            )
            .forEach(
                (button) => {

                    button.classList.toggle(
                        "active",
                        String(
                            button.dataset.typeId ||
                            ""
                        ) ===
                        String(
                            typeFilter.value ||
                            ""
                        )
                    );

                }
            );

    }


    async function loadResources() {

        const params =
            new URLSearchParams();


        if (
            search.value.trim()
        ) {

            params.set(
                "search",
                search.value.trim()
            );

        }


        if (
            subjectFilter.value
        ) {

            params.set(
                "subjectId",
                subjectFilter.value
            );

        }


        if (
            typeFilter.value
        ) {

            params.set(
                "typeId",
                typeFilter.value
            );

        }


        grid.innerHTML =
            `
            <div class="student-resource-empty">
                Loading approved resources...
            </div>
            `;


        try {

            const response =
                await fetch(
                    `/api/student/resources?${params.toString()}`,
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
                    "Unable to load resources"
                );

            }


            const resources =
                Array.isArray(
                    result.resources
                )
                    ? result.resources
                    : [];


            setText(
                "resourceResultCount",
                `${resources.length} item${
                    resources.length === 1
                        ? ""
                        : "s"
                }`
            );


            setText(
                "resourceTotalCount",
                resources.length
            );


            const videos =
                resources.filter(
                    (resource) =>
                        String(
                            resource.resourceType ||
                            ""
                        )
                            .trim()
                            .toLowerCase() ===
                        "video"
                );


            setText(
                "resourceVideoCount",
                videos.length
            );


            const selectedType =
                meta.resourceTypes.find(
                    (type) =>
                        String(
                            type.id
                        ) ===
                        String(
                            typeFilter.value
                        )
                );


            setText(
                "resourceResultsTitle",
                selectedType
                    ? selectedType.type_name
                    : "Learning Resources"
            );


            setText(
                "resourceResultsDescription",
                resources.length
                    ? "Approved content available for your current course and level."
                    : "No approved resources match these filters yet."
            );


            if (
                resources.length === 0
            ) {

                grid.innerHTML =
                    `
                    <div class="student-resource-empty large">
                        <strong>No approved resources found</strong>
                        <span>
                            Try another subject/type or check again after Faculty uploads are approved.
                        </span>
                    </div>
                    `;

                return;

            }


            grid.innerHTML =
                resources
                    .map(
                        resourceCard
                    )
                    .join("");


            grid
                .querySelectorAll(
                    "[data-resource-action]"
                )
                .forEach(
                    (button) => {

                        button.addEventListener(
                            "click",
                            () => {

                                const action =
                                    button.dataset.resourceAction;

                                const id =
                                    button.dataset.resourceId;

                                const url =
                                    button.dataset.externalUrl;


                                if (
                                    action ===
                                    "file"
                                ) {

                                    window.open(
                                        `/api/student/resources/${encodeURIComponent(id)}/file`,
                                        "_blank",
                                        "noopener"
                                    );

                                    return;

                                }


                                if (
                                    action ===
                                    "external" &&
                                    url
                                ) {

                                    window.open(
                                        url,
                                        "_blank",
                                        "noopener,noreferrer"
                                    );

                                }

                            }
                        );

                    }
                );


        } catch (error) {

            console.error(
                "Student resources error:",
                error
            );


            grid.innerHTML =
                `
                <div class="student-resource-empty large">
                    <strong>Unable to load resources</strong>
                    <span>${escapeHtml(error.message)}</span>
                </div>
                `;


            showToast(
                error.message
            );

        }

    }


    function resourceCard(resource) {

        const metaParts = [
            resource.subjectCode,
            resource.subjectName,
            formatDate(
                resource.createdAt
            )
        ]
            .filter(Boolean);


        const size =
            formatBytes(
                resource.fileSize
            );


        if (size) {
            metaParts.push(size);
        }


        const canOpenFile =
            Boolean(
                resource.hasFile
            );


        const canOpenLink =
            Boolean(
                resource.externalUrl
            );


        return `
            <article
                class="student-resource-card type-${escapeHtml(
                    typeClass(
                        resource.resourceType
                    )
                )}"
            >

                <div class="student-resource-card-top">

                    <div
                        class="student-resource-type-icon"
                    >
                        ${escapeHtml(
                            typeIcon(
                                resource.resourceType
                            )
                        )}
                    </div>

                    <div
                        class="student-resource-card-heading"
                    >

                        <span>
                            ${escapeHtml(
                                resource.resourceType ||
                                "Resource"
                            )}
                        </span>

                        <h3>
                            ${escapeHtml(
                                resource.title
                            )}
                        </h3>

                    </div>

                </div>


                <p class="student-resource-description">
                    ${escapeHtml(
                        resource.description ||
                        "Approved learning material for your course."
                    )}
                </p>


                <div class="student-resource-meta">
                    ${
                        metaParts
                            .map(
                                (part) =>
                                    `<span>${escapeHtml(part)}</span>`
                            )
                            .join("")
                    }
                </div>


                <div class="student-resource-uploader">
                    <span>Shared by</span>
                    <strong>
                        ${escapeHtml(
                            resource.uploaderName ||
                            "LearnVault"
                        )}
                    </strong>
                </div>


                <div class="student-resource-card-actions">

                    ${
                        canOpenFile
                            ? `
                                <button
                                    type="button"
                                    class="button button-primary"
                                    data-resource-action="file"
                                    data-resource-id="${escapeHtml(resource.id)}"
                                >
                                    Open File
                                </button>
                            `
                            : ""
                    }

                    ${
                        canOpenLink
                            ? `
                                <button
                                    type="button"
                                    class="button button-soft"
                                    data-resource-action="external"
                                    data-resource-id="${escapeHtml(resource.id)}"
                                    data-external-url="${escapeHtml(resource.externalUrl)}"
                                >
                                    ${
                                        String(
                                            resource.resourceType ||
                                            ""
                                        )
                                            .toLowerCase() ===
                                        "video"
                                            ? "Watch Video"
                                            : "Open Link"
                                    }
                                </button>
                            `
                            : ""
                    }

                </div>

            </article>
        `;

    }


    subjectFilter.addEventListener(
        "change",
        loadResources
    );


    typeFilter.addEventListener(
        "change",
        () => {

            updateTypeChipState();

            loadResources();

        }
    );


    search.addEventListener(
        "input",
        () => {

            clearTimeout(
                searchTimer
            );


            searchTimer =
                setTimeout(
                    loadResources,
                    280
                );

        }
    );


    topSearch.addEventListener(
        "input",
        () => {

            search.value =
                topSearch.value;


            clearTimeout(
                searchTimer
            );


            searchTimer =
                setTimeout(
                    loadResources,
                    280
                );

        }
    );


    clearFilters.addEventListener(
        "click",
        () => {

            search.value =
                "";

            topSearch.value =
                "";

            subjectFilter.value =
                "";

            typeFilter.value =
                "";

            updateTypeChipState();

            loadResources();

        }
    );


    document
        .querySelectorAll(
            ".coming-student-resource-module"
        )
        .forEach(
            (link) => {

                link.addEventListener(
                    "click",
                    (event) => {

                        event.preventDefault();

                        showToast(
                            "This LearnVault module is part of the planned learning system and will be connected in a later phase."
                        );

                    }
                );

            }
        );


    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            async () => {

                try {

                    logoutButton.disabled =
                        true;

                    logoutButton.textContent =
                        "Logging out...";


                    await fetch(
                        "/api/auth/logout",
                        {
                            method:
                                "POST",

                            credentials:
                                "same-origin"
                        }
                    );


                } finally {

                    window.location.replace(
                        "../login.html"
                    );

                }

            }
        );

    }


    try {

        const user =
            await requireStudent();


        if (!user) {
            return;
        }


        await loadMeta();

        await loadResources();


        if (loading) {
            loading.hidden = true;
        }


        if (content) {
            content.hidden = false;
        }


    } catch (error) {

        console.error(
            "Student Resource Library startup error:",
            error
        );


        if (loading) {

            loading.innerHTML =
                `
                <strong>${escapeHtml(error.message)}</strong>
                <span>Please refresh or log in again.</span>
                `;

        }


        showToast(
            error.message
        );

    }

});
