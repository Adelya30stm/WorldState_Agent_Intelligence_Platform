import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
    'inline-flex items-center rounded-full border px-2 py-0.5 gap-1 text-xs font-semibold transition-colors focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2',
    {
        defaultVariants: {
            variant: 'default',
        },
        variants: {
            variant: {
                default:     'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
                destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
                outline:     'text-foreground border-border',
                secondary:   'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
                // Status variants for pentest flows
                running:  'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400',
                waiting:  'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
                finished: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                failed:   'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
                created:  'border-border bg-muted text-muted-foreground',
            },
        },
    },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div
            className={cn(badgeVariants({ variant }), className)}
            {...props}
        />
    );
}

export { Badge, badgeVariants };
