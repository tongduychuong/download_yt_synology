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
    "Mozilla/5.0 (Linux; Android 14; Mobile) " +
    "AppleWebKit/537.36 " +
    "(KHTML, like Gecko) " +
    "Chrome/131.0.0.0 Mobile Safari/537.36";


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


function cleanUrl(url) {

    if (!url) {
        return "";
    }

    return url
        .replace(/&amp;/g, "&")
        .replace(/amp;/g, "");

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


async function links(page) {

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
                            element.href ||
                            element.getAttribute(
                                "href"
                            ) ||
                            ""
                    })
                )
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

        // ==================================================
        // 1. SEARCH
        // ==================================================

        console.log("");
        console.log(
            "======================================"
        );

        console.log(
            "SEARCH YOUTUBE"
        );

        console.log(
            "VERSION:",
            VERSION
        );

        console.log(
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


        await sleep(5000);


        // ==================================================
        // 2. FIND RELEASE
        // ==================================================

        const searchLinks =
            await links(page);


        const candidates =
            [];


        for (
            const item
            of searchLinks
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
                    "/apk/google-inc/youtube/"
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
                !combined.includes(
                    "release"
                )
            ) {
                continue;
            }


            if (
                isBadRelease(combined)
            ) {
                continue;
            }


            candidates.push({

                type:
                    isBeta(combined)
                        ? "beta"
                        : "stable",

                href:
                    href,

                text:
                    text

            });

        }


        // Remove duplicates
        const unique =
            [];


        const seen =
            new Set();


        for (
            const item
            of candidates
        ) {

            if (
                seen.has(
                    item.href
                )
            ) {
                continue;
            }


            seen.add(
                item.href
            );


            unique.push(
                item
            );

        }


        console.log("");
        console.log(
            "RELEASE CANDIDATES:"
        );


        for (
            const item
            of unique
        ) {

            console.log(
                `[${item.type}] ${item.href}`
            );

        }


        // ==================================================
        // 3. STABLE FIRST
        // ==================================================

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


        let release;


        if (
            stable.length
        ) {

            release =
                stable[0];

        } else if (
            beta.length
        ) {

            release =
                beta[0];

        } else {

            throw new Error(
                `Không tìm thấy YouTube ${VERSION}`
            );

        }


        console.log("");
        console.log(
            "SELECTED RELEASE:"
        );

        console.log(
            release.type
        );

        console.log(
            release.href
        );


        // ==================================================
        // 4. OPEN RELEASE
        // ==================================================

        await page.goto(
            release.href,
            {
                waitUntil:
                    "domcontentloaded",

                timeout:
                    120000
            }
        );


        await sleep(5000);


        // ==================================================
        // 5. FIND APK DOWNLOAD BUTTON
        //
        // KHÔNG CHỌN BUNDLE
        // ==================================================

        console.log("");
        console.log(
            "SEARCHING NORMAL APK..."
        );


        let apkPage =
            null;


        const releasePageLinks =
            await links(page);


        for (
            const item
            of releasePageLinks
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


            // ----------------------------------------------
            // BỎ BUNDLE
            // ----------------------------------------------

            if (
                combined.includes(
                    "bundle"
                )
            ) {
                continue;
            }


            if (
                combined.includes(
                    "splits"
                )
            ) {
                continue;
            }


            // ----------------------------------------------
            // BỎ SECONDARY
            // ----------------------------------------------

            if (
                combined.includes(
                    "secondary"
                )
            ) {
                continue;
            }


            // ----------------------------------------------
            // ĐÚNG VERSION
            // ----------------------------------------------

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


            apkPage = {

                text:
                    text,

                href:
                    href

            };


            break;

        }


        if (!apkPage) {

            throw new Error(
                "Không tìm thấy NORMAL APK download page."
            );

        }


        console.log("");
        console.log(
            "======================================"
        );

        console.log(
            "NORMAL APK PAGE:"
        );

        console.log(
            apkPage.href
        );

        console.log(
            "======================================"
        );


        // ==================================================
        // 6. OPEN NORMAL APK PAGE
        // ==================================================

        await page.goto(
            apkPage.href,
            {
                waitUntil:
                    "domcontentloaded",

                timeout:
                    120000
            }
        );


        // ==================================================
        // 7. WAIT ANTI-ADBLOCK
        // ==================================================

        console.log("");
        console.log(
            "Waiting APKMirror anti-adblock..."
        );


        for (
            let i = 20;
            i > 0;
            i--
        ) {

            process.stdout.write(
                `\rWaiting ${i}s...`
            );

            await sleep(1000);

        }


        console.log("");
        console.log(
            "Waiting completed."
        );


        // ==================================================
        // 8. FIND NODPI
        // ==================================================

        console.log("");
        console.log(
            "SEARCHING NODPI..."
        );


        const bodyText =
            (
                await page
                    .locator("body")
                    .innerText()
            )
            .toLowerCase();


        console.log(
            "Contains nodpi:",
            bodyText.includes(
                "nodpi"
            )
        );


        // --------------------------------------------------
        // TÌM LINK CHỨA NODPI
        // --------------------------------------------------

        const variantLinks =
            await links(page);


        let nodpiPage =
            null;


        for (
            const item
            of variantLinks
        ) {

            const href =
                item.href || "";


            const text =
                item.text || "";


            const combined =
                `${text} ${href}`
                    .toLowerCase();


            if (
                !combined.includes(
                    "nodpi"
                )
            ) {
                continue;
            }


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
                )
            ) {
                continue;
            }


            nodpiPage = {

                text:
                    text,

                href:
                    cleanUrl(
                        href
                    )

            };


            break;

        }


        // ==================================================
        // FALLBACK:
        // LINK nodpi CÓ THỂ LÀ VARIANT TEXT
        // ==================================================

        if (!nodpiPage) {

            for (
                const item
                of variantLinks
            ) {

                const href =
                    item.href || "";


                const text =
                    item.text || "";


                const combined =
                    `${text} ${href}`
                        .toLowerCase();


                if (
                    !combined.includes(
                        "nodpi"
                    )
                ) {
                    continue;
                }


                if (
                    combined.includes(
                        "bundle"
                    )
                ) {
                    continue;
                }


                nodpiPage = {

                    text:
                        text,

                    href:
                        cleanUrl(
                            href
                        )

                };


                break;

            }

        }


        if (!nodpiPage) {

            console.log("");
            console.log(
                "======================================"
            );

            console.log(
                "NODPI NOT FOUND"
            );

            console.log(
                "======================================"
            );


            console.log(
                (
                    await page
                        .locator("body")
                        .innerText()
                )
                .substring(
                    0,
                    8000
                )
            );


            throw new Error(
                `Không tìm thấy nodpi cho ${VERSION}`
            );

        }


        console.log("");
        console.log(
            "======================================"
        );

        console.log(
            "NODPI PAGE:"
        );

        console.log(
            nodpiPage.href
        );

        console.log(
            "======================================"
        );


        // ==================================================
        // 9. OPEN NODPI
        // ==================================================

        await page.goto(
            nodpiPage.href,
            {
                waitUntil:
                    "domcontentloaded",

                timeout:
                    120000
            }
        );


        // ==================================================
        // 10. WAIT 20 SEC AGAIN
        // ==================================================

        console.log("");
        console.log(
            "Waiting for DOWNLOAD APK..."
        );


        for (
            let i = 20;
            i > 0;
            i--
        ) {

            process.stdout.write(
                `\rWaiting ${i}s...`
            );

            await sleep(1000);

        }


        console.log("");


        // ==================================================
        // 11. FIND DOWNLOAD APK
        // ==================================================

        let downloadButton =
            null;


        for (
            let attempt = 0;
            attempt < 40;
            attempt++
        ) {

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


            const regex =
                page.getByText(
                    /DOWNLOAD\s+APK/i
                );


            const count =
                await regex.count();


            for (
                let i = 0;
                i < count;
                i++
            ) {

                const element =
                    regex.nth(i);


                const text =
                    (
                        await element
                            .innerText()
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


            if (
                downloadButton
            ) {
                break;
            }


            await sleep(1000);

        }


        if (!downloadButton) {

            console.log(
                (
                    await page
                        .locator("body")
                        .innerText()
                )
                .substring(
                    0,
                    8000
                )
            );


            throw new Error(
                "Không tìm thấy DOWNLOAD APK."
            );

        }


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


        // ==================================================
        // 12. CLICK DOWNLOAD APK
        // ==================================================

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
        // 13. SAVE
        // ==================================================

        const filename =
            `com.google.android.youtube-${VERSION}-all.apk`;


        console.log("");
        console.log(
            "Saving:"
        );

        console.log(
            filename
        );


        await download.saveAs(
            filename
        );


        // ==================================================
        // 14. VERIFY
        // ==================================================

        if (
            !fs.existsSync(
                filename
            )
        ) {

            throw new Error(
                "APK download failed."
            );

        }


        const size =
            fs.statSync(
                filename
            ).size;


        if (
            size <
            10 * 1024 * 1024
        ) {

            throw new Error(
                "Downloaded file is too small."
            );

        }


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
            "TYPE:",
            release.type
        );

        console.log(
            "======================================"
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
