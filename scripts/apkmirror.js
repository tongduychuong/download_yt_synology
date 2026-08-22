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

    return await page
        .locator("a[href]")
        .evaluateAll(
            elements =>
                elements.map(element => ({
                    text: (
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


        const releases =
            [];


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


        // =================================================
        // UNIQUE
        // =================================================

        const uniqueReleases =
            [];

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


            seen.add(
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


        // =================================================
        // 3. STABLE FIRST
        // =================================================

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


        // =================================================
        // 4. OPEN RELEASE
        // =================================================

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


        // =================================================
        // 5. GET VARIANT LINKS
        // =================================================

        const releaseLinks =
            await getLinks(page);


        const variants =
            [];


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


            // Chỉ link YouTube variant
            if (
                !combined.includes(
                    "/apk/google-inc/youtube/"
                )
            ) {
                continue;
            }


            // Không lấy release page chính
            if (
                href ===
                selectedRelease.href
            ) {
                continue;
            }


            // Không lấy secondary/alpha/rc
            if (
                isBad(combined)
            ) {
                continue;
            }


            // Không lấy bundle link trực tiếp
            if (
                combined.includes(
                    "bundle"
                )
            ) {
                continue;
            }


            // Phải là link variant/download
            if (
                !href.includes(
                    "/youtube/"
                )
            ) {
                continue;
            }


            variants.push({

                text:
                    text,

                href:
                    href

            });

        }


        // =================================================
        // UNIQUE VARIANTS
        // =================================================

        const uniqueVariants =
            [];

        const variantSeen =
            new Set();


        for (
            const item of variants
        ) {

            if (
                variantSeen.has(
                    item.href
                )
            ) {
                continue;
            }


            variantSeen.add(
                item.href
            );


            uniqueVariants.push(
                item
            );

        }


        console.log("");
        console.log(
            "VARIANT LINKS:"
        );


        for (
            const item of uniqueVariants
        ) {

            console.log(
                item.href
            );

        }


        if (
            uniqueVariants.length === 0
        ) {

            throw new Error(
                "Không tìm thấy variant links."
            );

        }


        // =================================================
        // 6. OPEN EACH VARIANT
        // FIND NODPI FROM PAGE CONTENT
        // =================================================

        let nodpiPage =
            null;


        for (
            const variant
            of uniqueVariants
        ) {

            console.log("");
            console.log(
                "CHECK VARIANT:"
            );

            console.log(
                variant.href
            );


            try {

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


                const variantText =
                    await page.locator(
                        "body"
                    ).innerText();


                const lower =
                    variantText
                        .toLowerCase();


                console.log(
                    "Contains nodpi:",
                    lower.includes(
                        "nodpi"
                    )
                );


                console.log(
                    "Contains APK:",
                    lower.includes(
                        "apk"
                    )
                );


                console.log(
                    "Contains version:",
                    lower.includes(
                        VERSION
                    )
                );


                // =========================================
                // MUST HAVE:
                //
                // nodpi
                // APK
                // VERSION
                // =========================================

                if (
                    !lower.includes(
                        "nodpi"
                    )
                ) {
                    continue;
                }


                if (
                    !lower.includes(
                        "apk"
                    )
                ) {
                    continue;
                }


                if (
                    !lower.includes(
                        VERSION
                    )
                ) {
                    continue;
                }


                // Không lấy Bundle
                if (
                    lower.includes(
                        "bundle"
                    ) &&
                    !lower.includes(
                        "download apk"
                    )
                ) {
                    continue;
                }


                nodpiPage =
                    variant.href;


                console.log("");
                console.log(
                    "======================================"
                );

                console.log(
                    "NODPI FOUND:"
                );

                console.log(
                    nodpiPage
                );

                console.log(
                    "======================================"
                );


                break;


            } catch (
                error
            ) {

                console.log(
                    "Variant error:",
                    error.message
                );

            }

        }


        if (
            !nodpiPage
        ) {

            throw new Error(
                `Không tìm thấy nodpi variant cho ${VERSION}`
            );

        }


        // =================================================
        // 7. OPEN NODPI PAGE
        // =================================================

        await page.goto(
            nodpiPage,
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
            "NODPI PAGE:"
        );

        console.log(
            await page.title()
        );


        // =================================================
        // 8. FIND ANDROID-APK-DOWNLOAD
        // =================================================

        const nodpiLinks =
            await getLinks(page);


        const apkDownloadPages =
            nodpiLinks.filter(
                item => {

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
                        return false;
                    }


                    if (
                        combined.includes(
                            "bundle"
                        )
                    ) {
                        return false;
                    }


                    if (
                        combined.includes(
                            "secondary"
                        )
                    ) {
                        return false;
                    }


                    return true;

                }
            );


        if (
            apkDownloadPages.length === 0
        ) {

            throw new Error(
                "Không tìm thấy android-apk-download " +
                "trên nodpi page."
            );

        }


        const downloadPage =
            apkDownloadPages[0];


        console.log("");
        console.log(
            "======================================"
        );

        console.log(
            "ANDROID APK DOWNLOAD:"
        );

        console.log(
            downloadPage.href
        );

        console.log(
            "======================================"
        );


        // =================================================
        // 9. OPEN DOWNLOAD PAGE
        // =================================================

        await page.goto(
            downloadPage.href,
            {
                waitUntil:
                    "domcontentloaded",

                timeout:
                    120000
            }
        );


        await sleep(6000);


        // =================================================
        // 10. FIND DOWNLOAD APK
        // =================================================

        const bodyText =
            await page.locator(
                "body"
            ).innerText();


        console.log("");
        console.log(
            "DOWNLOAD PAGE:"
        );

        console.log(
            bodyText.substring(
                0,
                4000
            )
        );


        // =================================================
        // Find all clickable elements
        // =================================================

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


        // =================================================
        // Find NORMAL APK
        // NEVER BUNDLE
        // =================================================

        const normal =
            elements.filter(
                item => {

                    const text =
                        item.text
                            .trim()
                            .toLowerCase();


                    const combined =
                        `${item.text} ${item.href} ${item.id} ${item.className}`
                            .toLowerCase();


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
            "NORMAL APK:"
        );


        for (
            const item of normal
        ) {

            console.log(
                item.text,
                item.href
            );

        }


        if (
            normal.length === 0
        ) {

            throw new Error(
                "Không tìm thấy DOWNLOAD APK thường."
            );

        }


        // =================================================
        // 11. FIND DOM ELEMENT
        // =================================================

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


            // Exact normal APK
            if (
                text ===
                "download apk"
            ) {

                target =
                    anchor;

                break;

            }


            // Direct key
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


        // =================================================
        // 12. CLICK
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


        await target.click({
            force: true
        });


        const download =
            await downloadPromise;


        // =================================================
        // 13. SAVE
        // =================================================

        const filename =
            `com.google.android.youtube-` +
            `${VERSION}-all.apk`;


        await download.saveAs(
            filename
        );


        // =================================================
        // 14. VERIFY
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


        // =================================================
        // 15. GITHUB OUTPUT
        // =================================================

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
                `nodpi_page=${nodpiPage}\n`
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
