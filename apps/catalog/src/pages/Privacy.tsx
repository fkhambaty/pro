import MarketingLayout from "../components/MarketingLayout";
import { Link } from "react-router-dom";

export default function Privacy() {
  return (
    <MarketingLayout>
      <section className="page-hero">
        <div className="wrap">
          <span className="eyebrow">Legal</span>
          <h1>Privacy</h1>
          <p>
            How Okavo handles account data, identity documents, and payments
            metadata. Short version: we collect what the marketplace needs and
            do not sell your personal data.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="wrap" style={{ maxWidth: "42rem" }}>
          <h2>What we collect</h2>
          <p>
            Account details (name, email, role), requirement and bid content,
            messages on the platform, identity documents submitted for
            verification, and payment metadata from Razorpay for platform fees.
            We do not store your full card number.
          </p>

          <h2>How we use it</h2>
          <p>
            To run the marketplace, verify developers, process platform fees,
            prevent abuse, and improve the product. Identity documents stay in
            private storage and are reviewed by Okavo for verification.
          </p>

          <h2>Sharing</h2>
          <p>
            We share data with infrastructure providers (hosting, database,
            email, Razorpay) as needed to operate the service. We do not sell
            personal data. Buyers and developers see what the product role
            allows under row-level security.
          </p>

          <h2>Contact</h2>
          <p>
            Privacy questions: support@okavo.org. See also{" "}
            <Link to="/security">Security</Link> and the{" "}
            <Link to="/terms">Terms of Use</Link>.
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}
