import os, requests
VERSION=os.environ["VERSION"]; URL=os.environ["DOWNLOAD_URL"]
FILE=f"com.google.android.youtube-{VERSION}-all.apk"
H={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36","Accept":"application/vnd.android.package-archive,application/octet-stream,*/*","Referer":"https://www.apkmirror.com/"}
r=requests.get(URL,headers=H,stream=True,timeout=180)
if r.status_code!=200: raise SystemExit(f"APK download failed: HTTP {r.status_code}")
if "text/html" in r.headers.get("content-type","").lower(): raise SystemExit("APKMirror trả về HTML thay vì APK; có thể bị anti-bot/403.")
total=0
with open(FILE,"wb") as f:
    for c in r.iter_content(1024*1024):
        if c:f.write(c); total+=len(c)
print(f"Downloaded {total/1024/1024:.2f} MB")
if total<10*1024*1024: raise SystemExit("APK quá nhỏ; download không hợp lệ.")
