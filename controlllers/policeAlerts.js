const PoliceAlert = require('../models/policeAlert');
const { BadRequestError, UnAuthenticatedError } = require('../ErrorHandlers');

const savePoliceAlert = async (req, res) => {
    const { userId } = req.user;
    const { location, phoneNumber, audioRecordingUrl, VideoRecordingUrl } = req.body;

    if(!userId) {
        throw new UnAuthenticatedError('User not authenticated');
    }


    if (!location || !phoneNumber || !audioRecordingUrl || !VideoRecordingUrl) {
        throw new BadRequestError('Please provide all required fields');
    }

    const policeAlert = new PoliceAlert({
        user: userId,
        location,
        phoneNumber,
        audioRecordingUrl,
        VideoRecordingUrl
    });

    await policeAlert.save();
    res.status(201).json({ message: 'Police alert saved successfully', alert: policeAlert });
}

const getPoliceAlerts = async (req, res) => {
    const alerts = await PoliceAlert.find();
    res.status(200).json({ alerts });
};

const getParticularUserPoliceAlerts = async (req, res) => {
    const {alertedUserId} = req.body;
    const alert = await PoliceAlert.findOne({ user: alertedUserId }).sort({ alertTime: -1 });
    res.status(200).json({ alert });
}

module.exports = {
    savePoliceAlert,
    getPoliceAlerts,
    getParticularUserPoliceAlerts
};