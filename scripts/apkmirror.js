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


function isBadRelease(value) {

    const text = value.toLowerCase();

    return (
        text.includes("secondary") ||
        text.includes("alpha") ||
        text.includes("release-candidate") ||
        /\brc\b/.test(text)
    );
}


function isBeta(value) {

    const text = value.toLowerCase();

    return (
        text.includes(" beta") ||
        text.includes("-beta-") ||
        text.includes(" beta-") ||
        text.includes("-beta/")
    );
}


async function getLinks(page) {

    return await page.locator("a[href]").evaluateAll(
        elements => elements.map(element => ({
            text: (
                element.innerText || ""
            ).trim(),

            href: element.href
        }))
    );

}


async function main() {

    const browser = await chromium.launch({

        headless: true,

        args: [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-blink-features=AutomationControlled"
        ]

    });


    const context = await browser.newContext({

        userAgent: USER_AGENT,

        locale: "en-US",

        viewport: {
            width: 1366,
            height: 900
        },

        extraHTTPHeaders: {
            "Accept-Language":
                "en-US,en;q=0.9"
        }

    });


    const page = await context.newPage();


    try {

        // ==================================================
        // 1. SEARCH APKMIRROR
        // ==================================================

        console.log("");
        console.log(
            "======================================"
        );

        console.log(
            "SEARCH VERSION:",
            VERSION
        );

        console.log(
            "SEARCH URL:",
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
                    VERSION.replace(
                        /\./g,
                        "-"
                    ).toLowerCase()
                )
            ) {
                continue;
            }


            if (
                isBadRelease(
                    combined
                )
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

        const seenReleases = new Set();


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
        // STABLE PRIORITY
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


        // ==================================================
        // 2. OPEN RELEASE PAGE
        // ==================================================

        await page.goto(
            selected.href,
            {
                waitUntil:
                    "domcontentloaded",

                timeout:
                    120000
            }
        );


        await sleep(3000);


        // ==================================================
        // 3. FIND ANDROID APK DOWNLOAD PAGE
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


            if (
                !href.includes(
                    "android-apk-download"
                )
            ) {
                continue;
            }


            if (
                !combined.includes(
                    VERSION.toLowerCase()
                ) &&
                !combined.includes(
                    VERSION.replace(
                        /\./g,
                        "-"
                    ).toLowerCase()
                )
            ) {
                continue;
            }


            if (
                isBadRelease(
                    combined
                )
            ) {
                continue;
            }


            downloadPages.push(
                item
            );

        }


        if (
            downloadPages.length === 0
        ) {

            throw new Error(
                "Không tìm thấy android-apk-download page."
            );

        }


        console.log("");
        console.log(
            "DOWNLOAD PAGES:"
        );


        for (
            const item of downloadPages
        ) {

            console.log(
                item.href
            );

        }


        const downloadPage =
            downloadPages[0];


        console.log("");
        console.log(
            "OPEN DOWNLOAD PAGE:"
        );

        console.log(
            downloadPage.href
        );


        // ==================================================
        // 4. OPEN REAL DOWNLOAD PAGE
        // ==================================================

        await page.goto(
            downloadPage.href,
            {
                waitUntil:
                    "domcontentloaded",

                timeout:
                    120000
            }
        );


        await sleep(5000);


        console.log("");
        console.log(
            "DOWNLOAD PAGE:"
        );

        console.log(
            await page.title()
        );


        // ==================================================
        // 5. FIND ALL DOWNLOAD LINKS
        // ==================================================

        const allDownloadLinks =
            await getLinks(page);


        console.log("");
        console.log(
            "ALL DOWNLOAD OPTIONS:"
        );


        for (
            const item
            of allDownloadLinks
        ) {

            const text =
                item.text || "";


            const combined =
                `${text} ${item.href}`
                    .toLowerCase();


            if (
                combined.includes(
                    "download"
                )
            ) {

                console.log(
                    "--------------------------------"
                );

                console.log(
                    "TEXT:",
                    text
                );

                console.log(
                    "URL:",
                    item.href
                );

            }

        }


        // ==================================================
        // 6. FIND NORMAL APK ONLY
        // ==================================================

        const normalApkLinks =
            allDownloadLinks.filter(
                item => {

                    const text =
                        (
                            item.text ||
                            ""
                        ).trim();


                    const lowerText =
                        text.toLowerCase();


                    const combined =
                        `${text} ${item.href}`
                            .toLowerCase();


                    // --------------------------------------
                    // NEVER DOWNLOAD BUNDLE
                    // --------------------------------------

                    if (
                        lowerText.includes(
                            "bundle"
                        )
                    ) {
                        return false;
                    }


                    if (
                        lowerText.includes(
                            "splits"
                        )
                    ) {
                        return false;
                    }


                    if (
                        lowerText.includes(
                            "base apk"
                        )
                    ) {
                        return false;
                    }


                    if (
                        combined.includes(
                            "bundle"
                        )
                    ) {
                        return false;
                    }


                    // --------------------------------------
                    // MUST BE APK
                    // --------------------------------------

                    if (
                        !lowerText.includes(
                            "download"
                        )
                    ) {
                        return false;
                    }


                    // --------------------------------------
                    // EXACT NORMAL APK
                    // --------------------------------------

                    if (
                        lowerText ===
                        "download apk"
                    ) {
                        return true;
                    }


                    // --------------------------------------
                    // OTHER NORMAL APK TEXT
                    // --------------------------------------

                    if (
                        lowerText.includes(
                            "download apk"
                        ) &&
                        !lowerText.includes(
                            "bundle"
                        )
                    ) {
                        return true;
                    }


                    return false;

                }
            );


        console.log("");
        console.log(
            "NORMAL APK LINKS:"
        );


        for (
            const item
            of normalApkLinks
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
            normalApkLinks.length === 0
        ) {

            throw new Error(
                "Không tìm thấy DOWNLOAD APK thường."
            );

        }


        // ==================================================
        // 7. SELECT DOWNLOAD APK
        // ==================================================

        const target =
            normalApkLinks[0];


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


        // ==================================================
        // 8. FIND ELEMENT BY TEXT
        // ==================================================

        const downloadLinks =
            page.locator("a");


        let targetElement = null;


        const count =
            await downloadLinks.count();


        for (
            let i = 0;
            i < count;
            i++
        ) {

            const element =
                downloadLinks.nth(i);


            const text =
                (
                    await element.innerText()
                ).trim();


            const lower =
                text.toLowerCase();


            if (
                lower ===
                "download apk"
            ) {

                targetElement =
                    element;

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
        // 9. CLICK
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
        // 10. SAVE
        // ==================================================

        const filename =
            `com.google.android.youtube-` +
            `${VERSION}-all.apk`;


        await download.saveAs(
            filename
        );


        console.log("");
        console.log(
            "APK SAVED:"
        );

        console.log(
            filename
        );


        // ==================================================
        // 11. VERIFY
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
        // 12. GITHUB OUTPUT
        // ==================================================

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
                `download_page=${downloadPage.href}\n`
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
