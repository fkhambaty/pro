/**
 * Marketing claims live here so there is exactly one place to check them
 * against what the product actually does. Every promise below is enforced in
 * the application or the database — nothing here is aspirational.
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
    title: "Your money sits in escrow, not in their account",
    body: "You fund one milestone at a time. The developer can see it is funded, which is why they start — but they cannot touch it until you accept the work.",
    enforcedBy:
      "Escrow is held by our payment provider. A milestone cannot be marked funded unless a real payment cleared.",
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
    question: "What does Okavo cost?",
    answer:
      "Buyers pay $1 to post a requirement. That is it — Okavo does not take a cut of your build budget. You then pay the developer the price you both agreed, milestone by milestone, through escrow. Developers browse for free and pay a one-time $10 membership before their first bid.",
  },
  {
    question: "Why charge anything at all to post?",
    answer:
      "Because free boards fill with requirements nobody intends to fund, and good developers stop reading them. A dollar is nothing to a serious buyer and enough to stop the noise.",
  },
  {
    question: "I do not know what I technically need. Is that a problem?",
    answer:
      "No. That is the normal case and the reason Okavo exists. You answer plain questions about what should be true when the work is finished. We turn that into the technical scope, show you a sketch of the screens it implies, and let you correct anything before you sign.",
  },
  {
    question: "What if I do not like what is delivered?",
    answer:
      "You review each milestone against the scope you signed before releasing that milestone's escrow. If it does not match, you do not accept it, and the money stays where it is until the work is corrected or the disagreement is resolved.",
  },
  {
    question: "What if the developer disappears halfway through?",
    answer:
      "You have only released escrow for milestones you already accepted, so you are never out of pocket for work you did not receive. Unreleased funds are still yours, and the requirement can be reopened to other developers with the same signed scope.",
  },
  {
    question: "Who owns the code?",
    answer:
      "You do. On final release of a milestone, the work delivered under it belongs to you outright — source included. The developer keeps no licence over it and cannot resell your build.",
  },
  {
    question: "How are developers vetted?",
    answer:
      "Two gates. Government ID checked by a person, and a recorded build interview where the developer ships a complete product end to end. The assessment scores security, efficiency under time pressure, maintainability and recovery from mistakes. Buyers see the resulting tier and the developer's record against closed contracts, not raw scores.",
  },
  {
    question: "Is Okavo an agency?",
    answer:
      "No. Okavo does not employ the developers and does not mark up their work. We set the rules of the transaction — the signed scope, the escrow, the change orders — and stay out of the pricing.",
  },
  {
    question: "How new is Okavo?",
    answer:
      "New. We launched in 2026 and we are deliberately small: a hand-verified group of developers rather than an open flood of applicants. If you want a marketplace with a decade of logos on the homepage, we are not that yet. What we can promise today is the mechanism above — signed scope, escrow, verified identity — which protects you whether we are ten developers or ten thousand.",
  },
  {
    question: "Where are the developers based?",
    answer:
      "Everywhere we can verify identity. You can filter by country if data residency or timezone overlap matters to you, and you can require that data stays in your region as part of the locked scope.",
  },
];
