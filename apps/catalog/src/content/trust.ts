import {
  MEMBERSHIP_FEE_INR_LABEL,
  MEMBERSHIP_FEE_LABEL,
  POSTING_FEE_INR_LABEL,
  POSTING_FEE_LABEL,
} from "../lib/pricing";

/**
 * Marketing claims live here so there is exactly one place to check them
 * against what the product actually does. Every promise below must match
 * live behaviour. Where a feature is not switched on yet (Okavo-held escrow,
 * recorded build interview as a bid gate), say so explicitly — never as
 * present-tense product.
 */

export type Promise_ = {
  title: string;
  body: string;
  /** Where the promise is actually enforced, in plain language. */
  enforcedBy: string;
};

export const GUARANTEES: Promise_[] = [
  {
    title: "Nothing is built until you sign what it means",
    body: "Your answers become a written scope: what is included, what is excluded, and how each item will be judged complete. Developers only see it once you have signed it.",
    enforcedBy:
      "Signing freezes an immutable copy of the scope. Later edits create a new version; the original stays readable.",
  },
  {
    title: "You pay milestone by milestone, never all up front",
    body: "The contract splits the work into milestones with their own amounts and dates. You settle each one only after checking it against the scope you signed, so you are never more than one milestone exposed.",
    enforcedBy:
      "Milestones and their amounts are fixed on the signed contract. Okavo-held escrow is being switched on next; until then you pay your developer directly against the same milestone schedule.",
  },
  {
    title: "Changes are quoted, never assumed",
    body: "If you want something outside the signed scope, it comes back as a price and a date before anyone starts. If you say no, the original agreement stands unchanged.",
    enforcedBy:
      "Extra work is raised as a change order, priced, and applied only after you accept it.",
  },
  {
    title: "Every developer is identity-verified before they can bid",
    body: "Government ID, checked by a person, before a single bid is possible. You are not hiring an anonymous username.",
    enforcedBy:
      "The database refuses a bid from anyone whose identity has not been approved.",
  },
  {
    title: "One price, agreed up front",
    body: "You set what you can pay to build it and what you can pay each month to run it. Developers bid against those numbers, so the quotes you compare are real.",
    enforcedBy:
      "Bids are priced against one identical scope, so the only thing that differs is the developer.",
  },
  {
    title: "A warranty after you accept",
    body: "If something covered by the signed scope breaks shortly after handover, fixing it is not a new project.",
    enforcedBy: "Every contract carries a warranty period recorded on the agreement.",
  },
];

export type FaqItem = {
  question: string;
  answer: string;
};

export const FAQS: FaqItem[] = [
  {
    question: "Do I pay the developer the full amount up front?",
    answer:
      "No. Okavo’s process is accept work for a milestone against the signed scope, then pay that milestone only, then confirm payment in Okavo. The first milestone is capped near 20% of the build. Okavo does not hold build money while escrow is off — never treat Okavo as a bank or insurer for off-platform payments.",
  },
  {
    question: "What if the developer ghosts me or cheats?",
    answer:
      "Open a dispute against the locked scope lines, and from the contract page request that Okavo block the developer from bidding again. Okavo can ban accounts after review. Okavo cannot refund money you paid outside the platform.",
  },
  {
    question: "What does Okavo cost?",
    answer:
      `Buyers pay ${POSTING_FEE_LABEL} to post a requirement. Developers browse free and pay a one-time ${MEMBERSHIP_FEE_LABEL} before their first bid. Okavo’s marketplace fee is a flat 10% on the awarded build — automatic collection of that commission is next; posting and membership are live today. You still pay the developer the agreed build price milestone by milestone. Fees are shown in USD; until Stripe USD checkout is live, Razorpay collects the INR equivalent (${POSTING_FEE_INR_LABEL} / ${MEMBERSHIP_FEE_INR_LABEL}).`,
  },
  {
    question: "Why charge anything at all to post?",
    answer:
      `Because free boards fill with requirements nobody intends to fund, and good developers stop reading them. ${POSTING_FEE_LABEL} is nothing to a serious buyer and enough to stop the noise.`,
  },
  {
    question: "I do not know what I technically need. Is that a problem?",
    answer:
      "No. That is the normal case and the reason Okavo exists. You answer plain questions about what should be true when the work is finished. We turn that into the technical scope, show you a sketch of the screens it implies, and let you correct anything before you sign.",
  },
  {
    question: "What if I do not like what is delivered?",
    answer:
      "You review each milestone against the scope you signed before you release payment for it. If it does not match, you do not accept it, and you do not pay for that milestone until the work is corrected or the disagreement is resolved.",
  },
  {
    question: "What if the developer disappears halfway through?",
    answer:
      "You have only paid for milestones you already accepted, so you are never out of pocket for work you did not receive. The requirement can be reopened to other developers with the same signed scope, and their bids are priced against that same definition of done.",
  },
  {
    question: "Who owns the code?",
    answer:
      "You do. On final release of a milestone, the work delivered under it belongs to you outright — source included. The developer keeps no licence over it and cannot resell your build.",
  },
  {
    question: "How are developers vetted?",
    answer:
      "Today, one hard gate before a bid is possible: government ID checked by a person. The database refuses a bid from anyone whose identity has not been approved. A recorded build interview (ship a product end to end, scored on security, efficiency, maintainability and recovery) is the next gate we are switching on; until then buyers see identity status and the developer's record against closed contracts.",
  },
  {
    question: "Is Okavo an agency?",
    answer:
      "No. Okavo does not employ the developers and does not mark up their work. We set the rules of the transaction — the signed scope, milestone schedule, and change orders — and stay out of the pricing. Okavo-held escrow for build payments is being switched on next; until then you pay your developer directly against that same schedule.",
  },
  {
    question: "How new is Okavo?",
    answer:
      "New. We launched in 2026 and we are deliberately small: a hand-verified group of developers rather than an open flood of applicants. If you want a marketplace with a decade of logos on the homepage, we are not that yet. What we can promise today is signed scope and verified identity — which protect you whether we are ten developers or ten thousand. Okavo-held escrow is next.",
  },
  {
    question: "Where are the developers based?",
    answer:
      "Everywhere we can verify identity. You can filter by country if data residency or timezone overlap matters to you, and you can require that data stays in your region as part of the locked scope.",
  },
];
