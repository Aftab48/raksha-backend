const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { BadRequestError, UnAuthenticatedError } = require('../ErrorHandlers');

const EVIDENCE_ROOT = path.join(process.cwd(), 'storage', 'evidence');

const ensureDir = (dirPath) => {
    fs.mkdirSync(dirPath, { recursive: true });
};

const sanitizeSegment = (value, fallback = 'unknown') => {
    if (value === undefined || value === null) return fallback;

    const sanitized = String(value)
        .trim()
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(0, 80);

    return sanitized || fallback;
};

const extensionFromMime = (mimeType, chunkType) => {
    if (mimeType && mimeType.includes('jpeg')) return 'jpg';
    if (mimeType && mimeType.includes('png')) return 'png';

    if (chunkType === 'camera_frame') return 'jpg';
    if (chunkType === 'audio_pcm') return 'pcm';

    if (mimeType && mimeType.startsWith('audio/')) return 'pcm';
    return 'bin';
};

const mimeFromExtension = (fileName, fallback = 'application/octet-stream') => {
    const extension = String(fileName).toLowerCase().split('.').pop();
    if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
    if (extension === 'png') return 'image/png';
    if (extension === 'pcm') return 'audio/raw';
    return fallback;
};

const getEventFolder = (userId, sosEventId) => {
    const userFolder = path.join(EVIDENCE_ROOT, `user_${sanitizeSegment(userId)}`);
    return path.join(userFolder, `event_${sanitizeSegment(sosEventId)}`);
};

const parseIndexFile = (indexFilePath) => {
    if (!fs.existsSync(indexFilePath)) return [];

    const lines = fs
        .readFileSync(indexFilePath, 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    return lines
        .map((line) => {
            try {
                return JSON.parse(line);
            } catch (error) {
                return null;
            }
        })
        .filter(Boolean);
};

const buildChunkUrl = (req, sosEventId, fileName) => {
    const base = `${req.protocol}://${req.get('host')}`;
    const encodedName = encodeURIComponent(fileName);
    const tokenSuffix = req.query?.token ? `?token=${encodeURIComponent(req.query.token)}` : '';
    return `${base}/api/v1/evidence/event/${encodeURIComponent(String(sosEventId))}/chunks/${encodedName}${tokenSuffix}`;
};

const annotateChunk = (req, sosEventId, chunk) => {
    const fileName = path.basename(chunk.filePath || '');
    return {
        ...chunk,
        fileName,
        chunkUrl: fileName ? buildChunkUrl(req, sosEventId, fileName) : null
    };
};

const getChunkAbsolutePath = (eventFolder, requestedFileName) => {
    const fileName = path.basename(requestedFileName || '');
    if (!fileName || fileName !== requestedFileName) {
        throw new BadRequestError('Invalid file name');
    }

    const resolvedEventFolder = path.resolve(eventFolder);
    const resolvedFilePath = path.resolve(path.join(eventFolder, fileName));

    if (!resolvedFilePath.startsWith(`${resolvedEventFolder}${path.sep}`) && resolvedFilePath !== resolvedEventFolder) {
        throw new BadRequestError('Invalid file path');
    }

    if (!fs.existsSync(resolvedFilePath)) {
        throw new BadRequestError('Chunk file not found');
    }

    return resolvedFilePath;
};

const streamEvidenceChunk = async (req, res) => {
    const { userId } = req.user || {};
    if (!userId) {
        throw new UnAuthenticatedError('User not authenticated');
    }

    const { sosEventId, timestamp, lat, lng, chunkType } = req.body;
    if (!sosEventId || !timestamp || !lat || !lng || !chunkType) {
        throw new BadRequestError('Missing required fields: sosEventId, timestamp, lat, lng, chunkType');
    }

    if (!req.file) {
        throw new BadRequestError('Missing multipart file field "chunk"');
    }

    const normalizedChunkType = sanitizeSegment(chunkType, 'unknown_chunk');
    const eventFolder = getEventFolder(userId, sosEventId);
    ensureDir(eventFolder);

    const extension = extensionFromMime(req.file.mimetype, normalizedChunkType);
    const fileName = `${Date.now()}_${normalizedChunkType}_${crypto.randomBytes(4).toString('hex')}.${extension}`;
    const absoluteFilePath = path.join(eventFolder, fileName);

    fs.writeFileSync(absoluteFilePath, req.file.buffer);

    const relativeFilePath = path
        .relative(process.cwd(), absoluteFilePath)
        .replace(/\\/g, '/');

    const metadata = {
        storedAt: new Date().toISOString(),
        userId: String(userId),
        sosEventId: String(sosEventId),
        timestamp,
        lat: Number(lat),
        lng: Number(lng),
        chunkType: normalizedChunkType,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        filePath: relativeFilePath
    };

    const indexFilePath = path.join(eventFolder, 'index.ndjson');
    fs.appendFileSync(indexFilePath, `${JSON.stringify(metadata)}\n`);

    res.status(201).json({
        msg: 'Evidence chunk stored',
        filePath: relativeFilePath,
        chunkType: normalizedChunkType,
        sizeBytes: req.file.size,
        fileName,
        chunkUrl: buildChunkUrl(req, sosEventId, fileName)
    });
};

const getEvidenceManifest = async (req, res) => {
    const { userId } = req.user || {};
    if (!userId) {
        throw new UnAuthenticatedError('User not authenticated');
    }

    const { sosEventId } = req.params;
    if (!sosEventId) {
        throw new BadRequestError('Please provide sosEventId');
    }

    const eventFolder = getEventFolder(userId, sosEventId);
    const indexFilePath = path.join(eventFolder, 'index.ndjson');
    const chunks = parseIndexFile(indexFilePath).map((chunk) => annotateChunk(req, sosEventId, chunk));

    res.status(200).json({
        sosEventId: String(sosEventId),
        chunkCount: chunks.length,
        chunks
    });
};

const getEvidenceFrames = async (req, res) => {
    const { userId } = req.user || {};
    if (!userId) {
        throw new UnAuthenticatedError('User not authenticated');
    }

    const { sosEventId } = req.params;
    if (!sosEventId) {
        throw new BadRequestError('Please provide sosEventId');
    }

    const eventFolder = getEventFolder(userId, sosEventId);
    const indexFilePath = path.join(eventFolder, 'index.ndjson');

    const frames = parseIndexFile(indexFilePath)
        .filter((chunk) => chunk.chunkType === 'camera_frame' || (chunk.mimeType || '').startsWith('image/'))
        .map((chunk) => {
            const fileName = path.basename(chunk.filePath || '');
            return {
                storedAt: chunk.storedAt,
                timestamp: chunk.timestamp,
                lat: chunk.lat,
                lng: chunk.lng,
                fileName,
                frameUrl: fileName ? buildChunkUrl(req, sosEventId, fileName) : null
            };
        })
        .filter((frame) => !!frame.frameUrl)
        .sort((a, b) => String(a.storedAt).localeCompare(String(b.storedAt)));

    res.status(200).json({
        sosEventId: String(sosEventId),
        frameCount: frames.length,
        frames
    });
};

const getEvidenceChunkFile = async (req, res) => {
    const { userId } = req.user || {};
    if (!userId) {
        throw new UnAuthenticatedError('User not authenticated');
    }

    const { sosEventId, fileName } = req.params;
    if (!sosEventId || !fileName) {
        throw new BadRequestError('Please provide sosEventId and fileName');
    }

    const eventFolder = getEventFolder(userId, sosEventId);
    const absolutePath = getChunkAbsolutePath(eventFolder, fileName);

    res.setHeader('Content-Type', mimeFromExtension(fileName));
    return res.sendFile(absolutePath);
};

const getEvidenceFramesGallery = async (req, res) => {
    const { userId } = req.user || {};
    if (!userId) {
        throw new UnAuthenticatedError('User not authenticated');
    }

    const { sosEventId } = req.params;
    if (!sosEventId) {
        throw new BadRequestError('Please provide sosEventId');
    }

    const eventFolder = getEventFolder(userId, sosEventId);
    const indexFilePath = path.join(eventFolder, 'index.ndjson');

    const frames = parseIndexFile(indexFilePath)
        .filter((chunk) => chunk.chunkType === 'camera_frame' || (chunk.mimeType || '').startsWith('image/'))
        .map((chunk) => {
            const fileName = path.basename(chunk.filePath || '');
            return {
                fileName,
                storedAt: chunk.storedAt,
                frameUrl: fileName ? buildChunkUrl(req, sosEventId, fileName) : null
            };
        })
        .filter((frame) => !!frame.frameUrl);

    const cards = frames.length
        ? frames.map((frame, index) => `
            <div class="card">
                <div class="meta">Frame ${index + 1} • ${frame.storedAt}</div>
                <img src="${frame.frameUrl}" alt="frame-${index + 1}" loading="lazy" />
            </div>
        `).join('\n')
        : '<p>No camera frames found for this event yet.</p>';

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Raksha Evidence Frames</title>
  <style>
    body { font-family: Arial, sans-serif; background: #0b1220; color: #e8f0ff; margin: 0; padding: 20px; }
    h1 { margin-top: 0; }
    .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
    .card { background: #111b2e; border: 1px solid #20304f; border-radius: 10px; padding: 10px; }
    .meta { font-size: 12px; color: #9fb3d8; margin-bottom: 8px; }
    img { width: 100%; border-radius: 8px; display: block; }
  </style>
</head>
<body>
  <h1>Evidence Frames • Event ${String(sosEventId)}</h1>
  <div class="grid">${cards}</div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
};

module.exports = {
    streamEvidenceChunk,
    getEvidenceManifest,
    getEvidenceFrames,
    getEvidenceChunkFile,
    getEvidenceFramesGallery
};
