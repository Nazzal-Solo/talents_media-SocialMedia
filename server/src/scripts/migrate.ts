#!/usr/bin/env ts-node

import { runMigrations } from '../models/migrations';

async function main() {
  try {
    await runMigrations();
    process.exit(0);
  } catch (error) {
    console.error('Migration script failed:', error);
    process.exit(1);
  }
}

main();
