document.addEventListener("DOMContentLoaded", async () => {

    const admin =
        window.LearnVaultAdmin;

    if (!admin) return;


    const user =
        await admin.requireAdmin();

    if (!user) return;


    const queue =
        document.getElementById(
            "approvalQueue"
        );

    const count =
        document.getElementById(
            "pendingApprovalCount"
        );


    function escapeHtml(value) {

        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");

    }


    async function loadPending() {

        try {

            const response =
                await fetch(
                    "/api/admin/resources?status=pending",
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
                    "Unable to load pending approvals"
                );

            }


            const resources =
                Array.isArray(result.resources)
                    ? result.resources
                    : [];


            count.textContent =
                `${resources.length} resource${resources.length === 1 ? "" : "s"} waiting`;


            if (resources.length === 0) {

                queue.innerHTML =
                    `
                    <div class="admin-empty-state large">
                        No pending resources. The approval queue is clear.
                    </div>
                    `;

                return;

            }


            queue.innerHTML =
                resources
                    .map(
                        (item) => `
                            <article class="approval-card">
                                <div class="approval-card-top">
                                    <div>
                                        <span class="mini-label">
                                            ${escapeHtml(item.resource_type || "RESOURCE")}
                                        </span>

                                        <h3>${escapeHtml(item.title)}</h3>

                                        <p>
                                            ${escapeHtml(item.subject_code || "")}
                                            ${escapeHtml(item.subject_name || "-")}
                                            •
                                            ${escapeHtml(item.course_name || "-")}
                                        </p>
                                    </div>

                                    <span class="status-pill pending">
                                        Pending
                                    </span>
                                </div>

                                <div class="approval-meta-grid">
                                    <div>
                                        <span>Uploaded By</span>
                                        <strong>${escapeHtml(item.uploader_name || "System")}</strong>
                                    </div>

                                    <div>
                                        <span>Department</span>
                                        <strong>${escapeHtml(item.department_name || "General")}</strong>
                                    </div>

                                    <div>
                                        <span>File / Link</span>
                                        <strong>${escapeHtml(item.original_file_name || item.external_url || "-")}</strong>
                                    </div>
                                </div>

                                <div class="approval-actions">
                                    <button
                                        type="button"
                                        class="button button-primary"
                                        data-approval-id="${escapeHtml(item.id)}"
                                        data-approval-status="approved"
                                    >
                                        Approve Resource
                                    </button>

                                    <button
                                        type="button"
                                        class="button button-soft"
                                        data-approval-id="${escapeHtml(item.id)}"
                                        data-approval-status="rejected"
                                    >
                                        Reject
                                    </button>
                                </div>
                            </article>
                        `
                    )
                    .join("");


            queue
                .querySelectorAll(
                    "[data-approval-id]"
                )
                .forEach(
                    (button) => {

                        button.addEventListener(
                            "click",
                            async () => {

                                await verify(
                                    button.dataset.approvalId,
                                    button.dataset.approvalStatus
                                );

                            }
                        );

                    }
                );


        } catch (error) {

            queue.innerHTML =
                `
                <div class="admin-empty-state large">
                    ${escapeHtml(error.message)}
                </div>
                `;

        }

    }


    async function verify(
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
                    "Unable to update resource"
                );

            }


            admin.showToast(
                result.message
            );


            await loadPending();


        } catch (error) {

            admin.showToast(
                error.message,
                "error"
            );

        }

    }


    loadPending();

});
