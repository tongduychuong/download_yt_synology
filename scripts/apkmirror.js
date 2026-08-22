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


function isBad(value) {

    const text =
        value.toLowerCase();

    return (
        text.includes("secondary") ||
        text.includes("alpha") ||
        text.includes("release-candidate") ||
        /\brc\b/.test(text) ||
        text.includes("bundle") ||
        text.includes("splits")
    );
}


function isBeta(value) {

    const text =
        value.toLowerCase();

    return (
        text.includes(" beta") ||
        text.includes("-beta-") ||
        text.includes(" beta-") ||
        text.includes("-beta/")
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

    // ======================================================
    // BROWSER
    // ======================================================

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
        // 1. SEARCH VERSION
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
        // 2. FIND STABLE / BETA RELEASE
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


            // Không lấy secondary,
            // alpha, rc, bundle, splits
            if (
                isBad(combined)
            ) {
                continue;
            }


            releases.push({

                type:
                    isBeta(combined)
                        ? "beta"
                        : "stable",

                href:
                    item.href,

                text:
                    item.text

            });

        }


        // ==================================================
        // REMOVE DUPLICATE
        // ==================================================

        const uniqueReleases =
            [];

        const releaseSeen =
            new Set();


        for (
            const item
            of releases
        ) {

            if (
                releaseSeen.has(
                    item.href
                )
            ) {
                continue;
            }


            releaseSeen.add(
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
        // 3. STABLE HAS PRIORITY
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


        await sleep(3000);


        // ==================================================
        // 5. GET RELEASE LINKS
        // ==================================================

        const releaseLinks =
            await getLinks(page);


        // ==================================================
        // 6. FIND ONLY NODPI
        // ==================================================

        const nodpiVariants =
            [];


        for (
            const item
            of releaseLinks
        ) {

            const text =
                item.text || "";


            const href =
                item.href || "";


            const combined =
                `${text} ${href}`
                    .toLowerCase();


            // ---------------------------------------------
            // Must be YouTube
            // ---------------------------------------------

            if (
                !combined.includes(
                    "/apk/google-inc/youtube/"
                )
            ) {
                continue;
            }


            // ---------------------------------------------
            // MUST BE NODPI
            // ---------------------------------------------

            if (
                !combined.includes(
                    "nodpi"
                )
            ) {
                continue;
            }


            // ---------------------------------------------
            // VERSION
            // ---------------------------------------------

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


            // ---------------------------------------------
            // BAD
            // ---------------------------------------------

            if (
                isBad(combined)
            ) {
                continue;
            }


            // ---------------------------------------------
            // Must lead to APK/download
            // ---------------------------------------------

            if (
                !combined.includes(
                    "apk"
                )
            ) {
                continue;
            }


            nodpiVariants.push({

                text:
                    text,

                href:
                    href

            });

        }


        // ==================================================
        // UNIQUE NODPI
        // ==================================================

        const uniqueNodpi =
            [];

        const nodpiSeen =
            new Set();


        for (
            const item
            of nodpiVariants
        ) {

            if (
                nodpiSeen.has(
                    item.href
                )
            ) {
                continue;
            }


            nodpiSeen.add(
                item.href
            );


            uniqueNodpi.push(
                item
            );

        }


        console.log("");
        console.log(
            "NODPI VARIANTS:"
        );


        for (
            const item
            of uniqueNodpi
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
            uniqueNodpi.length === 0
        ) {

            throw new Error(
                `Không tìm thấy variant nodpi cho ${VERSION}`
            );

        }


        // ==================================================
        // 7. FIND android-apk-download
        // ==================================================

        let downloadPage =
            null;


        for (
            const variant
            of uniqueNodpi
        ) {

            console.log("");
            console.log(
                "CHECK NODPI:",
                variant.href
            );


            await page.goto(
                variant.href,
                {
                    waitUntil:
                        "domcontentloaded",

                    timeout:
                        120000
                }
            );


            await sleep(2500);


            const variantLinks =
                await getLinks(page);


            for (
                const item
                of variantLinks
            ) {

                const href =
                    item.href || "";


                const combined =
                    `${item.text} ${href}`
                        .toLowerCase();


                if (
                    !href.includes(
                        "android-apk-download"
                    )
                ) {
                    continue;
                }


                if (
                    combined.includes(
                        "bundle"
                    ) ||
                    combined.includes(
                        "secondary"
                    ) ||
                    combined.includes(
                        "alpha"
                    )
                ) {
                    continue;
                }


                downloadPage =
                    href;


                break;

            }


            if (
                downloadPage
            ) {

                break;

            }

        }


        if (
            !downloadPage
        ) {

            throw new Error(
                `Không tìm thấy android-apk-download ` +
                `cho nodpi ${VERSION}`
            );

        }


        console.log("");
        console.log(
            "======================================"
        );

        console.log(
            "NODPI DOWNLOAD PAGE:"
        );

        console.log(
            downloadPage
        );

        console.log(
            "======================================"
        );


        // ==================================================
        // 8. OPEN DOWNLOAD PAGE
        // ==================================================

        await page.goto(
            downloadPage,
            {
                waitUntil:
                    "domcontentloaded",

                timeout:
                    120000
            }
        );


        await sleep(6000);


        console.log("");
        console.log(
            "DOWNLOAD PAGE TITLE:"
        );

        console.log(
            await page.title()
        );


        // ==================================================
        // 9. FIND ALL DOWNLOAD ELEMENTS
        // ==================================================

        const elements =
            await page.locator(
                "a,button,input"
            ).evaluateAll(
                elements =>
                    elements.map(
                        element => ({

                            tag:
                                element.tagName,

                            text:
                                (
                                    element.innerText ||
                                    element.value ||
                                    ""
                                ).trim(),

                            href:
                                element.href ||
                                element.getAttribute(
                                    "href"
                                ) ||
                                "",

                            id:
                                element.id ||
                                "",

                            className:
                                typeof element.className ===
                                "string"
                                    ? element.className
                                    : ""

                        })
                    )
            );


        console.log("");
        console.log(
            "DOWNLOAD ELEMENTS:"
        );


        for (
            const item
            of elements
        ) {

            const combined =
                `${item.text} ${item.href} ${item.id} ${item.className}`
                    .toLowerCase();


            if (
                combined.includes(
                    "download"
                )
            ) {

                console.log(
                    JSON.stringify(
                        item,
                        null,
                        2
                    )
                );

            }

        }


        // ==================================================
        // 10. FIND NORMAL DOWNLOAD APK
        // ==================================================

        const candidates =
            elements.filter(
                item => {

                    const text =
                        item.text
                            .trim()
                            .toLowerCase();


                    const combined =
                        `${item.text} ${item.href} ${item.id} ${item.className}`
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


                    if (
                        combined.includes(
                            "base apk"
                        )
                    ) {
                        return false;
                    }


                    // EXACT
                    if (
                        text ===
                        "download apk"
                    ) {
                        return true;
                    }


                    // Download APK with extra text
                    if (
                        text.includes(
                            "download apk"
                        )
                    ) {
                        return true;
                    }


                    // Direct /download/?key
                    if (
                        item.href.includes(
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
            const item
            of candidates
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


        // ==================================================
        // 11. SELECT
        // ==================================================

        let selectedDownload =
            candidates.find(
                item =>
                    item.text
                        .trim()
                        .toLowerCase() ===
                    "download apk"
            );


        if (
            !selectedDownload
        ) {

            selectedDownload =
                candidates.find(
                    item =>
                        item.href.includes(
                            "/download/?key="
                        )
                );

        }


        if (
            !selectedDownload
        ) {

            selectedDownload =
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
            selectedDownload.text
        );

        console.log(
            selectedDownload.href
        );

        console.log(
            "======================================"
        );


        // ==================================================
        // 12. FIND REAL DOM ELEMENT
        // ==================================================

        let targetElement =
            null;


        const anchors =
            page.locator(
                "a"
            );


        const anchorCount =
            await anchors.count();


        for (
            let i = 0;
            i < anchorCount;
            i++
        ) {

            const anchor =
                anchors.nth(i);


            const text =
                (
                    await anchor.innerText()
                )
                    .trim()
                    .toLowerCase();


            const href =
                await anchor.getAttribute(
                    "href"
                );


            // EXACT DOWNLOAD APK
            if (
                text ===
                "download apk"
            ) {

                targetElement =
                    anchor;

                break;

            }


            // Direct download key
            if (
                href &&
                href.includes(
                    "/download/?key="
                )
            ) {

                targetElement =
                    anchor;

                break;

            }

        }


        if (
            !targetElement
        ) {

            throw new Error(
                "Không tìm thấy element DOWNLOAD APK."
            );

        }


        // ==================================================
        // 13. CLICK
        // ==================================================

        console.log("");
        console.log(
            "CLICKING DOWNLOAD APK..."
        );


        const downloadPromise =
            page.waitForEvent(
                "download",
                {
                    timeout:
                        180000
                }
            );


        await targetElement.click({
            force: true
        });


        const download =
            await downloadPromise;


        // ==================================================
        // 14. SAVE
        // ==================================================

        const filename =
            `com.google.android.youtube-` +
            `${VERSION}-all.apk`;


        await download.saveAs(
            filename
        );


        console.log("");
        console.log(
            "======================================"
        );

        console.log(
            "APK SAVED:"
        );

        console.log(
            filename
        );

        console.log(
            "======================================"
        );


        // ==================================================
        // 15. VERIFY
        // ==================================================

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


        console.log(
            "SIZE:",
            (
                size /
                1024 /
                1024
            ).toFixed(2),
            "MB"
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
        // 16. GITHUB OUTPUT
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

                `download_page=${downloadPage}\n`
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
