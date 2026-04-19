import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FlowAssistantMessages from '@/features/flows/messages/flow-assistant-messages';
import FlowAutomationMessages from '@/features/flows/messages/flow-automation-messages';
import { useFlow } from '@/providers/flow-provider';

interface FlowCentralTabsProps {
    /** Called when the active tab changes — parent can react to world-state selection */
    onTabChange?: (tab: string) => void;
    /** Controlled active tab value from parent */
    value?: string;
}

const FlowCentralTabs = ({ onTabChange, value: controlledValue }: FlowCentralTabsProps) => {
    const { flowData, isLoading } = useFlow();
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<null | string>(null);

    const defaultTab = useMemo(() => {
        // Controlled mode takes precedence
        if (controlledValue) return controlledValue;
        if (activeTab) return activeTab;

        const tabParam = searchParams.get('tab');
        if (tabParam === 'automation' || tabParam === 'assistant' || tabParam === 'world-state') {
            return tabParam;
        }
        if (!isLoading && !flowData?.messageLogs?.length) return 'assistant';
        return 'automation';
    }, [controlledValue, activeTab, searchParams, isLoading, flowData?.messageLogs]);

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        setSearchParams({ tab });
        onTabChange?.(tab);
    };

    return (
        <Tabs
            className="flex size-full flex-col"
            onValueChange={handleTabChange}
            value={defaultTab}
        >
            <div className="max-w-full">
                <ScrollArea className="w-full pb-2">
                    <TabsList className="flex w-fit">
                        <TabsTrigger value="automation">Automation</TabsTrigger>
                        <TabsTrigger value="assistant">Assistant</TabsTrigger>
                        <TabsTrigger value="world-state">World State</TabsTrigger>
                    </TabsList>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </div>

            <TabsContent
                className="mt-2 flex-1 overflow-auto pr-4"
                value="automation"
            >
                <FlowAutomationMessages />
            </TabsContent>
            <TabsContent
                className="mt-2 flex-1 overflow-auto pr-4"
                value="assistant"
            >
                <FlowAssistantMessages />
            </TabsContent>

            {/* World State has no TabsContent here — handled full-width in flow.tsx */}
            <TabsContent
                className="mt-2 flex-1"
                value="world-state"
            >
                {/* Rendered full-width by flow.tsx when this tab is active */}
            </TabsContent>
        </Tabs>
    );
};

export default FlowCentralTabs;
