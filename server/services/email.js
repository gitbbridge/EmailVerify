import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { Resend } from 'resend'
import { config } from '../config.js'

let resend

export function sendTeamInvitation({ email, workspaceName, role, invitationId, invitationUrl }) {
  return sendEmail({
    to: email,
    subject: `Join ${workspaceName} on EmailVerify`,
    text: `You have been invited to join ${workspaceName} as ${role}. This invitation expires in seven days. Sign in or create an account with this email address: ${invitationUrl}`,
    idempotencyKey: `team-invitation/${invitationId}`,
    required: true,
    template: {
      preheader: `Your invitation to ${workspaceName}`,
      eyebrow: 'Team invitation',
      heading: 'Your team is waiting.',
      message: `Join ${workspaceName} as ${role}. Sign in or create an account with this email address to accept. This invitation expires in seven days.`,
      detailLabel: 'Workspace', detailValue: workspaceName,
      actionText: 'JOIN WORKSPACE', actionUrl: invitationUrl,
    },
  })
}
const emailLogo = readFileSync(new URL('../../public/images/logos/emailverify-wordmark.png', import.meta.url))

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function renderEmail({ subject, preheader, eyebrow, heading, message, detailLabel, detailValue, actionText, actionUrl }) {
  const year = new Date().getFullYear()
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>${escapeHtml(subject)}</title>
  <style>
    html,body{margin:0!important;padding:0!important;width:100%!important;background:#f7f7f8}table,td{border-collapse:collapse!important}img{border:0;display:block;height:auto;line-height:100%;outline:none;text-decoration:none}a{color:inherit}.preheader{display:none!important;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;visibility:hidden}
    @media only screen and (max-width:620px){.email-shell{width:100%!important}.email-card{border-left:0!important;border-right:0!important;border-radius:0!important}.content-cell{padding-left:28px!important;padding-right:28px!important}.headline{font-size:28px!important;line-height:35px!important}.button-link{display:block!important;text-align:center!important}}
  </style>
</head>
<body>
  <div class="preheader">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#f7f7f8">
    <tr><td align="center" style="padding:40px 16px">
      <table role="presentation" class="email-shell" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px">
        <tr><td style="padding:0 0 20px 4px"><img src="cid:emailverify-logo" width="164" alt="EmailVerify" style="width:164px;max-width:164px"></td></tr>
        <tr><td class="email-card" style="background:#fff;border:1px solid #e7e7ea;border-radius:18px;overflow:hidden">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td class="content-cell" style="padding:48px 48px 22px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
              <p style="margin:0 0 18px;color:#6548ff;font-size:12px;font-weight:700;letter-spacing:1.4px;line-height:18px;text-transform:uppercase">${escapeHtml(eyebrow)}</p>
              <h1 class="headline" style="margin:0;color:#17172d;font-size:34px;font-weight:700;letter-spacing:-.8px;line-height:42px">${escapeHtml(heading)}</h1>
            </td></tr>
            <tr><td class="content-cell" style="padding:0 48px 28px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"><p style="margin:0;color:#555563;font-size:16px;font-weight:400;line-height:26px">${escapeHtml(message)}</p></td></tr>
            ${detailLabel && detailValue ? `<tr><td class="content-cell" style="padding:0 48px 32px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f7ff;border:1px solid #ebe7ff;border-radius:12px"><tr><td style="padding:20px 22px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"><p style="margin:0 0 5px;color:#7a7885;font-size:12px;font-weight:600;letter-spacing:.4px;line-height:18px;text-transform:uppercase">${escapeHtml(detailLabel)}</p><p style="margin:0;color:#17172d;font-size:15px;font-weight:600;line-height:23px;word-break:break-word">${escapeHtml(detailValue)}</p></td></tr></table></td></tr>` : ''}
            ${actionText && actionUrl ? `<tr><td class="content-cell" style="padding:0 48px 48px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#6548ff" style="border-radius:10px"><a class="button-link" href="${escapeHtml(actionUrl)}" target="_blank" style="display:inline-block;padding:14px 22px;border:1px solid #6548ff;border-radius:10px;color:#fff;font-size:15px;font-weight:700;line-height:20px;text-decoration:none">${escapeHtml(actionText)}</a></td></tr></table></td></tr>` : ''}
            <tr><td style="height:1px;background:#ededf0;font-size:0;line-height:0">&nbsp;</td></tr>
            <tr><td class="content-cell" style="padding:24px 48px 28px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"><p style="margin:0;color:#8b8994;font-size:12px;line-height:19px">This automated message was sent by EmailVerify. If you were not expecting it, no action is required.</p></td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:22px 24px 0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"><p style="margin:0;color:#98969f;font-size:12px;line-height:18px">&copy; ${year} EmailVerify &nbsp;&middot;&nbsp; Accurate email decisions, made simple.</p></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function getClient() {
  if (!config.resendApiKey || !config.emailFrom) return null
  resend ??= new Resend(config.resendApiKey)
  return resend
}

async function sendEmail({ to, bcc, subject, text, template, idempotencyKey, required = false }) {
  const client = getClient()
  if (!client || !to) {
    if (!required) return null
    const error = new Error('Transactional email is not configured.')
    error.status = 503
    error.code = 'email_not_configured'
    throw error
  }

  const { data, error } = await client.emails.send({
    from: config.emailFrom,
    to,
    ...(bcc ? { bcc } : {}),
    subject,
    text,
    html: renderEmail({ subject, ...template }),
    attachments: [{
      filename: 'emailverify-wordmark.png',
      content: emailLogo,
      contentType: 'image/png',
      contentId: 'emailverify-logo',
    }],
  }, { idempotencyKey })

  if (error && required) {
    const deliveryError = new Error(error.message || 'Unable to send transactional email.')
    deliveryError.status = 503
    deliveryError.code = 'transactional_email_failed'
    throw deliveryError
  }
  return error ? null : data
}

export function sendPurchaseConfirmation({ email, purchaseId, credits, amountCents }) {
  const amount = `$${(amountCents / 100).toFixed(2)}`
  return sendEmail({
    to: email,
    subject: `${credits.toLocaleString()} credits added to your account`,
    text: `Your payment of ${amount} was received and ${credits.toLocaleString()} credits were added to your EmailVerify workspace.`,
    idempotencyKey: `purchase-confirmation/${purchaseId}`,
    template: {
      preheader: `${credits.toLocaleString()} verification credits are ready to use.`,
      eyebrow: 'Payment confirmed',
      heading: 'Your credits are ready.',
      message: `We received your ${amount} payment and added ${credits.toLocaleString()} verification credits to your workspace.`,
      detailLabel: 'Credits added',
      detailValue: credits.toLocaleString(),
      actionText: 'VIEW BILLING',
      actionUrl: `${config.appUrl}/#billing`,
    },
  })
}

export function sendSignupConfirmation({ email, confirmationUrl, userId }) {
  return sendEmail({
    to: email,
    subject: 'Confirm your EmailVerify account',
    text: `Welcome to EmailVerify. Confirm your email address to activate your workspace:\n\n${confirmationUrl}`,
    idempotencyKey: `signup-confirmation/${userId}`,
    required: true,
    template: {
      preheader: 'Confirm your email address to activate your EmailVerify workspace.',
      eyebrow: 'Confirm your email',
      heading: 'Your cleaner list starts here.',
      message: 'Confirm your email address to activate your workspace and continue to EmailVerify.',
      detailLabel: 'Account email',
      detailValue: email,
      actionText: 'CONFIRM EMAIL',
      actionUrl: confirmationUrl,
    },
  })
}

export function sendPasswordReset({ email, resetUrl, userId }) {
  const tokenKey = createHash('sha256').update(resetUrl).digest('hex').slice(0, 20)
  return sendEmail({
    to: email,
    subject: 'Reset your EmailVerify password',
    text: `Use this secure link to reset your EmailVerify password:\n\n${resetUrl}`,
    idempotencyKey: `password-reset/${userId}/${tokenKey}`,
    required: true,
    template: {
      preheader: 'Use this secure link to reset your EmailVerify password.',
      eyebrow: 'Password reset',
      heading: 'Choose a new password.',
      message: 'We received a request to reset the password for your EmailVerify account. Use the secure button below to continue.',
      detailLabel: 'Account email',
      detailValue: email,
      actionText: 'RESET PASSWORD',
      actionUrl: resetUrl,
    },
  })
}

export function sendAdminBillingAlert({ subject, text, idempotencyKey }) {
  return sendEmail({
    to: config.adminEmail,
    subject,
    text,
    idempotencyKey,
    template: {
      preheader: subject,
      eyebrow: 'Admin notification',
      heading: subject,
      message: text,
      detailLabel: 'Environment',
      detailValue: process.env.NODE_ENV || 'development',
      actionText: 'OPEN BILLING',
      actionUrl: `${config.appUrl}/#billing`,
    },
  })
}

export function sendBrandedEmailTest({ email, testId }) {
  return sendEmail({
    to: email,
    subject: 'Your EmailVerify email setup is working',
    text: 'Supabase secure links and EmailVerify transactional emails are ready for testing.',
    idempotencyKey: `branded-email-test/${testId}`,
    required: true,
    template: {
      preheader: 'EmailVerify transactional email delivery is working.',
      eyebrow: 'Delivery confirmed',
      heading: 'Your email setup is working.',
      message: 'Resend accepted this branded HTML message from your verified sending domain. Supabase can generate secure account links and EmailVerify can deliver them using this template.',
      detailLabel: 'Test reference',
      detailValue: testId,
      actionText: 'OPEN EMAILVERIFY',
      actionUrl: config.appUrl,
    },
  })
}

export function sendBatchExpiryWarning({ email, batchId, batchName, expiresAt, exportUrl }) {
  const deletionDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(expiresAt))
  return sendEmail({
    to: email,
    bcc: config.adminEmail || undefined,
    subject: `Export ${batchName} before it is deleted`,
    text: `Your list ${batchName} will be deleted on ${deletionDate}. Export the results now: ${exportUrl}`,
    idempotencyKey: `batch-retention-warning/${batchId}`,
    required: true,
    template: {
      preheader: `${batchName} will be deleted in 7 days.`,
      eyebrow: 'List retention notice',
      heading: 'Export your list within 7 days.',
      message: `Your completed list “${batchName}” has reached day 180 of its retention period. Download the results before they are permanently deleted.`,
      detailLabel: 'Scheduled deletion',
      detailValue: deletionDate,
      actionText: 'EXPORT LIST',
      actionUrl: exportUrl,
    },
  })
}

export function sendBatchApprovalRequest({ batchId, batchName, total, rules }) {
  return sendEmail({
    to: config.adminEmail,
    subject: `Review required: ${batchName}`,
    text: `${batchName} contains ${total.toLocaleString()} unique addresses and requires manual approval. Triggers: ${rules.join(', ')}.`,
    idempotencyKey: `batch-approval-request/${batchId}`,
    template: {
      preheader: `${batchName} is waiting for manual approval.`,
      eyebrow: 'Risk review required',
      heading: 'A batch is waiting for approval.',
      message: 'Automated risk controls paused this list before credits were reserved or verification began.',
      detailLabel: 'Review summary',
      detailValue: `${total.toLocaleString()} addresses - ${rules.join(', ')}`,
      actionText: 'REVIEW BATCH',
      actionUrl: `${config.appUrl}/#admin-approvals`,
    },
  })
}

export function sendSupportRequestAlert({ requestId, workspaceName, email, category, subject, message }) {
  return sendEmail({
    to: config.adminEmail,
    subject: `Support request: ${subject}`,
    text: `${workspaceName} (${email}) submitted a ${category} support request: ${message}`,
    idempotencyKey: `support-admin/${requestId}`,
    required: true,
    template: {
      preheader: `${workspaceName} submitted a support request.`,
      eyebrow: 'Customer support',
      heading: subject,
      message,
      detailLabel: 'Workspace and category',
      detailValue: `${workspaceName} - ${category}`,
      actionText: 'OPEN SUPPORT INBOX',
      actionUrl: `${config.appUrl}/#admin-approvals`,
    },
  })
}

export function sendSupportAcknowledgement({ requestId, email, subject }) {
  return sendEmail({
    to: email,
    subject: `We received your request: ${subject}`,
    text: `Your EmailVerify support request has been received. Reference: ${requestId}`,
    idempotencyKey: `support-customer/${requestId}`,
    required: true,
    template: {
      preheader: 'Your support request is in our queue.',
      eyebrow: 'Request received',
      heading: 'We are on it.',
      message: 'Your support request is in our queue. We will follow up using the email address on your account.',
      detailLabel: 'Reference number',
      detailValue: requestId,
      actionText: 'VIEW SUPPORT',
      actionUrl: `${config.appUrl}/#support`,
    },
  })
}
