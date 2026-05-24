import { Outlet } from 'react-router-dom';

import TopNavbar from '@/components/layouts/top-navbar';
import { TooltipProvider } from '@/components/ui/tooltip';

const MainLayout = () => {
    return (
        <TooltipProvider delayDuration={0}>
            <div className="flex h-screen flex-col">
                <TopNavbar />
                <div className="flex-1 overflow-auto">
                    <Outlet />
                </div>
            </div>
        </TooltipProvider>
    );
};

export default MainLayout;
