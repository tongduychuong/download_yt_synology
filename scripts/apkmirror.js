const { chromium } = require("playwright");
const fs = require("fs");

const VERSION = process.env.VERSION;

if (!VERSION) {
    throw new Error("VERSION is missing");
}

const BASE_URL =
    "https://www.apkmirror.com";

const SEARCH_URL =
    `${BASE_URL}/?post_type=app_release&searchtype=apk&s=youtube+${VERSION}`;

const USER_AGENT =
    "Mozilla/5.0 (X11; Linux x86_64) " +
    "AppleWebKit/537.36 " +
    "(KHTML, like Gecko) " +
    "Chrome/131.0.0.0 Safari/537.36";


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


function isBadRelease(text) {

    const s =
        text.toLowerCase();

    return (
        s.includes("secondary") ||
        s.includes("alpha") ||
        s.includes("release-candidate") ||
        /\brc\b/.test(s)
    );
}


function isBeta(text) {

    const s =
        text.toLowerCase();

    return (
        s.includes(" beta") ||
        s.includes("-beta-") ||
        s.includes(" beta-") ||
        s.includes("-beta/")
    );
}


async function getLinks(page) {

    return await page
        .locator("a[href]")
        .evaluateAll(
            elements =>
                elements.map(
                    element => ({
                        text:
                            (
                                element.innerText ||
                                ""
                            ).trim(),

                        href:
                            element.href
                    })
                )
        );

}


async function main() {

    // ==================================================
    // BROWSER
    // ==================================================

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
                width: 1366,
                height: 900
            },

            extraHTTPHeaders: {

                "Accept-Language":
                    "en-US,en;q=0.9"

            }

        });


    const page =
        await context.newPage();


    try {

        // ==================================================
        // 1. SEARCH
        // ==================================================

        console.log("");
        console.log(
            "======================================"
        );

        console.log(
            "VERSION:",
            VERSION
        );

        console.log(
            "SEARCH:",
            SEARCH_URL
        );

        console.log(
            "======================================"
        );


        await page.goto(
            SEARCH_URL,
            {
                waitUntil:
                    "domcontentloaded",

                timeout:
                    120000
            }
        );


        await sleep(3000);


        // ==================================================
        // 2. FIND RELEASE
        // ==================================================

        const searchLinks =
            await getLinks(page);


        const releases =
            [];


        for (
            const item
            of searchLinks
        ) {

            const combined =
                `${item.text} ${item.href}`
                    .toLowerCase();


            if (
                !combined.includes(
                    "/apk/google-inc/youtube/"
                )
            ) {
                continue;
            }


            if (
                !combined.includes(
                    "release"
                )
            ) {
                continue;
            }


            if (
                !combined.includes(
                    VERSION.toLowerCase()
                ) &&
                !combined.includes(
                    VERSION
                        .replace(
                            /\./g,
                            "-"
                        )
                        .toLowerCase()
                )
            ) {
                continue;
            }


            if (
                isBadRelease(combined)
            ) {
                continue;
            }


            releases.push({

                type:
                    isBeta(combined)
                        ? "beta"
                        : "stable",

                href:
                    item.href

            });

        }


        // ==================================================
        // UNIQUE RELEASES
        // ==================================================

        const uniqueReleases =
            [];

        const seenReleases =
            new Set();


        for (
            const item
            of releases
        ) {

            if (
                seenReleases.has(
                    item.href
                )
            ) {
                continue;
            }


            seenReleases.add(
                item.href
            );


            uniqueReleases.push(
                item
            );

        }


        console.log("");
        console.log(
            "RELEASE CANDIDATES:"
        );


        for (
            const item
            of uniqueReleases
        ) {

            console.log(
                `[${item.type}]`,
                item.href
            );

        }


        // ==================================================
        // 3. STABLE > BETA
        // ==================================================

        const stable =
            uniqueReleases.filter(
                item =>
                    item.type === "stable"
            );


        const beta =
            uniqueReleases.filter(
                item =>
                    item.type === "beta"
            );


        let selectedRelease;


        if (
            stable.length > 0
        ) {

            selectedRelease =
                stable[0];

        } else if (
            beta.length > 0
        ) {

            selectedRelease =
                beta[0];

        } else {

            throw new Error(
                `Không tìm thấy YouTube ${VERSION} Stable/Beta`
            );

        }


        console.log("");
        console.log(
            "SELECTED RELEASE:"
        );

        console.log(
            selectedRelease.type
        );

        console.log(
            selectedRelease.href
        );


        // ==================================================
        // 4. OPEN RELEASE
        // ==================================================

        await page.goto(
            selectedRelease.href,
            {
                waitUntil:
                    "domcontentloaded",

                timeout:
                    120000
            }
        );


        await sleep(4000);


        // ==================================================
        // 5. FIND APK DOWNLOAD PAGES
        // ==================================================

        const releaseLinks =
            await getLinks(page);


        const apkPages =
            [];


        for (
            const item
            of releaseLinks
        ) {

            const href =
                item.href || "";


            const lowerHref =
                href.toLowerCase();


            const combined =
                `${item.text} ${href}`
                    .toLowerCase();


            // YouTube only
            if (
                !lowerHref.includes(
                    "/apk/google-inc/youtube/"
                )
            ) {
                continue;
            }


            // Real APK download page
            if (
                !lowerHref.includes(
                    "android-apk-download"
                )
            ) {
                continue;
            }


            // Version
            if (
                !lowerHref.includes(
                    VERSION.toLowerCase()
                ) &&
                !lowerHref.includes(
                    VERSION
                        .replace(
                            /\./g,
                            "-"
                        )
                        .toLowerCase()
                )
            ) {
                continue;
            }


            // No secondary
            if (
                combined.includes(
                    "secondary"
                )
            ) {
                continue;
            }


            // No alpha
            if (
                combined.includes(
                    "alpha"
                )
            ) {
                continue;
            }


            // No RC
            if (
                combined.includes(
                    "release-candidate"
                ) ||
                /\brc\b/.test(combined)
            ) {
                continue;
            }


            // No bundle
            if (
                lowerHref.includes(
                    "bundle"
                )
            ) {
                continue;
            }


            apkPages.push({

                text:
                    item.text,

                href:
                    item.href

            });

        }


        // ==================================================
        // UNIQUE APK PAGES
        // ==================================================

        const uniqueApkPages =
            [];

        const pageSeen =
            new Set();


        for (
            const item
            of apkPages
        ) {

            if (
                pageSeen.has(
                    item.href
                )
            ) {
                continue;
            }


            pageSeen.add(
                item.href
            );


            uniqueApkPages.push(
                item
            );

        }


        console.log("");
        console.log(
            "NON-BUNDLE APK PAGES:"
        );


        for (
            const item
            of uniqueApkPages
        ) {

            console.log(
                item.href
            );

        }


        if (
            uniqueApkPages.length === 0
        ) {

            throw new Error(
                "Không tìm thấy APK non-bundle."
            );

        }


        // ==================================================
        // 6. SELECT NODPI APK
        // ==================================================

        const versionDash =
            VERSION.replace(
                /\./g,
                "-"
            );


        let selectedApkPage =
            uniqueApkPages.find(
                item => {

                    const href =
                        item.href.toLowerCase();


                    return (
                        href.includes(
                            `-${versionDash}-3-android-apk-download`
                        )
                    );

                }
            );


        // Fallback
        if (
            !selectedApkPage
        ) {

            selectedApkPage =
                uniqueApkPages.find(
                    item =>
                        !item.href
                            .toLowerCase()
                            .includes(
                                "bundle"
                            )
                );

        }


        if (
            !selectedApkPage
        ) {

            throw new Error(
                `Không tìm thấy nodpi APK page cho ${VERSION}`
            );

        }


        console.log("");
        console.log(
            "======================================"
        );

        console.log(
            "SELECTED NODPI APK PAGE:"
        );

        console.log(
            selectedApkPage.href
        );

        console.log(
            "======================================"
        );


        // ==================================================
        // 7. OPEN DOWNLOAD PAGE
        // ==================================================

        await page.goto(
            selectedApkPage.href,
            {
                waitUntil:
                    "domcontentloaded",

                timeout:
                    120000
            }
        );


        // ==================================================
        // 8. WAIT 20 SECONDS
        // ==================================================

        console.log("");
        console.log(
            "APKMirror anti-adblock detected."
        );

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
        console.log(
            "Anti-adblock wait completed."
        );


        // ==================================================
        // 9. WAIT DOWNLOAD APK
        // ==================================================

        console.log("");
        console.log(
            "Waiting for DOWNLOAD APK..."
        );


        let downloadButton =
            null;


        for (
            let attempt = 0;
            attempt < 40;
            attempt++
        ) {

            // ----------------------------------------------
            // Exact text
            // ----------------------------------------------

            const exact =
                page.getByText(
                    "DOWNLOAD APK",
                    {
                        exact: true
                    }
                );


            if (
                await exact.count() > 0
            ) {

                downloadButton =
                    exact.first();

                break;

            }


            // ----------------------------------------------
            // Regex
            // ----------------------------------------------

            const regex =
                page.getByText(
                    /DOWNLOAD\s+APK/i
                );


            const count =
                await regex.count();


            if (
                count > 0
            ) {

                for (
                    let i = 0;
                    i < count;
                    i++
                ) {

                    const element =
                        regex.nth(i);


                    const text =
                        (
                            await element.innerText()
                        )
                        .trim()
                        .toLowerCase();


                    if (
                        text.includes(
                            "bundle"
                        )
                    ) {
                        continue;
                    }


                    if (
                        text.includes(
                            "splits"
                        )
                    ) {
                        continue;
                    }


                    downloadButton =
                        element;

                    break;

                }

            }


            if (
                downloadButton
            ) {
                break;
            }


            await sleep(1000);

        }


        if (
            !downloadButton
        ) {

            console.log("");
            console.log(
                "DOWNLOAD APK NOT FOUND."
            );


            const body =
                await page
                    .locator(
                        "body"
                    )
                    .innerText();


            console.log("");
            console.log(
                "PAGE TEXT:"
            );


            console.log(
                body.substring(
                    0,
                    5000
                )
            );


            throw new Error(
                "Không tìm thấy element DOWNLOAD APK sau khi chờ."
            );

        }


        // ==================================================
        // 10. SHOW TARGET
        // ==================================================

        console.log("");
        console.log(
            "======================================"
        );

        console.log(
            "DOWNLOAD APK FOUND"
        );

        console.log(
            "======================================"
        );


        const targetInfo =
            await downloadButton.evaluate(
                element => ({

                    tag:
                        element.tagName,

                    text:
                        (
                            element.innerText ||
                            ""
                        ).trim(),

                    href:
                        element.href ||
                        element.getAttribute(
                            "href"
                        ) ||
                        "",

                    outerHTML:
                        element.outerHTML
                            .substring(
                                0,
                                2000
                            )

                })
            );


        console.log(
            JSON.stringify(
                targetInfo,
                null,
                2
            )
        );


        // ==================================================
        // 11. CLICK DOWNLOAD APK
        // ==================================================

        console.log("");
        console.log(
            "CLICK DOWNLOAD APK..."
        );


        const downloadPromise =
            page.waitForEvent(
                "download",
                {
                    timeout:
                        180000
                }
            );


        await downloadButton
            .scrollIntoViewIfNeeded();


        await downloadButton.click({
            force: true
        });


        const download =
            await downloadPromise;


        // ==================================================
        // 12. SAVE
        // ==================================================

        const filename =
            `com.google.android.youtube-` +
            `${VERSION}-all.apk`;


        console.log("");
        console.log(
            "SAVING:"
        );

        console.log(
            filename
        );


        await download.saveAs(
            filename
        );


        // ==================================================
        // 13. VERIFY
        // ==================================================

        if (
            !fs.existsSync(
                filename
            )
        ) {

            throw new Error(
                "APK không tồn tại sau download."
            );

        }


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


        if (
            size <
            10 * 1024 * 1024
        ) {

            throw new Error(
                "APK quá nhỏ."
            );

        }


        // ==================================================
        // 14. GITHUB OUTPUT
        // ==================================================

        if (
            process.env.GITHUB_OUTPUT
        ) {

            fs.appendFileSync(
                process.env.GITHUB_OUTPUT,

                `release_type=${selectedRelease.type}\n`
            );


            fs.appendFileSync(
                process.env.GITHUB_OUTPUT,

                `release_url=${selectedRelease.href}\n`
            );


            fs.appendFileSync(
                process.env.GITHUB_OUTPUT,

                `download_page=${selectedApkPage.href}\n`
            );

        }


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
