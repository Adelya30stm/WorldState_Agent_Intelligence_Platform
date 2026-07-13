#!/usr/bin/env python3
"""Convert graphify graph.json → Obsidian markdown vault."""

import json
import os
import re
from collections import defaultdict

GRAPH_JSON = os.path.join(os.path.dirname(__file__), "graph.json")
REPORT_MD  = os.path.join(os.path.dirname(__file__), "GRAPH_REPORT.md")
OUT_DIR    = os.path.expanduser("~/Documents/code-brain/04_code_graph/nodes")
COMM_DIR   = os.path.expanduser("~/Documents/code-brain/04_code_graph/communities")

os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(COMM_DIR, exist_ok=True)

print("Loading graph.json …")
with open(GRAPH_JSON) as f:
    g = json.load(f)

nodes    = {n["id"]: n for n in g.get("nodes", [])}
edges    = g.get("links", g.get("edges", []))
hyperedges = g.get("graph", {}).get("hyperedges", [])

# Build adjacency: id → [(relation, neighbour_id, direction)]
outgoing  = defaultdict(list)
incoming  = defaultdict(list)
for e in edges:
    src, tgt, rel = e["source"], e["target"], e.get("relation", "related")
    outgoing[src].append((rel, tgt))
    incoming[tgt].append((rel, src))

# Community → node list
community_nodes = defaultdict(list)
community_labels = {}
for nid, n in nodes.items():
    c = n.get("community")
    if c is not None:
        community_nodes[c].append(nid)

def safe_filename(s: str) -> str:
    return re.sub(r'[\\/*?:"<>|]', "_", s)[:120]

def node_link(nid: str) -> str:
    n = nodes.get(nid, {})
    label = n.get("label", nid)
    return f"[[{safe_filename(label)}]]"

total = len(nodes)
print(f"Writing {total} node files …")

for i, (nid, n) in enumerate(nodes.items()):
    if i % 1000 == 0:
        print(f"  {i}/{total}")

    label     = n.get("label", nid)
    file_type = n.get("file_type", "")
    src_file  = n.get("source_file", "")
    src_loc   = n.get("source_location", "")
    community = n.get("community", "")

    fname = safe_filename(label) + ".md"
    fpath = os.path.join(OUT_DIR, fname)

    lines = [
        f"# {label}",
        "",
        "## Metadata",
        f"- **Type**: {file_type}",
        f"- **Source**: `{src_file}` {src_loc}",
        f"- **Community**: [[_COMMUNITY_{community}]]" if community != "" else "",
        "",
    ]

    outs = outgoing.get(nid, [])
    if outs:
        lines.append("## Links →")
        for rel, tgt in outs[:50]:  # cap at 50 to keep files readable
            lines.append(f"- **{rel}** → {node_link(tgt)}")
        if len(outs) > 50:
            lines.append(f"- … and {len(outs)-50} more")
        lines.append("")

    ins = incoming.get(nid, [])
    if ins:
        lines.append("## ← Referenced by")
        for rel, src in ins[:30]:
            lines.append(f"- **{rel}** ← {node_link(src)}")
        if len(ins) > 30:
            lines.append(f"- … and {len(ins)-30} more")
        lines.append("")

    # Avoid overwriting if duplicate label (append id suffix)
    if os.path.exists(fpath):
        fpath = os.path.join(OUT_DIR, safe_filename(label) + f"__{nid[:8]}.md")

    with open(fpath, "w") as f:
        f.write("\n".join(lines))

# --- Community hub files ---
print(f"Writing {len(community_nodes)} community files …")
for cid, members in community_nodes.items():
    fname = f"_COMMUNITY_{cid}.md"
    lines = [
        f"# Community {cid}",
        "",
        f"**{len(members)} nodes**",
        "",
        "## Members",
    ]
    for nid in sorted(members)[:200]:
        lines.append(f"- {node_link(nid)}")
    if len(members) > 200:
        lines.append(f"- … and {len(members)-200} more")
    with open(os.path.join(COMM_DIR, fname), "w") as f:
        f.write("\n".join(lines))

# --- Hyperedge files ---
print(f"Writing {len(hyperedges)} hyperedge files …")
he_dir = os.path.expanduser("~/Documents/code-brain/04_code_graph/hyperedges")
os.makedirs(he_dir, exist_ok=True)
for he in hyperedges:
    label = he.get("label", he.get("id", "hyperedge"))
    fname = safe_filename(label) + ".md"
    lines = [
        f"# {label}",
        "",
        f"- **Relation**: {he.get('relation','')}",
        f"- **Confidence**: {he.get('confidence','')} ({he.get('confidence_score','')})",
        f"- **Source**: `{he.get('source_file','')}`",
        "",
        "## Nodes",
    ]
    for nid in he.get("nodes", []):
        lines.append(f"- {node_link(nid)}")
    with open(os.path.join(he_dir, fname), "w") as f:
        f.write("\n".join(lines))

# Copy GRAPH_REPORT.md
import shutil
shutil.copy(REPORT_MD, os.path.expanduser("~/Documents/code-brain/04_code_graph/GRAPH_REPORT.md"))

print("\nDone! Vault updated at ~/Documents/code-brain/04_code_graph/")
print(f"  nodes/        {total} files")
print(f"  communities/  {len(community_nodes)} files")
print(f"  hyperedges/   {len(hyperedges)} files")
