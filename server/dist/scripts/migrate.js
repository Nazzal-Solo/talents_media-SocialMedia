#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const migrations_1 = require("../models/migrations");
async function main() {
    try {
        await (0, migrations_1.runMigrations)();
        process.exit(0);
    }
    catch (error) {
        console.error('Migration script failed:', error);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=migrate.js.map