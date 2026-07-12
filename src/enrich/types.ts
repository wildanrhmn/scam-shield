export interface Evidence {
  claim: string;
  source: string;
  // verified = a fact from an authoritative source; assessment = AI reasoning.
  kind: "verified" | "assessment";
  severity: "info" | "low" | "medium" | "high";
  subject?: string;
  detail?: string;
}

export type EntityType = "url" | "domain" | "eth_address" | "sol_address" | "email" | "phone";

export interface Entity {
  type: EntityType;
  value: string;
}
