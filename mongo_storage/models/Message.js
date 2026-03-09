const mongoose = require('mongoose');
const { Schema, model } = require("mongoose");

const msgSchema = new Schema({
    user: String,
    type: String,
    text: String,
    ts: String
});

// Function to creates message model for any collection
const getMessageModel = (collectionName) => {
  if (mongoose.models[collectionName]) {
    return mongoose.models[collectionName];
  }
  return model(collectionName, msgSchema, collectionName);
};

module.exports = getMessageModel;