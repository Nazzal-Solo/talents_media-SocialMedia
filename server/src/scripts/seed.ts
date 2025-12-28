#!/usr/bin/env ts-node

import { seedDatabase } from '../models/seed';

async function main() {
  try {
    await seedDatabase();
    process.exit(0);
  } catch (error) {
    console.error('Seed script failed:', error);
    process.exit(1);
  }
}

main();
