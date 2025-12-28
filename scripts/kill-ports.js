#!/usr/bin/env node

/**
 * Kill processes using ports 4002 (server) and 5173 (Vite)
 * This script helps prevent "port already in use" errors
 */

const { execSync } = require("child_process");
const os = require("os");

const ports = [4002, 5173];
const isWindows = os.platform() === "win32";

function killPort(port) {
  try {
    if (isWindows) {
      // Windows: Find PID using netstat and kill it
      const result = execSync(
        `netstat -ano | findstr :${port} | findstr LISTENING`,
        { encoding: "utf-8" }
      );
      const lines = result
        .trim()
        .split("\n")
        .filter((line) => line.includes("LISTENING"));

      if (lines.length > 0) {
        const pids = new Set();
        lines.forEach((line) => {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && !isNaN(pid)) {
            pids.add(pid);
          }
        });

        pids.forEach((pid) => {
          try {
            execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
            console.log(`✅ Killed process ${pid} on port ${port}`);
          } catch (err) {
            // Process might already be gone
          }
        });
      } else {
        console.log(`ℹ️  Port ${port} is free`);
      }
    } else {
      // Unix/Linux/Mac: Use lsof
      try {
        const pid = execSync(`lsof -ti:${port}`, { encoding: "utf-8" }).trim();
        if (pid) {
          execSync(`kill -9 ${pid}`, { stdio: "ignore" });
          console.log(`✅ Killed process ${pid} on port ${port}`);
        }
      } catch (err) {
        console.log(`ℹ️  Port ${port} is free`);
      }
    }
  } catch (err) {
    // Port is likely free
    console.log(`ℹ️  Port ${port} is free`);
  }
}

console.log("🔍 Checking for processes on ports 4002 and 5173...\n");

ports.forEach((port) => {
  killPort(port);
});

console.log("\n✨ Port check complete. You can now run `npm run dev`\n");
