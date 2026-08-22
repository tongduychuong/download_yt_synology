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
        elements => {

            return elements.map(element => ({
                text: (
                    element.innerText || ""
                ).trim(),

                href: element.href
            }));

        }
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


    const context =
        await browser.newContext({

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


    const page =
        await context.newPage();


    try {

        // ==================================================
        // SEARCH
        // ==================================================

        console.log(
            "======================================"
        );

        console.log(
            "YouTube version:",
            VERSION
        );

        console.log(
            "Search:",
            SEARCH_URL
        );

        console.log(
            "======================================"
        );


        await page.goto(
            SEARCH_URL,
            {
                waitUntil: "domcontentloaded",
                timeout: 120000
            }
        );


        await sleep(3000);


        const body =
            await page.locator("body").innerText();


        if (
            body.includes("403 Forbidden") ||
            body.includes("Access Denied")
        ) {

            throw new Error(
                "APKMirror search bị 403."
            );

        }


        // ==================================================
        // FIND RELEASE
        // ==================================================

        const links =
            await getLinks(page);


        const candidates = [];


        for (const link of links) {

            const text =
                link.text || "";


            const href =
                link.href || "";


            const combined =
                `${text} ${href}`.toLowerCase();


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


            const versionDash =
                VERSION.replace(
                    /\./g,
                    "-"
                );


            if (
                !combined.includes(
                    VERSION.toLowerCase()
                ) &&
                !combined.includes(
                    versionDash.toLowerCase()
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

                href

            });

        }


        // ==================================================
        // REMOVE DUPLICATES
        // ==================================================

        const unique = [];

        const seen =
            new Set();


        for (const item of candidates) {

            if (
                seen.has(item.href)
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
            "Release candidates:"
        );


        for (
            const item of unique
        ) {

            console.log(
                item.type,
                item.href
            );

        }


        // ==================================================
        // STABLE FIRST
        // ==================================================

        const stable =
            unique.filter(
                x => x.type === "stable"
            );


        const beta =
            unique.filter(
                x => x.type === "beta"
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
                `Không tìm thấy YouTube ${VERSION} ` +
                `Stable hoặc Beta.`
            );

        }


        console.log("");
        console.log(
            "======================================"
        );

        console.log(
            "SELECTED:",
            selected.type
        );

        console.log(
            selected.href
        );

        console.log(
            "======================================"
        );


        // ==================================================
        // OPEN RELEASE
        // ==================================================

        await page.goto(
            selected.href,
            {
                waitUntil: "domcontentloaded",
                timeout: 120000
            }
        );


        await sleep(3000);


        const releaseBody =
            await page.locator("body").innerText();


        if (
            releaseBody.includes(
                "403 Forbidden"
            ) ||
            releaseBody.includes(
                "Access Denied"
            )
        ) {

            throw new Error(
                "Release page bị 403."
            );

        }


        // ==================================================
        // FIND VARIANT
        // ==================================================

        const releaseLinks =
            await getLinks(page);


        const variants = [];


        for (
            const link
            of releaseLinks
        ) {

            const combined =
                `${link.text} ${link.href}`.toLowerCase();


            if (
                !combined.includes(
                    "/apk/google-inc/youtube/"
                )
            ) {

                continue;

            }


            if (
                isBadRelease(combined)
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


            let score = 0;


            if (
                combined.includes(
                    "nodpi"
                )
            ) {

                score += 100;

            }


            if (
                combined.includes(
                    "universal"
                )
            ) {

                score += 50;

            }


            if (
                combined.includes(
                    "download"
                )
            ) {

                score += 20;

            }


            variants.push({

                href:
                    link.href,

                text:
                    link.text,

                score

            });

        }


        variants.sort(
            (a, b) =>
                b.score - a.score
        );


        console.log("");
        console.log(
            "Variants:"
        );


        for (
            const variant
            of variants.slice(0, 10)
        ) {

            console.log(
                variant.score,
                variant.href
            );

        }


        if (
            variants.length === 0
        ) {

            throw new Error(
                "Không tìm thấy variant."
            );

        }


        // ==================================================
        // FIND DOWNLOAD PAGE
        // ==================================================

        let downloadPage = null;


        for (
            const variant
            of variants.slice(0, 10)
        ) {

            console.log("");
            console.log(
                "Checking:",
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


                const variantBody =
                    await page.locator(
                        "body"
                    ).innerText();


                if (
                    variantBody.includes(
                        "403 Forbidden"
                    ) ||
                    variantBody.includes(
                        "Access Denied"
                    )
                ) {

                    continue;

                }


                const variantLinks =
                    await getLinks(
                        page
                    );


                for (
                    const link
                    of variantLinks
                ) {

                    const combined =
                        `${link.text} ${link.href}`
                            .toLowerCase();


                    if (
                        combined.includes(
                            "download apk"
                        )
                    ) {

                        downloadPage =
                            link.href;

                        break;

                    }


                    if (
                        combined.includes(
                            "download"
                        ) &&
                        combined.includes(
                            "apk"
                        )
                    ) {

                        downloadPage =
                            link.href;

                        break;

                    }

                }


                if (
                    downloadPage
                ) {

                    break;

                }


            } catch (error) {

                console.log(
                    "Variant error:",
                    error.message
                );

            }

        }


        if (
            !downloadPage
        ) {

            throw new Error(
                "Không tìm thấy download page."
            );

        }


        console.log("");
        console.log(
            "Download page:",
            downloadPage
        );


        // ==================================================
        // OPEN DOWNLOAD PAGE
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


        await sleep(5000);


        // ==================================================
        // FIND DOWNLOAD BUTTON
        // ==================================================

        const buttons =
            await page.locator(
                "a, button"
            ).evaluateAll(
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
                                ""

                        })
                    )
            );


        let downloadElement = null;


        for (
            const item
            of buttons
        ) {

            const text =
                item.text.toLowerCase();


            if (
                text.includes(
                    "download apk"
                )
            ) {

                downloadElement =
                    item;

                break;

            }

        }


        if (
            !downloadElement
        ) {

            for (
                const item
                of buttons
            ) {

                const text =
                    item.text.toLowerCase();


                if (
                    text.includes(
                        "download"
                    ) &&
                    text.includes(
                        "apk"
                    )
                ) {

                    downloadElement =
                        item;

                    break;

                }

            }

        }


        if (
            !downloadElement
        ) {

            throw new Error(
                "Không tìm thấy nút DOWNLOAD APK."
            );

        }


        console.log("");
        console.log(
            "Download button:"
        );

        console.log(
            downloadElement.text
        );

        console.log(
            downloadElement.href
        );


        // ==================================================
        // CLICK DOWNLOAD BUTTON
        // ==================================================

        let download;


        try {

            download =
                await page.waitForEvent(
                    "download",
                    {
                        timeout: 120000
                    }
                );


        } catch {

            download =
                null;

        }


        // Click bằng locator nếu có href
        if (
            downloadElement.href
        ) {

            const locator =
                page.locator(
                    `a[href="${downloadElement.href}"]`
                );


            if (
                await locator.count() > 0
            ) {

                const downloadPromise =
                    page.waitForEvent(
                        "download",
                        {
                            timeout:
                                120000
                        }
                    );


                await locator.first().click({
                    force: true
                });


                try {

                    download =
                        await downloadPromise;

                } catch {

                    // Có thể redirect trực tiếp
                }

            }

        }


        // ==================================================
        // SAVE DOWNLOAD
        // ==================================================

        const filename =
            `com.google.android.youtube-` +
            `${VERSION}-all.apk`;


        if (
            download
        ) {

            console.log(
                "Browser download detected."
            );


            await download.saveAs(
                filename
            );

        } else {

            throw new Error(
                "APKMirror không tạo download event. " +
                "Có thể đang yêu cầu quảng cáo/challenge."
            );

        }


        // ==================================================
        // VERIFY FILE
        // ==================================================

        if (
            !fs.existsSync(
                filename
            )
        ) {

            throw new Error(
                "Không tạo được APK."
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
            "APK:",
            filename
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


        if (
            size <
            10 * 1024 * 1024
        ) {

            throw new Error(
                "APK quá nhỏ."
            );

        }


        // ==================================================
        // GITHUB OUTPUT
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
