from __future__ import annotations

# Sprint 5: Network / graph analysis models
#
# The network model surfaces shell structures, circular funding arrangements,
# and shared-director clusters by treating organisations, directors, and
# addresses as nodes in a directed multigraph.
#
# Full implementation will provide:
#   - build_org_graph(matches: pd.DataFrame) -> nx.DiGraph
#       Constructs a NetworkX directed graph from entity_matches rows.
#   - detect_communities(graph: nx.DiGraph) -> list[list[str]]
#       Applies Louvain community detection to surface clusters.
#   - find_shell_candidates(graph: nx.DiGraph, settings: Settings)
#       -> list[ShellCluster]
#       Applies the shell_indicator rule: nodes with >SHELL_SHARED_ADDRESS_MIN
#       shared-address edges AND >SHELL_SHARED_DIRECTOR_MIN shared-director
#       edges are flagged.
#   - compute_centrality(graph: nx.DiGraph) -> dict[str, float]
#       PageRank centrality scores; high-centrality nodes in anomalous clusters
#       are elevated in the transparency score.
#   - Pydantic models: NetworkNode, NetworkEdge, NetworkGraph, ShellCluster
#
# Dependencies (Sprint 5):
#   networkx>=3.3 — add to requirements.txt when implementing
#   scipy>=1.13   — for community detection helpers
