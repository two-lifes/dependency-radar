/**
 * The parts of an OSV vulnerability record the analysis needs. The Zod schema
 * for the API response lives with the OSV client (plan task 9).
 */
export type OsvRecord = {
  id: string;
  aliases?: string[];
  summary?: string;
  details?: string;
  /** ISO date; set when the record was retracted. */
  withdrawn?: string;
  severity?: { type: string; score: string }[];
  database_specific?: { severity?: string };
  affected?: OsvAffected[];
};

export type OsvAffected = {
  package?: { ecosystem: string; name: string };
  ranges?: { type: string; events: OsvEvent[] }[];
  versions?: string[];
};

export type OsvEvent = {
  introduced?: string;
  fixed?: string;
  last_affected?: string;
};
