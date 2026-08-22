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


function isBad(text) {

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

    return await page.locator("a[href]").evaluateAll(
        elements =>
            elements.map(element => ({
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
            "Accept-Language": "en-US,en;q=0.9"
        }
    });


    const page = await context.newPage();


    try {

        // =================================================
        // SEARCH
        // =================================================

        console.log("");
        console.log("======================================");
        console.log("YouTube VERSION:", VERSION);
        console.log("SEARCH:", SEARCH_URL);
        console.log("======================================");


        await page.goto(
            SEARCH_URL,
            {
                waitUntil: "domcontentloaded",
                timeout: 120000
            }
        );


        await sleep(4000);


        // =================================================
        // FIND RELEASE
        // =================================================

        const links = await getLinks(page);

        const releases = [];


        for (const item of links) {

            const combined =
                `${item.text} ${item.href}`.toLowerCase();


            if (
                !combined.includes(
                    "/apk/google-inc/youtube/"
                )
            ) {
                continue;
            }


            if (
                !combined.includes("release")
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


            if (isBad(combined)) {
                continue;
            }


            releases.push({
                type: isBeta(combined)
                    ? "beta"
                    : "stable",

                href: item.href
            });

        }


        const unique = [];

        const seen = new Set();


        for (const item of releases) {

            if (seen.has(item.href)) {
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
                x => x.type === "stable"
            );


        const beta =
            unique.filter(
                x => x.type === "beta"
            );


        let release;


        if (stable.length > 0) {

            release = stable[0];

        } else if (beta.length > 0) {

            release = beta[0];

        } else {

            throw new Error(
                `Không tìm thấy YouTube ${VERSION} Stable/Beta`
            );

        }


        console.log("");
        console.log("SELECTED:");
        console.log(release.type);
        console.log(release.href);


        // =================================================
        // OPEN RELEASE
        // =================================================

        await page.goto(
            release.href,
            {
                waitUntil: "domcontentloaded",
                timeout: 120000
            }
        );


        await sleep(5000);


        // =================================================
        // FIND APK DOWNLOAD PAGES
        // =================================================

        const releaseLinks =
            await getLinks(page);


        const apkPages = [];


        for (const item of releaseLinks) {

            const href =
                item.href || "";

            const lower =
                href.toLowerCase();

            const combined =
                `${item.text} ${href}`.toLowerCase();


            if (
                !lower.includes(
                    "/apk/google-inc/youtube/"
                )
            ) {
                continue;
            }


            if (
                !lower.includes(
                    "android-apk-download"
                )
            ) {
                continue;
            }


            if (
                !lower.includes(
                    VERSION.toLowerCase()
                ) &&
                !lower.includes(
                    VERSION
                        .replace(/\./g, "-")
                        .toLowerCase()
                )
            ) {
                continue;
            }


            if (isBad(combined)) {
                continue;
            }


            // KHÔNG CHỌN BUNDLE
            if (
                lower.includes("bundle")
            ) {
                continue;
            }


            apkPages.push({
                text: item.text,
                href: item.href
            });

        }


        const uniquePages = [];

        const pageSeen = new Set();


        for (const item of apkPages) {

            if (pageSeen.has(item.href)) {
                continue;
            }

            pageSeen.add(item.href);

            uniquePages.push(item);

        }


        console.log("");
        console.log("NON-BUNDLE APK PAGES:");

        for (const item of uniquePages) {
            console.log(item.href);
        }


        if (uniquePages.length === 0) {

            throw new Error(
                "Không tìm thấy APK non-bundle."
            );

        }


        // =================================================
        // ƯU TIÊN LINK -3-
        // =================================================

        const versionDash =
            VERSION.replace(/\./g, "-");


        let selectedPage =
            uniquePages.find(
                item =>
                    item.href.includes(
                        `-${versionDash}-3-android-apk-download`
                    )
            );


        // Fallback
        if (!selectedPage) {
            selectedPage = uniquePages[0];
        }


        console.log("");
        console.log(
            "======================================"
        );

        console.log(
            "SELECTED NODPI APK PAGE:"
        );

        console.log(
            selectedPage.href
        );

        console.log(
            "======================================"
        );


        // =================================================
        // OPEN NODPI PAGE
        // =================================================

        await page.goto(
            selectedPage.href,
            {
                waitUntil: "domcontentloaded",
                timeout: 120000
            }
        );


        // =================================================
        // WAIT 20 SECONDS
        // =================================================

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
            "Anti-adblock wait completed."
        );


        // =================================================
        // WAIT DOWNLOAD APK
        // =================================================

        console.log(
            "Waiting for DOWNLOAD APK..."
        );


        let downloadButton = null;


        for (
            let attempt = 0;
            attempt < 40;
            attempt++
        ) {

            // Exact
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


            // Regex
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
                        await element.innerText()
                    )
                    .trim()
                    .toLowerCase();


                if (
                    text.includes("bundle") ||
                    text.includes("splits")
                ) {
                    continue;
                }


                downloadButton =
                    element;

                break;

            }


            if (downloadButton) {
                break;
            }


            await sleep(1000);

        }


        if (!downloadButton) {

            const body =
                await page.locator(
                    "body"
                ).innerText();


            console.log(body.substring(0, 5000));


            throw new Error(
                "Không tìm thấy element DOWNLOAD APK."
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


        // =================================================
        // CLICK DOWNLOAD
        // =================================================

        const downloadPromise =
            page.waitForEvent(
                "download",
                {
                    timeout: 180000
                }
            );


        await downloadButton
            .scrollIntoViewIfNeeded();


        await downloadButton.click({
            force: true
        });


        const download =
            await downloadPromise;


        // =================================================
        // SAVE
        // =================================================

        const filename =
            `com.google.android.youtube-${VERSION}-all.apk`;


        await download.saveAs(
            filename
        );


        // =================================================
        // VERIFY
        // =================================================

        if (!fs.existsSync(filename)) {
            throw new Error(
                "APK không tồn tại."
            );
        }


        const size =
            fs.statSync(filename).size;


        console.log("");
        console.log(
            "======================================"
        );

        console.log(
            "APK DOWNLOADED"
        );

        console.log(
            "FILE:",
            filename
        );

        console.log(
            "SIZE:",
            (
                size / 1024 / 1024
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


        if (
            size <
            10 * 1024 * 1024
        ) {

            throw new Error(
                "APK quá nhỏ."
            );

        }


        // =================================================
        // OUTPUT
        // =================================================

        if (
            process.env.GITHUB_OUTPUT
        ) {

            fs.appendFileSync(
                process.env.GITHUB_OUTPUT,
                `release_type=${release.type}\n`
            );

            fs.appendFileSync(
                process.env.GITHUB_OUTPUT,
                `download_page=${selectedPage.href}\n`
            );

        }


    } finally {

        await browser.close();

    }

}


main().catch(error => {

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

});
