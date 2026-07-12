import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Serve over HTTPS so the backend's Secure session cookie can be used.
const certDir = path.resolve(__dirname, './.certs');
const https =
    fs.existsSync(path.join(certDir, 'key.pem')) && fs.existsSync(path.join(certDir, 'cert.pem'))
        ? {
              key: fs.readFileSync(path.join(certDir, 'key.pem')),
              cert: fs.readFileSync(path.join(certDir, 'cert.pem')),
          }
        : undefined;

// The workspace runs on a different origin than the backend, so the browser
// won't send the backend's Secure/host-only session cookie. Instead, the dev
// proxy authenticates itself once at startup (using .auth.local.json — a
// gitignored file) and injects the resulting session cookie into every proxied
// request. This way the workspace "just works" regardless of browser state.
const authFile = path.resolve(__dirname, './.auth.local.json');
const authCfg = fs.existsSync(authFile) ? JSON.parse(fs.readFileSync(authFile, 'utf-8')) : null;
const BACKEND = authCfg?.backend ?? 'https://localhost:8443';

async function login(): Promise<string | null> {
    if (!authCfg?.mail || !authCfg?.password) return null;
    // Accept the backend's self-signed cert for this dev process only.
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    try {
        const res = await fetch(`${BACKEND}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mail: authCfg.mail, password: authCfg.password }),
        });
        if (!res.ok) {
            console.warn(`[ws-auth] login failed: HTTP ${res.status}`);
            return null;
        }
        const cookies = (res.headers as any).getSetCookie?.() ?? [];
        const authCookie = cookies.find((c: string) => c.startsWith('auth='));
        if (!authCookie) {
            console.warn('[ws-auth] login ok but no auth cookie returned');
            return null;
        }
        const value = authCookie.split(';')[0]; // "auth=<token>"
        console.log('[ws-auth] authenticated to backend; proxy will inject session');
        return value;
    } catch (e) {
        console.warn(`[ws-auth] login error: ${e instanceof Error ? e.message : String(e)}`);
        return null;
    }
}

export default defineConfig(async () => {
    const sessionCookie = await login();

    // Always inject the proxy's session cookie, replacing any browser auth=
    // cookie. Browsers often carry a stale Secure cookie for localhost that
    // would otherwise win and cause AuthRequired.
    const injectAuth = (headers: Record<string, any>) => {
        if (!sessionCookie) return;
        const existing = typeof headers.cookie === 'string' ? headers.cookie : '';
        const withoutAuth = existing
            .split(';')
            .map((c: string) => c.trim())
            .filter((c: string) => c && !c.startsWith('auth='))
            .join('; ');
        headers.cookie = withoutAuth ? `${withoutAuth}; ${sessionCookie}` : sessionCookie;
    };

    return {
        plugins: [react(), tailwindcss()],
        resolve: {
            alias: { '@': path.resolve(__dirname, './src') },
        },
        server: {
            port: 5174,
            https,
            proxy: {
                '/api': {
                    target: BACKEND,
                    secure: false,
                    changeOrigin: true,
                    ws: true,
                    configure: (proxy: any) => {
                        // Backend CORS_ORIGINS only allows the API origin
                        // (https://localhost:8443). Browser requests from the
                        // workspace send Origin: https://localhost:5174, which
                        // gin CORS rejects with 403. Rewrite to the backend
                        // origin so proxied requests look same-origin.
                        const rewriteOrigin = (proxyReq: any) => {
                            proxyReq.setHeader('origin', BACKEND);
                            proxyReq.setHeader('referer', `${BACKEND}/`);
                            const c = proxyReq.getHeader('cookie') as string | undefined;
                            const h: Record<string, any> = { cookie: c };
                            injectAuth(h);
                            if (h.cookie) proxyReq.setHeader('cookie', h.cookie);
                        };
                        proxy.on('proxyReq', rewriteOrigin);
                        proxy.on('proxyReqWs', rewriteOrigin);
                    },
                },
            },
        },
    };
});
