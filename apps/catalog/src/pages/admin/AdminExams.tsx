import { useCallback, useEffect, useState } from "react";
import * as examApi from "../../lib/exam";
import type { BuildExam } from "../../lib/exam";
import { getSupabase } from "../../lib/supabase";

export default function AdminExams() {
  const [rows, setRows] = useState<BuildExam[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setRows(await examApi.listOpenBuildExams());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load exams");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <header className="topbar">
        <h1>Build exams</h1>
        <div className="topbar-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void load()}>
            Refresh
          </button>
        </div>
      </header>
      <div className="content">
        <p style={{ color: "var(--muted)", maxWidth: "42rem" }}>
          Timed developer challenges. Auto-score is advisory. If you do not
          approve/reject within 48 hours of submission, the exam auto-approves.
        </p>
        {error && (
          <div className="callout callout-warn" role="alert">
            <span>!</span>
            <span>{error}</span>
          </div>
        )}
        {rows.length === 0 ? (
          <div className="card empty">
            <strong>No exams waiting</strong>
          </div>
        ) : (
          <div className="stack">
            {rows.map((exam) => (
              <div className="card card-pad" key={exam.id}>
                <strong>{exam.brief?.title ?? "Brief"}</strong>
                <p className="hint">
                  Status {exam.status.replace(/_/g, " ")}
                  {exam.reviewDeadlineAt
                    ? ` · decide by ${new Date(exam.reviewDeadlineAt).toLocaleString()}`
                    : ""}
                  {exam.autoScoreOverall !== null
                    ? ` · auto-score ${exam.autoScoreOverall}/100`
                    : ""}
                </p>
                <p>
                  <a href={exam.githubUrl ?? "#"} target="_blank" rel="noreferrer">
                    Repo
                  </a>
                  {" · "}
                  <a href={exam.liveUrl ?? "#"} target="_blank" rel="noreferrer">
                    Live
                  </a>
                </p>
                {exam.adminQuestion && (
                  <p>
                    <strong>Question:</strong> {exam.adminQuestion}
                  </p>
                )}
                {exam.developerReply && (
                  <p>
                    <strong>Reply:</strong> {exam.developerReply}
                  </p>
                )}
                <div className="bid-actions" style={{ marginTop: "0.75rem" }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={busyId === exam.id}
                    onClick={() => {
                      void (async () => {
                        setBusyId(exam.id);
                        try {
                          const { data: session } =
                            (await getSupabase()?.auth.getSession()) ?? {
                              data: { session: null },
                            };
                          if (session?.session?.access_token) {
                            await examApi.requestExamAnalysis(
                              exam.id,
                              session.session.access_token
                            );
                          }
                          await load();
                        } finally {
                          setBusyId(null);
                        }
                      })();
                    }}
                  >
                    Run auto-score
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busyId === exam.id}
                    onClick={() => {
                      const q = window.prompt("Question for the developer:");
                      if (!q) return;
                      void (async () => {
                        setBusyId(exam.id);
                        try {
                          await examApi.adminAskExam(exam.id, q);
                          await load();
                        } catch (cause) {
                          setError(
                            cause instanceof Error ? cause.message : "Ask failed"
                          );
                        } finally {
                          setBusyId(null);
                        }
                      })();
                    }}
                  >
                    Ask question
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={busyId === exam.id}
                    onClick={() => {
                      void (async () => {
                        setBusyId(exam.id);
                        try {
                          await examApi.adminDecideExam(exam.id, true);
                          await load();
                        } catch (cause) {
                          setError(
                            cause instanceof Error ? cause.message : "Approve failed"
                          );
                        } finally {
                          setBusyId(null);
                        }
                      })();
                    }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busyId === exam.id}
                    onClick={() => {
                      const notes = window.prompt("Rejection notes:");
                      if (notes === null) return;
                      void (async () => {
                        setBusyId(exam.id);
                        try {
                          await examApi.adminDecideExam(exam.id, false, notes);
                          await load();
                        } catch (cause) {
                          setError(
                            cause instanceof Error ? cause.message : "Reject failed"
                          );
                        } finally {
                          setBusyId(null);
                        }
                      })();
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
