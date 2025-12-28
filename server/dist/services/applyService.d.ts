export interface ApplyProfile {
    id: string;
    user_id: string;
    skills: string[];
    job_titles: string[];
    locations: string[];
    salary_min?: number;
    salary_max?: number;
    salary_currency?: string;
    include_keywords: string[];
    exclude_keywords: string[];
    cv_url?: string;
    portfolio_urls: string[];
    preferences: Record<string, any>;
    auto_apply_enabled: boolean;
    created_at: string;
    updated_at: string;
}
export interface ApplyJob {
    id: string;
    external_id?: string;
    source: string;
    title: string;
    company?: string;
    location?: string;
    description?: string;
    salary_min?: number;
    salary_max?: number;
    salary_currency?: string;
    job_url: string;
    application_url?: string;
    application_method: string;
    posted_date?: string;
    expires_date?: string;
    raw_data?: Record<string, any>;
    created_at: string;
    updated_at: string;
}
export interface ApplyApplication {
    id: string;
    user_id: string;
    job_id: string;
    status: 'applied' | 'failed' | 'skipped' | 'pending';
    match_score?: number;
    match_reason?: string;
    application_method?: string;
    application_details?: Record<string, any>;
    applied_at: string;
    created_at: string;
}
export interface ApplyPlan {
    id: string;
    name: string;
    display_name: string;
    daily_apply_limit: number;
    price_monthly: number;
    features: Record<string, any>;
    is_active: boolean;
    created_at: string;
}
export interface UserPlan {
    id: string;
    user_id: string;
    plan_id: string;
    status: 'active' | 'cancelled' | 'expired';
    started_at: string;
    expires_at?: string;
    created_at: string;
}
export interface ActivityLog {
    id: string;
    user_id: string;
    job_id?: string;
    application_id?: string;
    action: string;
    details?: Record<string, any>;
    created_at: string;
}
export declare class ApplyService {
    getProfile(userId: string): Promise<ApplyProfile | null>;
    createOrUpdateProfile(userId: string, data: Partial<ApplyProfile>): Promise<ApplyProfile>;
    getPlans(): Promise<ApplyPlan[]>;
    getPlanByName(name: string): Promise<ApplyPlan | null>;
    getUserPlan(userId: string): Promise<UserPlan | null>;
    setUserPlan(userId: string, planId: string): Promise<UserPlan>;
    getJobs(filters?: {
        source?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        jobs: ApplyJob[];
        total: number;
    }>;
    getJobById(jobId: string): Promise<ApplyJob | null>;
    createJob(job: Partial<ApplyJob>): Promise<ApplyJob>;
    getApplications(userId: string, filters?: {
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        applications: ApplyApplication[];
        total: number;
    }>;
    createApplication(userId: string, jobId: string, data: {
        status?: string;
        match_score?: number;
        match_reason?: string;
        application_method?: string;
        application_details?: Record<string, any>;
    }): Promise<ApplyApplication>;
    getActivityLogs(userId: string, limit?: number, offset?: number): Promise<{
        logs: ActivityLog[];
        total: number;
    }>;
    createActivityLog(userId: string, action: string, details?: {
        job_id?: string;
        application_id?: string;
        [key: string]: any;
    }): Promise<ActivityLog>;
    getDailyQuota(userId: string, date: Date): Promise<number>;
    incrementDailyQuota(userId: string, date: Date): Promise<void>;
    getDailyLimit(userId: string): Promise<number>;
}
//# sourceMappingURL=applyService.d.ts.map