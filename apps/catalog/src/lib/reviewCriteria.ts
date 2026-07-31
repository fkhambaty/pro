import type { ReviewScores } from "../types";

/**
 * The four questions a buyer answers when closing a contract.
 *
 * Deliberately short. Every question is answerable from the contract the buyer
 * signed, so nobody has to guess at a vague "professionalism" score. Options
 * run 5 down to 1 in the order listed.
 */
export const REVIEW_CRITERIA: {
  key: keyof ReviewScores;
  label: string;
  short: string;
  help: string;
  options: [string, string, string, string, string];
}[] = [
  {
    key: "scope",
    label: "Did you get what you locked?",
    short: "Locked scope",
    help: "Compare the delivered product against the scope you signed.",
    options: [
      "exactly what we agreed",
      "close, with minor gaps",
      "acceptable after rework",
      "significant mismatch",
      "not what was locked",
    ],
  },
  {
    key: "quality",
    label: "Does the work hold up?",
    short: "Quality",
    help: "Reliability in real use, not how it looked in a demo.",
    options: [
      "solid, nothing broke",
      "minor issues, quickly fixed",
      "worked after several fixes",
      "fragile, needed constant fixes",
      "unusable as delivered",
    ],
  },
  {
    key: "communication",
    label: "Did you always know where things stood?",
    short: "Communication",
    help: "Updates, questions answered, and bad news raised early.",
    options: [
      "always clear and proactive",
      "clear when asked",
      "had to chase sometimes",
      "had to chase constantly",
      "went quiet on me",
    ],
  },
  {
    key: "timeliness",
    label: "Did they hit the dates?",
    short: "Timeliness",
    help: "Against the milestone dates in the contract, not your hopes.",
    options: [
      "every milestone on time",
      "a slip or two, flagged early",
      "late but recovered",
      "repeatedly late",
      "badly overran",
    ],
  },
];

/** Formats an average like 4.25 as "4.3", and nothing when unrated. */
export function formatRating(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toFixed(1);
}
