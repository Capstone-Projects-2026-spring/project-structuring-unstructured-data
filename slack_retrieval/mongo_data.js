/*
Retrieves messages from Slack channels and inserts into MongoDB Atlas Database.
Limited to public channels that the bot is a member of.
MongoDB handles duplicates automatically.
*/

const { getConversationHistory, getChannelList } = require('./slack_data.js');
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: './.env' });

// Import database credentials from .env file
const DB_USER = process.env.MONGODB_USER;
const DB_PASSWORD = process.env.MONGODB_PASSWORD;

console.log("DB_USER:", DB_USER);
console.log("DB_PASSWORD:", DB_PASSWORD);

const uri = `mongodb+srv://${DB_USER}:${DB_PASSWORD}@suds-cluster.poxtvnp.mongodb.net/?appName=SUDs-Cluster`;
const mongoClient = new MongoClient(uri);

// MongoDB connection setup. Uses slack DB as default
async function connectDB(dbName = "slack") {
    try{
        await mongoClient.connect();
        const db = mongoClient.db(dbName);
        return db;
    } catch (error) {
        console.error("Database connection error:", error);
        throw error;
    }
}


// Main function to retrieve messages and insert into MongoDB
async function insertMessagesToDB(channelName) {
    try {
        const channelList = await getChannelList();
        const db = await connectDB();

        for (const channel of channelList) {
            const messages = await getConversationHistory(channel.id);
            
            //Skips channels that the bot is not a member of or have no messages
            if (!messages || messages.length === 0) {
                console.log(`Skipping #${channel.name} — Bot is not a member or no messages found.`);
                continue;
                }

            if (channel.name === channelName) {
                console.log(`Inserting messages from #${channel.name} into the database...`);
                const collection = db.collection(channel.name);
                await collection.insertMany(messages);
            }
        }
        console.log("All messages inserted into the database.");
    } catch (error) {
        console.error("Error inserting messages to DB:", error.message);
    }
}

module.exports = { insertMessagesToDB, connectDB };