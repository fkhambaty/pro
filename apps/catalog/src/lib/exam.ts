/**
 * Build-exam helpers — timed challenge after identity approval.
 */

import { getSupabase } from "./supabase";

export const EXAM_WINDOW_HOURS = 5;
export const EXAM_ADMIN_SLA_HOURS = 48;
export const EXAM_AUTO_APPROVE_MIN_SCORE = 70;
export const EXAM_DAILY_START_CAP = 10;

export type BuildExamStatus =
  | "in_progress"
  | "submitted"
  | "admin_questions"
  | "approved"
  | "rejected"
  | "expired";

export type ExamControls = {
  startsPaused: boolean;
  autoApprovePaused: boolean;
  updatedAt: string;
};

export type ExamBrief = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  acceptance: string;
  stackHint: string;
};

export type BuildExam = {
  id: string;
  status: BuildExamStatus;
  briefId: string;
  startedAt: string;
  dueAt: string;
  submittedAt: string | null;
  githubUrl: string | null;
  liveUrl: string | null;
  autoScoreOverall: number | null;
  autoScoreDetail: Record<string, unknown>;
  adminQuestion: string | null;
  developerReply: string | null;
  reviewerNotes: string | null;
  reviewDeadlineAt: string | null;
  autoApprovedAt: string | null;
  autoApprovalHold: boolean;
  autoApprovalHoldReason: string | null;
  normalizedRepoUrl: string | null;
  duplicateRepo: boolean;
  duplicateOfExamId: string | null;
  brief?: ExamBrief | null;
};

function db() {
  const client = getSupabase();
  if (!client) throw new Error("Supabase is not configured");
  return client;
}

export async function processExamAutoApprovals() {
  await db().rpc("process_build_exam_auto_approvals");
}

export async function fetchExamControls(): Promise<ExamControls> {
  const { data, error } = await db()
    .from("exam_controls")
    .select("starts_paused, auto_approve_paused, updated_at")
    .eq("singleton", true)
    .single();
  if (error) throw error;
  return {
    startsPaused: Boolean(data.starts_paused),
    autoApprovePaused: Boolean(data.auto_approve_paused),
    updatedAt: data.updated_at as string,
  };
}

export async function startBuildExam() {
  const { data, error } = await db().rpc("start_build_exam");
  if (error) throw error;
  return data as string;
}

export async function submitBuildExam(
  examId: string,
  githubUrl: string,
  liveUrl: string
) {
  const { error } = await db().rpc("submit_build_exam", {
    p_exam_id: examId,
    p_github_url: githubUrl,
    p_live_url: liveUrl,
  });
  if (error) throw error;
}

export async function replyBuildExam(examId: string, reply: string) {
  const { error } = await db().rpc("reply_build_exam", {
    p_exam_id: examId,
    p_reply: reply,
  });
  if (error) throw error;
}

export async function fetchMyBuildExam(): Promise<BuildExam | null> {
  await processExamAutoApprovals();
  const { data, error } = await db()
    .from("build_exams")
    .select(
      "id, status, brief_id, started_at, due_at, submitted_at, github_url, live_url, auto_score_overall, auto_score_detail, admin_question, developer_reply, reviewer_notes, review_deadline_at, auto_approved_at, auto_approval_hold, auto_approval_hold_reason, normalized_repo_url, duplicate_repo, duplicate_of_exam_id"
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: brief } = await db()
    .from("exam_briefs")
    .select("id, slug, title, summary, acceptance, stack_hint")
    .eq("id", data.brief_id)
    .maybeSingle();

  return mapExam(data, brief);
}

export async function listOpenBuildExams(): Promise<BuildExam[]> {
  await processExamAutoApprovals();
  const { data, error } = await db()
    .from("build_exams")
    .select(
      "id, status, brief_id, started_at, due_at, submitted_at, github_url, live_url, auto_score_overall, auto_score_detail, admin_question, developer_reply, reviewer_notes, review_deadline_at, auto_approved_at, auto_approval_hold, auto_approval_hold_reason, normalized_repo_url, duplicate_repo, duplicate_of_exam_id, developer_id"
    )
    .in("status", ["submitted", "admin_questions"])
    .order("review_deadline_at", { ascending: true })
    .limit(50);
  if (error) throw error;

  const rows = data ?? [];
  const briefIds = [...new Set(rows.map((r) => r.brief_id as string))];
  const { data: briefs } = await db()
    .from("exam_briefs")
    .select("id, slug, title, summary, acceptance, stack_hint")
    .in("id", briefIds);
  const byId = new Map((briefs ?? []).map((b) => [b.id as string, b]));

  return rows.map((row) => mapExam(row, byId.get(row.brief_id as string) ?? null));
}

export async function adminAskExam(examId: string, question: string) {
  const { error } = await db().rpc("admin_ask_build_exam", {
    p_exam_id: examId,
    p_question: question,
  });
  if (error) throw error;
}

export async function adminDecideExam(
  examId: string,
  approve: boolean,
  notes?: string
) {
  const { error } = await db().rpc("admin_decide_build_exam", {
    p_exam_id: examId,
    p_approve: approve,
    p_notes: notes ?? null,
  });
  if (error) throw error;
}

export async function adminSetExamPauses(
  startsPaused: boolean,
  autoApprovePaused: boolean
) {
  const { error } = await db().rpc("admin_set_exam_pauses", {
    p_starts_paused: startsPaused,
    p_auto_approve_paused: autoApprovePaused,
  });
  if (error) throw error;
}

export async function adminSetExamHold(
  examId: string,
  hold: boolean,
  reason?: string
) {
  const { error } = await db().rpc("admin_set_exam_hold", {
    p_exam_id: examId,
    p_hold: hold,
    p_reason: reason ?? null,
  });
  if (error) throw error;
}

export async function requestExamAnalysis(examId: string, accessToken: string) {
  const base = import.meta.env.VITE_SUPABASE_URL;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!base || !anon) return null;
  const response = await fetch(`${base}/functions/v1/exam-analyze`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: anon,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ exam_id: examId }),
  });
  if (!response.ok) return null;
  return (await response.json()) as { overall: number; checks: unknown[] };
}

function mapExam(
  row: Record<string, unknown>,
  brief: Record<string, unknown> | null | undefined
): BuildExam {
  return {
    id: row.id as string,
    status: row.status as BuildExamStatus,
    briefId: row.brief_id as string,
    startedAt: row.started_at as string,
    dueAt: row.due_at as string,
    submittedAt: (row.submitted_at as string) ?? null,
    githubUrl: (row.github_url as string) ?? null,
    liveUrl: (row.live_url as string) ?? null,
    autoScoreOverall:
      typeof row.auto_score_overall === "number" ? row.auto_score_overall : null,
    autoScoreDetail:
      row.auto_score_detail && typeof row.auto_score_detail === "object"
        ? (row.auto_score_detail as Record<string, unknown>)
        : {},
    adminQuestion: (row.admin_question as string) ?? null,
    developerReply: (row.developer_reply as string) ?? null,
    reviewerNotes: (row.reviewer_notes as string) ?? null,
    reviewDeadlineAt: (row.review_deadline_at as string) ?? null,
    autoApprovedAt: (row.auto_approved_at as string) ?? null,
    autoApprovalHold: row.auto_approval_hold === true,
    autoApprovalHoldReason: (row.auto_approval_hold_reason as string) ?? null,
    normalizedRepoUrl: (row.normalized_repo_url as string) ?? null,
    duplicateRepo: row.duplicate_repo === true,
    duplicateOfExamId: (row.duplicate_of_exam_id as string) ?? null,
    brief: brief
      ? {
          id: brief.id as string,
          slug: brief.slug as string,
          title: brief.title as string,
          summary: brief.summary as string,
          acceptance: brief.acceptance as string,
          stackHint: (brief.stack_hint as string) ?? "",
        }
      : null,
  };
}

/** Display INR paise for 10% hire fee from bid USD cents ($1 → ₹99). */
export function hireFeeInrPaiseFromBidUsdCents(bidUsdCents: number): number {
  const feeUsd = bidUsdCents / 100 / 10;
  return Math.max(9900, Math.round(feeUsd * 9900));
}

export function hireFeeUsdLabel(bidUsdCents: number): string {
  const fee = Math.max(1, Math.round(bidUsdCents / 100 / 10));
  return `$${fee}`;
}
