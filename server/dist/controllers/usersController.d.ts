import { Request, Response } from 'express';
export declare class UsersController {
    getMe(req: Request, res: Response): Promise<void>;
    updateProfile(req: Request, res: Response): Promise<void>;
    getUserProfile(req: Request, res: Response): Promise<void>;
    followUser(req: Request, res: Response): Promise<void>;
    unfollowUser(req: Request, res: Response): Promise<void>;
    getFollowers(req: Request, res: Response): Promise<void>;
    getFollowing(req: Request, res: Response): Promise<void>;
    searchUsers(req: Request, res: Response): Promise<void>;
    getAllUsers(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=usersController.d.ts.map