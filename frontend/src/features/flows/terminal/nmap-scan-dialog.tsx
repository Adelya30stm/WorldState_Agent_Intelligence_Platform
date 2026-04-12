import { ScanSearch } from 'lucide-react';

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
    onClose: () => void;
    open: boolean;
}

const NmapScanDialog = ({ command, onClose, open }: NmapScanDialogProps) => {
    return (
        <Dialog
            onOpenChange={(isOpen) => {
                if (!isOpen) {
                    onClose();
                }
            }}
            open={open}
        >
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ScanSearch className="size-5 shrink-0" />
                        Nmap Scan in Progress
                    </DialogTitle>
                    <DialogDescription>
                        The system is running an nmap scan. This may take a few minutes depending on the target and scan
                        options.
                    </DialogDescription>
                </DialogHeader>
                <div className="rounded-md bg-muted p-3 font-mono text-sm break-all">{command}</div>
                <DialogFooter>
                    <Button
                        onClick={onClose}
                        variant="default"
                    >
                        Got it
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default NmapScanDialog;
