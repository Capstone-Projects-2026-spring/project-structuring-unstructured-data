#!/usr/bin/env node

/**
 * Database Stop Script
 * 
 * Stops the local MongoDB Docker container if it's running.
 * This is a convenience wrapper around docker compose down.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT_DIR = path.resolve(__dirname, '../../');
const DOCKER_COMPOSE_FILE = path.join(ROOT_DIR, 'docker-compose.yml');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function main() {
  // Check if docker-compose.yml exists
  if (!fs.existsSync(DOCKER_COMPOSE_FILE)) {
    log('⚠ docker-compose.yml not found. No Docker MongoDB instance to stop.', 'yellow');
    process.exit(0);
  }

  try {
    log('🛑 Stopping MongoDB container...', 'cyan');
    execSync('docker compose down', {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    });
    log('✓ MongoDB stopped', 'green');
  } catch (error) {
    log(`⚠ Could not stop MongoDB: ${error.message}`, 'yellow');
    log('   This is normal if the container is not running.', 'yellow');
    process.exit(0);
  }
}

main();
