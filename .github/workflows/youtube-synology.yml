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

    return new Promise(
        resolve => setTimeout(
            resolve,
            ms
        )
    );

}


function isBadRelease(value) {

    const s =
        value.toLowerCase();

    return (
        s.includes("secondary") ||
        s.includes("alpha") ||
        s.includes("release-candidate") ||
        /\brc\b/.test(s)
    );

}


function isBeta(value) {

    const s =
        value.toLowerCase();

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
            elements => {

                return elements.map(
                    element => ({

                        text:
                            (
                                element.innerText ||
                                ""
                            ).trim(),

                        href:
                            element.href

                    })
                );

            }
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
        // 1. SEARCH APKMIRROR
        // ==================================================

        console.log("");
        console.log(
            "SEARCH:"
        );
        console.log(
            SEARCH_URL
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
                    VERSION
                ) &&
                !combined.includes(
                    VERSION.replace(
                        /\./g,
                        "-"
                    )
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
                    isBeta(
                        combined
                    )
                        ? "beta"
                        : "stable",

                href:
                    item.href

            });

        }


        // ==================================================
        // UNIQUE
        // ==================================================

        const unique =
            [];

        const seen =
            new Set();


        for (
            const item
            of releases
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
            "RELEASES:"
        );


        for (
            const item
            of unique
        ) {

            console.log(
                item.type,
                item.href
            );

        }


        // ==================================================
        // STABLE PRIORITY
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


        let selected;


        if (
            stable.length
        ) {

            selected =
                stable[0];

        } else if (
            beta.length
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
        // 3. OPEN RELEASE PAGE
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
        // 4. FIND *ANDROID-APK-DOWNLOAD* PAGE
        // ==================================================

        const releaseLinks =
            await getLinks(page);


        const downloadPages =
            [];


        for (
            const item
            of releaseLinks
        ) {

            const href =
                item.href || "";


            const text =
                item.text || "";


            const combined =
                `${text} ${href}`
                    .toLowerCase();


            // Đây là điểm quan trọng:
            // phải tìm URL dạng:
            //
            // android-apk-download
            //

            if (
                href.includes(
                    "android-apk-download"
                )
            ) {

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

        }


        if (
            !downloadPages.length
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
            const item
            of downloadPages
        ) {

            console.log(
                item.href
            );

        }


        // Ưu tiên URL có đúng version
        const exactPage =
            downloadPages.find(
                item => {

                    const href =
                        item.href
                            .toLowerCase();

                    return (
                        href.includes(
                            VERSION
                        ) ||
                        href.includes(
                            VERSION.replace(
                                /\./g,
                                "-"
                            )
                        )
                    );

                }
            );


        const downloadPage =
            exactPage ||
            downloadPages[0];


        console.log("");
        console.log(
            "OPEN DOWNLOAD PAGE:"
        );

        console.log(
            downloadPage.href
        );


        // ==================================================
        // 5. OPEN REAL DOWNLOAD PAGE
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
            "DOWNLOAD PAGE TITLE:"
        );

        console.log(
            await page.title()
        );


        // ==================================================
        // 6. FIND DOWNLOAD LINK
        // ==================================================

        const pageLinks =
            await getLinks(page);


        console.log("");
        console.log(
            "DOWNLOAD LINKS:"
        );


        const targets =
            [];


        for (
            const item
            of pageLinks
        ) {

            const text =
                item.text || "";


            const href =
                item.href || "";


            const combined =
                `${text} ${href}`
                    .toLowerCase();


            // Hiện chữ DOWNLOAD
            if (
                combined.includes(
                    "download"
                )
            ) {

                console.log(
                    "TEXT:",
                    text
                );

                console.log(
                    "URL:",
                    href
                );

            }


            // =================================================
            // Download target
            // =================================================

            if (
                text
                    .toLowerCase()
                    .includes(
                        "download"
                    )
            ) {

                targets.push(
                    item
                );

            }

        }


        if (
            !targets.length
        ) {

            throw new Error(
                "Không tìm thấy chữ DOWNLOAD trên download page."
            );

        }


        // Ưu tiên Download APK
        let target =
            targets.find(
                item =>
                    item.text
                        .toLowerCase()
                        .includes(
                            "download apk"
                        )
            );


        // Nếu không có, lấy Download đầu tiên
        if (
            !target
        ) {

            target =
                targets[0];

        }


        console.log("");
        console.log(
            "SELECTED DOWNLOAD:"
        );

        console.log(
            target.text
        );

        console.log(
            target.href
        );


        // ==================================================
        // 7. CLICK
        // ==================================================

        const targetLocator =
            page.locator(
                `a[href="${target.href}"]`
            ).first();


        if (
            await targetLocator.count() === 0
        ) {

            throw new Error(
                "Không tìm thấy element Download."
            );

        }


        console.log("");
        console.log(
            "CLICK DOWNLOAD..."
        );


        const downloadPromise =
            page.waitForEvent(
                "download",
                {
                    timeout:
                        180000
                }
            );


        await targetLocator.click({
            force: true
        });


        const download =
            await downloadPromise;


        // ==================================================
        // 8. SAVE
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
        // 9. VERIFY
        // ==================================================

        if (
            !fs.existsSync(
                filename
            )
        ) {

            throw new Error(
                "APK không tồn tại sau khi download."
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
        // 10. OUTPUT
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
