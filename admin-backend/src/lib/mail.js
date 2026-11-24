import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { withdrawalDecisionEmail } from './emailTemplates.js';
import { log } from './log.js';

/**
 * Outgoing email over SMTP (config.mail). Sending never throws: a missing
 * configuration, a missing address or an SMTP error is logged and reported as
 * { sent: false, reason }, so an admin action is never undone by a mail error.
 */

let transport = null;
const getTransport = () => {
  transport ??= nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    auth: config.mail.user ? { user: config.mail.user, pass: config.mail.password } : undefined,
    // Keep an unreachable mail server from holding up the admin's request.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transport;
};

export const mailConfigured = () => Boolean(config.mail.host && config.mail.from);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendMail({ to, subject, text, html, replyTo }) {
  if (!mailConfigured()) {
    log.warn(`Email "${subject}" not sent: SMTP_HOST / MAIL_FROM are not configured.`);
    return { sent: false, reason: 'email is not configured' };
  }
  if (!to || !EMAIL.test(to)) return { sent: false, reason: 'the member has no valid email address' };
  try {
    await getTransport().sendMail({ from: config.mail.from, to, subject, text, html, replyTo });
    return { sent: true };
  } catch (err) {
    log.warn(`Email "${subject}" to ${to} failed.`, err);
    return { sent: false, reason: 'the mail server refused it' };
  }
}

/**
 * Tell a member their withdrawal was accepted or rejected.
 * `user` is { Name, LoginId, Email }; `tx` is { uid, amount, requestedAt, processedAt };
 * `target` describes where it is paid (see payoutTarget in routes/transactions.js).
 */
export function sendWithdrawalDecision({ user, tx, accepted, reason, payoutRef, payoutUrl, target }) {
  const { subject, text, html } = withdrawalDecisionEmail({
    site: config.mail.siteName,
    siteUrl: config.mail.siteUrl,
    supportEmail: config.mail.supportEmail,
    name: user.Name || user.LoginId,
    tx, accepted, reason, payoutRef, payoutUrl, target,
  });
  return sendMail({ to: user.Email, subject, text, html, replyTo: config.mail.supportEmail || undefined });
}
