const path = require('path');
const mongoose = require('mongoose');
const { PythonShell } = require('python-shell');

const MODEL_RESULT_PREFIX = '__MODEL_RESULT__';

function parseModelResult(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
        return null;
    }

    for (let i = messages.length - 1; i >= 0; i -= 1) {
        const line = messages[i];
        if (typeof line !== 'string' || !line.startsWith(MODEL_RESULT_PREFIX)) {
            continue;
        }

        const payload = line.slice(MODEL_RESULT_PREFIX.length);
        try {
            return JSON.parse(payload);
        } catch (parseErr) {
            console.warn('[runModel] Failed to parse structured model result:', parseErr.message);
            return null;
        }
    }

    return null;
}


async function runModel(dbName, runOptions = {}) {
    const args = [dbName];

    if (runOptions.weekStart) {
        args.push(`--week-start=${runOptions.weekStart}`);
    } else if (Number.isInteger(runOptions.week)) {
        args.push(`--week=${runOptions.week}`);
    }

    const isWindows = process.platform === 'win32';
    const configuredPythonPath = process.env.PYTHON_PATH || process.env.PYTHON || '';
    const pythonPath = configuredPythonPath || (isWindows ? 'py' : 'python3');
    const pythonOptions = ['-u'];

    // Windows can use the Python launcher (py) with a version selector.
    // Non-Windows environments (e.g., Render Linux) should invoke python directly.
    if (isWindows && pythonPath === 'py') {
        pythonOptions.unshift(process.env.PYTHON_WINDOWS_SELECTOR || '-3');
    }

    const scriptPath = path.resolve(__dirname, '../NLP_Model/actual');

    const pythonShellOptions = {
        pythonPath,
        pythonOptions,
        scriptPath,
        args
    };

    try {
        const messages = await PythonShell.run('model.py', pythonShellOptions);
        const modelResult = parseModelResult(messages);
        // messages is an array of messages collected during execution
        console.log(`[runModel] Successfully executed model for database: ${dbName}`);
        console.log(`[runModel] Results: %j`, messages);
        
        return {
            success: true,
            dbName: dbName,
            message: `Model execution completed successfully for ${dbName}`,
            results: messages,
            modelResult,
            savedCount: modelResult && Number.isInteger(modelResult.saved_count)
                ? modelResult.saved_count
                : null,
        };
    } catch (err) {
        console.error(`[runModel] Error executing model for database ${dbName}:`, err);
        return {
            success: false,
            dbName: dbName,
            message: `Model execution failed for ${dbName}`,
            error: err.message
        };
    }
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
