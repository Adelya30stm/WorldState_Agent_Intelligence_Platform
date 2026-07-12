import { Loader2, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface AiAutofillBoxProps {
    value: string;
    onChange: (v: string) => void;
    onRun: () => void;
    loading: boolean;
    error?: string;
    title?: string;
    hint?: string;
    placeholder?: string;
    rows?: number;
}

// AiAutofillBox is a presentational paste-box + "Autofill with AI" button.
// The parent owns the request and merges the extracted result into its own state.
export const AiAutofillBox = ({
    value,
    onChange,
    onRun,
    loading,
    error,
    title = 'Autofill from text',
    hint = 'Paste a brief, email, or scope doc — AI fills the fields below.',
    placeholder = 'Paste engagement details here…',
    rows = 4,
}: AiAutofillBoxProps) => (
    <div className="rounded-xl border border-dashed border-blue-300 bg-blue-50/40 p-3">
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <Sparkles className="size-3.5 text-blue-600" />
            <span className="text-xs font-semibold text-blue-800">{title}</span>
            <span className="text-[11px] text-muted-foreground">{hint}</span>
        </div>
        <textarea
            className="w-full resize-y rounded-md border border-border bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
            disabled={loading}
            placeholder={placeholder}
            rows={rows}
            value={value}
            onChange={(e) => onChange(e.target.value)}
        />
        <div className="mt-2 flex items-center gap-2">
            <Button
                className="gap-1.5 bg-blue-600 text-white hover:bg-blue-700"
                disabled={loading || !value.trim()}
                size="sm"
                type="button"
                onClick={onRun}
            >
                {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                {loading ? 'Analyzing…' : 'Autofill with AI'}
            </Button>
            {error && <span className="text-[11px] text-red-600">{error}</span>}
        </div>
    </div>
);
