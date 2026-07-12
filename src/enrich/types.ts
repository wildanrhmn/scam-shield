/** A single piece of evidence attached to a verdict. */
export interface Evidence {
  /** Human-readable statement, e.g. "Domain registered 4 days ago". */
  claim: string;
  /** Where it came from: "Google Safe Browsing", "RDAP", "GoPlus", "OFAC", "heuristic", "AI". */
  source: string;
  /** `verified` = a fact from an authoritative source; `assessment` = AI reasoning. */
  kind: "verified" | "assessment";
  severity: "info" | "low" | "medium" | "high";
  /** The entity this concerns, e.g. the URL or address. */
  subject?: string;
  detail?: string;
}

export type EntityType = "url" | "domain" | "eth_address" | "sol_address" | "email" | "phone";

export interface Entity {
  type: EntityType;
  value: string;
}
