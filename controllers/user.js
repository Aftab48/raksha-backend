const User = require('../models/user');
const { BadRequestError, UnAuthenticatedError } = require('../ErrorHandlers');

const saveUserTrustedContact = async (req, res) => {
    const { userId } = req.user;

    if (!userId) {
        throw new UnAuthenticatedError('User not authenticated');
    }

    const { name, phoneNumber } = req.body;
    if(!name || !phoneNumber) {
        throw new BadRequestError('Please provide all required fields');
    }

    const user = await User.findById(userId);
    if (!user) {
        throw new UnAuthenticatedError('User not found');
    }

    const existingContact = user.trustedContacts.find(contact => contact.phoneNumber === phoneNumber);
    if (existingContact) {
        throw new BadRequestError('Trusted contact with this phone number already exists');
    }

    user.trustedContacts.push({ name, phoneNumber, priority: user.trustedContacts.length + 1 });
    await user.save();

    res.status(200).json({ message: 'Trusted contact added successfully', trustedContacts: user.trustedContacts });
}

const getUserTrustedContacts = async (req, res) => {
    const { userId } = req.user;

    if (!userId) {
        throw new UnAuthenticatedError('User not authenticated');
    }

    const user = await User.findById(userId);
    if (!user) {
        throw new UnAuthenticatedError('User not found');
    }

    res.status(200).json({ trustedContacts: user.trustedContacts });
}

const deleteUserTrustedContact = async (req, res) => {
    const { userId } = req.user;
    const {contactPhoneNumber} = req.params;

    if (!userId) {
        throw new UnAuthenticatedError('User not authenticated');
    }
    
    if(!contactPhoneNumber) {
        throw new BadRequestError('Please provide the phone number of the contact to delete');
    }

    const user = await User.findById(userId);
    if (!user) {
        throw new UnAuthenticatedError('User not found');
    }

    const contactIndex = user.trustedContacts.findIndex(contact => contact.phoneNumber === contactPhoneNumber);
    if (contactIndex === -1) {
        throw new BadRequestError('Trusted contact not found');
    }

    user.trustedContacts.splice(contactIndex, 1);
    await user.save();
    res.status(200).json({ message: 'Trusted contact deleted successfully', trustedContacts: user.trustedContacts });
    
}

module.exports = {
    saveUserTrustedContact,
    getUserTrustedContacts,
    deleteUserTrustedContact
};