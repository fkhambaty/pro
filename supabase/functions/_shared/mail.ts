/** Shared SMTP send for Okavo edge functions (denomailer). */

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export async function sendMail(message: MailMessage) {
  const host = Deno.env.get("SMTP_HOST") ?? "smtpout.secureserver.net";
  const port = Number(Deno.env.get("SMTP_PORT") ?? "465");
  const user = Deno.env.get("SMTP_USER") ?? "support@okavo.org";
  const pass = Deno.env.get("SMTP_PASS");
  const from = Deno.env.get("SMTP_FROM") ?? "Okavo <support@okavo.org>";

  if (!pass) throw new Error("SMTP_PASS is not configured");

  const client = new SMTPClient({
    connection: {
      hostname: host,
      port,
      tls: true,
      auth: { username: user, password: pass },
    },
  });

  try {
    await client.send({
      from,
      to: message.to,
      subject: message.subject,
      content: message.text,
      html: message.html,
    });
  } finally {
    await client.close();
  }
}

export function siteUrl() {
  return (Deno.env.get("SITE_URL") ?? "https://okavo.org").replace(/\/$/, "");
}

export function brandedEmail(opts: {
  title: string;
  body: string;
  linkPath?: string;
  cta?: string;
}) {
  const href = opts.linkPath
    ? `${siteUrl()}${opts.linkPath.startsWith("/") ? "" : "/"}${opts.linkPath}`
    : siteUrl();
  const cta = opts.cta ?? "Open Okavo";
  const text = [
    opts.title,
    "",
    opts.body,
    "",
    opts.linkPath ? `${cta}: ${href}` : "",
    "",
    "— Okavo",
  ]
    .filter((line) => line !== undefined)
    .join("\r\n");

  const html = [
    `<div style="font-family:Inter,Segoe UI,sans-serif;font-size:15px;color:#0c0d10;line-height:1.5">`,
    `<h2 style="font-size:18px;margin:0 0 12px">${escapeHtml(opts.title)}</h2>`,
    `<p style="margin:0 0 16px;color:#3d4149">${escapeHtml(opts.body)}</p>`,
    opts.linkPath
      ? `<p><a href="${href}" style="display:inline-block;background:#e8973a;color:#0c0d10;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600">${escapeHtml(cta)}</a></p>`
      : "",
    `<p style="margin-top:24px;font-size:12px;color:#9a958a">Okavo · agree what you will get before anyone writes code</p>`,
    `</div>`,
  ].join("");

  return { text, html };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
