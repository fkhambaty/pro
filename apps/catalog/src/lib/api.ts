import { supabase } from "./supabase";
import type {
  AppNotification,
  Bid,
  BidStatus,
  BuyerScale,
  ChangeOrder,
  ChangeOrderStatus,
  ContractVersion,
  DeveloperAccount,
  DeveloperTier,
  Dispute,
  Milestone,
  MilestoneStatus,
  NotificationKind,
  Project,
  ProjectStage,
  Review,
  ScopeItem,
  Thread,
} from "../types";

function db() {
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}

/** PostgREST returns embedded rows as an object or an array depending on cardinality. */
function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function many<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function toMoney(cents: number | null | undefined) {
  return Math.round((cents ?? 0) / 100);
}

function toCents(amount: number) {
  return Math.round(amount * 100);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relativeTime(value: string | null | undefined) {
  if (!value) return "recently";
  const diffMs = Date.now() - new Date(value).getTime();
  const hours = Math.round(diffMs / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

const SCALE_FROM_DB: Record<string, BuyerScale> = {
  local_business: "Local business",
  smb: "SMB",
  startup: "Startup",
  enterprise: "Enterprise",
};

const TIER_FROM_DB: Record<string, DeveloperTier> = {
  applicant: "Applicant",
  associate: "Associate",
  verified: "Verified",
  principal: "Principal",
};

function milestoneStatus(value: string): MilestoneStatus {
  if (value === "rejected") return "funded";
  if (value === "accepted") return "accepted";
  if (
    value === "pending" ||
    value === "funded" ||
    value === "in_progress" ||
    value === "submitted" ||
    value === "released"
  ) {
    return value;
  }
  return "pending";
}

function projectStage(value: string): ProjectStage {
  if (value === "cancelled") return "closed";
  if (
    value === "drafting" ||
    value === "locked" ||
    value === "hired" ||
    value === "in_delivery" ||
    value === "delivered" ||
    value === "closed"
  ) {
    return value;
  }
  return "drafting";
}

function makeLockReference() {
  return `LOCK-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;
}

const PROJECT_SELECT = `
  id, title, category, outcome_statement, stage, budget_min_cents, budget_max_cents,
  monthly_run_cents, timeline_weeks, published_at, created_at, buyer_id,
  buyer_profiles ( organization_name, scale ),
  scope_items ( id, label, detail, included, acceptance_criteria, position ),
  bids (
    id, developer_id, status, amount_cents, monthly_run_cents, delivery_weeks,
    message, created_at,
    developer_profiles ( tier, profiles ( full_name, country_code ) )
  ),
  contracts (
    id, lock_reference, status, locked_at, warranty_days, developer_id,
    agreed_amount_cents, current_version,
    milestones (
      id, title, description, amount_cents, status, position, due_on,
      deliverables ( summary, preview_url, repository_url, submitted_at, buyer_feedback )
    ),
    change_orders ( id, title, description, status, amount_cents, added_weeks, raised_by, created_at ),
    contract_versions ( version, reason, created_at ),
    disputes ( id, reason, status, raised_by, created_at, resolution_note ),
    reviews ( id, rating, matched_expectation, comment, author_id, created_at )
  )
`;

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapProject(row: any, currentUserId: string | null): Project {
  const buyer = one<any>(row.buyer_profiles);
  const contract = one<any>(row.contracts);

  const scope: ScopeItem[] = many<any>(row.scope_items)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((item) => ({
      id: item.id,
      label: item.label,
      detail: item.detail ?? "",
      included: item.included,
      acceptanceCriteria: item.acceptance_criteria ?? undefined,
    }));

  const bids: Bid[] = many<any>(row.bids).map((bid) => {
    const developer = one<any>(bid.developer_profiles);
    const profile = one<any>(developer?.profiles);
    return {
      id: bid.id,
      developerId: bid.developer_id,
      developerName: profile?.full_name ?? "Developer",
      country: profile?.country_code ?? "Remote",
      tier: TIER_FROM_DB[developer?.tier ?? "verified"] ?? "Verified",
      amount: toMoney(bid.amount_cents),
      monthlyOps: toMoney(bid.monthly_run_cents),
      weeks: bid.delivery_weeks,
      note: bid.message ?? "",
      status: bid.status as BidStatus,
      submittedAt: formatDate(bid.created_at),
    };
  });

  const milestones: Milestone[] = many<any>(contract?.milestones)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((milestone) => {
      const deliverable = one<any>(milestone.deliverables);
      return {
        id: milestone.id,
        title: milestone.title,
        description: milestone.description ?? "",
        amount: toMoney(milestone.amount_cents),
        status: milestoneStatus(milestone.status),
        dueOn: milestone.due_on ? formatDate(milestone.due_on) : "",
        deliverable: deliverable
          ? {
              summary: deliverable.summary,
              previewUrl: deliverable.preview_url ?? undefined,
              repositoryUrl: deliverable.repository_url ?? undefined,
              submittedAt: formatDate(deliverable.submitted_at),
              buyerFeedback: deliverable.buyer_feedback ?? undefined,
            }
          : undefined,
      };
    });

  const changeOrders: ChangeOrder[] = many<any>(contract?.change_orders).map(
    (order) => ({
      id: order.id,
      title: order.title,
      description: order.description ?? "",
      status: order.status as ChangeOrderStatus,
      amount: order.amount_cents ? toMoney(order.amount_cents) : undefined,
      addedWeeks: order.added_weeks ?? 0,
      raisedBy: order.raised_by === row.buyer_id ? "buyer" : "developer",
      createdAt: formatDate(order.created_at),
    })
  );

  const versions: ContractVersion[] = many<any>(contract?.contract_versions)
    .map((version) => ({
      version: version.version,
      reason: version.reason,
      createdAt: formatDate(version.created_at),
    }))
    .sort((a, b) => a.version - b.version);

  const disputeRow = one<any>(contract?.disputes);
  const dispute: Dispute | undefined = disputeRow
    ? {
        id: disputeRow.id,
        reason: disputeRow.reason,
        status: disputeRow.status.startsWith("resolved")
          ? "resolved"
          : disputeRow.status === "withdrawn"
            ? "withdrawn"
            : "open",
        raisedBy: disputeRow.raised_by === row.buyer_id ? "buyer" : "developer",
        createdAt: formatDate(disputeRow.created_at),
        resolutionNote: disputeRow.resolution_note ?? undefined,
      }
    : undefined;

  const reviews: Review[] = many<any>(contract?.reviews).map((review) => ({
    id: review.id,
    rating: review.rating,
    matchedExpectation: review.matched_expectation,
    comment: review.comment ?? "",
    author: review.author_id === row.buyer_id ? "Buyer" : "Developer",
    createdAt: formatDate(review.created_at),
  }));

  const awardedBid = bids.find((bid) => bid.status === "awarded");

  return {
    id: row.id,
    title: row.title,
    org: buyer?.organization_name ?? "Buyer",
    scale: SCALE_FROM_DB[buyer?.scale ?? "local_business"] ?? "Local business",
    category: row.category,
    outcome: row.outcome_statement,
    budgetMin: toMoney(row.budget_min_cents),
    budgetMax: toMoney(row.budget_max_cents),
    monthlyOps: toMoney(row.monthly_run_cents),
    timelineWeeks: row.timeline_weeks,
    skills: [row.category],
    scope,
    stage: projectStage(row.stage),
    lockedAt: contract?.locked_at ? formatDate(contract.locked_at) : undefined,
    lockId: contract?.lock_reference ?? undefined,
    postedAgo: relativeTime(row.published_at ?? row.created_at),
    bids,
    milestones,
    changeOrders,
    versions,
    dispute,
    reviews,
    warrantyDays: contract?.warranty_days ?? 30,
    ownedByMe: currentUserId ? row.buyer_id === currentUserId : false,
    awardedTo: awardedBid?.developerName,
  };
}

async function contractIdFor(projectId: string) {
  const { data, error } = await db()
    .from("contracts")
    .select("id, current_version")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchProjects(currentUserId: string | null) {
  const { data, error } = await db()
    .from("projects")
    .select(PROJECT_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapProject(row, currentUserId));
}

export async function fetchDeveloperAccount(
  profileId: string
): Promise<DeveloperAccount> {
  const { data, error } = await db()
    .from("developer_profiles")
    .select(
      "tier, identity_status, interview_status, bidding_unlocked_at, interview_assessments ( score_security, score_efficiency, score_maintainability, score_recovery )"
    )
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;

  const assessment = one<any>(data?.interview_assessments);

  return {
    identityStatus: (data?.identity_status ?? "not_started") as DeveloperAccount["identityStatus"],
    interviewStatus: (data?.interview_status ?? "not_started") as DeveloperAccount["interviewStatus"],
    membershipPaid: Boolean(data?.bidding_unlocked_at),
    membershipPaidAt: data?.bidding_unlocked_at
      ? formatDate(data.bidding_unlocked_at)
      : undefined,
    tier: TIER_FROM_DB[data?.tier ?? "applicant"] ?? "Applicant",
    interviewScores: [
      { label: "Security practices", score: assessment?.score_security ?? 0 },
      { label: "Efficiency under time pressure", score: assessment?.score_efficiency ?? 0 },
      { label: "Maintainability and structure", score: assessment?.score_maintainability ?? 0 },
      { label: "Recovery from mistakes", score: assessment?.score_recovery ?? 0 },
    ],
  };
}

export async function fetchThreads(userId: string): Promise<Thread[]> {
  const { data, error } = await db()
    .from("message_threads")
    .select(
      "id, subject, project_id, buyer_id, developer_id, messages ( id, body, sender_id, created_at )"
    )
    .order("last_message_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((thread: any) => ({
    id: thread.id,
    projectId: thread.project_id ?? "",
    subject: thread.subject,
    counterpart: thread.buyer_id === userId ? "Developer" : "Buyer",
    messages: many<any>(thread.messages)
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      .map((message) => ({
        id: message.id,
        from: message.sender_id === thread.buyer_id ? "buyer" : "developer",
        authorName: message.sender_id === userId ? "You" : "Them",
        body: message.body,
        sentAt: formatDateTime(message.created_at),
      })),
  }));
}

export async function fetchNotifications(
  userId: string
): Promise<AppNotification[]> {
  const { data, error } = await db()
    .from("notifications")
    .select("id, kind, title, body, link_path, read_at, created_at")
    .eq("profile_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    kind: row.kind as NotificationKind,
    title: row.title,
    body: row.body ?? "",
    link: row.link_path ?? undefined,
    read: Boolean(row.read_at),
    createdAt: formatDate(row.created_at),
  }));
}

export async function createProject(
  buyerId: string,
  input: {
    title: string;
    category: string;
    outcome: string;
    budgetMin: number;
    budgetMax: number;
    monthlyOps: number;
    timelineWeeks: number;
    scope: ScopeItem[];
  }
) {
  const { data, error } = await db()
    .from("projects")
    .insert({
      buyer_id: buyerId,
      title: input.title,
      category: input.category,
      outcome_statement: input.outcome,
      budget_min_cents: toCents(input.budgetMin),
      budget_max_cents: toCents(input.budgetMax),
      monthly_run_cents: toCents(input.monthlyOps),
      timeline_weeks: input.timelineWeeks,
      stage: "drafting",
    })
    .select("id")
    .single();
  if (error) throw error;

  if (input.scope.length > 0) {
    const { error: scopeError } = await db()
      .from("scope_items")
      .insert(
        input.scope.map((item, index) => ({
          project_id: data.id,
          label: item.label,
          detail: item.detail,
          included: item.included,
          acceptance_criteria: item.acceptanceCriteria ?? null,
          position: index,
        }))
      );
    if (scopeError) throw scopeError;
  }

  return data.id as string;
}

export async function lockProject(
  projectId: string,
  buyerId: string,
  monthlyOps: number,
  weeks: number
) {
  const existing = await contractIdFor(projectId);

  let contractId = existing?.id as string | undefined;
  if (!contractId) {
    const { data, error } = await db()
      .from("contracts")
      .insert({
        project_id: projectId,
        buyer_id: buyerId,
        lock_reference: makeLockReference(),
        status: "draft",
        agreed_monthly_cents: toCents(monthlyOps),
        agreed_weeks: weeks,
      })
      .select("id")
      .single();
    if (error) throw error;
    contractId = data.id;
  }

  // The status change fires snapshot_contract_scope(), freezing the scope.
  const { error: lockError } = await db()
    .from("contracts")
    .update({
      status: "locked",
      locked_at: new Date().toISOString(),
      buyer_signed_at: new Date().toISOString(),
    })
    .eq("id", contractId);
  if (lockError) throw lockError;

  const { error: stageError } = await db()
    .from("projects")
    .update({ stage: "locked", published_at: new Date().toISOString() })
    .eq("id", projectId);
  if (stageError) throw stageError;
}

export async function placeBid(
  projectId: string,
  developerId: string,
  input: { amount: number; monthlyOps: number; weeks: number; note: string }
) {
  const { error } = await db().from("bids").insert({
    project_id: projectId,
    developer_id: developerId,
    amount_cents: toCents(input.amount),
    monthly_run_cents: toCents(input.monthlyOps),
    delivery_weeks: input.weeks,
    message: input.note,
    accepts_locked_scope: true,
  });
  if (error) throw error;
}

export async function setBidStatus(bidId: string, status: BidStatus) {
  const { error } = await db().from("bids").update({ status }).eq("id", bidId);
  if (error) throw error;
}

export async function awardBid(
  projectId: string,
  bidId: string,
  amount: number
) {
  const contract = await contractIdFor(projectId);
  if (!contract) throw new Error("Lock the requirement before awarding");

  const { data: bid, error: bidError } = await db()
    .from("bids")
    .select("developer_id, delivery_weeks")
    .eq("id", bidId)
    .single();
  if (bidError) throw bidError;

  await db().from("bids").update({ status: "declined" }).eq("project_id", projectId);
  await db().from("bids").update({ status: "awarded" }).eq("id", bidId);

  const { error: contractError } = await db()
    .from("contracts")
    .update({
      developer_id: bid.developer_id,
      agreed_amount_cents: toCents(amount),
      agreed_weeks: bid.delivery_weeks,
      status: "active",
      developer_signed_at: new Date().toISOString(),
    })
    .eq("id", contract.id);
  if (contractError) throw contractError;

  await db().from("projects").update({ stage: "in_delivery" }).eq("id", projectId);

  const first = Math.round(amount * 0.35);
  const second = Math.round(amount * 0.4);
  const { error: milestoneError } = await db()
    .from("milestones")
    .insert([
      {
        contract_id: contract.id,
        title: "Foundation and core flows",
        description: "Environment, data model, and the first locked scope items.",
        amount_cents: toCents(first),
        position: 0,
      },
      {
        contract_id: contract.id,
        title: "Main functionality",
        description: "The bulk of the locked scope, demoed weekly.",
        amount_cents: toCents(second),
        position: 1,
      },
      {
        contract_id: contract.id,
        title: "Acceptance and handover",
        description: "Every scope item verified, documentation and deployment.",
        amount_cents: toCents(amount - first - second),
        position: 2,
      },
    ]);
  if (milestoneError) throw milestoneError;
}

export async function payMembership(profileId: string, amountCents: number) {
  const { error } = await db().from("payments").insert({
    profile_id: profileId,
    purpose: "bidding_membership",
    status: "paid",
    amount_cents: amountCents,
    provider: "demo",
    provider_reference: `demo_${Date.now()}`,
    paid_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/**
 * Buys the right to post one requirement. The insert trigger on `projects`
 * consumes it, so a fee cannot be reused across requirements.
 */
export async function payPostingFee(profileId: string, amountCents: number) {
  const { error } = await db().from("payments").insert({
    profile_id: profileId,
    purpose: "requirement_posting",
    status: "paid",
    amount_cents: amountCents,
    provider: "demo",
    provider_reference: `demo_${Date.now()}`,
    paid_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function countPostingFees(profileId: string) {
  const { count, error } = await db()
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .eq("purpose", "requirement_posting")
    .eq("status", "paid");
  if (error) throw error;
  return count ?? 0;
}

export async function submitInterview(profileId: string) {
  const { error } = await db()
    .from("developer_profiles")
    .update({ interview_status: "submitted" })
    .eq("profile_id", profileId);
  if (error) throw error;
}

export async function fundMilestone(milestoneId: string) {
  const { error } = await db()
    .from("milestones")
    .update({ status: "funded", funded_at: new Date().toISOString() })
    .eq("id", milestoneId);
  if (error) throw error;
}

export async function submitMilestone(
  milestoneId: string,
  developerId: string,
  summary: string,
  previewUrl: string
) {
  const { error } = await db().from("deliverables").insert({
    milestone_id: milestoneId,
    developer_id: developerId,
    summary,
    preview_url: previewUrl || null,
  });
  if (error) throw error;

  const { error: statusError } = await db()
    .from("milestones")
    .update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", milestoneId);
  if (statusError) throw statusError;
}

export async function acceptMilestone(milestoneId: string) {
  const now = new Date().toISOString();
  const { error } = await db()
    .from("milestones")
    .update({ status: "released", accepted_at: now, released_at: now })
    .eq("id", milestoneId);
  if (error) throw error;
}

export async function createChangeOrder(
  projectId: string,
  raisedBy: string,
  title: string,
  description: string
) {
  const contract = await contractIdFor(projectId);
  if (!contract) throw new Error("No contract for this project");
  const { error } = await db().from("change_orders").insert({
    contract_id: contract.id,
    raised_by: raisedBy,
    title,
    description,
  });
  if (error) throw error;
}

export async function priceChangeOrder(
  changeOrderId: string,
  amount: number,
  addedWeeks: number
) {
  const { error } = await db()
    .from("change_orders")
    .update({
      status: "priced",
      amount_cents: toCents(amount),
      added_weeks: addedWeeks,
    })
    .eq("id", changeOrderId);
  if (error) throw error;
}

export async function decideChangeOrder(
  projectId: string,
  changeOrderId: string,
  accepted: boolean
) {
  const { data: order, error: readError } = await db()
    .from("change_orders")
    .select("title, added_weeks, contract_id")
    .eq("id", changeOrderId)
    .single();
  if (readError) throw readError;

  const { error } = await db()
    .from("change_orders")
    .update({
      status: accepted ? "accepted" : "declined",
      decided_at: new Date().toISOString(),
    })
    .eq("id", changeOrderId);
  if (error) throw error;

  if (!accepted) return;

  const { count } = await db()
    .from("scope_items")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  await db().from("scope_items").insert({
    project_id: projectId,
    label: order.title,
    detail: "Added by an accepted change order.",
    included: true,
    position: count ?? 0,
  });

  const { data: project } = await db()
    .from("projects")
    .select("timeline_weeks")
    .eq("id", projectId)
    .single();

  await db()
    .from("projects")
    .update({
      timeline_weeks: (project?.timeline_weeks ?? 0) + (order.added_weeks ?? 0),
    })
    .eq("id", projectId);

  const { data: contract } = await db()
    .from("contracts")
    .select("current_version")
    .eq("id", order.contract_id)
    .single();

  const nextVersion = (contract?.current_version ?? 1) + 1;
  await db()
    .from("contracts")
    .update({ current_version: nextVersion })
    .eq("id", order.contract_id);
  await db().from("contract_versions").insert({
    contract_id: order.contract_id,
    version: nextVersion,
    snapshot: {},
    reason: `Change order accepted: ${order.title}`,
  });
}

export async function raiseDispute(
  projectId: string,
  raisedBy: string,
  reason: string
) {
  const contract = await contractIdFor(projectId);
  if (!contract) throw new Error("No contract for this project");
  const { error } = await db().from("disputes").insert({
    contract_id: contract.id,
    raised_by: raisedBy,
    reason,
  });
  if (error) throw error;

  await db()
    .from("contracts")
    .update({ status: "disputed" })
    .eq("id", contract.id);
}

export async function resolveDispute(disputeId: string, note: string) {
  const { error } = await db()
    .from("disputes")
    .update({
      status: "resolved_buyer",
      resolution_note: note,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", disputeId);
  if (error) throw error;
}

export async function leaveReview(
  projectId: string,
  authorId: string,
  input: { rating: number; matchedExpectation: boolean; comment: string }
) {
  const contract = await contractIdFor(projectId);
  if (!contract) throw new Error("No contract for this project");

  const { data: contractRow } = await db()
    .from("contracts")
    .select("developer_id, buyer_id")
    .eq("id", contract.id)
    .single();

  const subjectId =
    contractRow?.developer_id === authorId
      ? contractRow?.buyer_id
      : contractRow?.developer_id;

  const { error } = await db().from("reviews").insert({
    contract_id: contract.id,
    author_id: authorId,
    subject_id: subjectId ?? authorId,
    rating: input.rating,
    matched_expectation: input.matchedExpectation,
    comment: input.comment,
  });
  if (error) throw error;

  await db().from("projects").update({ stage: "closed" }).eq("id", projectId);
  await db()
    .from("contracts")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", contract.id);
}

export async function sendMessage(
  threadId: string,
  senderId: string,
  body: string
) {
  const { error } = await db().from("messages").insert({
    thread_id: threadId,
    sender_id: senderId,
    body,
  });
  if (error) throw error;

  await db()
    .from("message_threads")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", threadId);
}

export async function markNotificationsRead(userId: string) {
  const { error } = await db()
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("profile_id", userId)
    .is("read_at", null);
  if (error) throw error;
}
