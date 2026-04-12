import { ShieldAlert, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface NmapScanDialogProps {
    command: string;
    onConfirm: () => void;
    onDeny: () => void;
    open: boolean;
}

const NmapScanDialog = ({ command, onConfirm, onDeny, open }: NmapScanDialogProps) => {
    return (
        <Dialog open={open}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ShieldAlert className="size-5 shrink-0 text-yellow-500" />
                        Nmap Scan Authorization Required
                    </DialogTitle>
                    <DialogDescription>
                        The AI agent is about to run an nmap scan. Please confirm that you are authorized to perform
                        network scanning on the target and that this activity is legitimate.
                    </DialogDescription>
                </DialogHeader>
                <div className="rounded-md bg-muted p-3 font-mono text-sm break-all">{command}</div>
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        onClick={onDeny}
                        variant="destructive"
                    >
                        <ShieldAlert className="mr-2 size-4" />
                        Stop — not authorized
                    </Button>
                    <Button
                        onClick={onConfirm}
                        variant="default"
                    >
                        <ShieldCheck className="mr-2 size-4" />
                        Yes, it&apos;s legitimate
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default NmapScanDialog;
