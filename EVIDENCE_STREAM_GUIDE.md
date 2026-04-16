# Evidence Streaming Guide (Raksha)

This document explains how SOS evidence chunks are stored and how to view camera frames from the Render-hosted backend.

## App Configuration (`local.properties`)
Add this in your Android app `local.properties`:

```properties
MOCK_POLICE_STREAM_URL=https://raksha-backend-6a1s.onrender.com/api/v1/evidence/stream
```

After updating `local.properties`, rebuild/reinstall the app (value is compiled into `BuildConfig`).

## Auth Requirement
All evidence endpoints require user authentication.

You can pass token in either way:
- `Authorization: Bearer <JWT_TOKEN>` header
- `?token=<JWT_TOKEN>` query parameter (useful for browser/gallery URLs)

## Evidence Storage Location (Server)
Chunks are stored on disk in:

```text
storage/evidence/user_<userId>/event_<sosEventId>/
```

Inside each event folder:
- image/audio chunk files
- `index.ndjson` metadata log

## Endpoints

### 1) Upload chunk (used by app)
`POST /api/v1/evidence/stream`

Multipart form-data fields:
- `sosEventId`
- `timestamp`
- `lat`
- `lng`
- `chunkType` (`camera_frame` / `audio_pcm`)
- `chunk` (file)

### 2) Full event manifest
`GET /api/v1/evidence/event/:sosEventId`

Returns all stored chunks with metadata + `chunkUrl`.

### 3) Frame-only manifest
`GET /api/v1/evidence/event/:sosEventId/frames`

Returns only camera/image chunks with `frameUrl`.

### 4) Download/preview a single chunk
`GET /api/v1/evidence/event/:sosEventId/chunks/:fileName`

### 5) Browser gallery (visual frame view)
`GET /api/v1/evidence/event/:sosEventId/frames/gallery`

## Quick Usage Examples

### Get frame list (JSON)
```bash
curl -H "Authorization: Bearer <JWT_TOKEN>" \
"https://raksha-backend-6a1s.onrender.com/api/v1/evidence/event/<SOS_EVENT_ID>/frames"
```

### Open gallery in browser
```text
https://raksha-backend-6a1s.onrender.com/api/v1/evidence/event/<SOS_EVENT_ID>/frames/gallery?token=<JWT_TOKEN>
```

### Open a specific frame directly
```text
https://raksha-backend-6a1s.onrender.com/api/v1/evidence/event/<SOS_EVENT_ID>/chunks/<FILE_NAME>?token=<JWT_TOKEN>
```

## Notes
- Current implementation stores camera frames + raw audio chunks; it does not combine them into a single `.mp4` yet.
- `storage/evidence/` is excluded from git.
