import { Loader2 } from 'lucide-react';
import { useLocation, useSearchParams } from 'react-router-dom';

import LoginForm from '@/features/authentication/login-form';
import { getSafeReturnUrl } from '@/lib/utils/auth';
import { useUser } from '@/providers/user-provider';

const LeftPanel = () => (
    <div className="relative hidden h-full overflow-hidden lg:flex lg:flex-col lg:items-center lg:justify-center"
        style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #4f46e5 50%, #7c3aed 100%)' }}>
        {/* Dot pattern */}
        <div
            className="absolute inset-0 opacity-20"
            style={{
                backgroundImage: 'radial-gradient(circle, white 1.5px, transparent 1.5px)',
                backgroundSize: '28px 28px',
            }}
        />

        {/* Floating card stack */}
        <div className="relative mb-10 flex items-center justify-center">
            <div className="absolute h-52 w-72 translate-x-8 translate-y-8 rotate-6 rounded-2xl bg-white/10 shadow-xl" />
            <div className="absolute h-52 w-72 translate-x-4 translate-y-4 rotate-3 rounded-2xl bg-white/15 shadow-xl" />
            <div className="relative flex h-52 w-72 flex-col items-center justify-center gap-5 rounded-2xl bg-white/25 shadow-2xl backdrop-blur-md">
                {/* Rabbit logo — sitting side profile */}
                <svg fill="none" height="64" viewBox="0 0 64 64" width="64" xmlns="http://www.w3.org/2000/svg">
                    <g fill="white" opacity="0.95">
                        <ellipse cx="26" cy="45" rx="17" ry="14" />
                        <ellipse cx="43" cy="48" rx="9" ry="13" />
                        <ellipse cx="31" cy="60" rx="20" ry="4" />
                        <circle cx="45" cy="31" r="10.5" />
                        <path d="M50 28 C57 29 57 38 50 39 C47 39 46 30 50 28 Z" />
                        <path d="M38 24 C33 16 32 6 36 3 C39 1 42 3 43 8 C44 14 44 20 43 25 Z" />
                        <path d="M43 24 C41 15 42 6 46 4 C49 3 51 6 51 11 C51 17 49 22 47 25 Z" />
                    </g>
                    <circle cx="47" cy="29" r="1.6" fill="#4f46e5" />
                </svg>
                <p className="text-sm font-medium text-white/80">Security Platform</p>
            </div>
        </div>

        {/* Heading */}
        <div className="relative z-10 px-10 text-center text-white">
            <h2 className="text-4xl font-bold tracking-tight drop-shadow-sm">Secure. Test. Protect.</h2>
            <p className="mt-4 text-base leading-relaxed text-blue-100">
                Automated web application
                <br />
                security testing platform
            </p>
        </div>
    </div>
);

const Login = () => {
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const { authInfo, isLoading } = useUser();
    const authProviders = authInfo?.providers || [];

    const returnUrl = getSafeReturnUrl(
        (location.state?.from as string) || searchParams.get('returnUrl'),
        '/flows/new',
    );

    return (
        <div className="h-dvh w-full lg:grid lg:grid-cols-2">
            <LeftPanel />
            <div className="flex items-center justify-center px-8 py-12">
                {!isLoading ? (
                    <LoginForm
                        providers={authProviders}
                        returnUrl={returnUrl}
                    />
                ) : (
                    <Loader2 className="size-16 animate-spin" />
                )}
            </div>
        </div>
    );
};

export default Login;
