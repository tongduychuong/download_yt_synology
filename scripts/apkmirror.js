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


// ==================================================
// SLEEP
// ==================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


// ==================================================
// HTTP GET
// ==================================================

function get(url) {

    return new Promise((resolve, reject) => {

        const req = https.get(
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
            res => {

                const status = res.statusCode;

                // Redirect
                if (
                    [301, 302, 303, 307, 308].includes(status)
                ) {

                    const location =
                        res.headers.location;

                    res.resume();

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

                let body = "";

                res.setEncoding("utf8");

                res.on(
                    "data",
                    chunk => {
                        body += chunk;
                    }
                );

                res.on(
                    "end",
                    () => {

                        resolve({
                            status,
                            body,
                            headers: res.headers,
                            url
                        });

                    }
                );

            }
        );


        req.setTimeout(
            120000,
            () => {
                req.destroy(
                    new Error(
                        "Request timeout"
                    )
                );
            }
        );


        req.on(
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


        const req =
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
                res => {

                    const status =
                        res.statusCode;


                    // Redirect
                    if (
                        [301, 302, 303, 307, 308]
                            .includes(status)
                    ) {

                        const location =
                            res.headers.location;

                        res.resume();

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

                        res.resume();

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


                    res.pipe(file);


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


        req.setTimeout(
            180000,
            () => {

                req.destroy(
                    new Error(
                        "Download timeout"
                    )
                );

            }
        );


        req.on(
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

    url = cleanUrl(url);

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
// FIND downloadButton
//
// Giống build.sh:
//
// grep -m1 'downloadButton'
// tr ' ' '\n'
// grep -m1 'href='
// ==================================================

function findDownloadButton(html) {

    const match =
        html.match(
            /<[^>]*class=["'][^"']*downloadButton[^"']*["'][^>]*>/i
        );


    if (!match) {
        return null;
    }


    const tag =
        match[0];


    const href =
        tag.match(
            /href=["']([^"']+)["']/i
        );


    if (
        !href ||
        !href[1]
    ) {
        return null;
    }


    return href[1];

}


// ==================================================
// FIND "here"
//
// Giống build.sh:
//
// grep -m1 '>here<'
// ==================================================

function findHere(html) {

    const patterns = [

        /<a[^>]*href=["']([^"']+)["'][^>]*>\s*here\s*<\/a>/i,

        /<a[^>]*href=["']([^"']+)["'][^>]*>[\s\S]{0,300}?<[^>]*>\s*here\s*<\/[^>]*>[\s\S]{0,100}?<\/a>/i,

        /href=["']([^"']+)["'][^>]*>\s*here\s*</i

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

            return match[1];

        }

    }


    return null;

}


// ==================================================
// CHECK APK / BUNDLE
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


        // Bundle / APKS
        if (
            output.includes(
                "base.apk"
            )
        ) {

            return "bundle";

        }


        // Normal APK
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

    const firstUrl =
        `${BASE}/apk/${relativePath}`;


    const temp =
        `YouTube${number}.zip`;


    console.log("");
    console.log(
        "======================================"
    );

    console.log(
        `YOUTUBE CANDIDATE ${number}`
    );

    console.log(
        firstUrl
    );

    console.log(
        "======================================"
    );


    try {

        // ==================================================
        // FIRST PAGE
        // ==================================================

        let first =
            await get(
                firstUrl
            );


        console.log(
            "HTTP:",
            first.status
        );


        if (
            first.status !== 200
        ) {

            throw new Error(
                `HTTP ${first.status}`
            );

        }


        // ==================================================
        // CHỜ 15 GIÂY
        //
        // Quan trọng theo yêu cầu của bạn
        // ==================================================

        console.log(
            "Waiting 15 seconds for downloadButton..."
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
        // TÌM DOWNLOAD BUTTON
        // ==================================================

        let button =
            findDownloadButton(
                first.body
            );


        // ==================================================
        // RETRY
        // ==================================================

        if (!button) {

            console.log(
                "downloadButton chưa có."
            );

            console.log(
                "Retry..."
            );


            for (
                let retry = 0;
                retry < 15;
                retry++
            ) {

                await sleep(1000);


                first =
                    await get(
                        firstUrl
                    );


                button =
                    findDownloadButton(
                        first.body
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


        const secondUrl =
            absoluteUrl(
                button,
                firstUrl
            );


        console.log(
            "downloadButton:"
        );

        console.log(
            secondUrl
        );


        // ==================================================
        // SECOND PAGE
        // ==================================================

        let second =
            await get(
                secondUrl
            );


        if (
            second.status !== 200
        ) {

            throw new Error(
                `Download page HTTP ${second.status}`
            );

        }


        // ==================================================
        // CHỜ 15 GIÂY
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
                second.body
            );


        // ==================================================
        // RETRY HERE
        // ==================================================

        if (!realUrl) {

            console.log(
                "'here' chưa có."
            );

            for (
                let retry = 0;
                retry < 15;
                retry++
            ) {

                await sleep(1000);


                second =
                    await get(
                        secondUrl
                    );


                realUrl =
                    findHere(
                        second.body
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
                secondUrl
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

        await download(
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
            "TYPE:",
            type
        );


        if (
            type === "bundle"
        ) {

            console.log(
                "Bundle detected - skip."
            );

            fs.unlinkSync(
                temp
            );

            return null;

        }


        if (
            type !== "apk"
        ) {

            console.log(
                "Invalid APK file."
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

            return null;

        }


        // ==================================================
        // NORMAL APK
        // ==================================================

        const finalName =
            `com.google.android.youtube-${VERSION}-all.apk`;


        if (
            fs.existsSync(
                finalName
            )
        ) {
            fs.unlinkSync(
                finalName
            );
        }


        fs.renameSync(
            temp,
            finalName
        );


        const size =
            fs.statSync(
                finalName
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
            finalName
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


        return finalName;

    } catch (error) {

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


        return null;

    }

}


// ==================================================
// MAIN
// ==================================================

async function main() {

    // Giống build.sh dòng 124-127
    const candidates = [

        `google-inc/youtube/youtube-${V}-release/youtube-${V}-2-android-apk-download/`,

        `google-inc/youtube/youtube-${V}-release/youtube-${V}-android-apk-download/`,

        `google-inc/youtube/youtube-${V}-release/youtube-${V}-3-android-apk-download/`,

        `google-inc/youtube/youtube-${V}-release/youtube-${V}-4-android-apk-download/`

    ];


    console.log("");
    console.log(
        "======================================"
    );

    console.log(
        "YouTube APKMirror"
    );

    console.log(
        "VERSION:",
        VERSION
    );

    console.log(
        "4 candidates"
    );

    console.log(
        "======================================"
    );


    // ==================================================
    // THỬ 4 LINK TUẦN TỰ
    // ==================================================

    for (
        let i = 0;
        i < candidates.length;
        i++
    ) {

        const result =
            await downloadCandidate(
                candidates[i],
                i + 1
            );


        if (result) {

            console.log("");
            console.log(
                "DOWNLOAD SUCCESS"
            );

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
