const { chromium, request } = require("playwright");
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

function isBadRelease(text) {
  const value = text.toLowerCase();

  return (
    value.includes("secondary") ||
    value.includes("alpha") ||
    value.includes("release-candidate") ||
    /\brc\b/.test(value)
  );
}

function isBeta(text) {
  const value = text.toLowerCase();

  return (
    value.includes(" beta") ||
    value.includes("-beta-") ||
    value.includes(" beta-") ||
    value.includes("-beta/")
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

  const browserContext = await browser.newContext({
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

  const page = await browserContext.newPage();

  console.log("====================================");
  console.log("YouTube version:", VERSION);
  console.log("Search URL:");
  console.log(SEARCH_URL);
  console.log("====================================");

  try {
    // =====================================================
    // 1. OPEN APKMIRROR SEARCH
    // =====================================================

    await page.goto(SEARCH_URL, {
      waitUntil: "domcontentloaded",
      timeout: 120000
    });

    await sleep(3000);

    const title = await page.title();

    console.log("Page title:", title);

    const pageText = await page.locator("body").innerText();

    if (
      pageText.includes("403 Forbidden") ||
      pageText.includes("Access Denied")
    ) {
      throw new Error(
        "APKMirror trả về 403 Forbidden / Access Denied"
      );
    }

    // =====================================================
    // 2. FIND RELEASE LINKS
    // =====================================================

    const links = await page.locator("a[href]").evaluateAll(
      elements =>
        elements.map(element => ({
          text: (element.innerText || "").trim(),
          href: element.href
        }))
    );

    const candidates = [];

    for (const item of links) {
      const text = item.text || "";
      const href = item.href || "";

      const combined =
        `${text} ${href}`.toLowerCase();

      // Chỉ YouTube release
      if (
        !combined.includes("/apk/google-inc/youtube/")
      ) {
        continue;
      }

      if (!combined.includes("release")) {
        continue;
      }

      // Phải chứa version cần tìm
      const versionDash =
        VERSION.replace(/\./g, "-");

      if (
        !combined.includes(VERSION.toLowerCase()) &&
        !combined.includes(versionDash.toLowerCase())
      ) {
        continue;
      }

      // Bỏ Secondary / Alpha / RC
      if (isBadRelease(combined)) {
        continue;
      }

      const beta = isBeta(combined);

      candidates.push({
        type: beta ? "beta" : "stable",
        text,
        href
      });
    }

    // =====================================================
    // REMOVE DUPLICATES
    // =====================================================

    const unique = [];
    const seen = new Set();

    for (const item of candidates) {
      if (seen.has(item.href)) {
        continue;
      }

      seen.add(item.href);
      unique.push(item);
    }

    console.log("");
    console.log("Candidates:");

    for (const item of unique) {
      console.log(
        `[${item.type}] ${item.href}`
      );
    }

    // =====================================================
    // 3. STABLE HAS PRIORITY
    // =====================================================

    const stable = unique.filter(
      item => item.type === "stable"
    );

    const beta = unique.filter(
      item => item.type === "beta"
    );

    let selected = null;

    if (stable.length > 0) {
      selected = stable[0];
    } else if (beta.length > 0) {
      selected = beta[0];
    }

    if (!selected) {
      throw new Error(
        `Không tìm thấy YouTube ${VERSION} ` +
        `Stable hoặc Beta trên APKMirror`
      );
    }

    console.log("");
    console.log("====================================");
    console.log("SELECTED RELEASE");
    console.log("Type:", selected.type);
    console.log("URL:", selected.href);
    console.log("====================================");

    // =====================================================
    // 4. OPEN RELEASE PAGE
    // =====================================================

    await page.goto(selected.href, {
      waitUntil: "domcontentloaded",
      timeout: 120000
    });

    await sleep(2500);

    const releaseBody =
      await page.locator("body").innerText();

    if (
      releaseBody.includes("403 Forbidden") ||
      releaseBody.includes("Access Denied")
    ) {
      throw new Error(
        "Release page trả về 403 Forbidden / Access Denied"
      );
    }

    // =====================================================
    // 5. FIND VARIANT PAGE
    // =====================================================

    const releaseLinks =
      await page.locator("a[href]").evaluateAll(
        elements =>
          elements.map(element => ({
            text: (element.innerText || "").trim(),
            href: element.href
          }))
      );

    const variants = [];

    for (const item of releaseLinks) {
      const combined =
        `${item.text} ${item.href}`.toLowerCase();

      if (
        !combined.includes(
          "/apk/google-inc/youtube/"
        )
      ) {
        continue;
      }

      if (isBadRelease(combined)) {
        continue;
      }

      if (
        combined.includes("bundle")
      ) {
        continue;
      }

      const score =
        (combined.includes("nodpi") ? 100 : 0) +
        (combined.includes("universal") ? 50 : 0) +
        (combined.includes("download") ? 20 : 0);

      variants.push({
        ...item,
        score
      });
    }

    variants.sort(
      (a, b) => b.score - a.score
    );

    console.log("");
    console.log("Variant candidates:");

    for (
      const variant of variants.slice(0, 10)
    ) {
      console.log(
        variant.score,
        variant.href
      );
    }

    if (variants.length === 0) {
      throw new Error(
        "Không tìm thấy variant APK."
      );
    }

    // =====================================================
    // 6. FIND DOWNLOAD PAGE
    // =====================================================

    let downloadPage = null;

    for (
      const variant of variants.slice(0, 10)
    ) {
      console.log("");
      console.log(
        "Checking variant:",
        variant.href
      );

      try {
        await page.goto(
          variant.href,
          {
            waitUntil: "domcontentloaded",
            timeout: 120000
          }
        );

        await sleep(1800);

        const variantLinks =
          await page.locator(
            "a[href]"
          ).evaluateAll(
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

        for (const link of variantLinks) {
          const combined =
            `${link.text} ${link.href}`.toLowerCase();

          if (
            combined.includes(
              "download apk"
            )
          ) {
            downloadPage = link.href;
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
            downloadPage = link.href;
            break;
          }
        }

        if (downloadPage) {
          break;
        }

      } catch (error) {
        console.log(
          "Variant failed:",
          error.message
        );
      }
    }

    if (!downloadPage) {
      throw new Error(
        "Không tìm thấy download page."
      );
    }

    console.log("");
    console.log(
      "Download page:",
      downloadPage
    );

    // =====================================================
    // 7. OPEN DOWNLOAD PAGE
    // =====================================================

    await page.goto(
      downloadPage,
      {
        waitUntil: "domcontentloaded",
        timeout: 120000
      }
    );

    await sleep(2500);

    const downloadBody =
      await page.locator("body").innerText();

    if (
      downloadBody.includes("403 Forbidden") ||
      downloadBody.includes("Access Denied")
    ) {
      throw new Error(
        "Download page trả về 403 Forbidden / Access Denied"
      );
    }

    // =====================================================
    // 8. FIND REAL APK DOWNLOAD URL
    // =====================================================

    const downloadLinks =
      await page.locator(
        "a[href]"
      ).evaluateAll(
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

    let apkUrl = null;

    for (const link of downloadLinks) {
      const combined =
        `${link.text} ${link.href}`.toLowerCase();

      if (
        combined.includes("download apk")
      ) {
        apkUrl = link.href;
        break;
      }
    }

    if (!apkUrl) {
      for (const link of downloadLinks) {
        const combined =
          `${link.text} ${link.href}`.toLowerCase();

        if (
          combined.includes("download") &&
          combined.includes("apk")
        ) {
          apkUrl = link.href;
          break;
        }
      }
    }

    if (!apkUrl) {
      throw new Error(
        "Không tìm thấy APK download URL."
      );
    }

    console.log("");
    console.log(
      "APK URL:",
      apkUrl
    );

    // =====================================================
    // 9. CORRECT PLAYWRIGHT API REQUEST
    // =====================================================

    const api =
      await request.newContext({
        userAgent: USER_AGENT,

        extraHTTPHeaders: {
          "Accept":
            "application/vnd.android.package-archive," +
            "application/octet-stream,*/*",

          "Accept-Language":
            "en-US,en;q=0.9",

          "Referer":
            downloadPage
        }
      });

    console.log("");
    console.log(
      "Downloading APK..."
    );

    const response =
      await api.get(
        apkUrl,
        {
          timeout: 180000
        }
      );

    console.log(
      "HTTP:",
      response.status()
    );

    if (!response.ok()) {
      await api.dispose();

      throw new Error(
        `APK download failed: HTTP ${response.status()}`
      );
    }

    const contentType =
      (
        response.headers()[
          "content-type"
        ] || ""
      ).toLowerCase();

    if (
      contentType.includes(
        "text/html"
      )
    ) {
      await api.dispose();

      throw new Error(
        "APKMirror trả về HTML thay vì APK."
      );
    }

    const buffer =
      await response.body();

    await api.dispose();

    // =====================================================
    // 10. SAVE APK
    // =====================================================

    const filename =
      `com.google.android.youtube-` +
      `${VERSION}-all.apk`;

    fs.writeFileSync(
      filename,
      buffer
    );

    console.log("");
    console.log(
      "===================================="
    );

    console.log(
      "Saved:",
      filename
    );

    console.log(
      "Size:",
      (
        buffer.length /
        1024 /
        1024
      ).toFixed(2),
      "MB"
    );

    console.log(
      "===================================="
    );

    if (
      buffer.length <
      10 * 1024 * 1024
    ) {
      throw new Error(
        "APK quá nhỏ."
      );
    }

    // GitHub outputs
    const output =
      process.env.GITHUB_OUTPUT;

    if (output) {
      fs.appendFileSync(
        output,
        `release_type=${selected.type}\n`
      );

      fs.appendFileSync(
        output,
        `release_url=${selected.href}\n`
      );

      fs.appendFileSync(
        output,
        `download_url=${apkUrl}\n`
      );
    }

  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error("");
  console.error(
    "ERROR:",
    error.message
  );

  process.exit(1);
});
