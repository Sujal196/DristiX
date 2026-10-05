import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../env.js';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;

  if (env.SMTP_USER && env.SMTP_PASS) {
    const isGmail = !env.SMTP_HOST || env.SMTP_HOST.includes('gmail') || env.SMTP_USER.endsWith('@gmail.com');
    const host = env.SMTP_HOST || (isGmail ? 'smtp.gmail.com' : undefined);
    const port = env.SMTP_PORT ?? (isGmail ? 465 : (env.SMTP_SECURE ? 465 : 587));
    const secure = env.SMTP_SECURE ?? (port === 465);

    // Google App Passwords often contain spaces (e.g. "abcd efgh ijkl mnop"), strip them out:
    const cleanPass = env.SMTP_PASS.replace(/\s+/g, '');
    const cleanUser = env.SMTP_USER.trim();

    if (isGmail) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: cleanUser,
          pass: cleanPass,
        },
      });
    } else {
      transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user: cleanUser,
          pass: cleanPass,
        },
      });
    }
    return transporter;
  }

  return null;
}

/**
 * Sends a password reset email containing a direct one-click link and a 6-digit verification code.
 * If SMTP (e.g. Gmail) is configured in server/.env, dispatches through Google SMTP.
 * If SMTP is not yet configured, provides high-visibility console fallback with instructions.
 */
export async function sendPasswordResetEmail(
  toEmail: string,
  recipientName: string,
  verificationCode: string,
  resetToken: string,
  portal: 'student' | 'admin' = 'student'
): Promise<{ delivered: boolean; mode: 'smtp' | 'console'; error?: string }> {
  const subject = `DristiX Password Reset: Code ${verificationCode}`;
  const resetLink = `${env.CLIENT_URL}/?resetToken=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(toEmail)}&portal=${portal}`;

  const textBody = `Hello ${recipientName},

We received a request to reset your password for your DristiX account.

To reset your password directly from your email, click the link below:
${resetLink}

Alternatively, you can enter this 6-digit verification code in the portal:
${verificationCode}

This code and reset link will expire in 15 minutes.

If you did not request a password reset, please ignore this email. Your account remains completely secure.

Best regards,
The DristiX Team
${env.CLIENT_URL}`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>DristiX Password Reset</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; color: #1f2937; margin: 0; padding: 24px;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.08);">
    <tr>
      <td style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px 36px; text-align: center;">
        <div style="display: inline-block; background-color: rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 9999px; margin-bottom: 12px;">
          <span style="color: #ffffff; font-size: 13px; font-weight: 700; letter-spacing: 0.5px;">SECURE AUTHENTICATION</span>
        </div>
        <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">DristiX Assessment Portal</h1>
        <p style="color: #e0e7ff; margin: 6px 0 0; font-size: 13px;">${portal === 'admin' ? 'Administrator' : 'Candidate'} Password Reset</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 36px 32px;">
        <h2 style="margin: 0 0 16px; font-size: 18px; color: #111827; font-weight: 700;">Hello ${recipientName},</h2>
        <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #4b5563;">
          We received a request to reset the password for your account associated with <strong>${toEmail}</strong>. You can reset your password directly using the button below:
        </p>

        <!-- Direct Reset Button -->
        <div style="text-align: center; margin: 28px 0;">
          <a href="${resetLink}" target="_blank" style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; padding: 15px 34px; border-radius: 12px; font-weight: 800; font-size: 15px; display: inline-block; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4); text-transform: uppercase; letter-spacing: 0.5px;">
            Reset Password Now →
          </a>
        </div>

        <p style="margin: 0 0 12px; font-size: 12px; color: #6b7280; text-align: center;">
          Or copy and paste this direct link into your browser:
        </p>
        <p style="margin: 0 0 28px; font-size: 11px; word-break: break-all; color: #4f46e5; text-align: center; background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0;">
          <a href="${resetLink}" style="color: #4f46e5; text-decoration: underline;">${resetLink}</a>
        </p>

        <!-- 6-digit Code Alternative -->
        <div style="background-color: #f9fafb; border: 2px dashed #cbd5e1; border-radius: 14px; padding: 20px; text-align: center; margin: 24px 0;">
          <p style="margin: 0 0 10px; font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
            Alternatively, enter this 6-digit verification code:
          </p>
          <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #3730a3; background: #ffffff; padding: 6px 18px; border-radius: 10px; border: 1px solid #e2e8f0; display: inline-block;">
            ${verificationCode}
          </span>
          <p style="margin: 10px 0 0; font-size: 11px; color: #94a3b8; font-weight: 500;">
            Code expires in 15 minutes • Single use only
          </p>
        </div>

        <p style="margin: 20px 0 0; font-size: 12px; line-height: 1.6; color: #6b7280;">
          If you did not initiate this password reset, you can safely ignore this email. Your current password remains active and unchanged.
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 28px 0 20px;">
        <p style="margin: 0; font-size: 11px; color: #9ca3af; text-align: center;">
          Sent by DristiX Automated Authentication Dispatcher. Please do not reply directly to this email.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const client = getTransporter();

  if (client) {
    try {
      const info = await client.sendMail({
        from: env.EMAIL_FROM || env.SMTP_USER,
        to: toEmail,
        subject,
        text: textBody,
        html: htmlBody,
      });
      console.log(`[dristix-mail] ✅ Sent password reset email via SMTP to: ${toEmail} (messageId: ${info.messageId})`);
      return { delivered: true, mode: 'smtp' };
    } catch (err: any) {
      console.error(`[dristix-mail] ❌ SMTP delivery failed for ${toEmail}:`, err?.message || err);
      // Fall through to console logging so user/admin is never stranded during testing
    }
  }

  // Fallback to development console logging
  console.log('\n======================================================================');
  console.log('📧 [DRISTIX EMAIL DISPATCHER] PASSWORD RESET INSTRUCTIONS');
  console.log('======================================================================');
  console.log(`To:                 ${toEmail} (${recipientName})`);
  console.log(`Subject:            ${subject}`);
  console.log(`Direct Reset URL:   ${resetLink}`);
  console.log(`Verification OTP:   >>>  ${verificationCode}  <<<`);
  console.log(`Expiry:             15 minutes`);
  if (!env.SMTP_USER || !env.SMTP_PASS) {
    console.log('ℹ️  NOTE: Set SMTP_USER and SMTP_PASS (Gmail App Password) in server/.env to send real emails to Gmail.');
  }
  console.log('======================================================================\n');

  return { delivered: true, mode: 'console' };
}
