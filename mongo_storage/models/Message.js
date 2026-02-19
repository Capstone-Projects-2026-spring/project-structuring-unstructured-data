const mongoose = require('mongoose');
const { Schema, model } = require("mongoose");

const msgSchema = new Schema({
    name: String,
    msg_size: Number,
    msg: String,
    date: Date
});

// Function to creates message model for any collection
const getMessageModel = (collectionName) => {
  if (mongoose.models[collectionName]) {
    return mongoose.models[collectionName];
  }
  return mongoose.model(collectionName, msgSchema, collectionName);
};

module.exports = getMessageModel;