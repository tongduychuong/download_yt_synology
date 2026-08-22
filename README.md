# YouTube APKMirror → Synology

Nguồn version duy nhất:

version.txt

Ví dụ:

21.34.243

## Quy tắc

- Đọc đúng version trong version.txt.
- Nếu version có Stable và Beta → tải Stable.
- Nếu không có Stable nhưng có Beta → tải Beta.
- Bỏ SECONDARY.
- Bỏ ALPHA.
- Bỏ RC.
- Ưu tiên nodpi.
- Tên file:
  com.google.android.youtube-VERSION-all.apk
- Không upload version.txt lên Synology.
- Không upload sha256.txt lên Synology.
- Nếu APK đã tồn tại trên Synology thì không upload lại.
- SCP dùng `-O` để tránh lỗi SFTP subsystem.

## GitHub Secrets

SYNOLOGY_HOST
SYNOLOGY_SSH_PORT
SYNOLOGY_USER
SYNOLOGY_SSH_KEY
SYNOLOGY_PATH

Ví dụ:

SYNOLOGY_HOST=192.168.1.100
SYNOLOGY_SSH_PORT=22
SYNOLOGY_USER=github
SYNOLOGY_PATH=/volume1/YouTube

## Chạy

GitHub → Actions → YouTube APKMirror to Synology → Run workflow
