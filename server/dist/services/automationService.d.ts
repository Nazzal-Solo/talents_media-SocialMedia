import { ApplyService } from './applyService';
import { JobMatchingService } from './jobMatchingService';
export declare class AutomationService {
    private applyService;
    private jobMatchingService;
    constructor(applyService: ApplyService, jobMatchingService: JobMatchingService);
    runAutoApply(userId: string): Promise<void>;
    private applyToJob;
    runAutoApplyForAllUsers(): Promise<void>;
}
//# sourceMappingURL=automationService.d.ts.map