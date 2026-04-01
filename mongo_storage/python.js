const mongoose = require('mongoose');
const { PythonShell } = require('python-shell');


async function runModel(dbName) {
    let options = {
    pythonPath: 'py',
    pythonOptions: ['-3.14','-u'],
    scriptPath: '../NLP_Model/actual',
    args: [dbName]
    };

    PythonShell.run('model.py', options).then(messages => {
    // messages is an array of messages collected during execution
    console.log('results: %j', messages);
    }).catch(err => {
      console.error(err);
    });
}

async function postSummaries(channel_id, channel_name) {
    const client = mongoose.connection.client;

    await slack.chat.postMessage({
        channel: channel_id,
        text: `*📋 Weekly Summaries for #${channel_name}*`
    });

    // Post both current and past week
    const weeks = [
        { suffix: 'cw', label: 'Current Week' },
        { suffix: 'pw', label: 'Past Week' }
    ];

    for (const week of weeks) {
        const db_name = `${channel_name}_${week.suffix}`;
        const db = client.db(db_name);

        try {
            const collections = await db.listCollections().toArray();

            if (collections.length === 0) {
                await slack.chat.postMessage({
                    channel: channel_id,
                    text: `No summaries found for *${week.label}*.`
                });
                continue;
            }

            // Post week header
            await slack.chat.postMessage({
                channel: channel_id,
                text: `*🗓️ ${week.label}*`
            });

            // Each collection is a day
            for (const col of collections) {
                const day = col.name;
                const docs = await db.collection(day).find({}).toArray();

                if (docs.length === 0) continue;

                // Post day header
                await slack.chat.postMessage({
                    channel: channel_id,
                    text: `*📅 ${day}*`
                });

                // Each document is a user summary
                for (const doc of docs) {
                    if (!doc.sum_text || doc.sum_text === '()') continue;

                    await slack.chat.postMessage({
                        channel: channel_id,
                        text: `*User:* ${doc.user}\n*Summary:* ${doc.sum_text}`
                    });
                }
            }

        } catch(err) {
            console.error(`No database found for ${db_name}`, err);
            await slack.chat.postMessage({
                channel: channel_id,
                text: `No summaries found for *${week.label}* in *#${channel_name}*.`
            });
        }
    }
}

module.exports = { runModel, postSummaries };
