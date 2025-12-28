"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Scheduler = void 0;
const automationService_1 = require("./automationService");
const applyService_1 = require("./applyService");
const jobMatchingService_1 = require("./jobMatchingService");
const middlewares_1 = require("../middlewares");
class Scheduler {
    constructor() {
        this.intervalId = null;
        const applyService = new applyService_1.ApplyService();
        const jobMatchingService = new jobMatchingService_1.JobMatchingService(applyService);
        this.automationService = new automationService_1.AutomationService(applyService, jobMatchingService);
    }
    start() {
        middlewares_1.logger.info('Starting Apply system scheduler');
        const now = new Date();
        const nextRun = new Date();
        nextRun.setHours(2, 0, 0, 0);
        if (now.getTime() >= nextRun.getTime()) {
            nextRun.setDate(nextRun.getDate() + 1);
        }
        const msUntilNextRun = nextRun.getTime() - now.getTime();
        middlewares_1.logger.info(`Next auto-apply run scheduled for: ${nextRun.toISOString()}`);
        setTimeout(() => {
            this.runDaily();
            this.intervalId = setInterval(() => {
                this.runDaily();
            }, 24 * 60 * 60 * 1000);
        }, msUntilNextRun);
    }
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            middlewares_1.logger.info('Scheduler stopped');
        }
    }
    async runDaily() {
        try {
            middlewares_1.logger.info('Running daily auto-apply automation');
            await this.automationService.runAutoApplyForAllUsers();
            middlewares_1.logger.info('Daily auto-apply automation completed');
        }
        catch (error) {
            middlewares_1.logger.error('Error in daily auto-apply automation:', error);
        }
    }
    async triggerNow() {
        middlewares_1.logger.info('Manual trigger of auto-apply automation');
        await this.automationService.runAutoApplyForAllUsers();
    }
}
exports.Scheduler = Scheduler;
//# sourceMappingURL=scheduler.js.map