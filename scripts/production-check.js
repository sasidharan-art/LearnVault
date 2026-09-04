const fs = require("fs");
const path = require("path");

const root =
    path.resolve(
        __dirname,
        ".."
    );

const frontend =
    path.join(
        root,
        "frontend"
    );

const backend =
    path.join(
        root,
        "backend"
    );

let failures = 0;

function fail(message) {
    failures += 1;
    console.error(
        `FAIL: ${message}`
    );
}

function pass(message) {
    console.log(
        `PASS: ${message}`
    );
}

const required = [
    path.join(
        backend,
        "src",
        "server.js"
    ),
    path.join(
        backend,
        "src",
        "config",
        "db.js"
    ),
    path.join(
        frontend,
        "vercel.json"
    ),
    path.join(
        root,
        "render.yaml"
    )
];

for (
    const file of
    required
) {

    if (
        fs.existsSync(
            file
        )
    ) {
        pass(
            path.relative(
                root,
                file
            )
        );
    } else {
        fail(
            `Missing ${path.relative(root, file)}`
        );
    }

}

const envFile =
    path.join(
        backend,
        ".env"
    );

if (
    fs.existsSync(
        envFile
    )
) {
    console.log(
        "INFO: backend/.env exists locally. It is ignored by Git and must never be committed."
    );
}

if (failures) {
    console.error("");
    console.error(
        `${failures} deployment check(s) failed.`
    );
    process.exit(1);
}

console.log("");
console.log(
    "LearnVault deployment structure is ready for Vercel + Render."
);
