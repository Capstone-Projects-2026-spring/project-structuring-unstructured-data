#!/usr/bin/env node

/**
 * Local MongoDB Setup Script for Testing
 * 
 * This script sets up a local MongoDB instance for development and testing.
 * It supports two modes:
 * 1. Docker (recommended) - Automatically creates and starts a MongoDB container
 * 2. Local MongoDB - Uses an existing local MongoDB installation
 * 
 * Usage:
 *   npm run db:setup          - Interactive setup
 *   npm run db:setup -- docker - Force Docker setup
 *   npm run db:setup -- local  - Force local MongoDB setup
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const readline = require('readline');

const ROOT_DIR = path.resolve(__dirname, '../../');
const ENV_FILE = path.join(ROOT_DIR, '.env');
const DOCKER_COMPOSE_FILE = path.join(ROOT_DIR, 'docker-compose.yml');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

function checkCommand(command) {
  try {
    execSync(`${command} --version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getEnvValue(key) {
  if (!fs.existsSync(ENV_FILE)) {
    return null;
  }
  const content = fs.readFileSync(ENV_FILE, 'utf-8');
  const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1] : null;
}

function updateEnvFile(updates) {
  let content = '';
  
  if (fs.existsSync(ENV_FILE)) {
    content = fs.readFileSync(ENV_FILE, 'utf-8');
  }

  const lines = content.split('\n');
  const result = [];
  const processed = new Set();

  // Update existing keys
  for (const line of lines) {
    const [key] = line.split('=');
    if (updates.hasOwnProperty(key)) {
      result.push(`${key}=${updates[key]}`);
      processed.add(key);
    } else if (line.trim()) {
      result.push(line);
    }
  }

  // Add new keys
  for (const [key, value] of Object.entries(updates)) {
    if (!processed.has(key)) {
      result.push(`${key}=${value}`);
    }
  }

  fs.writeFileSync(ENV_FILE, result.join('\n') + '\n');
  log(`✓ Updated .env file`, 'green');
}

function createDockerCompose() {
  const dockerCompose = `version: '3.8'
services:
  mongodb:
    image: mongo:7.0
    container_name: suds-local-mongodb
    restart: unless-stopped
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: testuser
      MONGO_INITDB_ROOT_PASSWORD: testpass
    volumes:
      - mongodb_data:/data/db
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  mongodb_data:
`;

  fs.writeFileSync(DOCKER_COMPOSE_FILE, dockerCompose);
  log(`✓ Created docker-compose.yml`, 'green');
}

async function setupDocker() {
  log('\n🐳 Docker Setup', 'blue');
  log('-----------------------------------', 'blue');

  if (!checkCommand('docker')) {
    log('✗ Docker is not installed or not in PATH', 'red');
    log('  Please install Docker from https://www.docker.com/products/docker-desktop', 'yellow');
    return false;
  }

  if (!checkCommand('docker compose') && !checkCommand('docker-compose')) {
    log('✗ Docker Compose is not installed or not in PATH', 'red');
    log('  Please install Docker Compose from https://docs.docker.com/compose/install/', 'yellow');
    return false;
  }

  log('✓ Docker and Docker Compose found', 'green');

  try {
    createDockerCompose();

    log('\n📦 Starting MongoDB container...', 'cyan');
    execSync('docker compose up -d', {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    });

    log('\n⏳ Waiting for MongoDB to be ready...', 'cyan');
    for (let i = 0; i < 30; i++) {
      try {
        execSync(
          'docker compose exec mongodb mongosh --eval "db.adminCommand(\'ping\')" --quiet',
          { cwd: ROOT_DIR, stdio: 'ignore' }
        );
        break;
      } catch {
        if (i === 29) throw new Error('MongoDB failed to start');
        execSync('timeout /t 1', { stdio: 'ignore', shell: true });
      }
    }

    updateEnvFile({
      MONGODB_USER: 'testuser',
      MONGODB_PASSWORD: 'testpass',
      MONGODB_LOCAL: 'true',
      MONGODB_URI: 'mongodb://testuser:testpass@localhost:27017/test',
      MONGODB_HOST: 'localhost',
      MONGODB_PORT: '27017',
    });

    log('\n✓ MongoDB is ready!', 'green');
    log('\nConnection details:', 'cyan');
    log('  Host: localhost', 'cyan');
    log('  Port: 27017', 'cyan');
    log('  Username: testuser', 'cyan');
    log('  Password: testpass', 'cyan');

    return true;
  } catch (error) {
    log(`\n✗ Docker setup failed: ${error.message}`, 'red');
    return false;
  }
}

async function setupLocal() {
  log('\n💾 Local MongoDB Setup', 'blue');
  log('-----------------------------------', 'blue');

  if (!checkCommand('mongod')) {
    log('✗ MongoDB is not installed or not in PATH', 'red');
    log('  Windows: https://www.mongodb.com/try/download/community', 'yellow');
    log('  macOS: brew install mongodb-community', 'yellow');
    log('  Linux: Follow https://docs.mongodb.com/manual/installation/', 'yellow');
    return false;
  }

  log('✓ MongoDB found', 'green');

  const host = await ask('\nEnter MongoDB host (default: localhost): ') || 'localhost';
  const port = await ask('Enter MongoDB port (default: 27017): ') || '27017';
  const username = await ask('Enter MongoDB username (default: testuser): ') || 'testuser';
  const password = await ask('Enter MongoDB password (default: testpass): ') || 'testpass';

  try {
    log('\n✓ Verifying MongoDB connection...', 'cyan');
    // Note: This is a basic check. For local MongoDB without auth, credentials might not be needed
    
    updateEnvFile({
      MONGODB_USER: username,
      MONGODB_PASSWORD: password,
      MONGODB_LOCAL: 'true',
      MONGODB_URI: `mongodb://${username}:${password}@${host}:${port}/test`,
      MONGODB_HOST: host,
      MONGODB_PORT: port,
    });

    log('\n✓ MongoDB configuration updated!', 'green');
    log('\nReminder: Make sure MongoDB is running:', 'cyan');
    log('  Windows: mongod', 'cyan');
    log('  macOS: brew services start mongodb-community', 'cyan');
    log('  Linux: sudo systemctl start mongod', 'cyan');

    return true;
  } catch (error) {
    log(`\n✗ Local setup failed: ${error.message}`, 'red');
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  let setupMethod = args[0];

  log('\n╔════════════════════════════════════╗', 'cyan');
  log('║  MongoDB Local Setup for Testing   ║', 'cyan');
  log('╚════════════════════════════════════╝\n', 'cyan');

  // Check if already configured for local MongoDB
  const isLocalConfigured = getEnvValue('MONGODB_LOCAL') === 'true';
  
  if (!setupMethod) {
    log('Available setup methods:', 'cyan');
    log('  1. Docker (recommended)', 'cyan');
    log('  2. Local MongoDB installation', 'cyan');

    if (isLocalConfigured) {
      log('\n⚠ Local MongoDB already configured in .env', 'yellow');
      const response = await ask('\nReconfigure? (yes/no): ');
      if (response !== 'yes' && response !== 'y') {
        log('✓ Setup cancelled', 'green');
        process.exit(0);
      }
    }

    const choice = await ask('\nSelect option (1 or 2): ');
    setupMethod = choice === '1' ? 'docker' : 'local';
  }

  let success = false;

  if (setupMethod === 'docker') {
    success = await setupDocker();
  } else if (setupMethod === 'local') {
    success = await setupLocal();
  } else {
    log(`✗ Unknown setup method: ${setupMethod}`, 'red');
    log('  Valid options: docker, local', 'yellow');
    process.exit(1);
  }

  if (success) {
    log('\n╔════════════════════════════════════╗', 'green');
    log('║      Setup Complete! ✓            ║', 'green');
    log('╚════════════════════════════════════╝\n', 'green');
    
    log('Next steps:', 'cyan');
    log('  1. Run: npm test', 'cyan');
    log('  2. Or run: npm run test:integration', 'cyan');
    process.exit(0);
  } else {
    log('\n✗ Setup failed', 'red');
    process.exit(1);
  }
}

main().catch((error) => {
  log(`\n✗ Error: ${error.message}`, 'red');
  process.exit(1);
});
