export type SuggestionType = 'skill' | 'job_title' | 'keyword' | 'location';
export interface Suggestion {
    value: string;
    usage_count?: number;
    is_user_history?: boolean;
}
export declare class ApplySuggestionsService {
    private seedData;
    getSuggestions(type: SuggestionType, userId: string, query?: string, limit?: number): Promise<Suggestion[]>;
    private getUserHistory;
    private getPopularSuggestions;
    recordUsage(type: SuggestionType, value: string): Promise<void>;
    recordUsages(type: SuggestionType, values: string[]): Promise<void>;
}
//# sourceMappingURL=applySuggestionsService.d.ts.map