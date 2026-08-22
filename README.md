# YouTube APKMirror → Synology

Version lấy duy nhất từ `version.txt` trên GitHub.

- Nếu version có Stable và Beta: chọn Stable.
- Nếu không có Stable nhưng có Beta: chọn Beta.
- Bỏ qua SECONDARY, ALPHA, RC.
- Tên file: `com.google.android.youtube-VERSION-all.apk`.
- Không lưu `version.txt` hoặc `sha256.txt` trên Synology.
- Upload bằng `scp -O` để tránh lỗi SFTP subsystem.

Secrets:
`SYNOLOGY_HOST`, `SYNOLOGY_SSH_PORT`, `SYNOLOGY_USER`, `SYNOLOGY_SSH_KEY`, `SYNOLOGY_PATH`.
