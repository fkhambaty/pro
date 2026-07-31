import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  NEW_DEVELOPER_ACCOUNT,
  NOTIFICATIONS,
  PROJECTS,
  THREADS,
} from "./data";
import type {
  AppNotification,
  Bid,
  ChangeOrder,
  DeveloperAccount,
  Dispute,
  Milestone,
  Project,
  Review,
  Role,
  ScopeItem,
  Thread,
} from "./types";

type StoreValue = {
  role: Role;
  name: string;
  projects: Project[];
  threads: Thread[];
  notifications: AppNotification[];
  developerAccount: DeveloperAccount;

  signIn: (role: Role, name: string) => void;
  signOut: () => void;

  addProject: (project: Project) => void;
  updateScope: (projectId: string, scope: ScopeItem[]) => void;
  lockProject: (projectId: string) => void;

  placeBid: (projectId: string, bid: Bid) => void;
  setBidStatus: (projectId: string, bidId: string, status: Bid["status"]) => void;
  awardBid: (projectId: string, bidId: string) => void;

  payMembership: () => void;
  submitInterview: () => void;

  fundMilestone: (projectId: string, milestoneId: string) => void;
  submitMilestone: (
    projectId: string,
    milestoneId: string,
    summary: string,
    previewUrl: string
  ) => void;
  acceptMilestone: (projectId: string, milestoneId: string) => void;

  createChangeOrder: (
    projectId: string,
    input: { title: string; description: string; raisedBy: "buyer" | "developer" }
  ) => void;
  priceChangeOrder: (
    projectId: string,
    changeOrderId: string,
    amount: number,
    addedWeeks: number
  ) => void;
  decideChangeOrder: (
    projectId: string,
    changeOrderId: string,
    accepted: boolean
  ) => void;

  raiseDispute: (
    projectId: string,
    reason: string,
    raisedBy: "buyer" | "developer"
  ) => void;
  resolveDispute: (projectId: string, note: string) => void;

  leaveReview: (projectId: string, review: Omit<Review, "id" | "createdAt">) => void;

  sendMessage: (threadId: string, body: string) => void;
  markAllNotificationsRead: () => void;
};

const StoreContext = createContext<StoreValue | null>(null);

function makeLockId() {
  return `LOCK-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;
}

function today() {
  return new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function timestamp() {
  return new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function defaultMilestones(total: number): Milestone[] {
  const first = Math.round(total * 0.35);
  const second = Math.round(total * 0.4);
  return [
    {
      id: `ms-${Date.now()}-1`,
      title: "Foundation and core flows",
      description: "Environment, data model, and the first locked scope items.",
      amount: first,
      status: "pending",
      dueOn: today(),
    },
    {
      id: `ms-${Date.now()}-2`,
      title: "Main functionality",
      description: "The bulk of the locked scope, demoed weekly.",
      amount: second,
      status: "pending",
      dueOn: today(),
    },
    {
      id: `ms-${Date.now()}-3`,
      title: "Acceptance and handover",
      description: "Every scope item verified, documentation and deployment.",
      amount: total - first - second,
      status: "pending",
      dueOn: today(),
    },
  ];
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("guest");
  const [name, setName] = useState("");
  const [projects, setProjects] = useState<Project[]>(PROJECTS);
  const [threads, setThreads] = useState<Thread[]>(THREADS);
  const [notifications, setNotifications] =
    useState<AppNotification[]>(NOTIFICATIONS);
  const [developerAccount, setDeveloperAccount] = useState<DeveloperAccount>(
    NEW_DEVELOPER_ACCOUNT
  );

  const patchProject = useCallback(
    (projectId: string, patch: (project: Project) => Project) => {
      setProjects((prev) =>
        prev.map((project) => (project.id === projectId ? patch(project) : project))
      );
    },
    []
  );

  const notify = useCallback((notification: Omit<AppNotification, "id">) => {
    setNotifications((prev) => [
      { ...notification, id: `n-${Date.now()}` },
      ...prev,
    ]);
  }, []);

  const signIn = useCallback((nextRole: Role, nextName: string) => {
    setRole(nextRole);
    setName(nextName);
  }, []);

  const signOut = useCallback(() => {
    setRole("guest");
    setName("");
  }, []);

  const addProject = useCallback((project: Project) => {
    setProjects((prev) => [project, ...prev]);
  }, []);

  const updateScope = useCallback(
    (projectId: string, scope: ScopeItem[]) => {
      patchProject(projectId, (project) => ({ ...project, scope }));
    },
    [patchProject]
  );

  const lockProject = useCallback(
    (projectId: string) => {
      patchProject(projectId, (project) => ({
        ...project,
        stage: "locked",
        lockedAt: today(),
        lockId: project.lockId ?? makeLockId(),
        versions: [
          ...project.versions,
          {
            version: project.versions.length + 1,
            reason: "Requirement locked",
            createdAt: today(),
          },
        ],
      }));
      notify({
        kind: "contract",
        title: "Requirement locked",
        body: "Bidding is now open to verified developers.",
        link: `/app/contract/${projectId}`,
        read: false,
        createdAt: today(),
      });
    },
    [patchProject, notify]
  );

  const placeBid = useCallback(
    (projectId: string, bid: Bid) => {
      patchProject(projectId, (project) => ({
        ...project,
        bids: [bid, ...project.bids],
      }));
      notify({
        kind: "bid",
        title: "Bid submitted",
        body: `Your bid was sent against the locked scope.`,
        link: `/app/project/${projectId}`,
        read: false,
        createdAt: today(),
      });
    },
    [patchProject, notify]
  );

  const setBidStatus = useCallback(
    (projectId: string, bidId: string, status: Bid["status"]) => {
      patchProject(projectId, (project) => ({
        ...project,
        bids: project.bids.map((bid) =>
          bid.id === bidId ? { ...bid, status } : bid
        ),
      }));
    },
    [patchProject]
  );

  const awardBid = useCallback(
    (projectId: string, bidId: string) => {
      patchProject(projectId, (project) => {
        const winner = project.bids.find((bid) => bid.id === bidId);
        if (!winner) return project;
        return {
          ...project,
          stage: "in_delivery",
          awardedTo: winner.developerName,
          bids: project.bids.map((bid) => ({
            ...bid,
            status:
              bid.id === bidId ? "awarded" : bid.status === "awarded" ? "declined" : bid.status,
          })),
          milestones:
            project.milestones.length > 0
              ? project.milestones
              : defaultMilestones(winner.amount),
          versions: [
            ...project.versions,
            {
              version: project.versions.length + 1,
              reason: `Countersigned by ${winner.developerName}`,
              createdAt: today(),
            },
          ],
        };
      });
      notify({
        kind: "contract",
        title: "Contract awarded",
        body: "Both parties have signed. Milestones are ready to fund.",
        link: `/app/contract/${projectId}`,
        read: false,
        createdAt: today(),
      });
    },
    [patchProject, notify]
  );

  const payMembership = useCallback(() => {
    setDeveloperAccount((prev) => ({
      ...prev,
      membershipPaid: true,
      membershipPaidAt: today(),
    }));
    notify({
      kind: "payment",
      title: "Bidding activated",
      body: "Your $10 one-time membership is paid. You can bid on locked projects.",
      link: "/app",
      read: false,
      createdAt: today(),
    });
  }, [notify]);

  const submitInterview = useCallback(() => {
    setDeveloperAccount((prev) => ({ ...prev, interviewStatus: "approved" }));
  }, []);

  const fundMilestone = useCallback(
    (projectId: string, milestoneId: string) => {
      patchProject(projectId, (project) => ({
        ...project,
        milestones: project.milestones.map((milestone) =>
          milestone.id === milestoneId
            ? { ...milestone, status: "funded" }
            : milestone
        ),
      }));
    },
    [patchProject]
  );

  const submitMilestone = useCallback(
    (
      projectId: string,
      milestoneId: string,
      summary: string,
      previewUrl: string
    ) => {
      patchProject(projectId, (project) => ({
        ...project,
        milestones: project.milestones.map((milestone) =>
          milestone.id === milestoneId
            ? {
                ...milestone,
                status: "submitted",
                deliverable: {
                  summary,
                  previewUrl,
                  submittedAt: today(),
                },
              }
            : milestone
        ),
      }));
      notify({
        kind: "milestone",
        title: "Milestone submitted",
        body: "Waiting for the buyer to check it against the locked scope.",
        link: `/app/contract/${projectId}`,
        read: false,
        createdAt: today(),
      });
    },
    [patchProject, notify]
  );

  const acceptMilestone = useCallback(
    (projectId: string, milestoneId: string) => {
      patchProject(projectId, (project) => {
        const milestones = project.milestones.map((milestone) =>
          milestone.id === milestoneId
            ? { ...milestone, status: "released" as const }
            : milestone
        );
        const allDone = milestones.every((m) => m.status === "released");
        return {
          ...project,
          milestones,
          stage: allDone ? "delivered" : project.stage,
        };
      });
      notify({
        kind: "payment",
        title: "Payment released",
        body: "Escrow released for the accepted milestone.",
        link: `/app/contract/${projectId}`,
        read: false,
        createdAt: today(),
      });
    },
    [patchProject, notify]
  );

  const createChangeOrder = useCallback(
    (
      projectId: string,
      input: { title: string; description: string; raisedBy: "buyer" | "developer" }
    ) => {
      const changeOrder: ChangeOrder = {
        id: `co-${Date.now()}`,
        title: input.title,
        description: input.description,
        status: "proposed",
        addedWeeks: 0,
        raisedBy: input.raisedBy,
        createdAt: today(),
      };
      patchProject(projectId, (project) => ({
        ...project,
        changeOrders: [changeOrder, ...project.changeOrders],
      }));
      notify({
        kind: "change_order",
        title: "Change order raised",
        body: `${input.title} — awaiting a price.`,
        link: `/app/contract/${projectId}`,
        read: false,
        createdAt: today(),
      });
    },
    [patchProject, notify]
  );

  const priceChangeOrder = useCallback(
    (
      projectId: string,
      changeOrderId: string,
      amount: number,
      addedWeeks: number
    ) => {
      patchProject(projectId, (project) => ({
        ...project,
        changeOrders: project.changeOrders.map((order) =>
          order.id === changeOrderId
            ? { ...order, status: "priced", amount, addedWeeks }
            : order
        ),
      }));
    },
    [patchProject]
  );

  const decideChangeOrder = useCallback(
    (projectId: string, changeOrderId: string, accepted: boolean) => {
      patchProject(projectId, (project) => {
        const order = project.changeOrders.find((c) => c.id === changeOrderId);
        const changeOrders = project.changeOrders.map((c) =>
          c.id === changeOrderId
            ? { ...c, status: accepted ? ("accepted" as const) : ("declined" as const) }
            : c
        );
        if (!accepted || !order) {
          return { ...project, changeOrders };
        }
        return {
          ...project,
          changeOrders,
          timelineWeeks: project.timelineWeeks + order.addedWeeks,
          scope: [
            ...project.scope,
            {
              id: `sc-${order.id}`,
              label: order.title,
              detail: `Added by change order on ${today()}.`,
              included: true,
            },
          ],
          versions: [
            ...project.versions,
            {
              version: project.versions.length + 1,
              reason: `Change order accepted: ${order.title}`,
              createdAt: today(),
            },
          ],
        };
      });
    },
    [patchProject]
  );

  const raiseDispute = useCallback(
    (projectId: string, reason: string, raisedBy: "buyer" | "developer") => {
      const dispute: Dispute = {
        id: `dp-${Date.now()}`,
        reason,
        status: "open",
        raisedBy,
        createdAt: today(),
      };
      patchProject(projectId, (project) => ({ ...project, dispute }));
      notify({
        kind: "contract",
        title: "Dispute opened",
        body: "Forma review has been notified. Escrow is held until resolution.",
        link: `/app/contract/${projectId}`,
        read: false,
        createdAt: today(),
      });
    },
    [patchProject, notify]
  );

  const resolveDispute = useCallback(
    (projectId: string, note: string) => {
      patchProject(projectId, (project) =>
        project.dispute
          ? {
              ...project,
              dispute: {
                ...project.dispute,
                status: "resolved",
                resolutionNote: note,
              },
            }
          : project
      );
    },
    [patchProject]
  );

  const leaveReview = useCallback(
    (projectId: string, review: Omit<Review, "id" | "createdAt">) => {
      patchProject(projectId, (project) => ({
        ...project,
        stage: "closed",
        reviews: [
          ...project.reviews,
          { ...review, id: `rv-${Date.now()}`, createdAt: today() },
        ],
      }));
    },
    [patchProject]
  );

  const sendMessage = useCallback(
    (threadId: string, body: string) => {
      setThreads((prev) =>
        prev.map((thread) =>
          thread.id === threadId
            ? {
                ...thread,
                messages: [
                  ...thread.messages,
                  {
                    id: `msg-${Date.now()}`,
                    from: role === "buyer" ? "buyer" : "developer",
                    authorName: name || "You",
                    body,
                    sentAt: timestamp(),
                  },
                ],
              }
            : thread
        )
      );
    },
    [role, name]
  );

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  }, []);

  const value = useMemo(
    () => ({
      role,
      name,
      projects,
      threads,
      notifications,
      developerAccount,
      signIn,
      signOut,
      addProject,
      updateScope,
      lockProject,
      placeBid,
      setBidStatus,
      awardBid,
      payMembership,
      submitInterview,
      fundMilestone,
      submitMilestone,
      acceptMilestone,
      createChangeOrder,
      priceChangeOrder,
      decideChangeOrder,
      raiseDispute,
      resolveDispute,
      leaveReview,
      sendMessage,
      markAllNotificationsRead,
    }),
    [
      role,
      name,
      projects,
      threads,
      notifications,
      developerAccount,
      signIn,
      signOut,
      addProject,
      updateScope,
      lockProject,
      placeBid,
      setBidStatus,
      awardBid,
      payMembership,
      submitInterview,
      fundMilestone,
      submitMilestone,
      acceptMilestone,
      createChangeOrder,
      priceChangeOrder,
      decideChangeOrder,
      raiseDispute,
      resolveDispute,
      leaveReview,
      sendMessage,
      markAllNotificationsRead,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
