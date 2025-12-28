import { Request, Response } from 'express';
export declare class PostsController {
    createPost(req: Request, res: Response): Promise<void>;
    getFeed(req: Request, res: Response): Promise<void>;
    getExplore(req: Request, res: Response): Promise<void>;
    getPost(req: Request, res: Response): Promise<void>;
    updatePost(req: Request, res: Response): Promise<void>;
    deletePost(req: Request, res: Response): Promise<void>;
    getUserPosts(req: Request, res: Response): Promise<void>;
    getTrendingHashtags(req: Request, res: Response): Promise<void>;
    hidePost(req: Request, res: Response): Promise<void>;
    reportPost(req: Request, res: Response): Promise<void>;
    markNotInterested(req: Request, res: Response): Promise<void>;
    searchPosts(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=postsController.d.ts.map