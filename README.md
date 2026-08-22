# YouTube APKMirror → Synology SSH

## Files
- `.github/workflows/youtube-synology.yml`
- `scripts/find_youtube.py`
- `scripts/download_youtube.py`

## GitHub Secrets
Create:
- `SYNOLOGY_HOST`
- `SYNOLOGY_SSH_PORT` (usually `22`)
- `SYNOLOGY_USER`
- `SYNOLOGY_SSH_KEY` (private Ed25519 key)
- `SYNOLOGY_PATH` (example: `/volume1/YouTube`)

The workflow uses `scp -O` because Synology may return `subsystem request failed on channel 0` with SFTP-based SCP.

Run manually from GitHub Actions or let the daily schedule run.
