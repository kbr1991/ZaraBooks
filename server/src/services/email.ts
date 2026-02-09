import { Resend } from 'resend';

// Initialize Resend client
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Email configuration
const FROM_EMAIL = process.env.EMAIL_FROM || 'Zara Books <noreply@zarabooks.app>';
const APP_URL = process.env.APP_URL || 'https://scintillating-stillness-production-02d4.up.railway.app';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    console.warn('Email service not configured. Set RESEND_API_KEY to enable emails.');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    if (error) {
      console.error('Email send error:', error);
      return { success: false, error: error.message };
    }

    console.log('Email sent successfully:', data?.id);
    return { success: true };
  } catch (error) {
    console.error('Email service error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Email Templates

export function getInvitationEmailHtml(params: {
  inviterName: string;
  companyName: string;
  role: string;
  inviteToken: string;
}): string {
  const { inviterName, companyName, role, inviteToken } = params;
  const acceptUrl = `${APP_URL}/accept-invite?token=${inviteToken}`;
  const roleDisplay = role.charAt(0).toUpperCase() + role.slice(1);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're invited to join ${companyName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #18181b;">
                📚 Zara Books
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <h2 style="margin: 0 0 20px; font-size: 20px; font-weight: 600; color: #18181b;">
                You're invited to join ${companyName}
              </h2>

              <p style="margin: 0 0 16px; font-size: 15px; line-height: 24px; color: #3f3f46;">
                <strong>${inviterName}</strong> has invited you to join <strong>${companyName}</strong> on Zara Books as a <strong>${roleDisplay}</strong>.
              </p>

              <p style="margin: 0 0 24px; font-size: 15px; line-height: 24px; color: #3f3f46;">
                Zara Books is a comprehensive accounting application for managing your business finances, GST compliance, and financial reporting.
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center; padding: 10px 0 30px;">
                    <a href="${acceptUrl}" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600; color: #ffffff; background-color: #2563eb; text-decoration: none; border-radius: 6px;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 16px; font-size: 13px; line-height: 20px; color: #71717a;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 24px; font-size: 13px; line-height: 20px; color: #2563eb; word-break: break-all;">
                ${acceptUrl}
              </p>

              <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;">

              <p style="margin: 0; font-size: 13px; line-height: 20px; color: #71717a;">
                This invitation will expire in 7 days. If you did not expect this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 40px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa;">
                © ${new Date().getFullYear()} Zara Books. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function getInvitationEmailText(params: {
  inviterName: string;
  companyName: string;
  role: string;
  inviteToken: string;
}): string {
  const { inviterName, companyName, role, inviteToken } = params;
  const acceptUrl = `${APP_URL}/accept-invite?token=${inviteToken}`;
  const roleDisplay = role.charAt(0).toUpperCase() + role.slice(1);

  return `
You're invited to join ${companyName} on Zara Books

${inviterName} has invited you to join ${companyName} as a ${roleDisplay}.

Accept your invitation by visiting:
${acceptUrl}

This invitation will expire in 7 days.

If you did not expect this invitation, you can safely ignore this email.

---
© ${new Date().getFullYear()} Zara Books
  `.trim();
}

// Password reset email template
export function getPasswordResetEmailHtml(params: {
  userName: string;
  resetToken: string;
}): string {
  const { userName, resetToken } = params;
  const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #18181b;">
                📚 Zara Books
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <h2 style="margin: 0 0 20px; font-size: 20px; font-weight: 600; color: #18181b;">
                Reset your password
              </h2>

              <p style="margin: 0 0 16px; font-size: 15px; line-height: 24px; color: #3f3f46;">
                Hi ${userName},
              </p>

              <p style="margin: 0 0 24px; font-size: 15px; line-height: 24px; color: #3f3f46;">
                We received a request to reset your password. Click the button below to create a new password.
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center; padding: 10px 0 30px;">
                    <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600; color: #ffffff; background-color: #2563eb; text-decoration: none; border-radius: 6px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 16px; font-size: 13px; line-height: 20px; color: #71717a;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 24px; font-size: 13px; line-height: 20px; color: #2563eb; word-break: break-all;">
                ${resetUrl}
              </p>

              <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;">

              <p style="margin: 0; font-size: 13px; line-height: 20px; color: #71717a;">
                This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 40px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa;">
                © ${new Date().getFullYear()} Zara Books. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function getPasswordResetEmailText(params: {
  userName: string;
  resetToken: string;
}): string {
  const { userName, resetToken } = params;
  const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`;

  return `
Reset your password

Hi ${userName},

We received a request to reset your password. Visit the link below to create a new password:

${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.

---
© ${new Date().getFullYear()} Zara Books
  `.trim();
}

// Welcome email after accepting invitation
export function getWelcomeEmailHtml(params: {
  userName: string;
  companyName: string;
  role: string;
}): string {
  const { userName, companyName, role } = params;
  const roleDisplay = role.charAt(0).toUpperCase() + role.slice(1);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${companyName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #18181b;">
                📚 Zara Books
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <h2 style="margin: 0 0 20px; font-size: 20px; font-weight: 600; color: #18181b;">
                Welcome to ${companyName}!
              </h2>

              <p style="margin: 0 0 16px; font-size: 15px; line-height: 24px; color: #3f3f46;">
                Hi ${userName},
              </p>

              <p style="margin: 0 0 16px; font-size: 15px; line-height: 24px; color: #3f3f46;">
                You've successfully joined <strong>${companyName}</strong> as a <strong>${roleDisplay}</strong>.
              </p>

              <p style="margin: 0 0 24px; font-size: 15px; line-height: 24px; color: #3f3f46;">
                You can now access the company's financial data, reports, and more based on your role permissions.
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center; padding: 10px 0 30px;">
                    <a href="${APP_URL}" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600; color: #ffffff; background-color: #2563eb; text-decoration: none; border-radius: 6px;">
                      Go to Zara Books
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 40px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa;">
                © ${new Date().getFullYear()} Zara Books. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function getWelcomeEmailText(params: {
  userName: string;
  companyName: string;
  role: string;
}): string {
  const { userName, companyName, role } = params;
  const roleDisplay = role.charAt(0).toUpperCase() + role.slice(1);

  return `
Welcome to ${companyName}!

Hi ${userName},

You've successfully joined ${companyName} as a ${roleDisplay}.

You can now access the company's financial data, reports, and more based on your role permissions.

Get started at: ${APP_URL}

---
© ${new Date().getFullYear()} Zara Books
  `.trim();
}
