document.addEventListener("DOMContentLoaded", () => {

    const headerSearch =
        document.getElementById(
            "publicHeaderSearch"
        );

    const heroSearch =
        document.getElementById(
            "publicHeroSearch"
        );

    const searchButton =
        document.getElementById(
            "publicSearchButton"
        );


    function continueToLogin(value) {

        const query =
            String(
                value || ""
            ).trim();


        if (!query) {

            window.location.href =
                "login.html";

            return;

        }


        /*
           Search is authenticated and role-aware.
           Send the learner to login first while preserving
           a human-readable topic hint.
        */

        sessionStorage.setItem(
            "learnvault_public_search",
            query
        );


        window.location.href =
            "login.html";

    }


    searchButton?.addEventListener(
        "click",
        () =>
            continueToLogin(
                heroSearch.value
            )
    );


    heroSearch?.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key ===
                "Enter"
            ) {

                continueToLogin(
                    heroSearch.value
                );

            }

        }
    );


    headerSearch?.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key ===
                "Enter"
            ) {

                continueToLogin(
                    headerSearch.value
                );

            }

        }
    );


    document
        .querySelectorAll(
            'a[href^="#"]'
        )
        .forEach(
            (link) => {

                link.addEventListener(
                    "click",
                    (event) => {

                        const target =
                            document.querySelector(
                                link.getAttribute(
                                    "href"
                                )
                            );


                        if (!target) {
                            return;
                        }


                        event.preventDefault();


                        target.scrollIntoView({
                            behavior:
                                "smooth",
                            block:
                                "start"
                        });

                    }
                );

            }
        );

});
