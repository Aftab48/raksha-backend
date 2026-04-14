const mongoose = require('mongoose');

const connectDb = async(URI) => {
  try {
    await mongoose.connect(URI);
    console.log('Connected to Database');
  } catch (error) {
    console.error('Error connecting to Database: ', error);
  }
};

module.exports = connectDb;