const mongoose = require('mongoose');
const { Schema, model } = require("mongoose");

const userSchema = new Schema(
  {
    team_id: String,
    name: String,
    real_name: String,
    is_admin: Boolean,
    is_owner: Boolean,
    is_bot: Boolean
  },
  { strict: false } // Ensures all raw fields are logged
);

// Function to creates message model for any collection
const getUserModel = (collectionName) => {
  if (mongoose.models[collectionName]) {
    return mongoose.models[collectionName];
  }
  return model(collectionName, userSchema, collectionName);
};

module.exports = { getUserModel };