const fs = require("fs");
const { execFileSync } = require("child_process");

const VERSION = process.env.VERSION;

if (!VERSION) {
    console.error("ERROR: VERSION is missing");
    process.exit(1);
}

const BASE = "https://www.apkmirror.com";

const V = VERSION.replace(/\./g, "-");

const USER_AGENT =
    "Mozilla/5.0 (Linux; Android 14; Mobile)";


// ==================================================
// SLEEP
// ==================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


// ==================================================
// WGET GET
//
// Giống build.sh:
// wget -q -U "Mozilla/5.0 (Linux; Android 14; Mobile)"
// ==================================================

function wget(url) {

    try {

        return execFileSync(
            "wget",
            [
                "-q",
                "--max-redirect=10",
                "--timeout=60",
                "--tries=3",
                "-U",
                USER_AGENT,
                url,
                "-O",
                "-"
            ],
            {
                encoding: "utf8",
                maxBuffer: 50 * 1024 * 1024
            }
        );

    } catch (error) {

        throw new Error(
            `wget failed: ${url}`
        );

    }

}


// ==================================================
// DOWNLOAD FILE
// ==================================================

function download(url, filename) {

    console.log("");
    console.log("Downloading:");
    console.log(url);

    try {

        execFileSync(
            "wget",
            [
                "-q",
                "--max-redirect=10",
                "--timeout=180",
                "--tries=5",
                "-U",
                USER_AGENT,
                url,
                "-O",
                filename
            ],
            {
                stdio: "inherit"
            }
        );

    } catch (error) {

        if (
            fs.existsSync(filename)
        ) {
            fs.unlinkSync(filename);
        }

        throw new Error(
            "wget download failed"
        );

    }

}


// ==================================================
// CLEAN URL
// ==================================================

function cleanUrl(url) {

    return url
        .replace(
            /&amp;/g,
            "&"
        )
        .replace(
            /amp;/g,
            ""
        );

}


// ==================================================
// ABSOLUTE URL
// ==================================================

function absoluteUrl(url, base) {

    url =
        cleanUrl(url);

    if (
        url.startsWith("http://") ||
        url.startsWith("https://")
    ) {
        return url;
    }

    if (
        url.startsWith("//")
    ) {
        return "https:" + url;
    }

    return new URL(
        url,
        base
    ).href;

}


// ==================================================
// FIND DOWNLOAD BUTTON
//
// Theo build.sh:
//
// grep -m1 'downloadButton'
// tr ' ' '\n'
// grep -m1 'href='
// cut -d " -f2
// ==================================================

function findDownloadButton(html) {

    const match =
        html.match(
            /downloadButton[\s\S]{0,2000}?href=["']([^"']+)["']/i
        );


    if (
        match &&
        match[1]
    ) {

        return cleanUrl(
            match[1]
        );

    }


    return null;

}


// ==================================================
// FIND HERE
//
// Theo build.sh:
//
// grep -m1 '>here<'
// tr ' ' '\n'
// grep -m1 'href='
// ==================================================

function findHere(html) {

    const patterns = [

        /href=["']([^"']+)["'][^>]*>\s*here\s*</i,

        /<a[^>]+href=["']([^"']+)["'][^>]*>\s*here\s*<\/a>/i,

        /<a[^>]+href=["']([^"']+)["'][^>]*>[\s\S]{0,300}?here[\s\S]{0,300}?<\/a>/i

    ];


    for (
        const pattern of patterns
    ) {

        const match =
            html.match(pattern);


        if (
            match &&
            match[1]
        ) {

            return cleanUrl(
                match[1]
            );

        }

    }


    return null;

}


// ==================================================
// CHECK FILE
//
// Giống build.sh
// ==================================================

function checkFile(filename) {

    try {

        const output =
            execFileSync(
                "unzip",
                [
                    "-l",
                    filename
                ],
                {
                    encoding: "utf8"
                }
            );


        if (
            output.includes(
                "base.apk"
            )
        ) {

            return "bundle";

        }


        if (
            output.includes(
                "AndroidManifest.xml"
            )
        ) {

            return "apk";

        }

    } catch (error) {

        return "invalid";

    }


    return "invalid";

}


// ==================================================
// DOWNLOAD ONE CANDIDATE
// ==================================================

async function downloadCandidate(
    relativePath,
    number
) {

    const page =
        `${BASE}/apk/${relativePath}`;


    const temp =
        `YouTube${number}.zip`;


    console.log("");
    console.log(
        "======================================"
    );

    console.log(
        `CANDIDATE ${number}/4`
    );

    console.log(
        page
    );

    console.log(
        "======================================"
    );


    try {

        // ==================================================
        // FIRST REQUEST
        // ==================================================

        console.log(
            "Opening APKMirror..."
        );


        let html =
            wget(page);


        // ==================================================
        // WAIT 15 SECONDS
        // ==================================================

        console.log(
            "Waiting 15 seconds..."
        );


        for (
            let sec = 15;
            sec > 0;
            sec--
        ) {

            process.stdout.write(
                `\rWaiting ${sec}s...`
            );

            await sleep(1000);

        }

        console.log("");


        // ==================================================
        // FIND downloadButton
        // ==================================================

        let button =
            findDownloadButton(
                html
            );


        // ==================================================
        // RETRY
        // ==================================================

        if (!button) {

            console.log(
                "downloadButton chưa xuất hiện."
            );

            console.log(
                "Retrying..."
            );


            for (
                let retry = 1;
                retry <= 10;
                retry++
            ) {

                await sleep(1000);


                html =
                    wget(page);


                button =
                    findDownloadButton(
                        html
                    );


                if (button) {

                    console.log(
                        "downloadButton FOUND."
                    );

                    break;

                }

            }

        }


        if (!button) {

            throw new Error(
                "Không tìm thấy downloadButton"
            );

        }


        const downloadPage =
            absoluteUrl(
                button,
                page
            );


        console.log("");
        console.log(
            "DOWNLOAD PAGE:"
        );

        console.log(
            downloadPage
        );


        // ==================================================
        // SECOND REQUEST
        // ==================================================

        let html2 =
            wget(
                downloadPage
            );


        // ==================================================
        // WAIT 15 SECONDS
        // ==================================================

        console.log(
            "Waiting 15 seconds for 'here'..."
        );


        for (
            let sec = 15;
            sec > 0;
            sec--
        ) {

            process.stdout.write(
                `\rWaiting ${sec}s...`
            );

            await sleep(1000);

        }

        console.log("");


        // ==================================================
        // FIND HERE
        // ==================================================

        let realUrl =
            findHere(
                html2
            );


        // ==================================================
        // RETRY HERE
        // ==================================================

        if (!realUrl) {

            console.log(
                "'here' chưa xuất hiện."
            );

            for (
                let retry = 1;
                retry <= 10;
                retry++
            ) {

                await sleep(1000);


                html2 =
                    wget(
                        downloadPage
                    );


                realUrl =
                    findHere(
                        html2
                    );


                if (realUrl) {

                    console.log(
                        "'here' FOUND."
                    );

                    break;

                }

            }

        }


        if (!realUrl) {

            throw new Error(
                "Không tìm thấy link here"
            );

        }


        realUrl =
            absoluteUrl(
                realUrl,
                downloadPage
            );


        console.log("");
        console.log(
            "REAL DOWNLOAD:"
        );

        console.log(
            realUrl
        );


        // ==================================================
        // DOWNLOAD
        // ==================================================

        download(
            realUrl,
            temp
        );


        // ==================================================
        // CHECK
        // ==================================================

        const type =
            checkFile(
                temp
            );


        console.log(
            "FILE TYPE:",
            type
        );


        // ==================================================
        // BUNDLE
        // ==================================================

        if (
            type === "bundle"
        ) {

            console.log(
                "Bundle detected."
            );

            console.log(
                "Skip candidate."
            );


            fs.unlinkSync(
                temp
            );


            return false;

        }


        // ==================================================
        // APK
        // ==================================================

        if (
            type === "apk"
        ) {

            const filename =
                `com.google.android.youtube-${VERSION}-all.apk`;


            if (
                fs.existsSync(
                    filename
                )
            ) {

                fs.unlinkSync(
                    filename
                );

            }


            fs.renameSync(
                temp,
                filename
            );


            const size =
                fs.statSync(
                    filename
                ).size;


            console.log("");
            console.log(
                "======================================"
            );

            console.log(
                "SUCCESS"
            );

            console.log(
                "NORMAL APK FOUND"
            );

            console.log(
                "FILE:",
                filename
            );

            console.log(
                "SIZE:",
                (
                    size /
                    1024 /
                    1024
                ).toFixed(2),
                "MB"
            );

            console.log(
                "======================================"
            );


            return true;

        }


        throw new Error(
            "File downloaded không phải APK"
        );


    } catch (error) {

        console.log("");
        console.log(
            `Candidate ${number} failed:`
        );

        console.log(
            error.message
        );


        if (
            fs.existsSync(
                temp
            )
        ) {

            fs.unlinkSync(
                temp
            );

        }


        return false;

    }

}


// ==================================================
// MAIN
// ==================================================

async function main() {

    const candidates = [

        `google-inc/youtube/youtube-${V}-release/youtube-${V}-2-android-apk-download`,

        `google-inc/youtube/youtube-${V}-release/youtube-${V}-android-apk-download`,

        `google-inc/youtube/youtube-${V}-release/youtube-${V}-3-android-apk-download`,

        `google-inc/youtube/youtube-${V}-release/youtube-${V}-4-android-apk-download`

    ];


    console.log("");
    console.log(
        "======================================"
    );

    console.log(
        "YouTube APKMirror Downloader"
    );

    console.log(
        "VERSION:",
        VERSION
    );

    console.log(
        "METHOD: wget"
    );

    console.log(
        "======================================"
    );


    for (
        let i = 0;
        i < candidates.length;
        i++
    ) {

        const success =
            await downloadCandidate(
                candidates[i],
                i + 1
            );


        if (success) {
            return;
        }

    }


    throw new Error(
        `Không tìm thấy NORMAL APK cho ${VERSION}`
    );

}


main().catch(
    error => {

        console.error("");
        console.error(
            "======================================"
        );

        console.error(
            "ERROR:",
            error.message
        );

        console.error(
            "======================================"
        );

        process.exit(1);

    }
);
