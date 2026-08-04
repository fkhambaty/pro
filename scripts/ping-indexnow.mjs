#!/usr/bin/env node
/**
 * Notify Bing / Yandex / partner engines that Okavo URLs changed (IndexNow).
 * Safe to re-run after every production deploy.
 *
 *   node scripts/ping-indexnow.mjs
 */

const KEY = "d63dffffc4ddf51606382a427e421457";
const HOST = "okavo.org";
const URLS = [
  "https://okavo.org/",
  "https://okavo.org/how-it-works",
  "https://okavo.org/example",
  "https://okavo.org/guarantee",
  "https://okavo.org/security",
  "https://okavo.org/faq",
  "https://okavo.org/about",
  "https://okavo.org/llms.txt",
  "https://okavo.org/sitemap.xml",
];

const body = {
  host: HOST,
  key: KEY,
  keyLocation: `https://${HOST}/${KEY}.txt`,
  urlList: URLS,
};

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(body),
});

const text = await response.text();
console.log(`IndexNow HTTP ${response.status}`);
if (text) console.log(text);
if (!response.ok && response.status !== 202) process.exit(1);
