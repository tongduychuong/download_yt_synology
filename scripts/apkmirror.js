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
    "(KHTML, like Gecko) " +
    "Chrome/131.0.0.0 Mobile Safari/537.36";


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


// ==================================================
// HTTP GET
// ==================================================

function get(url) {

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

                const status =
                    response.statusCode;

                // ------------------------------------------
                // REDIRECT
                // ------------------------------------------

                if (
                    [301, 302, 303, 307, 308]
                        .includes(status)
                ) {

                    const location =
                        response.headers.location;

                    response.resume();

                    if (!location) {

                        reject(
                            new Error(
                                `HTTP ${status} without Location`
                            )
                        );

                        return;

                    }

                    const next =
                        new URL(
                            location,
                            url
                        ).href;

                    get(next)
                        .then(resolve)
                        .catch(reject);

                    return;

                }


                let data = "";

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
                            status,
                            body: data,
                            headers:
                                response.headers,
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

    return new Promise((resolve, reject) => {

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

                    const status =
                        response.statusCode;


                    // --------------------------------------
                    // REDIRECT
                    // --------------------------------------

                    if (
                        [301, 302, 303, 307, 308]
                            .includes(status)
                    ) {

                        const location =
                            response.headers.location;

                        response.resume();

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


                        if (!location) {

                            reject(
                                new Error(
                                    `HTTP ${status} without Location`
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


                    if (status !== 200) {

                        response.resume();

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

                        reject(
                            new Error(
                                `Download HTTP ${status}`
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

    });

}


// ==================================================
// CLEAN URL
// ==================================================

function cleanUrl(url) {

    if (!url) {
        return "";
    }

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
        url.startsWith(
            "http://"
        ) ||
        url.startsWith(
            "https://"
        )
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
// ==================================================

function findDownloadButton(html) {

    // ----------------------------------------------
    // APKMirror downloadButton
    // ----------------------------------------------

    const patterns = [

        /<a[^>]*class=["'][^"']*downloadButton[^"']*["'][^>]*href=["']([^"']+)["']/i,

        /<a[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*downloadButton[^"']*["']/i,

        /downloadButton[\s\S]{0,2000}?href=["']([^"']+)["']/i

    ];


    for (
        const pattern
        of patterns
    ) {

        const match =
            html.match(
                pattern
            );


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

    const patterns = [

        // <a href="...">here</a>
        /<a[^>]+href=["']([^"']+)["'][^>]*>\s*here\s*<\/a>/i,

        // <a href="..."><span>here</span></a>
        /<a[^>]+href=["']([^"']+)["'][^>]*>[\s\S]{0,200}?\bhere\b[\s\S]{0,200}?<\/a>/i,

        // href before >here<
        /href=["']([^"']+)["'][^>]*>[\s]*here[\s]*</i

    ];


    for (
        const pattern
        of patterns
    ) {

        const match =
            html.match(
                pattern
            );


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


        // ----------------------------------------------
        // Bundle / APKS
        // ----------------------------------------------

        if (
            output.includes(
                "base.apk"
            )
        ) {

            return "bundle";

        }


        // ----------------------------------------------
        // Normal APK
        // ----------------------------------------------

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
// 4 CANDIDATES
// ==================================================

const candidates = [

    `youtube-${V}-2-android-apk-download`,

    `youtube-${V}-android-apk-download`,

    `youtube-${V}-3-android-apk-download`,

    `youtube-${V}-4-android-apk-download`

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
        "======================================"
    );


    // ==================================================
    // TRY 4 LINKS
    // ==================================================

    for (
        let i = 0;
        i < candidates.length;
        i++
    ) {

        const candidate =
            candidates[i];


        const page =
            `${BASE}/apk/google-inc/youtube/` +
            `youtube-${V}-release/` +
            `${candidate}/`;


        const temp =
            `youtube_${i + 1}.tmp`;


        console.log("");
        console.log(
            "======================================"
        );

        console.log(
            `CHECK LINK ${i + 1}/4`
        );

        console.log(
            page
        );

        console.log(
            "======================================"


        );


        try {

            // ==================================================
            // STEP 1
            // OPEN CANDIDATE
            // ==================================================

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
                    "Candidate không tồn tại."
                );

                continue;

            }


            // ==================================================
            // STEP 2
            // CHỜ ĐỦ 15 GIÂY
            // ==================================================

            console.log("");
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
            console.log(
                "15 seconds completed."
            );


            // ==================================================
            // STEP 3
            // TÌM DOWNLOAD BUTTON
            // ==================================================

            console.log(
                "Searching downloadButton..."
            );


            let downloadButton =
                findDownloadButton(
                    first.body
                );


            // ==================================================
            // STEP 4
            // RETRY THÊM 10 GIÂY
            // ==================================================

            if (
                !downloadButton
            ) {

                console.log(
                    "downloadButton chưa xuất hiện."
                );

                console.log(
                    "Retrying..."
                );


                for (
                    let retry = 0;
                    retry < 10;
                    retry++
                ) {

                    await sleep(1000);


                    const retryPage =
                        await get(page);


                    downloadButton =
                        findDownloadButton(
                            retryPage.body
                        );


                    if (
                        downloadButton
                    ) {

                        console.log(
                            "downloadButton FOUND."
                        );

                        break;

                    }

                }

            }


            // ==================================================
            // STEP 5
            // KHÔNG CÓ BUTTON → LINK KHÁC
            // ==================================================

            if (
                !downloadButton
            ) {

                console.log(
                    "Không tìm thấy downloadButton."
                );

                console.log(
                    "Chuyển sang link tiếp theo."
                );

                continue;

            }


            const downloadPage =
                absoluteUrl(
                    downloadButton,
                    page
                );


            console.log("");
            console.log(
                "DOWNLOAD BUTTON:"
            );

            console.log(
                downloadPage
            );


            // ==================================================
            // STEP 6
            // OPEN DOWNLOAD PAGE
            // ==================================================

            const second =
                await get(
                    downloadPage
                );


            console.log(
                "DOWNLOAD PAGE HTTP:",
                second.status
            );


            if (
                second.status !== 200
            ) {

                console.log(
                    "Download page lỗi."
                );

                continue;

            }


            // ==================================================
            // STEP 7
            // CHỜ 15 GIÂY
            // ==================================================

            console.log("");
            console.log(
                "Waiting another 15 seconds..."
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
            // STEP 8
            // FIND HERE
            // ==================================================

            let realUrl =
                findHere(
                    second.body
                );


            // ==================================================
            // RETRY HERE
            // ==================================================

            if (
                !realUrl
            ) {

                console.log(
                    "'here' chưa xuất hiện."
                );

                console.log(
                    "Retrying..."
                );


                for (
                    let retry = 0;
                    retry < 10;
                    retry++
                ) {

                    await sleep(1000);


                    const retryPage =
                        await get(
                            downloadPage
                        );


                    realUrl =
                        findHere(
                            retryPage.body
                        );


                    if (
                        realUrl
                    ) {

                        console.log(
                            "'here' FOUND."
                        );

                        break;

                    }

                }

            }


            if (
                !realUrl
            ) {

                console.log(
                    "Không tìm thấy link 'here'."
                );

                continue;

            }


            realUrl =
                absoluteUrl(
                    realUrl,
                    downloadPage
                );


            console.log("");
            console.log(
                "REAL DOWNLOAD URL:"
            );

            console.log(
                realUrl
            );


            // ==================================================
            // STEP 9
            // DOWNLOAD
            // ==================================================

            console.log("");
            console.log(
                "Downloading..."
            );


            await download(
                realUrl,
                temp
            );


            // ==================================================
            // STEP 10
            // CHECK FILE
            // ==================================================

            const type =
                checkFile(
                    temp
                );


            console.log(
                "Detected:",
                type
            );


            // ==================================================
            // BUNDLE → SKIP
            // ==================================================

            if (
                type === "bundle"
            ) {

                console.log(
                    "BUNDLE detected."
                );

                console.log(
                    "Skip this candidate."
                );


                fs.unlinkSync(
                    temp
                );


                continue;

            }


            // ==================================================
            // APK → SUCCESS
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


            // ==================================================
            // INVALID
            // ==================================================

            console.log(
                "Invalid file."
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


        } catch (error) {

            console.log("");
            console.log(
                `LINK ${i + 1} ERROR:`
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
