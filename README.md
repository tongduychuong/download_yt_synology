# YouTube APKMirror → Synology SSH

GitHub Actions tự động:
1. Tìm YouTube stable nodpi mới nhất trên APKMirror.
2. Tải APK.
3. Tạo SHA-256.
4. Upload APK lên Synology bằng SSH/SCP.
5. Bỏ qua nếu version đã tồn tại.

## GitHub Secrets

Tạo các secrets:

- `SYNOLOGY_HOST` — IP/domain Synology
- `SYNOLOGY_SSH_PORT` — thường `22`
- `SYNOLOGY_USER` — user SSH
- `SYNOLOGY_SSH_KEY` — private Ed25519 key
- `SYNOLOGY_PATH` — ví dụ `/volume1/YouTube`

## Synology

Bật SSH tại:

Control Panel → Terminal & SNMP → Enable SSH service

Đảm bảo user có quyền ghi vào thư mục:

`/volume1/YouTube`

## SSH key

Tạo key:

```bash
ssh-keygen -t ed25519 -C "github-youtube"
```

Đưa public key vào Synology và private key vào GitHub Secret `SYNOLOGY_SSH_KEY`.

## Chạy

Vào:

GitHub → Actions → Download YouTube APKMirror → Run workflow

Workflow cũng tự chạy mỗi ngày.
