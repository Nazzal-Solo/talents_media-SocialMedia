import { AutomationService } from './automationService';
import { ApplyService } from './applyService';
import { JobMatchingService } from './jobMatchingService';
import { SourceGeneratorService } from './sourceGeneratorService';
import { logger } from '../middlewares';

export class Scheduler {
  private automationService: AutomationService;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    const applyService = new ApplyService();
    const jobMatchingService = new JobMatchingService(applyService);
    const sourceGenerator = new SourceGeneratorService();
    this.automationService = new AutomationService(
      applyService,
      jobMatchingService,
      sourceGenerator
    );
  }

  /**
   * Start the scheduler
   * Runs auto-apply daily at a specified time
   */
  start(): void {
    logger.info('Starting Apply system scheduler');

    // Run immediately on start (for testing)
    // In production, you might want to skip this
    // this.runDaily();

    // Run every hour to check user preferred times
    // This allows users to set their own preferred run times
    const now = new Date();
    const nextHour = new Date();
    nextHour.setHours(now.getHours() + 1, 0, 0, 0);
    
    const msUntilNextHour = nextHour.getTime() - now.getTime();
    logger.info(`Next auto-apply check scheduled for: ${nextHour.toISOString()}`);

    // Schedule first run
    setTimeout(() => {
      this.runDaily();
      // Then run every hour to check user preferred times
      this.intervalId = setInterval(() => {
        this.runDaily();
      }, 60 * 60 * 1000); // 1 hour
    }, msUntilNextHour);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Scheduler stopped');
    }
  }

  /**
   * Run daily automation
   */
  private async runDaily(): Promise<void> {
    try {
      logger.info('Running daily auto-apply automation');
      await this.automationService.runAutoApplyForAllUsers();
      logger.info('Daily auto-apply automation completed');
    } catch (error) {
      logger.error('Error in daily auto-apply automation:', error);
    }
  }

  /**
   * Manual trigger (for testing/admin)
   */
  async triggerNow(): Promise<void> {
    logger.info('Manual trigger of auto-apply automation');
    await this.automationService.runAutoApplyForAllUsers();
  }
}

