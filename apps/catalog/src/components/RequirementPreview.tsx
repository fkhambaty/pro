import { useEffect, useMemo, useState } from "react";

type Props = {
  category: string;
  mustHaves: string[];
};

type Screen = {
  id: string;
  label: string;
  render: () => React.ReactElement;
};

function Bar({ w, tall }: { w: string; tall?: boolean }) {
  return <span className="wf-bar" style={{ width: w, height: tall ? 12 : 8 }} />;
}

function HomeScreen({ category }: { category: string }) {
  return (
    <div className="wf-body">
      <div className="wf-hero">
        <Bar w="55%" tall />
        <Bar w="80%" />
        <Bar w="70%" />
        <span className="wf-btn">{category}</span>
      </div>
      <div className="wf-grid3">
        <span className="wf-tile" />
        <span className="wf-tile" />
        <span className="wf-tile" />
      </div>
    </div>
  );
}

function SignInScreen() {
  return (
    <div className="wf-body wf-center">
      <div className="wf-card-sm">
        <Bar w="40%" tall />
        <span className="wf-input" />
        <span className="wf-input" />
        <span className="wf-btn wf-btn-full">Sign in</span>
      </div>
    </div>
  );
}

function CheckoutScreen() {
  return (
    <div className="wf-body">
      <Bar w="35%" tall />
      <div className="wf-row-split">
        <div className="wf-col">
          <span className="wf-line-item" />
          <span className="wf-line-item" />
          <span className="wf-line-item" />
        </div>
        <div className="wf-card-sm">
          <Bar w="50%" />
          <span className="wf-input" />
          <span className="wf-btn wf-btn-full wf-btn-accent">Pay</span>
        </div>
      </div>
    </div>
  );
}

function DashboardScreen() {
  return (
    <div className="wf-body">
      <div className="wf-grid3">
        <span className="wf-stat" />
        <span className="wf-stat" />
        <span className="wf-stat" />
      </div>
      <div className="wf-table">
        <span className="wf-tr wf-th" />
        <span className="wf-tr" />
        <span className="wf-tr" />
        <span className="wf-tr" />
      </div>
    </div>
  );
}

function ReportsScreen() {
  const heights = [40, 62, 34, 78, 55, 90, 48];
  return (
    <div className="wf-body">
      <Bar w="30%" tall />
      <div className="wf-chart">
        {heights.map((h, i) => (
          <span key={i} className="wf-col-bar" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

function AlertsScreen() {
  return (
    <div className="wf-body wf-center">
      <div className="wf-phone">
        <span className="wf-notch" />
        <div className="wf-msg">
          <Bar w="70%" />
          <Bar w="45%" />
        </div>
        <div className="wf-msg wf-msg-accent">
          <Bar w="60%" />
        </div>
      </div>
    </div>
  );
}

export default function RequirementPreview({ category, mustHaves }: Props) {
  const screens = useMemo<Screen[]>(() => {
    const list: Screen[] = [
      { id: "home", label: "Home", render: () => <HomeScreen category={category} /> },
    ];
    if (mustHaves.includes("Customer logins")) {
      list.push({ id: "signin", label: "Sign in", render: () => <SignInScreen /> });
    }
    if (mustHaves.includes("Take payments")) {
      list.push({ id: "pay", label: "Checkout", render: () => <CheckoutScreen /> });
    }
    if (mustHaves.includes("Admin dashboard")) {
      list.push({ id: "admin", label: "Admin", render: () => <DashboardScreen /> });
    }
    if (mustHaves.includes("Reports and exports")) {
      list.push({ id: "reports", label: "Reports", render: () => <ReportsScreen /> });
    }
    if (mustHaves.includes("Email or WhatsApp alerts")) {
      list.push({ id: "alerts", label: "Alerts", render: () => <AlertsScreen /> });
    }
    return list;
  }, [category, mustHaves]);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [screens.length]);

  useEffect(() => {
    if (screens.length < 2) return;
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % screens.length);
    }, 2600);
    return () => clearInterval(timer);
  }, [screens.length]);

  const active = screens[Math.min(index, screens.length - 1)];
  const mobile = mustHaves.includes("Works on phones");

  return (
    <div className="preview">
      <div className="preview-head">
        <span>Rough idea of what you are describing</span>
        <div className="preview-tabs">
          {screens.map((screen, i) => (
            <button
              type="button"
              key={screen.id}
              className={i === index ? "preview-tab active" : "preview-tab"}
              onClick={() => setIndex(i)}
            >
              {screen.label}
            </button>
          ))}
        </div>
      </div>

      <div className={mobile ? "preview-stage with-phone" : "preview-stage"}>
        <div className="wf-window">
          <div className="wf-chrome">
            <span className="wf-dot" />
            <span className="wf-dot" />
            <span className="wf-dot" />
            <span className="wf-url" />
          </div>
          <div key={active.id} className="wf-screen">
            {active.render()}
          </div>
        </div>

        {mobile && (
          <div className="wf-window wf-window-phone">
            <div className="wf-chrome wf-chrome-phone">
              <span className="wf-url" />
            </div>
            <div key={`m-${active.id}`} className="wf-screen wf-screen-phone">
              {active.render()}
            </div>
          </div>
        )}
      </div>

      <p className="preview-note">
        A sketch, not the final design. It updates as you change your answers,
        and the developer designs the real screens against your locked scope.
      </p>
    </div>
  );
}
