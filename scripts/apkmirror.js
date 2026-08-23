const https = require("https");
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
    "Mozilla/5.0 (Linux; Android 14; Mobile) " +
    "AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";


// ==================================================
// HTTP GET
// ==================================================

function get(url, redirect = true) {

    return new Promise((resolve, reject) => {

        const request = https.get(
            url,
            {
                headers: {
                    "User-Agent": USER_AGENT,
                    "Accept":
                        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language":
                        "en-US,en;q=0.9"
                }
            },
            response => {

                let data = "";

                if (
                    redirect &&
                    [301, 302, 303, 307, 308]
                        .includes(response.statusCode)
                ) {

                    const location =
                        response.headers.location;

                    if (!location) {

                        reject(
                            new Error(
                                `HTTP ${response.statusCode} without Location`
                            )
                        );

                        return;

                    }

                    response.resume();

                    resolve(
                        get(
                            new URL(
                                location,
                                url
                            ).href
                        )
                    );

                    return;

                }


                response.setEncoding("utf8");

                response.on(
                    "data",
                    chunk => {
                        data += chunk;
                    }
                );

                response.on(
                    "end",
                    () => {

                        resolve({
                            status:
                                response.statusCode,

                            headers:
                                response.headers,

                            body:
                                data,

                            url
                        });

                    }
                );

            }
        );


        request.setTimeout(
            120000,
            () => {

                request.destroy(
                    new Error(
                        "HTTP timeout"
                    )
                );

            }
        );


        request.on(
            "error",
            reject
        );

    });

}


// ==================================================
// DOWNLOAD FILE
// ==================================================

function download(url, filename) {

    return new Promise(
        (resolve, reject) => {

            const file =
                fs.createWriteStream(
                    filename
                );


            const request =
                https.get(
                    url,
                    {
                        headers: {
                            "User-Agent":
                                USER_AGENT,
                            "Accept":
                                "*/*"
                        }
                    },
                    response => {

                        if (
                            [301, 302, 303, 307, 308]
                                .includes(
                                    response.statusCode
                                )
                        ) {

                            const location =
                                response.headers.location;

                            file.close();

                            fs.unlinkSync(
                                filename
                            );

                            if (!location) {

                                reject(
                                    new Error(
                                        "Redirect without Location"
                                    )
                                );

                                return;

                            }

                            const next =
                                new URL(
                                    location,
                                    url
                                ).href;

                            download(
                                next,
                                filename
                            )
                            .then(resolve)
                            .catch(reject);

                            return;

                        }


                        if (
                            response.statusCode !== 200
                        ) {

                            file.close();

                            fs.unlinkSync(
                                filename
                            );

                            reject(
                                new Error(
                                    `HTTP ${response.statusCode}`
                                )
                            );

                            return;

                        }


                        response.pipe(file);


                        file.on(
                            "finish",
                            () => {

                                file.close(
                                    () => resolve()
                                );

                            }
                        );

                    }
                );


            request.setTimeout(
                180000,
                () => {

                    request.destroy(
                        new Error(
                            "Download timeout"
                        )
                    );

                }
            );


            request.on(
                "error",
                error => {

                    file.close();

                    if (
                        fs.existsSync(
                            filename
                        )
                    ) {

                        fs.unlinkSync(
                            filename
                        );

                    }

                    reject(error);

                }
            );

        }
    );

}


// ==================================================
// FIND DOWNLOAD BUTTON
// ==================================================

function findDownloadButton(html) {

    // Tương đương:
    //
    // grep -m1 'downloadButton'
    // grep -m1 'href='

    const patterns = [

        /<a[^>]*class=["'][^"']*downloadButton[^"']*["'][^>]*href=["']([^"']+)["']/i,

        /<a[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*downloadButton[^"']*["']/i,

        /downloadButton[\s\S]{0,1000}?href=["']([^"']+)["']/i

    ];


    for (
        const pattern
        of patterns
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
// FIND HERE
// ==================================================

function findHere(html) {

    // Tương đương:
    //
    // grep -m1 '>here<'
    // grep -m1 'href='

    const patterns = [

        /<a[^>]+href=["']([^"']+)["'][^>]*>\s*here\s*<\/a>/i,

        /<a[^>]+href=["']([^"']+)["'][^>]*>\s*<[^>]*>\s*here\s*<\/[^>]*>\s*<\/a>/i,

        /href=["']([^"']+)["'][^>]*>\s*here\s*</i

    ];


    for (
        const pattern
        of patterns
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
// URL CLEAN
// ==================================================

function cleanUrl(url) {

    if (!url) {
        return "";
    }

    url =
        url
            .replace(
                /&amp;/g,
                "&"
            )
            .replace(
                /amp;/g,
                ""
            );


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


    if (
        url.startsWith("/")
    ) {

        return BASE + url;

    }


    return BASE + "/" + url;

}


// ==================================================
// CHECK APK
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
                    encoding:
                        "utf8"
                }
            );


        // Bundle / APKS
        if (
            output.includes(
                "base.apk"
            )
        ) {

            return "bundle";

        }


        // APK
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
// CANDIDATES
// ==================================================

const candidates = [

    `google-inc/youtube/youtube-${V}-release/youtube-${V}-2-android-apk-download`,

    `google-inc/youtube/youtube-${V}-release/youtube-${V}-android-apk-download`,

    `google-inc/youtube/youtube-${V}-release/youtube-${V}-3-android-apk-download`,

    `google-inc/youtube/youtube-${V}-release/youtube-${V}-4-android-apk-download`

];


// ==================================================
// MAIN
// ==================================================

async function main() {

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
        "Playwright: DISABLED"
    );

    console.log(
        "======================================"
    );


    for (
        let i = 0;
        i < candidates.length;
        i++
    ) {

        const page =
            `${BASE}/apk/${candidates[i]}/`;


        const temp =
            `youtube_${i + 1}.tmp`;


        console.log("");
        console.log(
            "======================================"
        );

        console.log(
            `CANDIDATE ${i + 1}/4`
        );

        console.log(
            page
        );

        console.log(
            "======================================"
        );


        try {

            // ----------------------------------------------
            // RELEASE/DOWNLOAD PAGE
            // ----------------------------------------------

            const first =
                await get(page);


            console.log(
                "HTTP:",
                first.status
            );


            if (
                first.status !== 200
            ) {

                console.log(
                    "Skip HTTP",
                    first.status
                );

                continue;

            }


            // ----------------------------------------------
            // downloadButton
            // ----------------------------------------------

            const downloadPage =
                findDownloadButton(
                    first.body
                );


            if (
                !downloadPage
            ) {

                console.log(
                    "Không tìm thấy downloadButton"
                );

                continue;

            }


            const downloadUrl =
                new URL(
                    downloadPage,
                    page
                ).href;


            console.log("");
            console.log(
                "DOWNLOAD PAGE:"
            );

            console.log(
                downloadUrl
            );


            // ----------------------------------------------
            // WAIT 15 SECONDS
            // ----------------------------------------------

            console.log(
                "Waiting 15 seconds..."
            );


            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        15000
                    )
            );


            // ----------------------------------------------
            // SECOND PAGE
            // ----------------------------------------------

            const second =
                await get(
                    downloadUrl
                );


            console.log(
                "DOWNLOAD PAGE HTTP:",
                second.status
            );


            if (
                second.status !== 200
            ) {

                console.log(
                    "Skip"
                );

                continue;

            }


            // ----------------------------------------------
            // FIND HERE
            // ----------------------------------------------

            const realUrl =
                findHere(
                    second.body
                );


            if (
                !realUrl
            ) {

                console.log(
                    "Không tìm thấy link 'here'"
                );

                continue;

            }


            console.log("");
            console.log(
                "REAL DOWNLOAD:"
            );

            console.log(
                realUrl
            );


            // ----------------------------------------------
            // DOWNLOAD
            // ----------------------------------------------

            console.log(
                "Downloading..."
            );


            await download(
                realUrl,
                temp
            );


            // ----------------------------------------------
            // CHECK
            // ----------------------------------------------

            const type =
                checkFile(
                    temp
                );


            console.log(
                "FILE TYPE:",
                type
            );


            // ----------------------------------------------
            // BUNDLE → BỎ
            // ----------------------------------------------

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


                continue;

            }


            // ----------------------------------------------
            // APK → SAVE
            // ----------------------------------------------

            if (
                type === "apk"
            ) {

                const filename =
                    `com.google.android.youtube-${VERSION}-all.apk`;


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


                return;

            }


            // ----------------------------------------------
            // INVALID
            // ----------------------------------------------

            if (
                fs.existsSync(
                    temp
                )
            ) {

                fs.unlinkSync(
                    temp
                );

            }


        } catch (error) {

            console.log("");
            console.log(
                "Candidate failed:"
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
