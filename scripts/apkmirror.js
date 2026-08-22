const { chromium } = require("playwright");
const fs = require("fs");

const VERSION = process.env.VERSION;

if (!VERSION) {
    throw new Error("VERSION is missing");
}

const BASE_URL = "https://www.apkmirror.com";

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

    const s = value.toLowerCase();

    return (
        s.includes("secondary") ||
        s.includes("alpha") ||
        s.includes("release-candidate") ||
        /\brc\b/.test(s)
    );
}


function isBeta(value) {

    const s = value.toLowerCase();

    return (
        s.includes(" beta") ||
        s.includes("-beta-") ||
        s.includes(" beta-") ||
        s.includes("-beta/")
    );
}


async function getLinks(page) {

    return await page.locator("a[href]").evaluateAll(
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
                    item.href

            });

        }


        // ==================================================
        // UNIQUE RELEASES
        // ==================================================

        const uniqueReleases = [];

        const seenReleases =
            new Set();


        for (
            const item of releases
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
            const item of uniqueReleases
        ) {

            console.log(
                `[${item.type}]`,
                item.href
            );

        }


        // ==================================================
        // 3. STABLE FIRST
        // ==================================================

        const stable =
            uniqueReleases.filter(
                x =>
                    x.type === "stable"
            );


        const beta =
            uniqueReleases.filter(
                x =>
                    x.type === "beta"
            );


        let selectedRelease;


        if (
            stable.length
        ) {

            selectedRelease =
                stable[0];

        } else if (
            beta.length
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
        // 4. OPEN RELEASE PAGE
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
        // 5. FIND REAL DOWNLOAD PAGES
        // ==================================================

        const releaseLinks =
            await getLinks(page);


        const downloadPages = [];


        for (
            const item of releaseLinks
        ) {

            const href =
                item.href || "";


            const text =
                item.text || "";


            const combined =
                `${text} ${href}`
                    .toLowerCase();


            // MUST be android-apk-download
            if (
                !href.includes(
                    "android-apk-download"
                )
            ) {
                continue;
            }


            // MUST be YouTube
            if (
                !href.includes(
                    "/apk/google-inc/youtube/"
                )
            ) {
                continue;
            }


            // MUST contain version
            if (
                !href.includes(
                    VERSION
                ) &&
                !href.includes(
                    VERSION.replace(
                        /\./g,
                        "-"
                    )
                )
            ) {
                continue;
            }


            // NEVER secondary / alpha / rc
            if (
                isBad(combined)
            ) {
                continue;
            }


            // NEVER bundle
            if (
                combined.includes(
                    "bundle"
                )
            ) {
                continue;
            }


            downloadPages.push(
                item
            );

        }


        // ==================================================
        // UNIQUE DOWNLOAD PAGES
        // ==================================================

        const uniqueDownloadPages =
            [];

        const downloadSeen =
            new Set();


        for (
            const item of downloadPages
        ) {

            if (
                downloadSeen.has(
                    item.href
                )
            ) {
                continue;
            }


            downloadSeen.add(
                item.href
            );


            uniqueDownloadPages.push(
                item
            );

        }


        console.log("");
        console.log(
            "ANDROID APK DOWNLOAD PAGES:"
        );


        for (
            const item of uniqueDownloadPages
        ) {

            console.log(
                item.href
            );

        }


        if (
            uniqueDownloadPages.length === 0
        ) {

            throw new Error(
                "Không tìm thấy android-apk-download page."
            );

        }


        // ==================================================
        // 6. CHECK EACH REAL DOWNLOAD PAGE
        //    FOR NODPI
        // ==================================================

        let nodpiDownloadPage =
            null;


        for (
            const item
            of uniqueDownloadPages
        ) {

            console.log("");
            console.log(
                "CHECK DOWNLOAD PAGE:"
            );

            console.log(
                item.href
            );


            try {

                await page.goto(
                    item.href,
                    {
                        waitUntil:
                            "domcontentloaded",

                        timeout:
                            120000
                    }
                );


                await sleep(4000);


                const body =
                    await page.locator(
                        "body"
                    ).innerText();


                const lower =
                    body.toLowerCase();


                const hasNodpi =
                    lower.includes(
                        "nodpi"
                    );


                const hasVersion =
                    lower.includes(
                        VERSION
                    );


                console.log(
                    "Contains nodpi:",
                    hasNodpi
                );


                console.log(
                    "Contains version:",
                    hasVersion
                );


                // MUST have nodpi
                if (
                    !hasNodpi
                ) {
                    continue;
                }


                // MUST have version
                if (
                    !hasVersion
                ) {
                    continue;
                }


                // MUST NOT be bundle-only
                if (
                    lower.includes(
                        "apk bundle"
                    ) &&
                    !lower.includes(
                        "download apk"
                    )
                ) {
                    continue;
                }


                nodpiDownloadPage =
                    item.href;


                console.log("");
                console.log(
                    "======================================"
                );

                console.log(
                    "NODPI DOWNLOAD PAGE FOUND:"
                );

                console.log(
                    nodpiDownloadPage
                );

                console.log(
                    "======================================"
                );


                break;


            } catch (
                error
            ) {

                console.log(
                    "CHECK ERROR:",
                    error.message
                );

            }

        }


        if (
            !nodpiDownloadPage
        ) {

            throw new Error(
                `Không tìm thấy download page nodpi cho ${VERSION}`
            );

        }


        // ==================================================
        // 7. OPEN NODPI DOWNLOAD PAGE
        // ==================================================

        await page.goto(
            nodpiDownloadPage,
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
            "NODPI PAGE TITLE:"
        );

        console.log(
            await page.title()
        );


        // ==================================================
        // 8. FIND DOWNLOAD ELEMENTS
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
            const item of elements
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
        // 9. NORMAL APK ONLY
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


                    // EXACT DOWNLOAD APK
                    if (
                        text ===
                        "download apk"
                    ) {
                        return true;
                    }


                    // Download APK + extra text
                    if (
                        text.includes(
                            "download apk"
                        )
                    ) {
                        return true;
                    }


                    // Direct APKMirror download
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


        // ==================================================
        // 10. FIND DOM ELEMENT
        // ==================================================

        let target =
            null;


        const anchors =
            page.locator(
                "a"
            );


        const count =
            await anchors.count();


        for (
            let i = 0;
            i < count;
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


            // Prefer exact DOWNLOAD APK
            if (
                text ===
                "download apk"
            ) {

                target =
                    anchor;

                break;

            }


            // Or direct key URL
            if (
                href &&
                href.includes(
                    "/download/?key="
                )
            ) {

                target =
                    anchor;

                break;

            }

        }


        if (
            !target
        ) {

            throw new Error(
                "Không tìm thấy element DOWNLOAD APK."
            );

        }


        // ==================================================
        // 11. CLICK
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


        await target.click({
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
            "APK SAVED:",
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

                `download_page=${nodpiDownloadPage}\n`
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
