const { chromium } = require("playwright");
const fs = require("fs");

const version = process.env.VERSION;

if (!version) {
  throw new Error("VERSION is missing");
}

const base = "https://www.apkmirror.com";
const searchUrl =
  `${base}/?post_type=app_release&searchtype=apk&s=youtube+${version}`;

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage"
    ]
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "en-US",
    viewport: { width: 1366, height: 900 }
  });

  const page = await context.newPage();

  console.log("Search:", searchUrl);

  await page.goto(searchUrl, {
    waitUntil: "domcontentloaded",
    timeout: 120000
  });

  await sleep(3000);

  const title = await page.title();
  console.log("Title:", title);

  const html = await page.content();

  if (
    html.includes("403 Forbidden") ||
    html.includes("Access Denied")
  ) {
    throw new Error("APKMirror returned 403/Access Denied");
  }

  const links = await page.locator("a[href]").evaluateAll(
    (els, wantedVersion) =>
      els.map(a => ({
        text: (a.innerText || "").trim(),
        href: a.href
      })).filter(x =>
        x.href.includes("/apk/google-inc/youtube/") &&
        x.href.includes("release") &&
        (
          x.text.includes(wantedVersion) ||
          x.href.includes(wantedVersion.replaceAll(".", "-"))
        )
      ),
    version
  );

  const candidates = [];

  for (const x of links) {
    const low = `${x.text} ${x.href}`.toLowerCase();

    if (
      low.includes("secondary") ||
      low.includes("alpha") ||
      low.includes("release-candidate") ||
      /\brc\b/.test(low)
    ) {
      continue;
    }

    const beta =
      low.includes(" beta") ||
      low.includes("-beta-") ||
      low.includes(" beta-");

    candidates.push({
      type: beta ? "beta" : "stable",
      url: x.href
    });
  }

  const unique = [];
  const seen = new Set();

  for (const x of candidates) {
    if (!seen.has(x.url)) {
      seen.add(x.url);
      unique.push(x);
    }
  }

  const stable = unique.filter(x => x.type === "stable");
  const beta = unique.filter(x => x.type === "beta");

  let selected;

  if (stable.length) {
    selected = stable[0];
  } else if (beta.length) {
    selected = beta[0];
  } else {
    throw new Error(
      `Không tìm thấy Stable/Beta cho YouTube ${version}`
    );
  }

  console.log("Selected:", selected.type);
  console.log("Release:", selected.url);

  await page.goto(selected.url, {
    waitUntil: "domcontentloaded",
    timeout: 120000
  });

  await sleep(2500);

  const releaseHtml = await page.content();

  if (
    releaseHtml.includes("403 Forbidden") ||
    releaseHtml.includes("Access Denied")
  ) {
    throw new Error("Release page returned 403/Access Denied");
  }

  // Find links to APKMirror variant/download pages.
  const releaseLinks = await page.locator("a[href]").evaluateAll(
    els => els.map(a => ({
      text: (a.innerText || "").trim(),
      href: a.href
    }))
  );

  let variantLinks = releaseLinks.filter(x => {
    const low = `${x.text} ${x.href}`.toLowerCase();
    return (
      x.href.includes("/apk/google-inc/youtube/") &&
      (
        low.includes("nodpi") ||
        low.includes("universal") ||
        low.includes("download")
      )
    );
  });

  // Prefer nodpi.
  variantLinks.sort((a, b) => {
    const aa = `${a.text} ${a.href}`.toLowerCase();
    const bb = `${b.text} ${b.href}`.toLowerCase();
    return Number(bb.includes("nodpi")) - Number(aa.includes("nodpi"));
  });

  if (!variantLinks.length) {
    throw new Error("Không tìm thấy variant/download page");
  }

  let apkDownloadUrl = null;

  for (const v of variantLinks.slice(0, 10)) {
    console.log("Checking:", v.href);

    await page.goto(v.href, {
      waitUntil: "domcontentloaded",
      timeout: 120000
    });

    await sleep(1800);

    const links2 = await page.locator("a[href]").evaluateAll(
      els => els.map(a => ({
        text: (a.innerText || "").trim(),
        href: a.href
      }))
    );

    for (const x of links2) {
      const low = `${x.text} ${x.href}`.toLowerCase();

      if (
        low.includes("download apk") ||
        low.includes("download") &&
        low.includes("apk")
      ) {
        if (
          !low.includes("bundle") &&
          !low.includes("secondary")
        ) {
          apkDownloadUrl = x.href;
          break;
        }
      }
    }

    if (apkDownloadUrl) break;
  }

  if (!apkDownloadUrl) {
    throw new Error(
      "Không tìm thấy direct/download APK link"
    );
  }

  console.log("APK download URL:", apkDownloadUrl);

  // Download through Playwright browser request.
  const request = await context.request.newContext({
    extraHTTPHeaders: {
      "Referer": selected.url,
      "Accept":
        "application/vnd.android.package-archive," +
        "application/octet-stream,*/*"
    }
  });

  const response = await request.get(apkDownloadUrl, {
    timeout: 180000
  });

  console.log("Download HTTP:", response.status());

  if (!response.ok()) {
    throw new Error(
      `APK download failed HTTP ${response.status()}`
    );
  }

  const contentType =
    (response.headers()["content-type"] || "").toLowerCase();

  if (contentType.includes("text/html")) {
    throw new Error(
      "APKMirror trả về HTML thay vì APK"
    );
  }

  const buffer = await response.body();

  const filename =
    `com.google.android.youtube-${version}-all.apk`;

  fs.writeFileSync(filename, buffer);

  console.log(
    `Saved ${filename}: ` +
    `${(buffer.length / 1024 / 1024).toFixed(2)} MB`
  );

  if (buffer.length < 10 * 1024 * 1024) {
    throw new Error("APK quá nhỏ");
  }

  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
