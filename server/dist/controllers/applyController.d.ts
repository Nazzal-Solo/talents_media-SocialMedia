import { Request, Response } from 'express';
export declare class ApplyController {
    getDashboard(req: Request, res: Response): Promise<void>;
    getProfile(req: Request, res: Response): Promise<void>;
    updateProfile(req: Request, res: Response): Promise<void>;
    getPlans(req: Request, res: Response): Promise<void>;
    getUserPlan(req: Request, res: Response): Promise<void>;
    setUserPlan(req: Request, res: Response): Promise<void>;
    getJobs(req: Request, res: Response): Promise<void>;
    getJob(req: Request, res: Response): Promise<void>;
    getApplications(req: Request, res: Response): Promise<void>;
    getActivityLogs(req: Request, res: Response): Promise<void>;
    toggleAutoApply(req: Request, res: Response): Promise<void>;
    getSuggestions(req: Request, res: Response): Promise<void>;
    searchLocations(req: Request, res: Response): Promise<void>;
    reverseGeocode(req: Request, res: Response): Promise<void>;
    uploadCV(req: Request, res: Response): Promise<void>;
    deleteCV(req: Request, res: Response): Promise<void>;
}
export declare const cvUploadMiddleware: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
//# sourceMappingURL=applyController.d.ts.map