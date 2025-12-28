import { Request, Response } from 'express';
export declare class CommentsController {
    createComment(req: Request, res: Response): Promise<void>;
    getPostComments(req: Request, res: Response): Promise<void>;
    deleteComment(req: Request, res: Response): Promise<void>;
}
export declare class ReactionsController {
    addReaction(req: Request, res: Response): Promise<void>;
    removeReaction(req: Request, res: Response): Promise<void>;
    getReactionUsers(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=commentsReactionsController.d.ts.map