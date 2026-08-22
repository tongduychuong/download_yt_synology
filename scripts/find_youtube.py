import os, re, requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

VERSION = os.environ["VERSION"]
BASE = "https://www.apkmirror.com/"
URL = "https://www.apkmirror.com/apk/google-inc/youtube/"
HEADERS = {"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36","Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8","Accept-Language":"en-US,en;q=0.9","Referer":BASE}
s=requests.Session(); s.headers.update(HEADERS)

def get(url):
    last=None
    for i in range(4):
        try:
            r=s.get(url,timeout=60)
            if r.status_code==200:return r
            last=f"HTTP {r.status_code}"
        except requests.RequestException as e:last=str(e)
    raise SystemExit(f"Không thể truy cập APKMirror: {last}")

# Search page for exact version. Stable is preferred over beta.
search=f"{BASE}?post_type=app_release&s=youtube+{VERSION}"
r=get(search); soup=BeautifulSoup(r.text,"lxml")
candidates=[]
for a in soup.select("a[href]"):
    href=a.get("href",""); text=" ".join(a.stripped_strings); low=(text+" "+href).lower()
    if "youtube" not in low or VERSION not in low or "release" not in low: continue
    if any(x in low for x in ["secondary"," alpha","alpha-"," rc","release candidate"]): continue
    kind="beta" if (" beta" in low or "-beta-" in low or " beta-" in low) else "stable"
    candidates.append((kind,urljoin(BASE,href)))
seen=set(); candidates=[x for x in candidates if not (x in seen or seen.add(x))]
stable=[x for x in candidates if x[0]=="stable"]; beta=[x for x in candidates if x[0]=="beta"]
selected=(stable or beta)
if not selected: raise SystemExit(f"Không tìm thấy YouTube {VERSION} Stable hoặc Beta trên APKMirror.")
kind, release_url=selected[0]
print("Selected:",kind,release_url)
r=get(release_url); soup=BeautifulSoup(r.text,"lxml")
download_page=None
for a in soup.select("a[href]"):
    href=a.get("href",""); text=" ".join(a.stripped_strings).lower()
    if "download" in text and "apk" in text and "/apk/" in href:
        download_page=urljoin(release_url,href); break
if not download_page:
    for a in soup.select("a[href]"):
        href=a.get("href","")
        if "android-apk-download" in href: download_page=urljoin(release_url,href); break
if not download_page: raise SystemExit("Không tìm thấy download page.")
r=get(download_page); soup=BeautifulSoup(r.text,"lxml")
apk=None
for a in soup.select("a[href]"):
    href=a.get("href",""); text=" ".join(a.stripped_strings).lower()
    if href.startswith("http") and "download" in text and "apk" in text: apk=href; break
if not apk:
    for a in soup.select("a[href]"):
        href=a.get("href","")
        if ".apk" in href.lower(): apk=href; break
if not apk: raise SystemExit("Không tìm thấy direct APK URL.")
with open(os.environ["GITHUB_OUTPUT"],"a") as f:f.write(f"download_url={apk}\n")
