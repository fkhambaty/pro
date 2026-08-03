/**
 * Writes a real HTML file for every public route.
 *
 * The app is a single-page app, so without this every URL served the same
 * <title> and no share tags. Search crawlers can run JavaScript, but the
 * crawlers behind link previews — LinkedIn, Slack, WhatsApp, X — cannot.
 * They read the first HTML response and nothing else, which is why a shared
 * Okavo link used to appear as a bare URL.
 *
 * Runs after `vite build`, over the same page definitions the app uses.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist");

// seo.ts is TypeScript; read the page table out of it rather than compiling.
const seoSource = readFileSync(join(here, "..", "src", "lib", "seo.ts"), "utf8");

const SITE_URL = "https://okavo.org";
const OG_IMAGE = `${SITE_URL}/og.png`;

function extractPages() {
  const block = seoSource.slice(
    seoSource.indexOf("export const PAGES"),
    seoSource.indexOf("export function seoFor")
  );

  const pages = [];
  const entry = /\{\s*path:\s*"([^"]+)",\s*title:\s*"((?:[^"\\]|\\.)*)",\s*description:\s*\n?\s*"((?:[^"\\]|\\.)*)",\s*indexed:\s*(true|false),(?:\s*priority:\s*([\d.]+),)?/g;

  let match;
  while ((match = entry.exec(block)) !== null) {
    pages.push({
      path: match[1],
      title: match[2].replace(/\\"/g, '"'),
      description: match[3].replace(/\\"/g, '"'),
      indexed: match[4] === "true",
      priority: match[5] ? Number(match[5]) : 0.5,
    });
  }
  return pages;
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

const template = readFileSync(join(dist, "index.html"), "utf8");

const organisation = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Okavo",
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.svg`,
  description:
    "Okavo turns a plain-language description into a signed agreement, then identity-verified developers build exactly that, paid through escrow.",
  email: "support@okavo.org",
  foundingDate: "2026",
};

/** One spelling of every URL, so the canonical and the sitemap always agree. */
function canonicalUrl(path) {
  return path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}`;
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
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Okavo" />`,
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
      `<script type="application/ld+json">${JSON.stringify(organisation)}</script>`
    );
  }

  return tags.join("\n    ");
}

for (const page of pages) {
  // Replace the build's single generic title/description with this page's.
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, "")
    .replace(/<meta\s+name="description"[\s\S]*?\/>/, "")
    .replace("</head>", `  ${headFor(page)}\n  </head>`);

  const target =
    page.path === "/"
      ? join(dist, "index.html")
      : join(dist, page.path.replace(/^\//, ""), "index.html");

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html);
}

// Google ignores <changefreq> and <priority> outright but does read
// <lastmod>, so the sitemap carries the field that is actually used.
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
  } urls`
);
