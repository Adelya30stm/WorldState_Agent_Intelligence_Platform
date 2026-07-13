import {
    Clock,
    GitFork,
    Network,
    Plus,
    Settings,
    Star,
    Zap,
} from 'lucide-react';

const WSLogo = () => (
    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-700 to-indigo-800 flex items-center justify-center shadow-sm shadow-violet-900/50 shrink-0">
        {/* Rabbit logo — sitting side profile */}
        <svg width="20" height="20" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g fill="white">
                <ellipse cx="26" cy="45" rx="17" ry="14" />
                <ellipse cx="43" cy="48" rx="9" ry="13" />
                <ellipse cx="31" cy="60" rx="20" ry="4" />
                <circle cx="45" cy="31" r="10.5" />
                <path d="M50 28 C57 29 57 38 50 39 C47 39 46 30 50 28 Z" />
                <path d="M38 24 C33 16 32 6 36 3 C39 1 42 3 43 8 C44 14 44 20 43 25 Z" />
                <path d="M43 24 C41 15 42 6 46 4 C49 3 51 6 51 11 C51 17 49 22 47 25 Z" />
            </g>
            <circle cx="47" cy="29" r="1.6" fill="#3b0764" />
        </svg>
    </div>
);
import { useMemo, useState } from 'react';
import { Link, useLocation, useMatch, useParams } from 'react-router-dom';

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from '@/components/ui/sidebar';

import { useFavorites } from '@/providers/favorites-provider';
import { useSidebarFlows } from '@/providers/sidebar-flows-provider';

const MainSidebar = () => {
    const [clickedButtons, setClickedButtons] = useState<Set<string>>(new Set());

    const isSettingsActive = useMatch('/settings/*');
    const { flowId: flowIdParam } = useParams<{ flowId: string }>();
    const location = useLocation();

    // Flows button is active only on /flows list and /flows/new, not on specific flow pages
    const isFlowsActive = useMemo(() => {
        return location.pathname === '/flows' || location.pathname === '/flows/new';
    }, [location.pathname]);

    const { addFavoriteFlow, favoriteFlowIds, removeFavoriteFlow } = useFavorites();
    const { flows } = useSidebarFlows();

    // Convert flowId to number for comparison
    const flowId = useMemo(() => {
        return flowIdParam ? +flowIdParam : null;
    }, [flowIdParam]);

    // Check if we're on a specific flow page (not /flows/new)
    const isOnFlowPage = useMemo(() => {
        return location.pathname.startsWith('/flows/') && flowIdParam && flowIdParam !== 'new';
    }, [location.pathname, flowIdParam]);

    // Get favorite flows (full objects)
    const favoriteFlows = useMemo(() => {
        const filtered = flows
            .filter((flow) => {
                const numericFlowId = typeof flow.id === 'string' ? +flow.id : flow.id;

                return favoriteFlowIds.includes(numericFlowId);
            })
            .sort((a, b) => +b.id - +a.id);

        return filtered;
    }, [flows, favoriteFlowIds]);

    // Get recent flows (5 latest non-favorites, sorted by createdAt desc)
    const recentFlows = useMemo(() => {
        const nonFavoriteFlows = flows.filter((flow) => {
            const numericFlowId = typeof flow.id === 'string' ? +flow.id : flow.id;

            return !favoriteFlowIds.includes(numericFlowId);
        });
        const sortedByDate = [...nonFavoriteFlows].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );

        return sortedByDate.slice(0, 5);
    }, [flows, favoriteFlowIds]);

    // Get current flow (if on flow page and not in recent/favorites)
    const currentFlow = useMemo(() => {
        if (!isOnFlowPage || !flowId) {
            return null;
        }

        const isInRecent = recentFlows.some((flow) => +flow.id === flowId);
        const isInFavorites = favoriteFlows.some((flow) => +flow.id === flowId);

        if (isInRecent || isInFavorites) {
            return null;
        }

        const found = flows.find((flow) => +flow.id === flowId) || null;

        return found;
    }, [isOnFlowPage, flowId, flows, recentFlows, favoriteFlows]);

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader className="border-b border-sidebar-border/60 pb-3">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild size="lg" className="hover:bg-sidebar-accent/60">
                            <Link to="/flows">
                                <WSLogo />
                                <div className="flex flex-col leading-none">
                                    <span className="font-bold text-[13px] tracking-tight">WorldState<span className="text-violet-400">Security</span></span>
                                    <span className="text-[10px] text-muted-foreground font-medium mt-0.5">AI Pentest Platform</span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup className="bg-sidebar sticky top-0 z-10 pt-3">
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem className="group-data-[state=expanded]:hidden">
                                <SidebarMenuButton asChild>
                                    <Link to="/flows/new">
                                        <Plus />
                                        New Flow
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            {/* New Flow CTA */}
                            <SidebarMenuItem className="group-data-[state=collapsed]:hidden mb-1">
                                <Link
                                    to="/flows/new"
                                    className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                                >
                                    <Zap className="size-4 shrink-0" />
                                    <span>New Pentest</span>
                                </Link>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild isActive={!!isFlowsActive}>
                                    <Link to="/flows">
                                        <GitFork />
                                        All Flows
                                    </Link>
                                </SidebarMenuButton>
                                <SidebarMenuAction asChild className="data-[state=open]:bg-accent rounded-sm" showOnHover>
                                    <Link to="/flows/new"><Plus /></Link>
                                </SidebarMenuAction>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild isActive={location.pathname === '/web-pentest'}>
                                    <Link to="/web-pentest">
                                        <Network />
                                        Web Pentest
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {currentFlow && (
                    <SidebarGroup>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                <SidebarMenuItem
                                    onMouseLeave={(e) => {
                                        const menuItem = e.currentTarget;
                                        menuItem.querySelectorAll('button, a').forEach((el) => {
                                            if (el instanceof HTMLElement) {
                                                el.blur();
                                            }
                                        });

                                        const key = `current-${currentFlow.id}`;
                                        setClickedButtons((prev) => {
                                            const next = new Set(prev);
                                            next.delete(key);

                                            return next;
                                        });
                                    }}
                                >
                                    <SidebarMenuButton
                                        asChild
                                        isActive={true}
                                    >
                                        <Link to={`/flows/${currentFlow.id}`}>
                                            <span className="-mx-2 w-8 shrink-0 text-center text-xs group-data-[state=expanded]:hidden">
                                                {currentFlow.id}
                                            </span>
                                            <span className="text-muted-foreground bg-background dark:bg-muted -my-0.5 -ml-0.5 h-5 min-w-5 shrink-0 rounded-md px-px py-0.5 text-center text-xs group-data-[state=collapsed]:hidden">
                                                {currentFlow.id}
                                            </span>
                                            <span className="truncate">{currentFlow.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                    <SidebarMenuAction
                                        className={`data-[state=open]:bg-accent rounded-sm ${clickedButtons.has(`current-${currentFlow.id}`) ? 'pointer-events-none! opacity-0!' : ''}`}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();

                                            const button = e.currentTarget;
                                            button.blur();

                                            const key = `current-${currentFlow.id}`;
                                            setClickedButtons((prev) => new Set(prev).add(key));
                                            addFavoriteFlow(currentFlow.id);

                                            setTimeout(() => {
                                                setClickedButtons((prev) => {
                                                    const next = new Set(prev);
                                                    next.delete(key);

                                                    return next;
                                                });
                                            }, 600);
                                        }}
                                        showOnHover
                                    >
                                        <Star />
                                    </SidebarMenuAction>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}

                {recentFlows.length > 0 && (
                    <SidebarGroup>
                        <SidebarGroupLabel className="flex items-center gap-2">
                            <Clock />
                            Recent Flows
                        </SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {recentFlows.map((flow) => (
                                    <SidebarMenuItem
                                        key={flow.id}
                                        onMouseLeave={(e) => {
                                            const menuItem = e.currentTarget;
                                            menuItem.querySelectorAll('button, a').forEach((el) => {
                                                if (el instanceof HTMLElement) {
                                                    el.blur();
                                                }
                                            });

                                            const key = `recent-${flow.id}`;
                                            setClickedButtons((prev) => {
                                                const next = new Set(prev);
                                                next.delete(key);

                                                return next;
                                            });
                                        }}
                                    >
                                        <SidebarMenuButton
                                            asChild
                                            isActive={flowId === +flow.id}
                                        >
                                            <Link to={`/flows/${flow.id}`}>
                                                <span className="-mx-2 w-8 shrink-0 text-center text-xs group-data-[state=expanded]:hidden">
                                                    {flow.id}
                                                </span>
                                                <span className="text-muted-foreground bg-background dark:bg-muted -my-0.5 -ml-0.5 h-5 min-w-5 shrink-0 rounded-md px-px py-0.5 text-center text-xs group-data-[state=collapsed]:hidden">
                                                    {flow.id}
                                                </span>
                                                <span className="truncate">{flow.title}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                        <SidebarMenuAction
                                            className={`data-[state=open]:bg-accent rounded-sm ${clickedButtons.has(`recent-${flow.id}`) ? 'pointer-events-none! opacity-0!' : ''}`}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                const button = e.currentTarget;
                                                button.blur();

                                                const key = `recent-${flow.id}`;
                                                setClickedButtons((prev) => new Set(prev).add(key));
                                                addFavoriteFlow(flow.id);

                                                setTimeout(() => {
                                                    setClickedButtons((prev) => {
                                                        const next = new Set(prev);
                                                        next.delete(key);

                                                        return next;
                                                    });
                                                }, 600);
                                            }}
                                            showOnHover
                                        >
                                            <Star />
                                        </SidebarMenuAction>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}

                {favoriteFlows.length > 0 && (
                    <SidebarGroup>
                        <SidebarGroupLabel className="flex items-center gap-2">
                            <Star />
                            Favorite Flows
                        </SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {favoriteFlows.map((flow) => (
                                    <SidebarMenuItem
                                        key={flow.id}
                                        onMouseLeave={(e) => {
                                            const menuItem = e.currentTarget;
                                            menuItem.querySelectorAll('button, a').forEach((el) => {
                                                if (el instanceof HTMLElement) {
                                                    el.blur();
                                                }
                                            });

                                            const key = `favorite-${flow.id}`;
                                            setClickedButtons((prev) => {
                                                const next = new Set(prev);
                                                next.delete(key);

                                                return next;
                                            });
                                        }}
                                    >
                                        <SidebarMenuButton
                                            asChild
                                            isActive={flowId === +flow.id}
                                        >
                                            <Link to={`/flows/${flow.id}`}>
                                                <span className="-mx-2 w-8 shrink-0 text-center text-xs group-data-[state=expanded]:hidden">
                                                    {flow.id}
                                                </span>
                                                <span className="text-muted-foreground bg-background dark:bg-muted -my-0.5 -ml-0.5 h-5 min-w-5 shrink-0 rounded-md px-px py-0.5 text-center text-xs group-data-[state=collapsed]:hidden">
                                                    {flow.id}
                                                </span>
                                                <span className="truncate">{flow.title}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                        <SidebarMenuAction
                                            className={`data-[state=open]:bg-accent rounded-sm ${clickedButtons.has(`favorite-${flow.id}`) ? 'pointer-events-none! opacity-0!' : ''}`}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                const button = e.currentTarget;
                                                button.blur();

                                                const key = `favorite-${flow.id}`;
                                                setClickedButtons((prev) => new Set(prev).add(key));
                                                removeFavoriteFlow(flow.id);

                                                setTimeout(() => {
                                                    setClickedButtons((prev) => {
                                                        const next = new Set(prev);
                                                        next.delete(key);

                                                        return next;
                                                    });
                                                }, 600);
                                            }}
                                            showOnHover
                                        >
                                            <Star className="fill-yellow-500 stroke-yellow-500" />
                                        </SidebarMenuAction>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}
            </SidebarContent>
            <SidebarFooter className="border-t border-sidebar-border/60 pt-2">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={!!isSettingsActive}>
                            <Link to="/settings">
                                <Settings />
                                Settings
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
};

export default MainSidebar;
