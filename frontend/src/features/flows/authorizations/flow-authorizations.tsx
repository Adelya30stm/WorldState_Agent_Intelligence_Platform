import { ShieldCheck } from 'lucide-react';

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

const FlowAuthorizations = () => {
    return (
        <div className="flex h-full flex-col">
            <Empty>
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <ShieldCheck />
                    </EmptyMedia>
                    <EmptyTitle>No authorizations available</EmptyTitle>
                    <EmptyDescription>Authorization data will appear here once the agent collects it</EmptyDescription>
                </EmptyHeader>
            </Empty>
        </div>
    );
};

export default FlowAuthorizations;
