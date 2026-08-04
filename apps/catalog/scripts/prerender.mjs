/**
 * Writes a real HTML file for every public route.
 *
 * The app is a single-page app, so without this every URL served the same
 * <title> and no share tags. Search crawlers can run JavaScript, but many
 * answer-engine fetchers and link-preview bots do not — they read the first
 * HTML response only. An empty <div id="root"> looks like a blank site.
 *
 * Runs after `vite build`, over the same page definitions the app uses.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist");

const seoSource = readFileSync(join(here, "..", "src", "lib", "seo.ts"), "utf8");
const trustSource = readFileSync(
  join(here, "..", "src", "content", "trust.ts"),
  "utf8"
);

const SITE_URL = "https://okavo.org";
const OG_IMAGE = `${SITE_URL}/og.png`;

function extractPages() {
  const block = seoSource.slice(
    seoSource.indexOf("export const PAGES"),
    seoSource.indexOf("export function seoFor")
  );

  const pages = [];
  const entry =
    /\{\s*path:\s*"([^"]+)",\s*title:\s*"((?:[^"\\]|\\.)*)",\s*description:\s*\n?\s*"((?:[^"\\]|\\.)*)",\s*indexed:\s*(true|false),(?:\s*priority:\s*([\d.]+),)?\s*h1:\s*"((?:[^"\\]|\\.)*)",\s*body:\s*\[([\s\S]*?)\],/g;

  let match;
  while ((match = entry.exec(block)) !== null) {
    const bodyRaw = match[7];
    const body = [];
    const para = /"((?:[^"\\]|\\.)*)"/g;
    let p;
    while ((p = para.exec(bodyRaw)) !== null) {
      body.push(p[1].replace(/\\"/g, '"'));
    }
    pages.push({
      path: match[1],
      title: match[2].replace(/\\"/g, '"'),
      description: match[3].replace(/\\"/g, '"'),
      indexed: match[4] === "true",
      priority: match[5] ? Number(match[5]) : 0.5,
      h1: match[6].replace(/\\"/g, '"'),
      body,
    });
  }
  return pages;
}

function extractFaqs() {
  const faqs = [];
  const entry =
    /\{\s*question:\s*"((?:[^"\\]|\\.)*)",\s*answer:\s*\n?\s*`?((?:[^"`\\]|\\.)*?)`?,?\s*\}/g;
  // Prefer the FAQS array only.
  const block = trustSource.slice(
    trustSource.indexOf("export const FAQS"),
    trustSource.indexOf("export const FAQS") > -1
      ? trustSource.length
      : 0
  );

  // Template literals and string concat make regex fragile — fall back to
  // question-only lines, then a second pass for simple string answers.
  const simple =
    /question:\s*"((?:[^"\\]|\\.)*)",\s*answer:\s*\n?\s*"((?:[^"\\]|\\.)*)"/g;
  let match;
  while ((match = simple.exec(block)) !== null) {
    faqs.push({
      question: match[1].replace(/\\"/g, '"'),
      answer: match[2].replace(/\\"/g, '"'),
    });
  }

  // Also capture template-literal answers (cost FAQ uses backticks).
  const templ =
    /question:\s*"((?:[^"\\]|\\.)*)",\s*answer:\s*\n?\s*`([\s\S]*?)`,/g;
  while ((match = templ.exec(block)) !== null) {
    const question = match[1].replace(/\\"/g, '"');
    if (faqs.some((f) => f.question === question)) continue;
    const answer = match[2]
      .replace(/\$\{[^}]+\}/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (answer.length > 20) faqs.push({ question, answer });
  }

  void entry;
  return faqs;
}

const escapeHtml = (value) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const pages = extractPages();
if (pages.length === 0) {
  console.error("prerender: no pages found in seo.ts — aborting");
  process.exit(1);
}

const faqs = extractFaqs();
const template = readFileSync(join(dist, "index.html"), "utf8");

const organisation = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Okavo",
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.svg`,
  description:
    "Okavo turns a plain-language description into a signed agreement, then identity-verified developers build exactly that, paid milestone by milestone against the locked scope.",
  email: "support@okavo.org",
  foundingDate: "2026",
};

const website = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Okavo",
  url: `${SITE_URL}/`,
  description: pages[0].description,
  publisher: { "@type": "Organization", name: "Okavo", url: SITE_URL },
};

const software = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Okavo",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  description: pages[0].description,
  offers: {
    "@type": "Offer",
    price: "1.00",
    priceCurrency: "USD",
    description: "Buyer posting fee per requirement; developer membership separate",
  },
};

function canonicalUrl(path) {
  return path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}`;
}

const NAV = pages
  .filter((page) => page.indexed)
  .map(
    (page) =>
      `<li><a href="${escapeHtml(canonicalUrl(page.path))}">${escapeHtml(
        page.h1
      )}</a></li>`
  )
  .join("");

function shellHtml(page) {
  const paragraphs = page.body
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("\n      ");
  return [
    `<article id="okavo-seo-shell">`,
    `  <header>`,
    `    <p><strong>Okavo</strong> · <a href="${SITE_URL}/">okavo.org</a></p>`,
    `    <h1>${escapeHtml(page.h1)}</h1>`,
    `  </header>`,
    `  ${paragraphs}`,
    `  <nav aria-label="Okavo site">`,
    `    <ul>${NAV}</ul>`,
    `  </nav>`,
    `  <p>Full product: <a href="${SITE_URL}/">https://okavo.org/</a> · Machine-readable summary: <a href="${SITE_URL}/llms.txt">llms.txt</a></p>`,
    `</article>`,
  ].join("\n    ");
}

function headFor(page) {
  const url = canonicalUrl(page.path);
  const title = escapeHtml(page.title);
  const description = escapeHtml(page.description);

  const tags = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta name="robots" content="${page.indexed ? "index,follow" : "noindex,follow"}" />`,
    `<meta name="googlebot" content="${page.indexed ? "index,follow,max-image-preview:large" : "noindex,follow"}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Okavo" />`,
    `<meta property="og:locale" content="en_US" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${OG_IMAGE}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${OG_IMAGE}" />`,
  ];

  if (page.path === "/") {
    tags.push(
      `<script type="application/ld+json">${JSON.stringify(organisation)}</script>`,
      `<script type="application/ld+json">${JSON.stringify(website)}</script>`,
      `<script type="application/ld+json">${JSON.stringify(software)}</script>`
    );
  }

  if (page.path === "/faq" && faqs.length > 0) {
    tags.push(
      `<script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      })}</script>`
    );
  }

  return tags.join("\n    ");
}

for (const page of pages) {
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, "")
    .replace(/<meta\s+name="description"[\s\S]*?\/>/, "")
    .replace("</head>", `  ${headFor(page)}\n  </head>`)
    .replace(
      /<div id="root"><\/div>/,
      `<div id="root">${shellHtml(page)}</div>`
    );

  const target =
    page.path === "/"
      ? join(dist, "index.html")
      : join(dist, page.path.replace(/^\//, ""), "index.html");

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html);
}

const lastmod = new Date().toISOString().slice(0, 10);

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...pages
    .filter((page) => page.indexed)
    .map((page) =>
      [
        "  <url>",
        `    <loc>${canonicalUrl(page.path)}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        "  </url>",
      ].join("\n")
    ),
  "</urlset>",
].join("\n");

writeFileSync(join(dist, "sitemap.xml"), sitemap);

console.log(
  `prerender: wrote ${pages.length} pages and a sitemap with ${
    pages.filter((p) => p.indexed).length
  } urls (${faqs.length} FAQ schema entries)`
);
