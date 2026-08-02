import { Link } from "react-router-dom";
import MarketingLayout from "../components/MarketingLayout";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "../brand";
import { FAQS } from "../content/trust";

export default function Faq() {
  return (
    <MarketingLayout>
      <section className="page-hero">
        <div className="wrap">
          <span className="eyebrow">Questions</span>
          <h1>The things people ask before they trust us with a project</h1>
          <p>
            Including the awkward ones. If something you need to know is not
            here, ask us directly and we will add it.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="faq-list">
            {FAQS.map((item) => (
              <details className="faq-item" key={item.question}>
                <summary>
                  <span>{item.question}</span>
                  <span className="faq-marker" aria-hidden="true" />
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="wrap">
          <div className="closer">
            <div>
              <h2>Still deciding?</h2>
              <p>
                Email a real person at{" "}
                <a className="footer-mail" href={SUPPORT_MAILTO}>
                  {SUPPORT_EMAIL}
                </a>
                . Describing what you need costs nothing until you publish.
              </p>
            </div>
            <Link className="btn btn-accent btn-lg" to="/signin">
              Describe what you need
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
