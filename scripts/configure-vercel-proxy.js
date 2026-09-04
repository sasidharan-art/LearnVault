const fs = require("fs");
const path = require("path");

const backendUrl =
    String(
        process.argv[2] ||
        ""
    )
        .trim()
        .replace(
            /\/+$/,
            ""
        );


if (
    !/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i
        .test(
            backendUrl
        )
) {

    console.error("");
    console.error(
        "Usage:"
    );
    console.error(
        "node scripts/configure-vercel-proxy.js https://YOUR-RENDER-SERVICE.onrender.com"
    );
    console.error("");

    process.exit(
        1
    );

}


const root =
    path.resolve(
        __dirname,
        ".."
    );


const templatePath =
    path.join(
        root,
        "frontend",
        "vercel.json.template"
    );


const outputPath =
    path.join(
        root,
        "frontend",
        "vercel.json"
    );


if (
    !fs.existsSync(
        templatePath
    )
) {

    console.error(
        "frontend/vercel.json.template was not found."
    );

    process.exit(
        1
    );

}


const template =
    fs.readFileSync(
        templatePath,
        "utf8"
    );


const output =
    template.replaceAll(
        "__RENDER_BACKEND_URL__",
        backendUrl
    );


fs.writeFileSync(
    outputPath,
    output,
    "utf8"
);


console.log("");
console.log(
    "LearnVault Vercel API proxy configured."
);
console.log(
    `Backend: ${backendUrl}`
);
console.log(
    `Created: ${outputPath}`
);
console.log("");
