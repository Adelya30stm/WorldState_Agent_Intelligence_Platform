import { gql, useMutation, useQuery } from '@apollo/client';
import { ChevronDown, Loader2, Plus, Rocket, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const PROVIDERS_QUERY = gql`
    query Providers {
        providers {
            name
            type
        }
    }
`;

const CREATE_FLOW = gql`
    mutation CreateFlow($modelProvider: String!, $input: String!) {
        createFlow(modelProvider: $modelProvider, input: $input) {
            id
            title
            status
        }
    }
`;

interface Props {
    onCreated: (flowId: string) => void;
}

export function NewFlowModal({ onCreated }: Props) {
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState('');
    const [provider, setProvider] = useState<string>('');
    const [providerOpen, setProviderOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const { data: providersData } = useQuery(PROVIDERS_QUERY, { skip: !open });
    const [createFlow, { loading }] = useMutation(CREATE_FLOW);

    const providers: { name: string; type: string }[] = providersData?.providers ?? [];

    // Default-select OpenAI when available, otherwise the first provider
    useEffect(() => {
        if (!provider && providers.length > 0) {
            const openai = providers.find((p) => p.name === 'openai' || p.type === 'openai');
            setProvider(openai?.name ?? providers[0].name);
        }
    }, [providers, provider]);

    useEffect(() => {
        if (open) setTimeout(() => textareaRef.current?.focus(), 50);
    }, [open]);

    function reset() {
        setInput('');
        setError(null);
        setProviderOpen(false);
    }

    async function submit() {
        if (!input.trim() || !provider || loading) return;
        setError(null);
        try {
            const { data } = await createFlow({
                variables: { modelProvider: provider, input: input.trim() },
                refetchQueries: ['Flows'],
            });
            const id = data?.createFlow?.id;
            if (id) {
                setOpen(false);
                reset();
                onCreated(String(id));
            } else {
                setError('Flow was not created');
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }

    function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
        }
    }

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-3 py-2.5 text-sm font-medium transition-colors shadow-sm shadow-indigo-900/50 shrink-0"
            >
                <Plus size={14} />
                New Flow
            </button>

            {open && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    onMouseDown={() => setOpen(false)}
                >
                    <div
                        className="w-full max-w-lg bg-[#0d1117] border border-indigo-900/50 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden"
                        onMouseDown={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-indigo-900/30">
                            <Rocket size={15} className="text-indigo-400" />
                            <h2 className="text-sm font-semibold text-slate-200">Start a new pentest flow</h2>
                            <button
                                onClick={() => setOpen(false)}
                                className="ml-auto text-slate-500 hover:text-slate-300 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">
                                    Target / objective
                                </label>
                                <textarea
                                    ref={textareaRef}
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={onKey}
                                    rows={4}
                                    placeholder="Describe what you would like to test, e.g. 'Scan https://example.com for web vulnerabilities'…"
                                    className="mt-1.5 w-full bg-[#161b22] border border-indigo-900/40 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-indigo-700/60 transition-colors resize-none"
                                />
                            </div>

                            {/* Provider picker */}
                            <div className="relative">
                                <label className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">
                                    LLM provider
                                </label>
                                <button
                                    onClick={() => setProviderOpen(o => !o)}
                                    className="mt-1.5 w-full flex items-center gap-2 bg-[#161b22] border border-indigo-900/40 rounded-lg px-3 py-2.5 text-sm text-slate-200 hover:border-indigo-700/60 transition-colors"
                                >
                                    <span className="flex-1 text-left truncate">
                                        {provider || (providers.length ? 'Select provider' : 'No providers configured')}
                                    </span>
                                    <ChevronDown size={14} className={`text-slate-500 transition-transform ${providerOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {providerOpen && providers.length > 0 && (
                                    <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-[#161b22] border border-indigo-900/50 rounded-lg shadow-xl shadow-black/50 max-h-52 overflow-y-auto">
                                        {providers.map(p => (
                                            <button
                                                key={p.name}
                                                onClick={() => { setProvider(p.name); setProviderOpen(false); }}
                                                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-indigo-900/20 transition-colors ${p.name === provider ? 'bg-indigo-900/30 text-slate-100' : 'text-slate-300'}`}
                                            >
                                                <span className="flex-1 truncate">{p.name}</span>
                                                <span className="text-[10px] text-slate-600">{p.type}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {error && (
                                <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/30 rounded-lg px-3 py-2">
                                    {error}
                                </p>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-indigo-900/30">
                            <button
                                onClick={() => setOpen(false)}
                                className="px-3 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submit}
                                disabled={!input.trim() || !provider || loading}
                                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                            >
                                {loading ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
                                Create & run
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
