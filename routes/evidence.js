const express = require('express');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const { authenticateUser } = require('../Middlewares/authenticate');
const { UnAuthenticatedError } = require('../ErrorHandlers');
const {
    streamEvidenceChunk,
    getEvidenceManifest,
    getEvidenceFrames,
    getEvidenceChunkFile,
    getEvidenceFramesGallery
} = require('../controllers/evidence');

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        // Keep chunks bounded for mock server safety
        fileSize: 6 * 1024 * 1024
    }
});

const authenticateEvidenceAccess = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authenticateUser(req, res, next);
    }

    const token = req.query?.token;
    if (!token) {
        throw new UnAuthenticatedError('Authentication invalid');
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = { userId: payload.userId, phoneNumber: payload.phoneNumber };
        return next();
    } catch (error) {
        throw new UnAuthenticatedError('Authentication invalid');
    }
};

router.post('/evidence/stream', authenticateEvidenceAccess, upload.single('chunk'), streamEvidenceChunk);
router.get('/evidence/event/:sosEventId', authenticateEvidenceAccess, getEvidenceManifest);
router.get('/evidence/event/:sosEventId/frames', authenticateEvidenceAccess, getEvidenceFrames);
router.get('/evidence/event/:sosEventId/chunks/:fileName', authenticateEvidenceAccess, getEvidenceChunkFile);
router.get('/evidence/event/:sosEventId/frames/gallery', authenticateEvidenceAccess, getEvidenceFramesGallery);

module.exports = router;
