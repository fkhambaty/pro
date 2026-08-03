/**
 * One definition of every public page's metadata.
 *
 * Used twice: by the browser at runtime (so titles change as you navigate)
 * and by scripts/prerender.mjs at build time (so crawlers and link previews,
 * which do not run JavaScript, see the right thing).
 */

export const SITE_URL = "https://okavo.org";
export const SITE_NAME = "Okavo";
export const OG_IMAGE = `${SITE_URL}/og.png`;

export type PageSeo = {
  path: string;
  title: string;
  description: string;
  /** Included in sitemap.xml; omit for pages we do not want indexed. */
  indexed: boolean;
  priority?: number;
};

export const PAGES: PageSeo[] = [
  {
    path: "/",
    title: "Okavo — Agree what you'll get before anyone writes code",
    description:
      "Describe what you need in plain language. Okavo turns it into a signed agreement, then identity-verified developers bid on that exact scope and you pay milestone by milestone.",
    indexed: true,
    priority: 1,
  },
  {
    path: "/how-it-works",
    title: "How Okavo works — from a description to delivered software",
    description:
      "Six steps: describe the outcome, check the scope, sign the lock, compare bids priced against identical scope, fund one milestone at a time, and own the result.",
    indexed: true,
    priority: 0.9,
  },
  {
    path: "/guarantee",
    title: "The Okavo guarantee — six promises, and how each is enforced",
    description:
      "Nothing is built until you sign what it means. You pay milestone by milestone as you accept the work. Changes are quoted, never assumed. Every developer is identity-verified.",
    indexed: true,
    priority: 0.9,
  },
  {
    path: "/security",
    title: "Security and data handling at Okavo",
    description:
      "How Okavo protects your money, your documents and your data: payments handled by Razorpay, row-level database isolation, private identity storage and regional data rules.",
    indexed: true,
    priority: 0.7,
  },
  {
    path: "/faq",
    title: "Okavo FAQ — costs, payment, code ownership and vetting",
    description:
      "What it costs, who owns the code, how developers are vetted, what happens if a developer disappears, and how new Okavo really is. Answered plainly.",
    indexed: true,
    priority: 0.8,
  },
  {
    path: "/about",
    title: "About Okavo — closing the gap between what was meant and built",
    description:
      "Okavo exists because software goes wrong in the gap between what the buyer pictured and what the developer heard. We make the expectation a signed document.",
    indexed: true,
    priority: 0.6,
  },
  {
    path: "/signin",
    title: "Sign in to Okavo",
    description:
      "Sign in to post a requirement or bid on locked scope. Buyers pay ₹99 per requirement; developers pay a one-time ₹899 membership.",
    indexed: false,
  },
];

export function seoFor(pathname: string): PageSeo {
  return (
    PAGES.find((page) => page.path === pathname) ?? {
      path: pathname,
      title: `${SITE_NAME} — Where the world comes to have software built`,
      description: PAGES[0].description,
      indexed: false,
    }
  );
}

function setMeta(selector: string, attribute: string, value: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement("meta");
    const [key, val] = selector.replace(/^meta\[|\]$/g, "").split("=");
    tag.setAttribute(key, val.replace(/["']/g, ""));
    document.head.appendChild(tag);
  }
  tag.setAttribute(attribute, value);
}

/** Keeps the tab title and share tags in step with client-side navigation. */
export function applySeo(pathname: string) {
  if (typeof document === "undefined") return;
  const page = seoFor(pathname);
  const url = `${SITE_URL}${pathname}`;

  document.title = page.title;
  setMeta('meta[name="description"]', "content", page.description);
  setMeta('meta[property="og:title"]', "content", page.title);
  setMeta('meta[property="og:description"]', "content", page.description);
  setMeta('meta[property="og:url"]', "content", url);
  setMeta('meta[name="twitter:title"]', "content", page.title);
  setMeta('meta[name="twitter:description"]', "content", page.description);

  let canonical = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]'
  );
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = url;

  let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (!robots) {
    robots = document.createElement("meta");
    robots.name = "robots";
    document.head.appendChild(robots);
  }
  robots.content = page.indexed ? "index,follow" : "noindex,follow";
}
