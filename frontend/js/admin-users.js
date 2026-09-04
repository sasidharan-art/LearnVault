document.addEventListener("DOMContentLoaded", async () => {

    const admin =
        window.LearnVaultAdmin;

    if (!admin) return;


    const user =
        await admin.requireAdmin();

    if (!user) return;


    const form =
        document.getElementById("facultyForm");

    const resultBox =
        document.getElementById("facultyCreatedResult");

    const tbody =
        document.getElementById("usersTableBody");

    const search =
        document.getElementById("userSearch");

    const roleFilter =
        document.getElementById("userRoleFilter");

    const statusFilter =
        document.getElementById("userStatusFilter");

    const refresh =
        document.getElementById("refreshUsers");


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


    function context(user) {

        if (
            user.role_name === "student"
        ) {

            return [
                user.course_name,
                user.level_name
            ]
                .filter(Boolean)
                .join(" • ")
                ||
                "Student profile not assigned";

        }


        if (
            user.role_name === "faculty"
        ) {

            return [
                user.faculty_department,
                user.designation
            ]
                .filter(Boolean)
                .join(" • ")
                ||
                "Faculty profile";

        }


        return "System administrator";

    }


    async function loadUsers() {

        const params =
            new URLSearchParams();


        if (search.value.trim()) {
            params.set(
                "search",
                search.value.trim()
            );
        }


        if (roleFilter.value) {
            params.set(
                "role",
                roleFilter.value
            );
        }


        if (statusFilter.value) {
            params.set(
                "status",
                statusFilter.value
            );
        }


        tbody.innerHTML =
            `<tr><td colspan="6">Loading users...</td></tr>`;


        try {

            const response =
                await fetch(
                    `/api/admin/users?${params.toString()}`,
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
                    "Unable to load users"
                );

            }


            const users =
                Array.isArray(result.users)
                    ? result.users
                    : [];


            const totalCount =
                document.getElementById(
                    "adminUserTotalCount"
                );

            const studentCount =
                document.getElementById(
                    "adminStudentCount"
                );

            const facultyCount =
                document.getElementById(
                    "adminFacultyCount"
                );

            const activeCount =
                document.getElementById(
                    "adminActiveCount"
                );


            /*
               Keep summary cards based on the complete current result.
               When filters are active, the directory changes while these
               cards remain a useful snapshot of the loaded result.
            */
            if (totalCount) {
                totalCount.textContent =
                    String(users.length);
            }

            if (studentCount) {
                studentCount.textContent =
                    String(
                        users.filter(
                            (item) =>
                                item.role_name === "student"
                        ).length
                    );
            }

            if (facultyCount) {
                facultyCount.textContent =
                    String(
                        users.filter(
                            (item) =>
                                item.role_name === "faculty"
                        ).length
                    );
            }

            if (activeCount) {
                activeCount.textContent =
                    String(
                        users.filter(
                            (item) =>
                                item.status === "active"
                        ).length
                    );
            }


            if (users.length === 0) {

                tbody.innerHTML =
                    `<tr><td colspan="6">No users match the current filters.</td></tr>`;

                return;

            }


            tbody.innerHTML =
                users
                    .map(
                        (item) => {

                            const isActive =
                                item.status === "active";

                            return `
                                <tr>
                                    <td>
                                        <div class="table-primary">
                                            <strong>${escapeHtml(item.full_name)}</strong>
                                            <span>${escapeHtml(item.email)}</span>
                                            <small>
                                                #${escapeHtml(item.id)}
                                                • @${escapeHtml(item.username || "-")}
                                            </small>
                                        </div>
                                    </td>

                                    <td>
                                        <span class="admin-role-badge ${escapeHtml(item.role_name)}">
                                            ${escapeHtml(item.role_name)}
                                        </span>
                                    </td>

                                    <td>
                                        ${escapeHtml(context(item))}
                                    </td>

                                    <td>
                                        <span class="status-pill ${isActive ? "approved" : "rejected"}">
                                            ${escapeHtml(item.status)}
                                        </span>
                                    </td>

                                    <td>
                                        ${escapeHtml(formatDate(item.created_at))}
                                    </td>

                                    <td>
                                        <button
                                            type="button"
                                            class="table-action-button"
                                            data-user-id="${escapeHtml(item.id)}"
                                            data-next-status="${isActive ? "inactive" : "active"}"
                                        >
                                            ${isActive ? "Deactivate" : "Activate"}
                                        </button>
                                    </td>
                                </tr>
                            `;
                        }
                    )
                    .join("");


            tbody
                .querySelectorAll(
                    "[data-user-id]"
                )
                .forEach(
                    (button) => {

                        button.addEventListener(
                            "click",
                            async () => {

                                await updateStatus(
                                    button.dataset.userId,
                                    button.dataset.nextStatus
                                );

                            }
                        );

                    }
                );


        } catch (error) {

            console.error(
                "Load users error:",
                error
            );


            tbody.innerHTML =
                `<tr><td colspan="6">${escapeHtml(error.message)}</td></tr>`;

        }

    }


    async function updateStatus(
        userId,
        status
    ) {

        try {

            const response =
                await fetch(
                    `/api/admin/users/${encodeURIComponent(userId)}/status`,
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
                    "Unable to update user"
                );

            }


            admin.showToast(
                result.message
            );


            await loadUsers();


        } catch (error) {

            admin.showToast(
                error.message,
                "error"
            );

        }

    }


    form.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            const data =
                new FormData(form);


            const payload = {

                fullName:
                    String(
                        data.get("fullName") || ""
                    ).trim(),

                email:
                    String(
                        data.get("email") || ""
                    ).trim(),

                phone:
                    String(
                        data.get("phone") || ""
                    ).trim(),

                department:
                    String(
                        data.get("department") || ""
                    ).trim(),

                designation:
                    String(
                        data.get("designation") || ""
                    ).trim(),

                password:
                    String(
                        data.get("password") || ""
                    )

            };


            const button =
                form.querySelector(
                    'button[type="submit"]'
                );


            try {

                button.disabled = true;
                button.textContent =
                    "Creating Faculty...";


                const response =
                    await fetch(
                        "/api/admin/faculty",
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
                                JSON.stringify(payload)
                        }
                    );


                const result =
                    await response.json();


                if (!response.ok) {

                    throw new Error(
                        result.message ||
                        "Unable to create faculty"
                    );

                }


                const faculty =
                    result.faculty || {};


                resultBox.hidden = false;

                resultBox.innerHTML =
                    `
                    <strong>Faculty Created Successfully</strong>
                    <span>Name: ${escapeHtml(faculty.fullName || "-")}</span>
                    <span>Username: ${escapeHtml(faculty.username || "-")}</span>
                    <span>User ID: ${escapeHtml(faculty.id || "-")}</span>
                    <span>Email: ${escapeHtml(faculty.email || "-")}</span>
                    `;


                form.reset();

                admin.showToast(
                    "Faculty account created."
                );


                await loadUsers();


            } catch (error) {

                admin.showToast(
                    error.message,
                    "error"
                );


            } finally {

                button.disabled = false;
                button.textContent =
                    "Create Faculty Account";

            }

        }
    );


    let searchTimer;


    search.addEventListener(
        "input",
        () => {

            clearTimeout(searchTimer);

            searchTimer =
                setTimeout(
                    loadUsers,
                    300
                );

        }
    );


    roleFilter.addEventListener(
        "change",
        loadUsers
    );


    statusFilter.addEventListener(
        "change",
        loadUsers
    );


    refresh.addEventListener(
        "click",
        loadUsers
    );


    loadUsers();

});
