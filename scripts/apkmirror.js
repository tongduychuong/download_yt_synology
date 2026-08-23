const { chromium } = require("playwright");
const fs = require("fs");
const { execFileSync } = require("child_process");

const VERSION = process.env.VERSION;

if (!VERSION) {
    throw new Error("VERSION is missing");
}

const BASE_URL = "https://www.apkmirror.com";

const VERSION_DASH = VERSION.replace(/\./g, "-");

const USER_AGENT =
    "Mozilla/5.0 (Linux; Android 14; Mobile) " +
    "AppleWebKit/537.36 " +
    "(KHTML, like Gecko) " +
    "Chrome/131.0.0.0 Mobile Safari/537.36";


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


function absUrl(url) {

    if (!url) {
        return "";
    }

    url = url
        .replace(/&amp;/g, "&")
        .replace(/amp;/g, "");

    if (url.startsWith("http://")) {
        return url;
    }

    if (url.startsWith("https://")) {
        return url;
    }

    if (url.startsWith("//")) {
        return "https:" + url;
    }

    if (url.startsWith("/")) {
        return BASE_URL + url;
    }

    return BASE_URL + "/" + url;
}


function releaseUrls() {

    return [
        `google-inc/youtube/youtube-${VERSION_DASH}-release/youtube-${VERSION_DASH}-2-android-apk-download`,

        `google-inc/youtube/youtube-${VERSION_DASH}-release/youtube-${VERSION_DASH}-android-apk-download`,

        `google-inc/youtube/youtube-${VERSION_DASH}-release/youtube-${VERSION_DASH}-3-android-apk-download`,

        `google-inc/youtube/youtube-${VERSION_DASH}-release/youtube-${VERSION_DASH}-4-android-apk-download`
    ];

}


function inspectFile(filename) {

    if (!fs.existsSync(filename)) {
        return "missing";
    }

    try {

        const output =
            execFileSync(
                "unzip",
                [
                    "-l",
                    filename
                ],
                {
                    encoding: "utf8",
                    stdio: [
                        "ignore",
                        "pipe",
                        "ignore"
                    ]
                }
            );


        if (
            output.includes("base.apk")
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


async function getDownloadButton(page) {

    // ==================================================
    // TƯƠNG ĐƯƠNG:
    //
    // grep 'downloadButton'
    // ==================================================

    const selectors = [

        "a.downloadButton",

        ".downloadButton a",

        "a[class*='downloadButton']",

        "[class*='downloadButton']"

    ];


    for (
        const selector
        of selectors
    ) {

        const locator =
            page.locator(
                selector
            );


        const count =
            await locator.count();


        if (
            count === 0
        ) {
            continue;
        }


        for (
            let i = 0;
            i < count;
            i++
        ) {

            const element =
                locator.nth(i);


            const href =
                await element.getAttribute(
                    "href"
                );


            if (
                href
            ) {

                return absUrl(
                    href
                );

            }

        }

    }


    // ==================================================
    // FALLBACK: SEARCH HTML
    // ==================================================

    const html =
        await page.content();


    const match =
        html.match(
            /class=["'][^"']*downloadButton[^"']*["'][^>]*href=["']([^"']+)["']/i
        );


    if (
        match &&
        match[1]
    ) {

        return absUrl(
            match[1]
        );

    }


    return null;

}


async function getHereLink(page) {

    // ==================================================
    // TƯƠNG ĐƯƠNG:
    //
    // grep -m1 '>here<'
    // ==================================================

    const here =
        page.getByText(
            "here",
            {
                exact: true
            }
        );


    const count =
        await here.count();


    for (
        let i = 0;
        i < count;
        i++
    ) {

        const element =
            here.nth(i);


        const href =
            await element.getAttribute(
                "href"
            );


        if (
            href
        ) {

            return absUrl(
                href
            );

        }


        const parent =
            element.locator(
                "xpath=ancestor::a[1]"
            );


        if (
            await parent.count()
        ) {

            const parentHref =
                await parent.getAttribute(
                    "href"
                );


            if (
                parentHref
            ) {

                return absUrl(
                    parentHref
                );

            }

        }

    }


    // ==================================================
    // FALLBACK HTML
    // ==================================================

    const html =
        await page.content();


    const match =
        html.match(
            /<a[^>]+href=["']([^"']+)["'][^>]*>\s*here\s*<\/a>/i
        );


    if (
        match &&
        match[1]
    ) {

        return absUrl(
            match[1]
        );

    }


    // ==================================================
    // FALLBACK: FIND href + text nearby
    // ==================================================

    const matches =
        [
            ...html.matchAll(
                /href=["']([^"']+)["'][^>]*>[^<]*here[^<]*</gi
            )
        ];


    if (
        matches.length > 0
    ) {

        return absUrl(
            matches[0][1]
        );

    }


    return null;

}


async function downloadFile(
    context,
    url,
    filename
) {

    console.log("");
    console.log(
        "REAL DOWNLOAD URL:"
    );

    console.log(
        url
    );


    // ==================================================
    // DÙNG REQUEST CONTEXT CỦA PLAYWRIGHT
    // SESSION COOKIE ĐƯỢC GIỮ
    // ==================================================

    const response =
        await context.request.get(
            url,
            {
                timeout: 180000,
                maxRedirects: 10,
                failOnStatusCode: false
            }
        );


    console.log(
        "HTTP:",
        response.status()
    );


    if (
        !response.ok()
    ) {

        throw new Error(
            `Download HTTP ${response.status()}`
        );

    }


    const buffer =
        await response.body();


    if (
        buffer.length <
        1000000
    ) {

        throw new Error(
            `Downloaded data quá nhỏ: ${buffer.length} bytes`
        );

    }


    fs.writeFileSync(
        filename,
        buffer
    );


    return filename;

}


async function main() {

    const browser =
        await chromium.launch({

            headless: true,

            args: [
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled"
            ]

        });


    const context =
        await browser.newContext({

            userAgent:
                USER_AGENT,

            locale:
                "en-US",

            viewport: {
                width: 390,
                height: 844
            },

            isMobile: true,

            hasTouch: true,

            extraHTTPHeaders: {
                "Accept-Language":
                    "en-US,en;q=0.9"
            }

        });


    const page =
        await context.newPage();


    try {

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


        const candidates =
            releaseUrls();


        // ==================================================
        // THỬ 4 URL GIỐNG CODE TAIYT
        // ==================================================

        for (
            let index = 0;
            index < candidates.length;
            index++
        ) {

            const relativeUrl =
                candidates[index];


            const releaseUrl =
                `${BASE_URL}/apk/${relativeUrl}/`;


            const tempName =
                `youtube_candidate_${index + 1}.zip`;


            console.log("");
            console.log(
                "======================================"
            );

            console.log(
                `TRY CANDIDATE ${index + 1}/4`
            );

            console.log(
                releaseUrl
            );

            console.log(
                "======================================"
            );


            try {

                // ==================================================
                // 1. OPEN APKMIRROR DOWNLOAD PAGE
                // ==================================================

                await page.goto(
                    releaseUrl,
                    {
                        waitUntil:
                            "domcontentloaded",

                        timeout:
                            120000
                    }
                );


                // ==================================================
                // 2. CHỜ ANTI-ADBLOCK
                // ==================================================

                console.log(
                    "Waiting 20 seconds..."
                );


                for (
                    let seconds = 20;
                    seconds > 0;
                    seconds--
                ) {

                    process.stdout.write(
                        `\rWaiting ${seconds}s...`
                    );

                    await sleep(1000);

                }


                console.log("");


                // ==================================================
                // 3. TÌM downloadButton
                // ==================================================

                console.log(
                    "Finding downloadButton..."
                );


                const apkPage =
                    await getDownloadButton(
                        page
                    );


                if (
                    !apkPage
                ) {

                    console.log(
                        "downloadButton not found."
                    );

                    continue;

                }


                console.log(
                    "downloadButton:"
                );

                console.log(
                    apkPage
                );


                // ==================================================
                // 4. MỞ TRANG DOWNLOAD
                // ==================================================

                await page.goto(
                    apkPage,
                    {
                        waitUntil:
                            "domcontentloaded",

                        timeout:
                            120000
                    }
                );


                // ==================================================
                // 5. CHỜ 20 GIÂY
                // ==================================================

                console.log(
                    "Waiting for real download page..."
                );


                for (
                    let seconds = 20;
                    seconds > 0;
                    seconds--
                ) {

                    process.stdout.write(
                        `\rWaiting ${seconds}s...`
                    );

                    await sleep(1000);

                }


                console.log("");


                // ==================================================
                // 6. TÌM >here<
                // ==================================================

                console.log(
                    "Finding 'here'..."
                );


                const realUrl =
                    await getHereLink(
                        page
                    );


                if (
                    !realUrl
                ) {

                    console.log(
                        "here link not found."
                    );

                    continue;

                }


                console.log(
                    "here:"
                );

                console.log(
                    realUrl
                );


                // ==================================================
                // 7. DOWNLOAD
                // ==================================================

                console.log(
                    "Downloading candidate..."
                );


                await downloadFile(
                    context,
                    realUrl,
                    tempName
                );


                // ==================================================
                // 8. KIỂM TRA APK HAY BUNDLE
                // ==================================================

                const type =
                    inspectFile(
                        tempName
                    );


                console.log(
                    "Detected:",
                    type
                );


                // ==================================================
                // APK THƯỜNG
                // ==================================================

                if (
                    type === "apk"
                ) {

                    const finalName =
                        `com.google.android.youtube-${VERSION}-all.apk`;


                    fs.renameSync(
                        tempName,
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
                        "SUCCESS - NORMAL APK"
                    );

                    console.log(
                        "Candidate:",
                        index + 1
                    );

                    console.log(
                        "File:",
                        finalName
                    );

                    console.log(
                        "Size:",
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
                // BUNDLE / APKS
                // ==================================================

                if (
                    type === "bundle"
                ) {

                    console.log(
                        "Candidate is BUNDLE/APKS."
                    );

                    console.log(
                        "Skip."
                    );


                    fs.unlinkSync(
                        tempName
                    );


                    continue;

                }


                // ==================================================
                // INVALID
                // ==================================================

                console.log(
                    "Invalid download."
                );


                if (
                    fs.existsSync(
                        tempName
                    )
                ) {

                    fs.unlinkSync(
                        tempName
                    );

                }


            } catch (error) {

                console.log("");
                console.log(
                    `Candidate ${index + 1} failed:`
                );

                console.log(
                    error.message
                );


                if (
                    fs.existsSync(
                        tempName
                    )
                ) {

                    fs.unlinkSync(
                        tempName
                    );

                }

            }

        }


        throw new Error(
            `Không tìm thấy NORMAL APK cho YouTube ${VERSION}. Đã thử 4 candidate.`
        );


    } finally {

        await browser.close();

    }

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
