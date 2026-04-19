import { GitFork, Network, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';

const Projects = () => {
    return (
        <>
            <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
                <SidebarTrigger className="-ml-1" />
                <Separator
                    className="mr-2 h-4"
                    orientation="vertical"
                />
                <Breadcrumb>
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbPage>Projects</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
            </header>

            <div className="flex min-h-[calc(100dvh-3rem)] flex-col items-center justify-center gap-6 p-8">
                {/* Empty state */}
                <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed bg-muted/30 px-12 py-10 text-center max-w-md w-full">
                    <div className="flex size-14 items-center justify-center rounded-full bg-muted">
                        <Network className="size-7 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                        <h2 className="text-lg font-semibold">No projects yet</h2>
                        <p className="text-sm text-muted-foreground">
                            A project groups multiple flows together so you can connect results, track scope, and render an attack graph.
                        </p>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-center">
                        <Button
                            className="gap-2"
                            disabled
                        >
                            <Plus className="size-4" />
                            New Project
                        </Button>
                        <Button
                            asChild
                            className="gap-2"
                            variant="outline"
                        >
                            <Link to="/flows/new">
                                <GitFork className="size-4" />
                                Start with a flow
                            </Link>
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground opacity-60">Project management coming soon</p>
                </div>
            </div>
        </>
    );
};

export default Projects;
