import type { BuyerScale } from "../types";

export type Audience = "customers" | "staff" | "both";

export type PreviewInput = {
  scale: BuyerScale;
  categoryId: string;
  categoryLabel: string;
  outcome: string;
  audience: Audience;
  primaryAction: string;
  mustHaves: string[];
  excluded: string;
};

export type ScreenKind =
  | "home"
  | "catalog"
  | "booking"
  | "auth"
  | "checkout"
  | "dashboard"
  | "reports"
  | "alerts"
  | "locations"
  | "assistant";

export type PreviewScreen = {
  id: string;
  label: string;
  /** Plain-English reason this screen exists, tied to their answers. */
  why: string;
  kind: ScreenKind;
  title: string;
  subtitle?: string;
  cta?: string;
  items: string[];
  fields: string[];
  badges: string[];
};

export type RequirementBlueprint = {
  ready: boolean;
  missing: string[];
  headline: string;
  heardAs: string;
  audienceLabel: string;
  screens: PreviewScreen[];
  included: string[];
  excluded: string[];
  showPhone: boolean;
  showDesktop: boolean;
};

const AUDIENCE_LABEL: Record<Audience, string> = {
  customers: "Your customers",
  staff: "Your team",
  both: "Customers and your team",
};

type CategoryPack = {
  defaultAction: string;
  defaultItems: string[];
  homeTitle: string;
  homeWhy: string;
  suggestedMustHaves: string[];
  outcomePrompts: string[];
  exclusionHints: string[];
  mustHaveOptions: string[];
  /** Always-on lock lines for this category (contract-grade base). */
  lockBaseItems: { label: string; detail: string; acceptance: string }[];
};

const SHARED_LOCK_BASE: CategoryPack["lockBaseItems"] = [
  {
    label: "Deployed and reachable",
    detail: "A production or staging URL the buyer can open without a VPN.",
    acceptance: "Buyer can open the URL and complete the primary happy path.",
  },
  {
    label: "Handover package",
    detail: "Credentials, environments, and a short runbook for day-two ops.",
    acceptance: "Buyer can start, stop, and recover the service using the runbook alone.",
  },
  {
    label: "Defects against this lock",
    detail: "Bugs that break an included scope line are fixed within the warranty window.",
    acceptance: "Reported defects that map to an included line are fixed free within warranty days.",
  },
];

const SHARED_MUST = [
  "Works on phones",
  "Take payments",
  "Customer logins",
  "Admin dashboard",
  "Email or WhatsApp alerts",
  "Reports and exports",
  "Multiple locations",
  "Single sign-on",
  "Data stays in my region",
];

export const CATEGORY_PACKS: Record<string, CategoryPack> = {
  store: {
    defaultAction: "Buy now",
    defaultItems: ["Featured product", "Today's specials", "Pickup options"],
    homeTitle: "Storefront",
    homeWhy: "You chose Sell online — shoppers land here first.",
    suggestedMustHaves: ["Works on phones", "Take payments", "Admin dashboard"],
    outcomePrompts: [
      "Customers browse my products, pay online, and I see every order on one screen.",
      "People order for pickup, choose a time slot, and get a confirmation message.",
      "I sell across two shops with one catalogue and separate stock counts.",
    ],
    exclusionHints: [
      "Native mobile app",
      "Same-day delivery",
      "Marketplace for other sellers",
    ],
    mustHaveOptions: SHARED_MUST,
    lockBaseItems: [
      ...SHARED_LOCK_BASE,
      {
        label: "Catalogue and checkout",
        detail: "Shoppers can browse listed products and complete a purchase.",
        acceptance: "A test order completes and appears in the admin list.",
      },
    ],
  },
  booking: {
    defaultAction: "Book a slot",
    defaultItems: ["Available today", "This week", "Staff calendar"],
    homeTitle: "Booking",
    homeWhy: "You chose Take bookings — people pick a time here.",
    suggestedMustHaves: [
      "Works on phones",
      "Customer logins",
      "Email or WhatsApp alerts",
    ],
    outcomePrompts: [
      "Clients book appointments online, get reminders, and I stop double-booking.",
      "Patients choose a doctor, pick a slot, and pay the consult fee upfront.",
      "My studio shows open classes; people reserve a spot and get a WhatsApp confirm.",
    ],
    exclusionHints: [
      "Video consultations",
      "Insurance billing",
      "Walk-in queue management",
    ],
    mustHaveOptions: SHARED_MUST,
    lockBaseItems: [
      ...SHARED_LOCK_BASE,
      {
        label: "Bookable calendar",
        detail: "Customers or staff can reserve an available slot without double-booking.",
        acceptance: "A slot books once; a second attempt on the same slot is refused.",
      },
    ],
  },
  internal: {
    defaultAction: "Add record",
    defaultItems: ["Open tasks", "This week's numbers", "Team queue"],
    homeTitle: "Team workspace",
    homeWhy: "You chose Replace spreadsheets — staff work from this screen.",
    suggestedMustHaves: ["Admin dashboard", "Reports and exports", "Customer logins"],
    outcomePrompts: [
      "My team stops sharing Excel files. Everyone updates the same live list.",
      "Managers approve requests, see status, and export a weekly report.",
      "Staff log jobs, attach photos, and I know what is overdue without chasing.",
    ],
    exclusionHints: [
      "Public customer website",
      "Mobile app for customers",
      "Accounting / payroll",
    ],
    mustHaveOptions: SHARED_MUST,
    lockBaseItems: [
      ...SHARED_LOCK_BASE,
      {
        label: "Shared live records",
        detail: "The team works from one live list instead of emailed spreadsheets.",
        acceptance: "Two users see the same record update without a file exchange.",
      },
    ],
  },
  portal: {
    defaultAction: "Open account",
    defaultItems: ["Invoices", "Documents", "Support"],
    homeTitle: "Customer portal",
    homeWhy: "You chose Customer portal — signed-in people self-serve here.",
    suggestedMustHaves: [
      "Customer logins",
      "Works on phones",
      "Reports and exports",
    ],
    outcomePrompts: [
      "Customers log in, see invoices, update payment methods, and download reports.",
      "Partners upload documents, track status, and message my team in one place.",
      "Members manage their profile, renewals, and past purchases without emailing us.",
    ],
    exclusionHints: [
      "Public marketing site redesign",
      "Native mobile app",
      "Live chat agent",
    ],
    mustHaveOptions: SHARED_MUST,
    lockBaseItems: [
      ...SHARED_LOCK_BASE,
      {
        label: "Signed-in self-serve",
        detail: "Customers log in and complete the portal jobs without emailing staff.",
        acceptance: "A signed-in user finishes the primary portal task end to end.",
      },
    ],
  },
  ai: {
    defaultAction: "Ask",
    defaultItems: ["Suggested answers", "Recent questions", "Sources used"],
    homeTitle: "Assistant",
    homeWhy: "You chose Add an AI feature — this is where people ask and get help.",
    suggestedMustHaves: ["Customer logins", "Admin dashboard", "Works on phones"],
    outcomePrompts: [
      "Visitors ask questions in plain language and get answers from our docs only.",
      "Support staff draft replies with AI, then approve before anything sends.",
      "Staff search policies and past tickets and get a cited summary in seconds.",
    ],
    exclusionHints: [
      "Fully autonomous replies with no human review",
      "Training on customer private data outside our account",
      "Voice / phone bot",
    ],
    mustHaveOptions: SHARED_MUST,
    lockBaseItems: [
      ...SHARED_LOCK_BASE,
      {
        label: "Grounded answers",
        detail: "The assistant answers from the buyer’s allowed sources and cites them.",
        acceptance: "A sample question returns an answer with a visible source citation.",
      },
    ],
  },
  other: {
    defaultAction: "Get started",
    defaultItems: ["Main action", "Key list", "Status"],
    homeTitle: "Main screen",
    homeWhy: "You described something custom — we sketch the main screen from your words.",
    suggestedMustHaves: ["Works on phones", "Admin dashboard"],
    outcomePrompts: [
      "When this is done, my users can finish their main job without calling me.",
      "One screen shows status, the next step, and who owns it.",
      "People submit a request, track it, and get notified when it is done.",
    ],
    exclusionHints: ["Native mobile app", "Hardware / IoT", "Third-party marketplace"],
    mustHaveOptions: SHARED_MUST,
    lockBaseItems: [
      ...SHARED_LOCK_BASE,
      {
        label: "Primary job complete",
        detail: "A user can finish the main job described in the outcome without calling the buyer.",
        acceptance: "A reviewer walks the happy path and confirms the stated outcome is true.",
      },
    ],
  },
};

const MUST_HAVE_SCREEN: Record<
  string,
  { id: string; label: string; kind: ScreenKind; title: string; why: string }
> = {
  "Customer logins": {
    id: "auth",
    label: "Sign in",
    kind: "auth",
    title: "Sign in",
    why: "You ticked Customer logins — accounts start here.",
  },
  "Take payments": {
    id: "pay",
    label: "Checkout",
    kind: "checkout",
    title: "Pay securely",
    why: "You ticked Take payments — money changes hands on this screen.",
  },
  "Admin dashboard": {
    id: "admin",
    label: "Admin",
    kind: "dashboard",
    title: "Operations",
    why: "You ticked Admin dashboard — you run the business from here.",
  },
  "Reports and exports": {
    id: "reports",
    label: "Reports",
    kind: "reports",
    title: "Reports",
    why: "You ticked Reports and exports — numbers and downloads live here.",
  },
  "Email or WhatsApp alerts": {
    id: "alerts",
    label: "Alerts",
    kind: "alerts",
    title: "Notifications",
    why: "You ticked Email or WhatsApp alerts — people get told when something matters.",
  },
  "Multiple locations": {
    id: "locations",
    label: "Locations",
    kind: "locations",
    title: "Choose a location",
    why: "You ticked Multiple locations — the product must know which site is in play.",
  },
};

type Trait = {
  items: string[];
  fields: string[];
  badges: string[];
  actionHint?: string;
};

/** Lightweight keyword read of the buyer's own words — no AI. */
function traitsFromOutcome(outcome: string, categoryId: string): Trait {
  const text = outcome.toLowerCase();
  const items: string[] = [];
  const fields: string[] = [];
  const badges: string[] = [];
  let actionHint: string | undefined;

  const pushUnique = (list: string[], value: string) => {
    if (!list.includes(value)) list.push(value);
  };

  if (/order|cake|menu|product|shop|cart|catalog|catalogue|sell/.test(text)) {
    pushUnique(items, "Catalogue");
    pushUnique(items, "Orders today");
    pushUnique(badges, "Orders");
    actionHint = actionHint ?? "Place order";
  }
  if (/pickup|pick-up|collect/.test(text)) {
    pushUnique(items, "Pickup times");
    pushUnique(fields, "Pickup slot");
    pushUnique(badges, "Pickup");
  }
  if (/deliver/.test(text)) {
    pushUnique(items, "Delivery area");
    pushUnique(badges, "Delivery");
  }
  if (/book|appoint|slot|class|consult|reserv/.test(text)) {
    pushUnique(items, "Open slots");
    pushUnique(fields, "Date & time");
    pushUnique(badges, "Bookings");
    actionHint = actionHint ?? "Book now";
  }
  if (/invoice|bill|payment|pay|stripe|checkout/.test(text)) {
    pushUnique(items, "Invoices");
    pushUnique(fields, "Card details");
    pushUnique(badges, "Payments");
    actionHint = actionHint ?? "Pay";
  }
  if (/login|sign in|account|member|portal|self-serve|self serve/.test(text)) {
    pushUnique(fields, "Email");
    pushUnique(fields, "Password");
    pushUnique(badges, "Accounts");
  }
  if (/report|export|download|usage|analytics/.test(text)) {
    pushUnique(items, "Export CSV");
    pushUnique(badges, "Reports");
  }
  if (/whatsapp|sms|email|remind|alert|notif/.test(text)) {
    pushUnique(items, "Reminder message");
    pushUnique(badges, "Alerts");
  }
  if (/team|staff|internal|approve|queue|spreadsheet|excel/.test(text)) {
    pushUnique(items, "Team queue");
    pushUnique(badges, "Staff");
    actionHint = actionHint ?? "Update status";
  }
  if (/ai|assistant|chat|ask|search/.test(text) || categoryId === "ai") {
    pushUnique(items, "Suggested answers");
    pushUnique(fields, "Your question");
    pushUnique(badges, "AI");
    actionHint = actionHint ?? "Ask";
  }
  if (/location|branch|shop|clinic|storefront|two shop|multi/.test(text)) {
    pushUnique(items, "Location picker");
    pushUnique(badges, "Multi-site");
  }

  return { items, fields, badges, actionHint };
}

function firstSentence(outcome: string): string {
  const cleaned = outcome.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";
  const match = cleaned.match(/^[^.!?]+[.!?]/);
  if (match) return match[0].trim();
  return cleaned.length > 110 ? `${cleaned.slice(0, 107)}…` : cleaned;
}

function parseExclusions(raw: string): string[] {
  return raw
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function screenChrome(
  kind: ScreenKind,
  base: PreviewScreen,
  trait: Trait,
  pack: CategoryPack,
  primaryAction: string
): PreviewScreen {
  const cta =
    primaryAction.trim() ||
    trait.actionHint ||
    pack.defaultAction;

  switch (kind) {
    case "home":
    case "catalog":
    case "booking":
    case "assistant":
      return {
        ...base,
        cta,
        items:
          trait.items.length > 0
            ? trait.items.slice(0, 4)
            : pack.defaultItems.slice(0, 3),
        fields: trait.fields.slice(0, 2),
        badges: trait.badges.slice(0, 3),
        subtitle: base.subtitle,
      };
    case "auth":
      return {
        ...base,
        cta: "Sign in",
        items: [],
        fields: ["Email", "Password"],
        badges: ["Secure account"],
      };
    case "checkout":
      return {
        ...base,
        cta: "Pay now",
        items: trait.items.includes("Orders today")
          ? ["Order summary", "Tax", "Total"]
          : ["Item", "Fees", "Total"],
        fields: ["Card number", "Expiry"],
        badges: ["Payments"],
      };
    case "dashboard":
      return {
        ...base,
        cta: "View all",
        items:
          trait.items.length > 0
            ? trait.items.slice(0, 3)
            : ["Today", "Needs attention", "Done"],
        fields: [],
        badges: ["Live ops"],
      };
    case "reports":
      return {
        ...base,
        cta: "Export",
        items: ["This week", "This month", "Custom range"],
        fields: [],
        badges: ["CSV", "PDF"],
      };
    case "alerts":
      return {
        ...base,
        cta: undefined,
        items: ["Confirmation", "Reminder", "Status change"],
        fields: [],
        badges: ["Email", "WhatsApp"],
      };
    case "locations":
      return {
        ...base,
        cta: "Continue",
        items: ["Location A", "Location B", "All locations"],
        fields: [],
        badges: ["Multi-site"],
      };
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function buildRequirementBlueprint(
  input: PreviewInput
): RequirementBlueprint {
  const pack = CATEGORY_PACKS[input.categoryId] ?? CATEGORY_PACKS.other;
  const outcome = input.outcome.trim();
  const trait = traitsFromOutcome(outcome, input.categoryId);
  const excluded = parseExclusions(input.excluded);
  const missing: string[] = [];

  if (!outcome) missing.push("Describe what should be true when this is finished");
  if (input.mustHaves.length === 0) missing.push("Tick at least one must-have");

  const included = [...input.mustHaves];
  const showPhone = input.mustHaves.includes("Works on phones");
  const showDesktop = true;

  const homeKind: ScreenKind =
    input.categoryId === "booking"
      ? "booking"
      : input.categoryId === "store"
        ? "catalog"
        : input.categoryId === "ai"
          ? "assistant"
          : "home";

  const screens: PreviewScreen[] = [];

  const homeBase: PreviewScreen = {
    id: "home",
    label: pack.homeTitle,
    why: pack.homeWhy,
    kind: homeKind,
    title: pack.homeTitle,
    subtitle: firstSentence(outcome) || undefined,
    items: [],
    fields: [],
    badges: [],
  };
  screens.push(
    screenChrome(homeKind, homeBase, trait, pack, input.primaryAction)
  );

  for (const must of input.mustHaves) {
    const meta = MUST_HAVE_SCREEN[must];
    if (!meta) continue;
    const base: PreviewScreen = {
      id: meta.id,
      label: meta.label,
      why: meta.why,
      kind: meta.kind,
      title: meta.title,
      items: [],
      fields: [],
      badges: [],
    };
    screens.push(
      screenChrome(meta.kind, base, trait, pack, input.primaryAction)
    );
  }

  const heardAs =
    firstSentence(outcome) ||
    `A ${input.categoryLabel.toLowerCase()} for ${AUDIENCE_LABEL[input.audience].toLowerCase()}.`;

  const headline = outcome
    ? `${input.categoryLabel} · ${input.scale}`
    : "Fill in your answers to see what we will lock";

  return {
    ready: missing.length === 0,
    missing,
    headline,
    heardAs,
    audienceLabel: AUDIENCE_LABEL[input.audience],
    screens,
    included,
    excluded,
    showPhone,
    showDesktop,
  };
}

export function mustHavesForCategory(categoryId: string): string[] {
  return CATEGORY_PACKS[categoryId]?.mustHaveOptions ?? SHARED_MUST;
}

export function lockBaseItemsFor(categoryId: string) {
  return (
    CATEGORY_PACKS[categoryId]?.lockBaseItems ??
    CATEGORY_PACKS.other.lockBaseItems
  );
}

export function suggestedMustHaves(categoryId: string): string[] {
  return CATEGORY_PACKS[categoryId]?.suggestedMustHaves ?? ["Works on phones"];
}

export function outcomePromptsFor(categoryId: string): string[] {
  return CATEGORY_PACKS[categoryId]?.outcomePrompts ?? CATEGORY_PACKS.other.outcomePrompts;
}

export function exclusionHintsFor(categoryId: string): string[] {
  return (
    CATEGORY_PACKS[categoryId]?.exclusionHints ?? CATEGORY_PACKS.other.exclusionHints
  );
}

export function defaultActionFor(categoryId: string): string {
  return CATEGORY_PACKS[categoryId]?.defaultAction ?? "Get started";
}
