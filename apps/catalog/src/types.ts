export type Role = "guest" | "buyer" | "developer" | "admin";

export type BuyerScale = "Local business" | "SMB" | "Startup" | "Enterprise";

export type DeveloperTier = "Applicant" | "Associate" | "Verified" | "Principal";

export type VerificationStatus =
  | "not_started"
  | "submitted"
  | "in_review"
  | "approved"
  | "rejected";

export type ProjectStage =
  | "drafting"
  | "clarifying"
  | "locked"
  | "hired"
  | "in_delivery"
  | "delivered"
  | "closed";

export type BidStatus =
  | "submitted"
  | "shortlisted"
  | "declined"
  | "withdrawn"
  | "awarded";

export type MilestoneStatus =
  | "pending"
  | "funded"
  | "in_progress"
  | "submitted"
  | "accepted"
  | "released";

export type ChangeOrderStatus =
  | "proposed"
  | "priced"
  | "accepted"
  | "declined";

export type DisputeStatus = "open" | "evidence" | "resolved" | "withdrawn";

export type ScopeItem = {
  id: string;
  label: string;
  detail: string;
  included: boolean;
  acceptanceCriteria?: string;
};

export type Bid = {
  id: string;
  developerId: string;
  developerName: string;
  country: string;
  tier: DeveloperTier;
  amount: number;
  monthlyOps: number;
  weeks: number;
  note: string;
  status: BidStatus;
  submittedAt: string;
};

export type Milestone = {
  id: string;
  title: string;
  description: string;
  amount: number;
  status: MilestoneStatus;
  dueOn: string;
  deliverable?: Deliverable;
};

export type Deliverable = {
  summary: string;
  previewUrl?: string;
  repositoryUrl?: string;
  submittedAt: string;
  buyerFeedback?: string;
};

export type ChangeOrder = {
  id: string;
  title: string;
  description: string;
  status: ChangeOrderStatus;
  amount?: number;
  addedWeeks: number;
  raisedBy: "buyer" | "developer";
  createdAt: string;
};

export type ContractVersion = {
  version: number;
  reason: string;
  createdAt: string;
};

export type Dispute = {
  id: string;
  reason: string;
  status: DisputeStatus;
  raisedBy: "buyer" | "developer";
  createdAt: string;
  resolutionNote?: string;
  /** Locked scope lines this dispute points at. */
  scopeItemIds?: string[];
};

/** The four questions a buyer answers about a finished contract. */
export type ReviewScores = {
  scope: number;
  quality: number;
  communication: number;
  timeliness: number;
};

export type Review = {
  id: string;
  /** Average of the four criteria, computed by the database. */
  rating: number;
  scores: ReviewScores;
  matchedExpectation: boolean;
  comment: string;
  author: string;
  createdAt: string;
};

/** A developer as a buyer sees them when choosing who to hire. */
export type DeveloperListing = {
  id: string;
  name: string;
  headline: string;
  country: string;
  tier: DeveloperTier;
  hourlyRate: number | null;
  rating: number | null;
  reviewCount: number;
  contractsDelivered: number;
  /** Share of reviews where the locked scope was delivered, 0–100. */
  lockedScopeRate: number | null;
  criteria: {
    scope: number | null;
    quality: number | null;
    communication: number | null;
    timeliness: number | null;
  };
};

export type Project = {
  id: string;
  title: string;
  org: string;
  scale: BuyerScale;
  category: string;
  outcome: string;
  budgetMin: number;
  budgetMax: number;
  monthlyOps: number;
  timelineWeeks: number;
  skills: string[];
  scope: ScopeItem[];
  stage: ProjectStage;
  lockedAt?: string;
  lockId?: string;
  /** ISO or display date when the awarded developer countersigned. */
  developerSignedAt?: string;
  postedAgo: string;
  bids: Bid[];
  /**
   * Marketplace-visible bid count. Developers only see their own rows in
   * `bids` under RLS; use this for board competition stats.
   */
  publicBidCount: number;
  /** Lowest competing bid in major currency units, when known. */
  lowestBidAmount?: number;
  milestones: Milestone[];
  changeOrders: ChangeOrder[];
  versions: ContractVersion[];
  dispute?: Dispute;
  reviews: Review[];
  warrantyDays: number;
  ownedByMe?: boolean;
  awardedTo?: string;
};

export type Developer = {
  id: string;
  name: string;
  headline: string;
  country: string;
  rate: number;
  rating: number;
  delivered: number;
  skills: string[];
  idVerified: boolean;
  interviewScore: number;
  tier: DeveloperTier;
};

export type DeveloperAccount = {
  identityStatus: VerificationStatus;
  interviewStatus: VerificationStatus;
  membershipPaid: boolean;
  membershipPaidAt?: string;
  tier: DeveloperTier;
  interviewScores: { label: string; score: number }[];
};

export type Message = {
  id: string;
  from: "buyer" | "developer";
  authorName: string;
  body: string;
  sentAt: string;
};

export type Thread = {
  id: string;
  projectId: string;
  subject: string;
  counterpart: string;
  messages: Message[];
};

export type NotificationKind =
  | "bid"
  | "contract"
  | "milestone"
  | "message"
  | "change_order"
  | "dispute"
  | "payment"
  | "verification";

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt: string;
};

export type PaymentRecord = {
  id: string;
  label: string;
  amount: number;
  status: "pending" | "paid" | "released" | "refunded";
  date: string;
  reference: string;
};
