const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { PythonShell } = require('python-shell');
const { spawnSync } = require('child_process');

const MODEL_RESULT_PREFIX = '__MODEL_RESULT__';
const REQUIREMENTS_PATH = path.resolve(__dirname, '../NLP_Model/actual/requirements.txt');
const VENV_DIR = path.resolve(__dirname, '../.python-venv');
let pythonDepsChecked = false;

function runCommand(command, args) {
    return spawnSync(command, args, {
        stdio: 'inherit'
    });
}

function buildBasePythonInvocation(pythonPath, isWindows) {
    if (isWindows && pythonPath === 'py') {
        return {
            command: pythonPath,
            prefixArgs: [process.env.PYTHON_WINDOWS_SELECTOR || '-3']
        };
    }

    return {
        command: pythonPath,
        prefixArgs: []
    };
}

function getVenvPythonPath(isWindows) {
    if (isWindows) {
        return path.join(VENV_DIR, 'Scripts', 'python.exe');
    }

    const preferred = path.join(VENV_DIR, 'bin', 'python3');
    if (fs.existsSync(preferred)) {
        return preferred;
    }
    return path.join(VENV_DIR, 'bin', 'python');
}

function ensureVirtualEnv(basePythonCommand, basePrefixArgs, isWindows) {
    const venvPythonPath = getVenvPythonPath(isWindows);
    if (fs.existsSync(venvPythonPath)) {
        return venvPythonPath;
    }

    console.log(`[runModel] Creating local Python virtual environment at ${VENV_DIR}`);
    const createVenv = runCommand(basePythonCommand, [...basePrefixArgs, '-m', 'venv', VENV_DIR]);

    if (createVenv.status !== 0) {
        throw new Error('Failed to create Python virtual environment for model execution');
    }

    return getVenvPythonPath(isWindows);
}

function installPythonDependencies(pythonPath) {
    console.log(`[runModel] Installing Python dependencies via ${pythonPath} -m pip install -r ${REQUIREMENTS_PATH}`);

    // Upgrade pip in the virtualenv first for compatibility.
    runCommand(pythonPath, ['-m', 'pip', 'install', '--upgrade', 'pip']);

    let result = runCommand(pythonPath, ['-m', 'pip', 'install', '-r', REQUIREMENTS_PATH]);

    if (result.status === 0) {
        return true;
    }

    // Some environments may need ensurepip within venv.
    console.warn('[runModel] pip install failed, attempting ensurepip bootstrap...');
    const ensurePip = runCommand(pythonPath, ['-m', 'ensurepip', '--upgrade']);

    if (ensurePip.status !== 0) {
        return false;
    }

    result = runCommand(pythonPath, ['-m', 'pip', 'install', '-r', REQUIREMENTS_PATH]);

    return result.status === 0;
}

function isMissingPythonModuleError(err) {
    const message = String(err?.message || '');
    const traceback = String(err?.traceback || '');
    return message.includes('ModuleNotFoundError') || traceback.includes('ModuleNotFoundError');
}

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
    const basePythonPath = configuredPythonPath || (isWindows ? 'py' : 'python3');
    const { command: basePythonCommand, prefixArgs: basePrefixArgs } = buildBasePythonInvocation(basePythonPath, isWindows);

    const venvPythonPath = ensureVirtualEnv(basePythonCommand, basePrefixArgs, isWindows);
    const pythonOptions = ['-u'];

    const scriptPath = path.resolve(__dirname, '../NLP_Model/actual');

    const pythonShellOptions = {
        pythonPath: venvPythonPath,
        pythonOptions,
        scriptPath,
        args
    };

    if (!pythonDepsChecked) {
        // Best effort bootstrap before first execution in this process.
        installPythonDependencies(venvPythonPath);
        pythonDepsChecked = true;
    }

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
        // Self-heal once if Python modules are missing at runtime.
        if (isMissingPythonModuleError(err)) {
            console.warn('[runModel] Detected missing Python module. Attempting dependency install + one retry...');
            const installed = installPythonDependencies(venvPythonPath);
            if (installed) {
                try {
                    const retryMessages = await PythonShell.run('model.py', pythonShellOptions);
                    const retryModelResult = parseModelResult(retryMessages);
                    console.log(`[runModel] Retry succeeded for database: ${dbName}`);
                    return {
                        success: true,
                        dbName: dbName,
                        message: `Model execution completed successfully for ${dbName} after dependency install retry`,
                        results: retryMessages,
                        modelResult: retryModelResult,
                        savedCount: retryModelResult && Number.isInteger(retryModelResult.saved_count)
                            ? retryModelResult.saved_count
                            : null,
                    };
                } catch (retryErr) {
                    console.error(`[runModel] Retry failed for database ${dbName}:`, retryErr);
                    return {
                        success: false,
                        dbName: dbName,
                        message: `Model execution failed for ${dbName} after dependency install retry`,
                        error: retryErr.message
                    };
                }
            }
        }

        console.error(`[runModel] Error executing model for database ${dbName}:`, err);
        return {
            success: false,
            dbName: dbName,
            message: `Model execution failed for ${dbName}`,
            error: err.message
        };
    }
}

async function runUserModel(databaseKey, userId) {
    const args = [databaseKey];

    if (userId) {
        args.push(`--userId=${userId}`);
    }

    const isWindows = process.platform === 'win32';
    const configuredPythonPath = process.env.PYTHON_PATH || process.env.PYTHON || '';
    const basePythonPath = configuredPythonPath || (isWindows ? 'py' : 'python3');
    const { command: basePythonCommand, prefixArgs: basePrefixArgs } = buildBasePythonInvocation(basePythonPath, isWindows);

    const venvPythonPath = ensureVirtualEnv(basePythonCommand, basePrefixArgs, isWindows);
    const pythonOptions = ['-u'];

    const scriptPath = path.resolve(__dirname, '../NLP_Model/actual');

    const pythonShellOptions = {
        pythonPath: venvPythonPath,
        pythonOptions,
        scriptPath,
        args
    };

    if (!pythonDepsChecked) {
        // Best effort bootstrap before first execution in this process.
        installPythonDependencies(venvPythonPath);
        pythonDepsChecked = true;
    }

    try {
        const messages = await PythonShell.run('user_model.py', pythonShellOptions);
        const modelResult = parseModelResult(messages);
        // messages is an array of messages collected during execution
        console.log(`[runUserModel] Successfully executed user model for database: ${databaseKey}`);
        console.log(`[runUserModel] Results: %j`, messages);
        
        return {
            success: true,
            databaseKey: databaseKey,
            message: `User model execution completed successfully for ${databaseKey}`,
            results: messages,
            modelResult,
        };
    } catch (err) {
        // Self-heal once if Python modules are missing at runtime.
        if (isMissingPythonModuleError(err)) {
            console.warn('[runUserModel] Detected missing Python module. Attempting dependency install + one retry...');
            const installed = installPythonDependencies(venvPythonPath);
            if (installed) {
                try {
                    const retryMessages = await PythonShell.run('user_model.py', pythonShellOptions);
                    const retryModelResult = parseModelResult(retryMessages);
                    console.log(`[runUserModel] Retry succeeded for database: ${databaseKey}`);
                    return {
                        success: true,
                        databaseKey: databaseKey,
                        message: `User model execution completed successfully for ${databaseKey} after dependency install retry`,
                        results: retryMessages,
                        modelResult: retryModelResult,
                    };
                } catch (retryErr) {
                    console.error(`[runUserModel] Retry failed for database ${databaseKey}:`, retryErr);
                    return {
                        success: false,
                        databaseKey: databaseKey,
                        message: `User model execution failed for ${databaseKey} after dependency install retry`,
                        error: retryErr.message
                    };
                }
            }
        }

        console.error(`[runUserModel] Error executing user model for database ${databaseKey}:`, err);
        return {
            success: false,
            databaseKey: databaseKey,
            message: `User model execution failed for ${databaseKey}`,
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

module.exports = { runModel, runUserModel, postSummaries };
