document.addEventListener("DOMContentLoaded", async () => {

    const admin =
        window.LearnVaultAdmin;

    if (!admin) return;


    const user =
        await admin.requireAdmin();

    if (!user) return;


    const tbody =
        document.getElementById(
            "resourcesTableBody"
        );

    const search =
        document.getElementById(
            "resourceSearch"
        );

    const statusFilter =
        document.getElementById(
            "resourceStatusFilter"
        );

    const refresh =
        document.getElementById(
            "refreshResources"
        );


    function escapeHtml(value) {

        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");

    }


    function formatDate(value) {

        if (!value) return "-";

        const date =
            new Date(value);

        return Number.isNaN(date.getTime())
            ? "-"
            : date.toLocaleDateString();

    }


    function setCount(id, value) {

        const element =
            document.getElementById(id);

        if (element) {
            element.textContent =
                Number(value || 0);
        }

    }


    async function loadResources() {

        const params =
            new URLSearchParams();


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


        tbody.innerHTML =
            `<tr><td colspan="6">Loading resources...</td></tr>`;


        try {

            const response =
                await fetch(
                    `/api/admin/resources?${params.toString()}`,
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
                Array.isArray(result.resources)
                    ? result.resources
                    : [];


            setCount(
                "resourceCountAll",
                resources.length
            );


            setCount(
                "resourceCountPending",
                resources.filter(
                    (item) =>
                        item.verification_status ===
                        "pending"
                ).length
            );


            setCount(
                "resourceCountApproved",
                resources.filter(
                    (item) =>
                        item.verification_status ===
                        "approved"
                ).length
            );


            setCount(
                "resourceCountRejected",
                resources.filter(
                    (item) =>
                        item.verification_status ===
                        "rejected"
                ).length
            );


            if (resources.length === 0) {

                tbody.innerHTML =
                    `<tr><td colspan="6">No resources match the current filters.</td></tr>`;

                return;

            }


            tbody.innerHTML =
                resources
                    .map(
                        (item) => {

                            const pending =
                                item.verification_status ===
                                "pending";

                            return `
                                <tr>
                                    <td>
                                        <div class="table-primary">
                                            <strong>${escapeHtml(item.title)}</strong>
                                            <span>${escapeHtml(item.resource_type || "-")}</span>
                                            <small>${escapeHtml(item.original_file_name || item.external_url || "-")}</small>
                                        </div>
                                    </td>

                                    <td>
                                        <strong>${escapeHtml(item.subject_code || "")} ${escapeHtml(item.subject_name || "-")}</strong>
                                        <small class="table-block-small">
                                            ${escapeHtml(item.course_name || "-")}
                                        </small>
                                    </td>

                                    <td>
                                        ${escapeHtml(item.uploader_name || "System")}
                                    </td>

                                    <td>
                                        <span class="status-pill ${escapeHtml(item.verification_status)}">
                                            ${
                                                item.verification_status === "approved"
                                                    ? "Published"
                                                    : item.verification_status === "rejected"
                                                        ? "Hidden"
                                                        : "Legacy Pending"
                                            }
                                        </span>
                                    </td>

                                    <td>
                                        ${escapeHtml(formatDate(item.created_at))}
                                    </td>

                                    <td>
                                        <div class="table-action-group">
                                            ${
                                                item.verification_status === "approved"
                                                    ? `
                                                        <button
                                                            type="button"
                                                            class="table-action-button reject"
                                                            data-resource-id="${escapeHtml(item.id)}"
                                                            data-resource-status="rejected"
                                                        >
                                                            Hide
                                                        </button>
                                                    `
                                                    : `
                                                        <button
                                                            type="button"
                                                            class="table-action-button approve"
                                                            data-resource-id="${escapeHtml(item.id)}"
                                                            data-resource-status="approved"
                                                        >
                                                            Restore
                                                        </button>
                                                    `
                                            }
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }
                    )
                    .join("");


            tbody
                .querySelectorAll(
                    "[data-resource-id]"
                )
                .forEach(
                    (button) => {

                        button.addEventListener(
                            "click",
                            async () => {

                                await verifyResource(
                                    button.dataset.resourceId,
                                    button.dataset.resourceStatus
                                );

                            }
                        );

                    }
                );


        } catch (error) {

            tbody.innerHTML =
                `<tr><td colspan="6">${escapeHtml(error.message)}</td></tr>`;

        }

    }


    async function verifyResource(
        resourceId,
        status
    ) {

        try {

            const response =
                await fetch(
                    `/api/admin/resources/${encodeURIComponent(resourceId)}/verification`,
                    {
                        method:
                            "PATCH",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        credentials:
                            "same-origin",

                        body:
                            JSON.stringify({
                                status
                            })
                    }
                );


            const result =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    result.message ||
                    "Unable to update resource visibility"
                );

            }


            admin.showToast(
                result.message
            );


            await loadResources();


        } catch (error) {

            admin.showToast(
                error.message,
                "error"
            );

        }

    }


    let timer;


    search.addEventListener(
        "input",
        () => {

            clearTimeout(timer);

            timer =
                setTimeout(
                    loadResources,
                    300
                );

        }
    );


    statusFilter.addEventListener(
        "change",
        loadResources
    );


    refresh.addEventListener(
        "click",
        loadResources
    );


    loadResources();

});
