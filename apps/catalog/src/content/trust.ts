import {
  MEMBERSHIP_FEE_INR_LABEL,
  MEMBERSHIP_FEE_LABEL,
  POSTING_FEE_INR_LABEL,
  POSTING_FEE_LABEL,
} from "../lib/pricing";

/**
 * Marketing claims live here so there is exactly one place to check them
 * against what the product actually does. Every promise below must match
 * live behaviour. Do not claim Okavo-held escrow or money/delivery guarantees.
 */

export type Promise_ = {
  title: string;
  body: string;
  /** Where the promise is actually enforced, in plain language. */
  enforcedBy: string;
};

export const GUARANTEES: Promise_[] = [
  {
    title: "Okavo does not guarantee your money or delivery",
    body: "Okavo is a marketplace intermediary. We do not hold build funds, insure payments, or promise that a developer will finish the work. The hired developer is responsible for delivery; you are responsible for paying them milestone by milestone after you accept work against the signed scope.",
    enforcedBy:
      "Terms of Use + hire success fee. Off-platform deals to avoid the fee sit outside Okavo’s process and protections.",
  },
  {
    title: "Nothing is built until you sign what it means",
    body: "Your answers become a written scope: what is included, what is excluded, and how each item will be judged complete. Developers only see it once you have signed it.",
    enforcedBy:
      "Signing freezes an immutable copy of the scope. Later edits create a new version; the original stays readable.",
  },
  {
    title: "You pay milestone by milestone, never all up front",
    body: "The contract splits the work into milestones with their own amounts and dates. You accept submitted work against the lock, then pay that milestone outside Okavo, then confirm payment here. Okavo does not hold the money.",
    enforcedBy:
      "Accept-then-pay milestone statuses. First milestone is capped near 20% so you never prepay the whole build through Okavo’s process.",
  },
  {
    title: "Changes are quoted, never assumed",
    body: "If you want something outside the signed scope, it comes back as a price and a date before anyone starts. If you say no, the original agreement stands unchanged.",
    enforcedBy:
      "Extra work is raised as a change order, priced, and applied only after you accept it.",
  },
  {
    title: "Every developer passes identity and a timed build exam before bidding",
    body: "Government ID checked by a person, then a five-hour build exam with a rotating brief, public repo, and live URL. Links are safely checked and duplicate repositories are flagged for a person rather than automatically rejected. Membership unlocks bidding only after both gates are approved.",
    enforcedBy:
      "The database refuses a bid unless identity_status and interview_status are approved and membership is paid.",
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
      "No. Okavo’s process is accept work for a milestone against the signed scope, then pay that milestone only, then confirm payment in Okavo. The first milestone is capped near 20% of the build. Okavo does not hold build money — never treat Okavo as a bank or insurer for off-platform payments.",
  },
  {
    question: "What if the developer ghosts me or cheats?",
    answer:
      "Open a dispute against the locked scope lines, and from the contract page request that Okavo block the developer from bidding again. Okavo can ban accounts after review. Okavo cannot refund money you paid outside the platform.",
  },
  {
    question: "What does Okavo cost?",
    answer:
      `Buyers pay ${POSTING_FEE_LABEL} to post a requirement. Hiring on Okavo also requires Okavo’s flat 10% hire success fee (collected via Razorpay when you award a bid) so deals stay on-platform. Developers browse free, pass identity + a timed build exam, then pay a one-time ${MEMBERSHIP_FEE_LABEL} before bidding. You still pay the developer the agreed build price yourself, milestone by milestone after accepting work. Fees are shown in USD; Razorpay collects the INR equivalent (${POSTING_FEE_INR_LABEL} / ${MEMBERSHIP_FEE_INR_LABEL} and 10% mapped the same way).`,
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
      "Today, two hard gates before a bid is possible: government ID checked by a person, then a timed build exam (a rotating brief from Okavo’s bank, about five hours, public GitHub + live URL). After 48 hours, only a score of 70 or higher may auto-approve, and only when no admin pause or per-exam hold is active. Missing and lower scores remain for manual review. Duplicate repositories, including possible forks, are flagged but never automatically rejected. Then the one-time membership unlocks bidding.",
  },
  {
    question: "Is Okavo an agency?",
    answer:
      "No. Okavo does not employ the developers and does not guarantee their work or your money. We set the rules of the marketplace transaction — signed scope, exam gate, hire fee, milestone accept-then-pay — and stay out of holding build funds. The hired developer is responsible for delivery.",
  },
  {
    question: "How new is Okavo?",
    answer:
      "New. We launched in 2026 and we are deliberately small: a hand-verified group of developers rather than an open flood of applicants. If you want a marketplace with a decade of logos on the homepage, we are not that yet. What we can promise today is signed scope, identity + build-exam gates, and clear rules that Okavo does not guarantee money or delivery.",
  },
  {
    question: "Where are the developers based?",
    answer:
      "Everywhere we can verify identity. You can filter by country if data residency or timezone overlap matters to you, and you can require that data stays in your region as part of the locked scope.",
  },
];
