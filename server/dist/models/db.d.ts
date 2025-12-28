import { Pool } from 'pg';
import 'dotenv/config';
export declare const pool: Pool;
export declare const query: <T = any>(text: string, params?: any[], timeoutMs?: number) => Promise<{
    rows: T[];
    rowCount: number;
}>;
export declare const testConnection: () => Promise<void>;
//# sourceMappingURL=db.d.ts.map