import { Check, ChevronDown, KeyRound, LogOut, Monitor, Moon, Settings, Sun } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PasswordChangeForm } from '@/features/authentication/password-change-form';
import { useTheme } from '@/hooks/use-theme';
import { useUser } from '@/providers/user-provider';
import type { Theme } from '@/providers/theme-provider';

const ShieldCodeIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L4 5.5V11C4 15.42 7.5 19.57 12 21C16.5 19.57 20 15.42 20 11V5.5L12 2Z" fill="#1d4ed8" />
        <text dominantBaseline="middle" fill="white" fontSize="6.5" fontWeight="bold" textAnchor="middle" x="12" y="12">
            {'</>'}
        </text>
    </svg>
);

const PENTEST_TYPES = [
    { label: 'Web Pentest',    sub: '7-phase PTES methodology',  path: '/web-pentest'          },
    { label: 'Custom',         sub: 'Define your own scope',       path: '/flows/new'            },
] as const;

const CENTER_NAV = [
    { label: 'Flows',      path: '/flows',                exact: false },
    { label: 'Dashboard',  path: '/web-pentest',          exact: true  },
    { label: 'Phases',     path: '/web-pentest/phases',   exact: true  },
] as const;

function getInitials(name?: string | null, mail?: string | null): string {
    if (name) {
        const parts = name.trim().split(/\s+/);
        const a = parts[0]?.[0] ?? '';
        const b = parts[1]?.[0] ?? '';
        if (b) return (a + b).toUpperCase();
        return name.slice(0, 2).toUpperCase();
    }
    if (mail) return mail.slice(0, 2).toUpperCase();
    return 'AI';
}

function getDisplayName(name?: string | null, mail?: string | null): string {
    if (name) return name;
    if (mail) return mail.split('@')[0] ?? mail;
    return 'Adelia Ibragimova';
}

const TopNavbar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { authInfo, logout } = useUser();
    const user = authInfo?.user;
    const { setTheme, theme } = useTheme();
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

    const currentType =
        PENTEST_TYPES.find((t) => location.pathname.startsWith(t.path.replace('/new', ''))) ??
        PENTEST_TYPES[0];

    const displayName = getDisplayName(user?.name, user?.mail);
    const initials = getInitials(user?.name, user?.mail);

    return (
        <>
            {/* ── Main bar ── */}
            <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center gap-0 border-b border-border/60 bg-background/80 backdrop-blur-md px-6 shadow-sm">
                {/* Left: project type dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-semibold transition-all hover:bg-accent/70 mr-4 outline-none group">
                            <ShieldCodeIcon className="size-7 shrink-0 transition-transform group-hover:scale-105" />
                            <span className="hidden sm:block tracking-tight">{currentType.label}</span>
                            <ChevronDown className="size-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-64 p-1.5 rounded-xl shadow-lg border-border/60" sideOffset={8}>
                        {PENTEST_TYPES.map((item) => {
                            const isActive = location.pathname.startsWith(
                                item.path.replace('/new', ''),
                            );
                            return (
                                <DropdownMenuItem
                                    className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 cursor-pointer"
                                    key={item.path}
                                    onClick={() => navigate(item.path)}
                                >
                                    <ShieldCodeIcon className="size-8 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold leading-tight">{item.label}</div>
                                        <div className="text-xs text-muted-foreground leading-tight mt-0.5">
                                            {item.sub}
                                        </div>
                                    </div>
                                    {isActive && <Check className="size-4 text-blue-500 shrink-0" />}
                                </DropdownMenuItem>
                            );
                        })}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Divider */}
                <div className="h-5 w-px bg-border/60 mr-4" />

                {/* Center: section nav */}
                <nav className="flex items-center gap-1 flex-1 h-full">
                    {CENTER_NAV.map((item) => {
                        const isActive = item.exact
                            ? location.pathname === item.path
                            : location.pathname.startsWith(item.path);
                        return (
                            <Link
                                className={`flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                                    isActive
                                        ? 'bg-zinc-800 text-zinc-100 dark:bg-zinc-700 dark:text-zinc-50'
                                        : 'text-muted-foreground hover:bg-zinc-800/80 hover:text-zinc-100 dark:hover:bg-zinc-700/80 dark:hover:text-zinc-50'
                                }`}
                                key={item.path}
                                to={item.path}
                            >
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                {/* Right: user + settings */}
                <div className="flex items-center gap-1">
                    {/* Settings */}
                    <Link
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                            location.pathname.startsWith('/settings')
                                ? 'bg-accent text-accent-foreground'
                                : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground'
                        }`}
                        to="/settings"
                    >
                        <Settings className="size-3.5" />
                        <span className="hidden sm:block">Settings</span>
                    </Link>

                    {/* Divider */}
                    <div className="h-5 w-px bg-border/60 mx-1" />

                    {/* User pill */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent/70 outline-none">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-[11px] font-bold text-white shadow-sm">
                                    {initials}
                                </div>
                                <div className="hidden sm:flex flex-col items-start leading-none">
                                    <span className="text-[12px] font-semibold text-foreground">
                                        {displayName}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground mt-0.5">
                                        Senior Pentester
                                    </span>
                                </div>
                                <ChevronDown className="size-3 text-muted-foreground hidden sm:block" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-52 rounded-xl shadow-lg border-border/60" sideOffset={6}>
                            <DropdownMenuLabel className="p-0 font-normal">
                                <div className="flex items-center gap-2 px-2 py-2 text-sm">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
                                        {initials}
                                    </div>
                                    <div className="grid leading-tight">
                                        <span className="truncate font-semibold">{displayName}</span>
                                        <span className="truncate text-xs text-muted-foreground">
                                            {user?.mail}
                                        </span>
                                    </div>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="cursor-default hover:bg-transparent focus:bg-transparent"
                                onSelect={(e) => e.preventDefault()}
                            >
                                <Monitor className="size-4" />
                                Theme
                                <Tabs
                                    className="-my-1.5 -mr-2 ml-auto"
                                    onValueChange={(v) => setTheme(v as Theme)}
                                    value={theme ?? 'system'}
                                >
                                    <TabsList className="h-7 p-0.5">
                                        <TabsTrigger className="h-6 px-2" value="system">
                                            <Monitor className="size-3.5" />
                                        </TabsTrigger>
                                        <TabsTrigger className="h-6 px-2" value="light">
                                            <Sun className="size-3.5" />
                                        </TabsTrigger>
                                        <TabsTrigger className="h-6 px-2" value="dark">
                                            <Moon className="size-3.5" />
                                        </TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </DropdownMenuItem>
                            {user?.type === 'local' && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setIsPasswordModalOpen(true)}>
                                        <KeyRound className="size-4" />
                                        Change Password
                                    </DropdownMenuItem>
                                </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => {
                                    logout();
                                    navigate('/login');
                                }}
                            >
                                <LogOut className="size-4" />
                                Log out
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            <Dialog onOpenChange={setIsPasswordModalOpen} open={isPasswordModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Change Password</DialogTitle>
                    </DialogHeader>
                    <PasswordChangeForm
                        onCancel={() => setIsPasswordModalOpen(false)}
                        onSuccess={() => setIsPasswordModalOpen(false)}
                    />
                </DialogContent>
            </Dialog>
        </>
    );
};

export default TopNavbar;
