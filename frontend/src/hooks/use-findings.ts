import { useCallback, useEffect, useState } from 'react';

export type Severity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';
export type FindingStatus = 'Open' | 'In Progress' | 'Remediated' | 'Accepted Risk' | 'False Positive';

export interface Finding {
    id: string;
    title: string;
    severity: Severity;
    status: FindingStatus;
    target: string;
    phase: string;
    description: string;
    evidence: string;
    cve: string;
    cvss: string;
    remediation: string;
    flowId?: string;
    createdAt: string;
}

const STORAGE_KEY = 'pentest_findings_v2';

const load = (): Finding[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as Finding[]) : [];
    } catch {
        return [];
    }
};

export const useFindings = () => {
    const [findings, setFindings] = useState<Finding[]>(load);

    useEffect(() => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(findings)); } catch {}
    }, [findings]);

    const addFinding = useCallback((f: Finding) => setFindings((p) => [f, ...p]), []);
    const updateFinding = useCallback((f: Finding) => setFindings((p) => p.map((x) => x.id === f.id ? f : x)), []);
    const deleteFinding = useCallback((id: string) => setFindings((p) => p.filter((x) => x.id !== id)), []);
    const bulkAdd = useCallback((fs: Finding[]) => setFindings((p) => [...fs, ...p]), []);

    return { findings, addFinding, updateFinding, deleteFinding, bulkAdd, setFindings };
};
