/**
 * Transactional email templates. HTML is built for email clients: table
 * layout, inline styles only, a 600px column, web-safe fonts and no images
 * (so nothing is blocked), plus a matching plain-text version. Every dynamic
 * value goes through esc().
 */

const BRAND = '#1fc77e';
const INK = '#1f2933';
const MUTED = '#6b7785';
const LINE = '#e6e9ee';
const BG = '#f3f5f8';
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const usd = (n) =>
  `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "23 Nov 2026, 18:00 UTC" */
export function formatDate(d) {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC',
  })} UTC`;
}

/** Only the last 4 characters of an account number, e.g. "•••• 4821". */
export const maskAccount = (v) => (v ? `•••• ${String(v).slice(-4)}` : null);

/** "0x1234…cdef" for long addresses / hashes, so they fit on a phone. */
const shorten = (v, keep = 10) => (v && v.length > keep * 2 + 1 ? `${v.slice(0, keep)}…${v.slice(-keep + 2)}` : v);

/**
 * The shared frame: preheader, header with the site name, a status banner,
 * the body, and the footer.
 * `tone` is 'success' | 'danger'.
 */
function layout({ site, preheader, tone, badge, title, body, siteUrl, supportEmail, cta }) {
  const accent = tone === 'danger' ? '#d64545' : BRAND;
  const badgeBg = tone === 'danger' ? '#fdecec' : '#e7f8f0';
  const year = new Date().getUTCFullYear();
  const button = cta ? `
              <tr><td style="padding:8px 32px 8px">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="border-radius:8px;background:${INK}">
                    <a href="${esc(cta.url)}" target="_blank" style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px">${esc(cta.label)}</a>
                  </td>
                </tr></table>
              </td></tr>` : '';
  const help = supportEmail
    ? `Questions? Reply to this email or contact <a href="mailto:${esc(supportEmail)}" style="color:${MUTED};text-decoration:underline">${esc(supportEmail)}</a>.`
    : 'Questions? Please contact our support team.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};-webkit-text-size-adjust:100%">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${esc(preheader)}&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG}">
    <tr><td align="center" style="padding:32px 12px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">
        <tr><td style="padding:0 4px 16px;font-family:${FONT};font-size:20px;font-weight:700;letter-spacing:.2px;color:${INK}">
          ${siteUrl ? `<a href="${esc(siteUrl)}" target="_blank" style="color:${INK};text-decoration:none">${esc(site)}</a>` : esc(site)}
        </td></tr>
        <tr><td style="background:#ffffff;border:1px solid ${LINE};border-radius:12px;overflow:hidden">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="height:4px;line-height:4px;font-size:0;background:${accent}">&nbsp;</td></tr>
            <tr><td style="padding:28px 32px 8px">
              <span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${badgeBg};color:${accent};font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:.4px;text-transform:uppercase">${esc(badge)}</span>
              <h1 style="margin:14px 0 0;font-family:${FONT};font-size:22px;line-height:1.3;font-weight:700;color:${INK}">${esc(title)}</h1>
            </td></tr>
            ${body}
            ${button}
            <tr><td style="padding:24px 32px 28px;font-family:${FONT};font-size:14px;line-height:1.6;color:${INK}">
              Kind regards,<br><strong>The ${esc(site)} Team</strong>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 8px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};text-align:center">
          ${help}<br>
          This is an automated message about your account. For your security, we will never ask for your password by email.<br>
          &copy; ${year} ${esc(site)}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const paragraph = (html) =>
  `<tr><td style="padding:12px 32px 0;font-family:${FONT};font-size:15px;line-height:1.6;color:${INK}">${html}</td></tr>`;

/** A two-column summary table. `rows` is [[label, valueHtml]] (values already escaped). */
function summary(rows) {
  const cells = rows.map(([label, value], i) => `
                  <tr>
                    <td style="padding:11px 16px;${i ? `border-top:1px solid ${LINE};` : ''}font-family:${FONT};font-size:13px;color:${MUTED};white-space:nowrap;vertical-align:top;width:40%">${esc(label)}</td>
                    <td style="padding:11px 16px;${i ? `border-top:1px solid ${LINE};` : ''}font-family:${FONT};font-size:14px;color:${INK};font-weight:600;text-align:right;word-break:break-all">${value}</td>
                  </tr>`).join('');
  return `<tr><td style="padding:20px 32px 4px">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${LINE};border-radius:10px;background:#fafbfc">${cells}
                </table>
              </td></tr>`;
}

/** A highlighted note box (e.g. the rejection reason). */
const note = (labelText, bodyText, tone) => {
  const color = tone === 'danger' ? '#d64545' : BRAND;
  const bg = tone === 'danger' ? '#fdf3f3' : '#f0faf5';
  return `<tr><td style="padding:16px 32px 0">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="border-left:4px solid ${color};background:${bg};border-radius:6px;padding:14px 16px;font-family:${FONT}">
                    <div style="font-size:12px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:${color}">${esc(labelText)}</div>
                    <div style="margin-top:6px;font-size:14px;line-height:1.6;color:${INK};white-space:pre-wrap">${esc(bodyText)}</div>
                  </td>
                </tr></table>
              </td></tr>`;
};

/** Summary rows ([label, plainValue, htmlValue]) describing where the money goes. */
function targetRows(target) {
  if (!target) return [];
  if (target.kind === 'crypto') {
    const net = target.coin === target.network ? target.coin : `${target.coin} (${target.network})`;
    return [
      ['Method', `Crypto · ${net}`, esc(`Crypto · ${net}`)],
      ['Wallet address', target.address, `<span style="font-family:Menlo,Consolas,monospace;font-size:13px;font-weight:500">${esc(target.address)}</span>`],
    ];
  }
  const bank = [target.bankName, maskAccount(target.bankAccount)].filter(Boolean).join(' · ');
  return [
    ['Method', 'Bank transfer', 'Bank transfer'],
    ...(bank ? [['Bank account', bank, esc(bank)]] : []),
    ...(target.bankMaster ? [['Account holder', target.bankMaster, esc(target.bankMaster)]] : []),
  ];
}

/**
 * The withdrawal accepted / rejected email.
 * Returns { subject, text, html }.
 */
export function withdrawalDecisionEmail({
  site, siteUrl, supportEmail, name, tx, accepted, reason, payoutRef, payoutUrl, target,
}) {
  const amount = usd(tx.amount);
  const ref = `#${tx.uid}`;
  const requested = formatDate(tx.requestedAt);
  const processed = formatDate(tx.processedAt);

  const rows = [
    ['Request', ref, esc(ref)],
    ['Amount', amount, `<span style="font-size:16px">${esc(amount)}</span>`],
    ['Status', accepted ? 'Completed' : 'Rejected',
      `<span style="color:${accepted ? BRAND : '#d64545'}">${accepted ? 'Completed' : 'Rejected'}</span>`],
    ...targetRows(target),
    ...(accepted && payoutRef ? [['Payment reference', payoutRef,
      payoutUrl
        ? `<a href="${esc(payoutUrl)}" target="_blank" style="color:${INK};font-family:Menlo,Consolas,monospace;font-size:13px">${esc(shorten(payoutRef))}</a>`
        : `<span style="font-family:Menlo,Consolas,monospace;font-size:13px;font-weight:500">${esc(payoutRef)}</span>`]] : []),
    ...(requested ? [['Requested', requested, esc(requested)]] : []),
    ...(processed ? [[accepted ? 'Sent' : 'Reviewed', processed, esc(processed)]] : []),
  ];

  const greeting = `Hello ${name},`;
  const cta = siteUrl ? { label: 'View your transactions', url: `${siteUrl}/money/transaction` } : null;

  if (accepted) {
    const subject = `Your withdrawal of ${amount} has been sent`;
    const intro = `Good news: your withdrawal request ${ref} has been approved and the funds have been sent.`;
    const after = target?.kind === 'crypto'
      ? 'Crypto transfers usually arrive within minutes, depending on network confirmations.'
      : 'Bank transfers can take 1–3 business days to appear in your account, depending on your bank.';
    const html = layout({
      site, siteUrl, supportEmail, cta, tone: 'success', badge: 'Withdrawal completed', title: 'Your withdrawal has been sent',
      preheader: `${amount} is on its way to you. Request ${ref}.`,
      body: [
        paragraph(esc(greeting)),
        paragraph(esc(intro)),
        summary(rows.map(([l, , h]) => [l, h])),
        paragraph(`<span style="color:${MUTED};font-size:14px">${esc(after)} If it has not arrived after that time, please contact us with your request number ${esc(ref)}.</span>`),
      ].join(''),
    });
    const text = [
      greeting, '', intro, '',
      ...rows.map(([l, p]) => `${l}: ${p}`), '',
      after, `If it has not arrived after that time, please contact us with your request number ${ref}.`, '',
      ...(cta ? [`View your transactions: ${cta.url}`, ''] : []),
      'Kind regards,', `The ${site} Team`, '',
      '--',
      supportEmail ? `Questions? Reply to this email or contact ${supportEmail}.` : 'Questions? Please contact our support team.',
      'This is an automated message about your account. We will never ask for your password by email.',
    ].join('\n');
    return { subject, text, html };
  }

  const subject = `Your withdrawal request ${ref} was not approved`;
  const intro = `We have reviewed your withdrawal request ${ref} for ${amount}, and unfortunately we are unable to approve it.`;
  const after = 'Your balance has not been charged for this request. Once the issue above is resolved, you are welcome to submit a new withdrawal request.';
  const html = layout({
    site, siteUrl, supportEmail, cta, tone: 'danger', badge: 'Withdrawal not approved', title: 'Your withdrawal request was not approved',
    preheader: `Request ${ref} for ${amount} was not approved. Reason inside.`,
    body: [
      paragraph(esc(greeting)),
      paragraph(esc(intro)),
      note('Reason', reason, 'danger'),
      summary(rows.map(([l, , h]) => [l, h])),
      paragraph(`<span style="color:${MUTED};font-size:14px">${esc(after)}</span>`),
    ].join(''),
  });
  const text = [
    greeting, '', intro, '',
    `Reason: ${reason}`, '',
    ...rows.map(([l, p]) => `${l}: ${p}`), '',
    after, '',
    ...(cta ? [`View your transactions: ${cta.url}`, ''] : []),
    'Kind regards,', `The ${site} Team`, '',
    '--',
    supportEmail ? `Questions? Reply to this email or contact ${supportEmail}.` : 'Questions? Please contact our support team.',
    'This is an automated message about your account. We will never ask for your password by email.',
  ].join('\n');
  return { subject, text, html };
}
