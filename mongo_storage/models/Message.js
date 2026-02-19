const mongoose = require('mongoose');
const { Schema, model } = require("mongoose");

const msgSchema = new Schema({
    name: String,
    msg_size: Number,
    msg: String,
    date: Date
});

module.exports = mongoose.model("team1_messages", msgSchema);