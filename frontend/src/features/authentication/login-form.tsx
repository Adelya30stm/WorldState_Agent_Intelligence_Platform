import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';

import type { OAuthProvider } from '@/providers/user-provider';

import Github from '@/components/icons/github';
import Google from '@/components/icons/google';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useUser } from '@/providers/user-provider';

import { PasswordChangeForm } from './password-change-form';

const formSchema = z.object({
    mail: z
        .string()
        .min(1, {
            message: 'Login is required',
        })
        .refine(
            (value) => z.string().email().safeParse(value).success || ['admin', 'demo'].includes(value.toLowerCase()),
            {
                message: 'Invalid login',
            },
        ),
    password: z.string().min(1, {
        message: 'Password is required',
    }),
    rememberMe: z.boolean().default(false),
});

const errorMessage = 'Invalid login or password';
const errorProviderMessage = 'Authentication failed';

interface AuthProviderAction {
    icon: React.ReactNode;
    id: OAuthProvider;
    name: string;
}

const providerActions: AuthProviderAction[] = [
    {
        icon: <Google className="size-5" />,
        id: 'google',
        name: 'Continue with Google',
    },
    {
        icon: <Github className="size-5" />,
        id: 'github',
        name: 'Continue with GitHub',
    },
];

interface LoginFormProps {
    providers: string[];
    returnUrl?: string;
}

const LoginForm = ({ providers, returnUrl = '/flows/new' }: LoginFormProps) => {
    const form = useForm<z.infer<typeof formSchema>>({
        defaultValues: {
            mail: '',
            password: '',
            rememberMe: false,
        },
        resolver: zodResolver(formSchema),
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<null | string>(null);
    const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);
    const navigate = useNavigate();
    const { authInfo, isAuthenticated, login, loginWithOAuth, setAuth } = useUser();

    const handleSubmit = async (values: z.infer<typeof formSchema>) => {
        setError(null);
        setIsSubmitting(true);

        try {
            const result = await login(values);

            if (!result.success) {
                setError(result.error || errorMessage);

                return;
            }

            if (result.passwordChangeRequired) {
                setPasswordChangeRequired(true);

                return;
            }

            navigate(returnUrl);
        } catch {
            setError(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleProviderLogin = async (provider: OAuthProvider) => {
        setError(null);
        setIsSubmitting(true);

        try {
            const result = await loginWithOAuth(provider);

            if (!result.success) {
                setError(result.error || errorProviderMessage);

                return;
            }

            navigate(returnUrl);
        } catch (error) {
            setError(error instanceof Error ? error.message : errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSkipPasswordChange = () => {
        navigate(returnUrl);
    };

    const handlePasswordChangeSuccess = () => {
        if (authInfo?.user) {
            const updatedAuthData = {
                ...authInfo,
                user: {
                    ...authInfo.user,
                    password_change_required: false,
                },
            };

            setAuth(updatedAuthData);
            navigate(returnUrl);
        }
    };

    const shouldShowPasswordChange =
        (passwordChangeRequired || authInfo?.user?.password_change_required) &&
        authInfo?.user?.type === 'local' &&
        isAuthenticated();

    if (shouldShowPasswordChange) {
        return (
            <div className="mx-auto flex w-[350px] flex-col gap-6">
                <h1 className="text-center text-3xl font-bold">Update Password</h1>
                <p className="text-muted-foreground text-center text-sm">
                    You need to change your password before continuing.
                </p>
                <PasswordChangeForm
                    isModal={false}
                    onSkip={handleSkipPasswordChange}
                    onSuccess={handlePasswordChangeSuccess}
                    showSkip={true}
                />
            </div>
        );
    }

    return (
        <Form {...form}>
            <form
                className="mx-auto flex w-full max-w-[400px] flex-col gap-6"
                onSubmit={form.handleSubmit(handleSubmit)}
            >
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold">Sign in</h1>
                    <p className="text-muted-foreground mt-1 text-sm">Welcome back! Please sign in to your account.</p>
                </div>

                {/* OAuth providers */}
                {providers?.length > 0 && (
                    <>
                        <div className="flex flex-col gap-3">
                            {providerActions
                                .filter((provider) => providers.includes(provider.id))
                                .map((provider) => (
                                    <Button
                                        disabled={isSubmitting}
                                        key={provider.id}
                                        onClick={() => handleProviderLogin(provider.id)}
                                        type="button"
                                        variant="secondary"
                                    >
                                        {provider.icon}
                                        {provider.name}
                                    </Button>
                                ))}
                        </div>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background text-muted-foreground px-2">or</span>
                            </div>
                        </div>
                    </>
                )}

                {/* Fields */}
                <div className="flex flex-col gap-4">
                    <FormField
                        control={form.control}
                        name="mail"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Login</FormLabel>
                                <FormControl>
                                    <Input
                                        {...field}
                                        autoFocus
                                        placeholder="Enter your email"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Password</FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <Input
                                            {...field}
                                            placeholder="Enter your password"
                                            type={showPassword ? 'text' : 'password'}
                                        />
                                        <button
                                            className="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                                            onClick={() => setShowPassword((v) => !v)}
                                            tabIndex={-1}
                                            type="button"
                                        >
                                            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                        </button>
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {/* Remember me + Forgot password */}
                    <div className="flex items-center justify-between">
                        <FormField
                            control={form.control}
                            name="rememberMe"
                            render={({ field }) => (
                                <label className="flex cursor-pointer items-center gap-2 text-sm">
                                    <input
                                        checked={field.value}
                                        className="accent-primary h-4 w-4 rounded border"
                                        onChange={field.onChange}
                                        type="checkbox"
                                    />
                                    Remember me
                                </label>
                            )}
                        />
                        <button
                            className="text-primary hover:text-primary/80 text-sm underline-offset-4 hover:underline"
                            type="button"
                        >
                            Forgot password?
                        </button>
                    </div>

                    <Button
                        className="w-full bg-blue-700 hover:bg-blue-800"
                        disabled={isSubmitting || (!form.formState.isValid && form.formState.isSubmitted)}
                        type="submit"
                    >
                        {isSubmitting && <Loader2 className="animate-spin" />}
                        <span>Sign in</span>
                    </Button>

                    {error && <FormMessage>{error}</FormMessage>}
                </div>

                {/* Footer */}
                <p className="text-muted-foreground text-center text-xs">
                    By signing in, you agree to our{' '}
                    <span className="underline underline-offset-4 cursor-pointer hover:text-foreground">Terms of Service</span>{' '}
                    and{' '}
                    <span className="underline underline-offset-4 cursor-pointer hover:text-foreground">Privacy Policy</span>.
                </p>
            </form>
        </Form>
    );
};

export default LoginForm;
