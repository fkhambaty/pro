import type { Bid, Milestone, Project } from "../types";
import type { NamedValue, TrendPoint } from "./chartMath";

const STAGE_LABEL: Record<string, string> = {
  drafting: "Draft",
  locked: "Locked",
  hired: "Hired",
  in_delivery: "In delivery",
  delivered: "Delivered",
  closed: "Closed",
};

const MILESTONE_LABEL: Record<string, string> = {
  pending: "Not confirmed",
  funded: "Confirmed",
  in_progress: "In progress",
  submitted: "Submitted",
  accepted: "Accepted",
  released: "Accepted",
};

const BID_LABEL: Record<string, string> = {
  submitted: "Submitted",
  shortlisted: "Shortlisted",
  declined: "Declined",
  withdrawn: "Withdrawn",
  awarded: "Awarded",
};

function countBy<T>(
  items: T[],
  keyOf: (item: T) => string,
  labelOf: (key: string) => string,
  tones: Record<string, NamedValue["tone"]>
): NamedValue[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyOf(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, value]) => ({
      id,
      label: labelOf(id),
      value,
      tone: tones[id] ?? "accent",
    }))
    .sort((a, b) => b.value - a.value);
}

export function buyerStageMix(projects: Project[]): NamedValue[] {
  return countBy(
    projects,
    (project) => project.stage,
    (key) => STAGE_LABEL[key] ?? key,
    {
      drafting: "muted",
      locked: "accent",
      hired: "accent",
      in_delivery: "lock",
      delivered: "lock",
      closed: "ink",
    }
  );
}

export function buyerMilestoneMix(projects: Project[]): NamedValue[] {
  const milestones = projects.flatMap((project) => project.milestones);
  return countBy(
    milestones,
    (milestone) =>
      milestone.status === "accepted" ? "released" : milestone.status,
    (key) => MILESTONE_LABEL[key] ?? key,
    {
      pending: "muted",
      funded: "accent",
      in_progress: "accent",
      submitted: "warn",
      released: "lock",
    }
  );
}

export function buyerBidsPerRequirement(projects: Project[]): NamedValue[] {
  return projects
    .map((project) => ({
      id: project.id,
      label:
        project.title.length > 28
          ? `${project.title.slice(0, 26)}…`
          : project.title,
      value: project.bids.length,
      tone: "accent" as const,
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

export function buyerBudgetBands(projects: Project[]): NamedValue[] {
  return projects
    .filter((project) => project.stage !== "drafting")
    .map((project) => ({
      id: project.id,
      label:
        project.title.length > 24
          ? `${project.title.slice(0, 22)}…`
          : project.title,
      value: project.budgetMax,
      tone: "ink" as const,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

export function developerBidOutcomes(
  bids: Bid[]
): NamedValue[] {
  return countBy(
    bids,
    (bid) => bid.status,
    (key) => BID_LABEL[key] ?? key,
    {
      submitted: "accent",
      shortlisted: "warn",
      awarded: "lock",
      declined: "muted",
      withdrawn: "muted",
    }
  );
}

export function developerMilestoneMoney(milestones: Milestone[]): NamedValue[] {
  const buckets: Record<string, number> = {
    pending: 0,
    active: 0,
    released: 0,
  };
  for (const milestone of milestones) {
    if (milestone.status === "released" || milestone.status === "accepted") {
      buckets.released += milestone.amount;
    } else if (
      milestone.status === "funded" ||
      milestone.status === "in_progress" ||
      milestone.status === "submitted"
    ) {
      buckets.active += milestone.amount;
    } else {
      buckets.pending += milestone.amount;
    }
  }
  return [
    { id: "released", label: "Accepted", value: buckets.released, tone: "lock" as const },
    { id: "active", label: "In progress", value: buckets.active, tone: "accent" as const },
    { id: "pending", label: "Awaiting confirmation", value: buckets.pending, tone: "muted" as const },
  ].filter((row) => row.value > 0);
}

export function developerContractValues(projects: Project[]): NamedValue[] {
  return projects
    .map((project) => {
      const awarded = project.bids.find((bid) => bid.status === "awarded");
      return {
        id: project.id,
        label: project.lockId ?? (project.title.length > 22
          ? `${project.title.slice(0, 20)}…`
          : project.title),
        value: awarded?.amount ?? project.budgetMax,
        tone: "accent" as const,
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

export function developerWinTrend(bids: Bid[]): TrendPoint[] {
  // Group by submittedAt date string already formatted in UI (en-GB).
  const byDay = new Map<string, { total: number; won: number }>();
  for (const bid of bids) {
    const key = bid.submittedAt || "Unknown";
    const current = byDay.get(key) ?? { total: 0, won: 0 };
    current.total += 1;
    if (bid.status === "awarded") current.won += 1;
    byDay.set(key, current);
  }
  return [...byDay.entries()]
    .map(([id, stats]) => ({
      id,
      label: id,
      value: stats.total,
      secondary: stats.won,
    }))
    .slice(-14);
}

export function adminComposition(insights: {
  buyers: number;
  developers: number;
  verifiedDevelopers: number;
  projects: number;
  lockedProjects: number;
  bids: number;
}): NamedValue[] {
  return [
    { id: "buyers", label: "Buyers", value: insights.buyers, tone: "ink" as const },
    {
      id: "verified",
      label: "Verified developers",
      value: insights.verifiedDevelopers,
      tone: "lock" as const,
    },
    {
      id: "unverified",
      label: "Developers pending ID",
      value: Math.max(0, insights.developers - insights.verifiedDevelopers),
      tone: "warn" as const,
    },
    { id: "locked", label: "Locked contracts", value: insights.lockedProjects, tone: "accent" as const },
    {
      id: "drafts",
      label: "Unlocked drafts",
      value: Math.max(0, insights.projects - insights.lockedProjects),
      tone: "muted" as const,
    },
    { id: "bids", label: "Bids placed", value: insights.bids, tone: "accent" as const },
  ].filter((row) => row.value > 0);
}
