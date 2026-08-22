import os
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

release_url = os.environ["RELEASE_URL"]

headers = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.apkmirror.com/",
}

s = requests.Session()
s.headers.update(headers)

r = s.get(release_url, timeout=60)
r.raise_for_status()
soup = BeautifulSoup(r.text, "lxml")

download_page = None

for a in soup.select("a[href]"):
    href = a.get("href", "")
    txt = " ".join(a.stripped_strings).lower()
    if "download" in txt and "apk" in txt and "/apk/" in href:
        download_page = urljoin(release_url, href)
        break

if not download_page:
    for a in soup.select("a[href]"):
        href = a.get("href", "")
        if "android-apk-download" in href:
            download_page = urljoin(release_url, href)
            break

if not download_page:
    raise SystemExit("Không tìm thấy trang download APKMirror.")

r2 = s.get(download_page, timeout=60)
r2.raise_for_status()
soup2 = BeautifulSoup(r2.text, "lxml")

apk_url = None

for a in soup2.select("a[href]"):
    href = a.get("href", "")
    txt = " ".join(a.stripped_strings).lower()
    if href.startswith("http") and "download" in txt and ("apk" in txt or "mirror" in txt):
        apk_url = href
        break

if not apk_url:
    for a in soup2.select("a[href]"):
        href = a.get("href", "")
        if ".apk" in href.lower():
            apk_url = href
            break

if not apk_url:
    raise SystemExit("Không tìm thấy URL APK thực tế.")

version = open("version.txt").read().strip()
filename = f"YouTube-{version}.apk"

print("APK URL:", apk_url)
print("Downloading:", filename)

rr = s.get(apk_url, stream=True, timeout=180)
rr.raise_for_status()

content_type = rr.headers.get("content-type", "").lower()
if "text/html" in content_type:
    raise SystemExit("APKMirror trả về HTML thay vì APK; có thể gặp anti-bot.")

total = 0
with open(filename, "wb") as f:
    for chunk in rr.iter_content(chunk_size=1024 * 1024):
        if chunk:
            f.write(chunk)
            total += len(chunk)

print(f"Downloaded {total / 1024 / 1024:.2f} MB")

if total < 10 * 1024 * 1024:
    raise SystemExit("File tải về quá nhỏ, download có thể thất bại.")
