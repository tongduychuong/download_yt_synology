import os, re, requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

URL = "https://www.apkmirror.com/apk/google-inc/youtube/"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

s = requests.Session(); s.headers.update(HEADERS)
r = s.get(URL, timeout=60)
r.raise_for_status()
soup = BeautifulSoup(r.text, "lxml")
releases = []

for a in soup.select("a[href]"):
    href = a.get("href", "")
    text = " ".join(a.stripped_strings)
    low = (text + " " + href).lower()
    if "youtube" not in low or "release" not in low: continue
    if any(x in low for x in [" beta", " alpha", " rc"]): continue
    m = re.search(r"youtube[-\s]+(\d+)[.-](\d+)[.-](\d+)", low)
    if not m: continue
    version = ".".join(m.groups())
    releases.append((tuple(map(int, version.split("."))), version, urljoin(URL, href)))

if not releases: raise SystemExit("Không tìm thấy YouTube release.")
releases.sort(reverse=True)
_, version, release_url = releases[0]
print("Latest version:", version)
print("Release URL:", release_url)
open("version.txt", "w").write(version)
open("release_url.txt", "w").write(release_url)
with open(os.environ["GITHUB_OUTPUT"], "a") as f:
    f.write(f"version={version}\nrelease_url={release_url}\n")
