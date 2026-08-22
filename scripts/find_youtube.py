import os
import re
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

url = "https://www.apkmirror.com/apk/google-inc/youtube/variant-%7B%22dpis_slug%22%3A%5B%22nodpi%22%5D%7D/"

headers = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

s = requests.Session()
s.headers.update(headers)
r = s.get(url, timeout=60)
r.raise_for_status()

soup = BeautifulSoup(r.text, "lxml")
found = []

for a in soup.select("a[href]"):
    href = a.get("href", "")
    text = " ".join(a.stripped_strings)
    low = (text + " " + href).lower()

    if "/youtube-" not in href.lower() or "release" not in low:
        continue
    if "nodpi" not in low:
        continue
    if any(x in low for x in [" beta", " alpha", " rc", "secondary"]):
        continue

    m = re.search(r"youtube\s+(\d+\.\d+\.\d+)", text, re.I)
    if not m:
        m = re.search(r"youtube-(\d+)-(\d+)-(\d+)-release", href, re.I)
    if not m:
        continue

    version = ".".join(m.groups())
    found.append((tuple(map(int, version.split("."))), version,
                  urljoin(url, href)))

if not found:
    raise SystemExit("Không tìm thấy YouTube stable nodpi trên APKMirror.")

found.sort(reverse=True)
_, version, release_url = found[0]

print("Latest version:", version)
print("Release URL:", release_url)

open("version.txt", "w").write(version)
open("release_url.txt", "w").write(release_url)

with open(os.environ["GITHUB_OUTPUT"], "a") as f:
    f.write(f"version={version}\n")
    f.write(f"release_url={release_url}\n")
