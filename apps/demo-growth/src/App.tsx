import { useMemo, useState } from "react";
import "./index.css";

type FeeStatus = "paid" | "due" | "partial";

type Student = {
  id: string;
  name: string;
  batch: string;
  phone: string;
  feeStatus: FeeStatus;
  dueAmount: number;
};

type Batch = {
  id: string;
  name: string;
  schedule: string;
  seats: number;
  filled: number;
};

type Announcement = {
  id: string;
  title: string;
  body: string;
  when: string;
};

type View =
  | "dashboard"
  | "students"
  | "batches"
  | "fees"
  | "announcements"
  | "reminders"
  | "parent";

const INITIAL_STUDENTS: Student[] = [
  {
    id: "s1",
    name: "Aarav Deshmukh",
    batch: "JEE Evening",
    phone: "98XXXX2101",
    feeStatus: "due",
    dueAmount: 8500,
  },
  {
    id: "s2",
    name: "Isha Kulkarni",
    batch: "NEET Morning",
    phone: "98XXXX8842",
    feeStatus: "paid",
    dueAmount: 0,
  },
  {
    id: "s3",
    name: "Rohan Patil",
    batch: "JEE Evening",
    phone: "98XXXX3310",
    feeStatus: "partial",
    dueAmount: 4000,
  },
  {
    id: "s4",
    name: "Sneha Joshi",
    batch: "Foundation 9",
    phone: "98XXXX1199",
    feeStatus: "due",
    dueAmount: 6000,
  },
];

const INITIAL_BATCHES: Batch[] = [
  {
    id: "b1",
    name: "JEE Evening",
    schedule: "Mon–Sat · 5:30–8:00 PM",
    seats: 40,
    filled: 36,
  },
  {
    id: "b2",
    name: "NEET Morning",
    schedule: "Mon–Sat · 7:00–10:00 AM",
    seats: 35,
    filled: 31,
  },
  {
    id: "b3",
    name: "Foundation 9",
    schedule: "Tue–Sun · 6:00–8:00 PM",
    seats: 30,
    filled: 22,
  },
];

const NAV: { id: View; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "students", label: "Students" },
  { id: "batches", label: "Batches" },
  { id: "fees", label: "Fee ledger" },
  { id: "announcements", label: "Announcements" },
  { id: "reminders", label: "Reminders assist" },
  { id: "parent", label: "Parent portal" },
];

function formatInr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function App() {
  const [view, setView] = useState<View>("dashboard");
  const [students, setStudents] = useState(INITIAL_STUDENTS);
  const [batches] = useState(INITIAL_BATCHES);
  const [announcements, setAnnouncements] = useState<Announcement[]>([
    {
      id: "a1",
      title: "Mock test — Sunday",
      body: "JEE Evening mock test this Sunday 9 AM at Baner centre. Bring admit card.",
      when: "Today",
    },
  ]);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [selectedDue, setSelectedDue] = useState(INITIAL_STUDENTS[0].id);

  const dueTotal = useMemo(
    () => students.reduce((sum, s) => sum + s.dueAmount, 0),
    [students]
  );

  const reminderStudent = students.find((s) => s.id === selectedDue) ?? students[0];
  const reminderText = `Namaste, this is a fee reminder from Meridian Coaching (demo).\nStudent: ${reminderStudent.name}\nBatch: ${reminderStudent.batch}\nAmount due: ${formatInr(reminderStudent.dueAmount)}\nPlease clear dues this week. Thank you.`;

  function markPaid(id: string) {
    setStudents((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, feeStatus: "paid", dueAmount: 0 } : s
      )
    );
  }

  function publishAnnouncement() {
    if (!draftTitle.trim() || !draftBody.trim()) return;
    setAnnouncements((prev) => [
      {
        id: `a${Date.now()}`,
        title: draftTitle.trim(),
        body: draftBody.trim(),
        when: "Just now",
      },
      ...prev,
    ]);
    setDraftTitle("");
    setDraftBody("");
  }

  return (
    <div className="app">
      <aside className="side">
        <div>
          <div className="side-brand">FORMA</div>
          <div className="side-meta">Growth demo · Meridian Coaching</div>
        </div>
        <nav>
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-btn${view === item.id ? " active" : ""}`}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main">
        <div className="top">
          <div>
            <h1>
              {NAV.find((n) => n.id === view)?.label ?? "Dashboard"}
            </h1>
            <p>Gold-standard preview of COACH-GROWTH screens (mock data).</p>
          </div>
          <span className="badge">Canon demo · not production</span>
        </div>

        {view === "dashboard" && (
          <>
            <div className="grid">
              <div className="stat">
                <span>Active students</span>
                <strong>{students.length}</strong>
              </div>
              <div className="stat">
                <span>Fees due this week</span>
                <strong>{formatInr(dueTotal)}</strong>
              </div>
              <div className="stat">
                <span>Open batches</span>
                <strong>{batches.length}</strong>
              </div>
            </div>
            <div className="panel">
              <div className="panel-head">
                <h2>Students needing follow-up</h2>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Batch</th>
                    <th>Status</th>
                    <th>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {students
                    .filter((s) => s.feeStatus !== "paid")
                    .map((s) => (
                      <tr key={s.id}>
                        <td>{s.name}</td>
                        <td>{s.batch}</td>
                        <td>
                          <StatusPill status={s.feeStatus} />
                        </td>
                        <td>{formatInr(s.dueAmount)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {view === "students" && (
          <div className="panel">
            <div className="panel-head">
              <h2>All students</h2>
              <button type="button" className="btn secondary">
                Import CSV
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Batch</th>
                  <th>Phone</th>
                  <th>Fee</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.batch}</td>
                    <td>{s.phone}</td>
                    <td>
                      <StatusPill status={s.feeStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === "batches" && (
          <div className="panel">
            <div className="panel-head">
              <h2>Batch calendar</h2>
            </div>
            <div className="stack">
              {batches.map((b) => (
                <div className="card-row" key={b.id}>
                  <div>
                    <h3>{b.name}</h3>
                    <p>
                      {b.schedule} · {b.filled}/{b.seats} filled
                    </p>
                  </div>
                  <button type="button" className="btn secondary">
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === "fees" && (
          <div className="panel">
            <div className="panel-head">
              <h2>Fee ledger</h2>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Status</th>
                  <th>Due</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>
                      <StatusPill status={s.feeStatus} />
                    </td>
                    <td>{formatInr(s.dueAmount)}</td>
                    <td>
                      {s.feeStatus !== "paid" && (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => markPaid(s.id)}
                        >
                          Record payment
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === "announcements" && (
          <div className="two">
            <div className="panel">
              <div className="panel-head">
                <h2>Published</h2>
              </div>
              <div className="stack">
                {announcements.map((a) => (
                  <div className="card-row" key={a.id}>
                    <div>
                      <h3>{a.title}</h3>
                      <p>
                        {a.body} · {a.when}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel">
              <div className="panel-head">
                <h2>New announcement</h2>
              </div>
              <div className="stack">
                <div className="field">
                  <label htmlFor="title">Title</label>
                  <input
                    id="title"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    placeholder="Parent meeting"
                  />
                </div>
                <div className="field">
                  <label htmlFor="body">Message</label>
                  <textarea
                    id="body"
                    rows={4}
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                    placeholder="Parents will see this in the portal"
                  />
                </div>
                <button type="button" className="btn" onClick={publishAnnouncement}>
                  Publish to parents
                </button>
              </div>
            </div>
          </div>
        )}

        {view === "reminders" && (
          <div className="two">
            <div className="panel">
              <div className="panel-head">
                <h2>Pick a due student</h2>
              </div>
              <div className="stack">
                <div className="field">
                  <label htmlFor="due">Student</label>
                  <select
                    id="due"
                    value={selectedDue}
                    onChange={(e) => setSelectedDue(e.target.value)}
                  >
                    {students
                      .filter((s) => s.feeStatus !== "paid")
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} · {formatInr(s.dueAmount)}
                        </option>
                      ))}
                  </select>
                </div>
                <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>
                  Growth includes copy-assist for WhatsApp. Pro adds Razorpay
                  collection.
                </p>
              </div>
            </div>
            <div className="panel">
              <div className="panel-head">
                <h2>Message to copy</h2>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => navigator.clipboard.writeText(reminderText)}
                >
                  Copy
                </button>
              </div>
              <div className="stack">
                <div className="msg">{reminderText}</div>
              </div>
            </div>
          </div>
        )}

        {view === "parent" && (
          <div className="two">
            <div className="panel">
              <div className="panel-head">
                <h2>Parent home · Isha Kulkarni</h2>
              </div>
              <div className="stack">
                <div className="card-row">
                  <div>
                    <h3>NEET Morning</h3>
                    <p>Mon–Sat · 7:00–10:00 AM</p>
                  </div>
                  <StatusPill status="paid" />
                </div>
                <div className="card-row">
                  <div>
                    <h3>Fee status</h3>
                    <p>No dues for this month</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="panel">
              <div className="panel-head">
                <h2>Announcements</h2>
              </div>
              <div className="stack">
                {announcements.map((a) => (
                  <div className="card-row" key={a.id}>
                    <div>
                      <h3>{a.title}</h3>
                      <p>{a.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatusPill({ status }: { status: FeeStatus }) {
  return <span className={`pill ${status}`}>{status}</span>;
}

export default App;
