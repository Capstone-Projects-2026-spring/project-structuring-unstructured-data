const { Schema, model } = require("mongoose");

const msgSchema = new Schema({
    user: String,
    type: String,
    text: String,
    ts: String
});

// Creates a mongoose model for a given channel name
const createMessageModel = (channelName) => {
  // Checks if the models for the collection exists
  if (mongoose.models[channelName]) {
    return mongoose.models[channelName];
  }

  const model = mongoose.model(channelName, msgSchema, channelName);
  return model;
};

module.exports = { createMessageModel };