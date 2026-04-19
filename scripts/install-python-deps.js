const { spawnSync } = require('child_process');
const path = require('path');

const requirementsPath = path.resolve(__dirname, '../NLP_Model/actual/requirements.txt');

function run(command, args) {
  return spawnSync(command, args, { stdio: 'inherit', shell: true });
}

function installWithPython(pythonCmd) {
  console.log(`[python-deps] Trying ${pythonCmd} -m pip install -r ${requirementsPath}`);
  const result = run(pythonCmd, ['-m', 'pip', 'install', '-r', requirementsPath]);
  return result.status === 0;
}

function main() {
  const preferred = [];
  if (process.env.PYTHON_PATH) preferred.push(process.env.PYTHON_PATH);
  if (process.env.PYTHON) preferred.push(process.env.PYTHON);

  const candidates = [...new Set([...preferred, 'python3', 'python', 'py'])];

  for (const cmd of candidates) {
    if (installWithPython(cmd)) {
      console.log('[python-deps] ✅ Python dependencies installed successfully.');
      return;
    }
  }

  const message = '[python-deps] ⚠️ Could not install Python dependencies automatically. Ensure Python + pip are available and install NLP_Model/actual/requirements.txt manually.';

  if (String(process.env.REQUIRE_PYTHON_DEPS || '').toLowerCase() === 'true') {
    console.error(`${message} Failing build because REQUIRE_PYTHON_DEPS=true.`);
    process.exit(1);
  }

  console.warn(message);
}

main();
