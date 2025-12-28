import { ApplyService, ApplyProfile, ApplyJob } from './applyService';
export interface MatchResult {
    job: ApplyJob;
    score: number;
    reasons: string[];
}
export declare class JobMatchingService {
    private applyService;
    constructor(applyService: ApplyService);
    matchJobs(profile: ApplyProfile, jobs: ApplyJob[]): Promise<MatchResult[]>;
    private matchJob;
    findJobs(limit?: number): Promise<ApplyJob[]>;
    fetchJobsFromSource(source: string): Promise<ApplyJob[]>;
}
//# sourceMappingURL=jobMatchingService.d.ts.map