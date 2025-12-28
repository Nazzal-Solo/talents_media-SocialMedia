"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveGoogleCallbackUrl = resolveGoogleCallbackUrl;
function resolveGoogleCallbackUrl(env = process.env) {
    const PORT = env.PORT?.trim() || '4000';
    const API_BASE = (env.API_URL?.trim() || `http://localhost:${PORT}`).replace(/\/+$/, '');
    const PATH_RAW = env.GOOGLE_CALLBACK_PATH?.trim() || '/api/auth/google/callback';
    const PATH = PATH_RAW.startsWith('/') ? PATH_RAW : `/${PATH_RAW}`;
    return `${API_BASE}${PATH}`;
}
//# sourceMappingURL=oauth.js.map