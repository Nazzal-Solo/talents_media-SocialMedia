#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const seed_1 = require("../models/seed");
async function main() {
    try {
        await (0, seed_1.seedDatabase)();
        process.exit(0);
    }
    catch (error) {
        console.error('Seed script failed:', error);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=seed.js.map