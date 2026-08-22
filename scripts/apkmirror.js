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

    const s = text.toLowerCase();

    return (
        s.includes("secondary") ||
        s.includes("alpha") ||
        s.includes("release-candidate") ||
        /\brc\b/.test(s)
    );
}


function isBeta(text) {

    const s = text.toLowerCase();

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
                elements.map(element => ({
                    text:
                        (
                            element.innerText ||
                            ""
                        ).trim(),

                    href:
                        element.href
                }))
        );

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

        // =================================================
        // 1. SEARCH
        // =================================================

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


        // =================================================
        // 2. FIND RELEASE
        // =================================================

        const searchLinks =
            await getLinks(page);


        const releases = [];


        for (
            const item of searchLinks
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
                        .replace(/\./g, "-")
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


        // =================================================
        // UNIQUE
        // =================================================

        const unique = [];

        const seen =
            new Set();


        for (
            const item of releases
        ) {

            if (
                seen.has(item.href)
            ) {
                continue;
            }


            seen.add(item.href);

            unique.push(item);

        }


        // =================================================
        // STABLE FIRST
        // =================================================

        const stable =
            unique.filter(
                x =>
                    x.type === "stable"
            );


        const beta =
            unique.filter(
                x =>
                    x.type === "beta"
            );


        let selected;


        if (
            stable.length > 0
        ) {

            selected =
                stable[0];

        } else if (
            beta.length > 0
        ) {

            selected =
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
            selected.type
        );

        console.log(
            selected.href
        );


        // =================================================
        // 3. OPEN RELEASE
        // =================================================

        await page.goto(
            selected.href,
            {
                waitUntil:
                    "domcontentloaded",

                timeout:
                    120000
            }
        );


        await sleep(4000);


        // =================================================
        // 4. FIND ALL ANDROID APK DOWNLOAD LINKS
        // =================================================

        const releaseLinks =
            await getLinks(page);


        const apkPages = [];


        for (
            const item of releaseLinks
        ) {

            const href =
                item.href || "";


            const text =
                item.text || "";


            const lower =
                href.toLowerCase();


            const combined =
                `${text} ${href}`
                    .toLowerCase();


            // MUST be YouTube APK
            if (
                !lower.includes(
                    "/apk/google-inc/youtube/"
                )
            ) {
                continue;
            }


            // MUST be APK download page
            if (
                !lower.includes(
                    "android-apk-download"
                )
            ) {
                continue;
            }


            // MUST contain version
            if (
                !lower.includes(
                    VERSION.toLowerCase()
                ) &&
                !lower.includes(
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


            // NEVER SECONDARY
            if (
                combined.includes(
                    "secondary"
                )
            ) {
                continue;
            }


            // NEVER ALPHA
            if (
                combined.includes(
                    "alpha"
                )
            ) {
                continue;
            }


            // NEVER RC
            if (
                combined.includes(
                    "release-candidate"
                ) ||
                /\brc\b/.test(combined)
            ) {
                continue;
            }


            // NEVER BUNDLE
            if (
                lower.includes(
                    "bundle"
                )
            ) {
                continue;
            }


            apkPages.push({
                text,
                href
            });

        }


        // =================================================
        // UNIQUE
        // =================================================

        const uniqueApkPages = [];

        const apkSeen =
            new Set();


        for (
            const item of apkPages
        ) {

            if (
                apkSeen.has(item.href)
            ) {
                continue;
            }


            apkSeen.add(
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
            const item of uniqueApkPages
        ) {

            console.log(
                item.href
            );

        }


        if (
            uniqueApkPages.length === 0
        ) {

            throw new Error(
                "Không tìm thấy APK nodpi / non-bundle."
            );

        }


        // =================================================
        // 5. PRIORITY:
        //
        // -3-android-apk-download
        //
        // This is the nodpi APK page
        // =================================================

        let selectedApkPage =
            uniqueApkPages.find(
                item =>
                    item.href.includes(
                        `-${VERSION.replace(/\./g, "-")}-3-android-apk-download`
                    )
            );


        // Generic fallback:
        // android-apk-download but not bundle
        if (
            !selectedApkPage
        ) {

            selectedApkPage =
                uniqueApkPages[0];

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


        // =================================================
        // 6. OPEN NODPI APK PAGE
        // =================================================

        await page.goto(
            selectedApkPage.href,
            {
                waitUntil:
                    "domcontentloaded",

                timeout:
                    120000
            }
        );


        await sleep(8000);


        console.log("");
        console.log(
            "PAGE TITLE:"
        );

        console.log(
            await page.title()
        );


        // =================================================
        // 7. FIND DOWNLOAD URL
        // =================================================

        const allLinks =
            await getLinks(page);


        console.log("");
        console.log(
            "DOWNLOAD LINKS:"
        );


        for (
            const item of allLinks
        ) {

            const combined =
                `${item.text} ${item.href}`
                    .toLowerCase();


            if (
                combined.includes(
                    "download"
                )
            ) {

                console.log(
                    item.text
                );

                console.log(
                    item.href
                );

            }

        }


        // =================================================
        // 8. FIND NORMAL DOWNLOAD
        // =================================================

        const candidates =
            allLinks.filter(
                item => {

                    const text =
                        (
                            item.text ||
                            ""
                        )
                        .trim()
                        .toLowerCase();


                    const href =
                        (
                            item.href ||
                            ""
                        )
                        .toLowerCase();


                    const combined =
                        `${text} ${href}`
                            .toLowerCase();


                    // NEVER BUNDLE
                    if (
                        combined.includes(
                            "bundle"
                        )
                    ) {
                        return false;
                    }


                    if (
                        combined.includes(
                            "splits"
                        )
                    ) {
                        return false;
                    }


                    // Normal APK
                    if (
                        text ===
                        "download apk"
                    ) {
                        return true;
                    }


                    if (
                        text.includes(
                            "download apk"
                        )
                    ) {
                        return true;
                    }


                    // Dynamic APKMirror key
                    if (
                        href.includes(
                            "/download/?key="
                        )
                    ) {
                        return true;
                    }


                    return false;

                }
            );


        console.log("");
        console.log(
            "NORMAL APK CANDIDATES:"
        );


        for (
            const item of candidates
        ) {

            console.log(
                "TEXT:",
                item.text
            );

            console.log(
                "URL:",
                item.href
            );

        }


        if (
            candidates.length === 0
        ) {

            throw new Error(
                "Không tìm thấy DOWNLOAD APK thường."
            );

        }


        // =================================================
        // 9. CLICK REAL DOWNLOAD LINK
        // =================================================

        let target =
            candidates.find(
                item =>
                    (
                        item.text ||
                        ""
                    )
                    .trim()
                    .toLowerCase() ===
                    "download apk"
            );


        if (
            !target
        ) {

            target =
                candidates.find(
                    item =>
                        (
                            item.href ||
                            ""
                        ).includes(
                            "/download/?key="
                        )
                );

        }


        if (
            !target
        ) {

            target =
                candidates[0];

        }


        console.log("");
        console.log(
            "======================================"
        );

        console.log(
            "SELECTED DOWNLOAD:"
        );

        console.log(
            target.text
        );

        console.log(
            target.href
        );

        console.log(
            "======================================"
        );


        // =================================================
        // 10. LOCATOR
        // =================================================

        let locator =
            null;


        if (
            target.href
        ) {

            const hrefLocator =
                page.locator(
                    `a[href="${target.href}"]`
                );


            if (
                await hrefLocator.count()
            ) {

                locator =
                    hrefLocator.first();

            }

        }


        if (
            !locator
        ) {

            locator =
                page.getByText(
                    "DOWNLOAD APK",
                    {
                        exact: true
                    }
                ).first();

        }


        if (
            !locator ||
            await locator.count() === 0
        ) {

            throw new Error(
                "Không tìm thấy element DOWNLOAD APK."
            );

        }


        // =================================================
        // 11. CLICK
        // =================================================

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


        await locator.scrollIntoViewIfNeeded();


        await locator.click({
            force: true
        });


        const download =
            await downloadPromise;


        // =================================================
        // 12. SAVE
        // =================================================

        const filename =
            `com.google.android.youtube-` +
            `${VERSION}-all.apk`;


        await download.saveAs(
            filename
        );


        // =================================================
        // 13. VERIFY
        // =================================================

        if (
            !fs.existsSync(
                filename
            )
        ) {

            throw new Error(
                "APK không tồn tại."
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


        // =================================================
        // 14. GITHUB OUTPUT
        // =================================================

        if (
            process.env.GITHUB_OUTPUT
        ) {

            fs.appendFileSync(
                process.env.GITHUB_OUTPUT,

                `release_type=${selected.type}\n`
            );


            fs.appendFileSync(
                process.env.GITHUB_OUTPUT,

                `release_url=${selected.href}\n`
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
