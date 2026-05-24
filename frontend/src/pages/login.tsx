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
                {/* Shield icon */}
                <svg fill="none" height="56" viewBox="0 0 24 24" width="56" xmlns="http://www.w3.org/2000/svg">
                    <path
                        d="M12 2L4 5.5V11C4 15.42 7.5 19.57 12 21C16.5 19.57 20 15.42 20 11V5.5L12 2Z"
                        fill="white"
                        opacity="0.95"
                    />
                    <text
                        dominantBaseline="middle"
                        fill="#4f46e5"
                        fontSize="6"
                        fontWeight="bold"
                        textAnchor="middle"
                        x="12"
                        y="12"
                    >
                        {'</>'}
                    </text>
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
