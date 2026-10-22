/**
 * Email helpers. Uses Resend when RESEND_API_KEY is set; otherwise logs to console (dev).
 * Set RESEND_API_KEY and optionally EMAIL_FROM (e.g. "Convixa <noreply@yourdomain.com>") in env.
 */

const EMAIL_FROM = process.env.EMAIL_FROM ?? "Convixa <onboarding@resend.dev>";

export async function sendInviteEmail(
  to: string,
  opts: { orgName: string; invitedBy: string | null; acceptUrl: string }
): Promise<boolean> {
  const { orgName, invitedBy, acceptUrl } = opts;
  const subject = `You've been invited to join ${orgName} on Convixa`;
  const inviterLine = invitedBy ? `${invitedBy} has invited you` : "You've been invited";
  const text = `${inviterLine} to join ${orgName} on Convixa.\n\nAccept your invitation here:\n${acceptUrl}\n\nThis link expires in 7 days. If you weren't expecting this, you can safely ignore it.`;
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Invitation to ${orgName}</title></head>
<body style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
  <h2 style="color:#0f172a;margin-bottom:4px;">You're invited</h2>
  <p style="color:#334155;">${inviterLine} to join <strong>${orgName}</strong> on Convixa.</p>
  <p style="margin:24px 0;">
    <a href="${acceptUrl}" style="background:#0f172a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Accept invitation</a>
  </p>
  <p style="color:#64748b;font-size:13px;">Or copy this link: <a href="${acceptUrl}" style="color:#0ea5e9;">${acceptUrl}</a></p>
  <p style="color:#94a3b8;font-size:12px;margin-top:32px;">This invitation expires in 7 days. If you weren't expecting this email, you can safely ignore it.</p>
</body>
</html>`;

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({ from: EMAIL_FROM, to, subject, text, html });
      if (error) {
        console.error("[email] Resend error (invite):", error);
        return false;
      }
      return true;
    } catch (e) {
      console.error("[email] Invite send failed:", e);
      return false;
    }
  }
  console.log("[email] RESEND_API_KEY not set. Invite for", to, ":", acceptUrl);
  return true;
}

export async function sendOtpEmail(to: string, otp: string, purpose: "enable_2fa" | "login" | "deactivate_account"): Promise<boolean> {
  const subject =
    purpose === "enable_2fa"
      ? "Your verification code to enable 2FA"
      : purpose === "deactivate_account"
        ? "Account deactivation verification code"
        : "Your sign-in verification code";
  const body =
    purpose === "deactivate_account"
      ? `Your verification code is: ${otp}\n\nYou are requesting to permanently deactivate your Convixa account. This action cannot be undone. If you did not request this, please secure your account immediately.`
      : `Your verification code is: ${otp}\n\nThis code expires in 10 minutes. If you didn't request this, you can ignore this email.`;

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({
        from: EMAIL_FROM,
        to,
        subject,
        text: body,
      });
      if (error) {
        console.error("[email] Resend error:", error);
        return false;
      }
      return true;
    } catch (e) {
      console.error("[email] Send failed:", e);
      return false;
    }
  }
  console.log("[email] RESEND_API_KEY not set. OTP for", to, ":", otp);
  return true;
}

export async function sendVerificationEmail(
  to: string,
  verificationUrl: string
): Promise<boolean> {
  const subject = "Verify your email for Convixa";
  const text = `Please verify your email address by clicking this link:\n\n${verificationUrl}\n\nThis link expires in 24 hours. If you didn't create this account, you can ignore this email.`;
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Verify your email</title></head>
<body style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
  <h2 style="color:#0f172a;margin-bottom:4px;">Verify your email</h2>
  <p style="color:#334155;">Click the button below to verify your email address for Convixa.</p>
  <p style="margin:24px 0;">
    <a href="${verificationUrl}" style="background:#0f172a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Verify email</a>
  </p>
  <p style="color:#64748b;font-size:13px;">Or copy this link: <a href="${verificationUrl}" style="color:#0ea5e9;">${verificationUrl}</a></p>
  <p style="color:#94a3b8;font-size:12px;margin-top:32px;">This link expires in 24 hours. If you didn't create this account, you can safely ignore it.</p>
</body>
</html>`;

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({
        from: EMAIL_FROM,
        to,
        subject,
        text,
        html,
      });
      if (error) {
        console.error("[email] Resend verification error:", error);
        return false;
      }
      return true;
    } catch (e) {
      console.error("[email] Verification send failed:", e);
      return false;
    }
  }
  console.log("[email] RESEND_API_KEY not set. Verification for", to, ":", verificationUrl);
  return true;
}

export async function sendSignerVerificationEmail(
  to: string,
  opts: { orgName: string; safeAddress: string; verifyUrl: string }
): Promise<boolean> {
  const { orgName, safeAddress, verifyUrl } = opts;
  const shortAddr = `${safeAddress.slice(0, 6)}…${safeAddress.slice(-4)}`;
  const subject = `Verify your signer affiliation for ${orgName}`;
  const text = `${orgName} has requested that you verify your affiliation as a signer on Safe ${shortAddr}.\n\nComplete verification here:\n${verifyUrl}\n\nThis link expires in 7 days.`;
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Signer verification</title></head>
<body style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
  <h2 style="color:#0f172a;margin-bottom:4px;">Verify signer affiliation</h2>
  <p style="color:#334155;"><strong>${orgName}</strong> has requested that you cryptographically verify your affiliation as a signer on Safe <code>${shortAddr}</code>.</p>
  <p style="margin:24px 0;">
    <a href="${verifyUrl}" style="background:#0f172a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Verify affiliation</a>
  </p>
  <p style="color:#64748b;font-size:13px;">Or copy this link: <a href="${verifyUrl}" style="color:#0ea5e9;">${verifyUrl}</a></p>
  <p style="color:#94a3b8;font-size:12px;margin-top:32px;">This link expires in 7 days. You will connect the wallet that matches your on-chain signer address and sign an affiliation message.</p>
</body>
</html>`;

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({ from: EMAIL_FROM, to, subject, text, html });
      if (error) {
        console.error("[email] Resend signer verification error:", error);
        return false;
      }
      return true;
    } catch (e) {
      console.error("[email] Signer verification send failed:", e);
      return false;
    }
  }
  console.log("[email] RESEND_API_KEY not set. Signer verification for", to, ":", verifyUrl);
  return true;
}

export async function sendSecurityIncidentEmail(
  to: string,
  opts: {
    title: string;
    severity: string;
    incidentType: string;
    description: string;
    incidentId: string;
  }
): Promise<boolean> {
  const appUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  const trackUrl = appUrl
    ? `${appUrl.replace(/\/$/, "")}/dashboard/security/incidents/${opts.incidentId}`
    : null;
  const subject = `[${opts.severity.toUpperCase()}] Security incident: ${opts.title}`;
  const text = `A security incident has been reported in Convixa.\n\nType: ${opts.incidentType}\nSeverity: ${opts.severity}\nTitle: ${opts.title}\n\n${opts.description}\n\nIncident ID: ${opts.incidentId}${trackUrl ? `\n\nOpen tracking page: ${trackUrl}` : ""}`;
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Security incident reported</title></head>
<body style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
  <h2 style="color:#dc2626;margin-bottom:4px;">Security incident reported</h2>
  <p style="color:#334155;"><strong>${opts.title}</strong></p>
  <p style="color:#64748b;font-size:13px;">Type: ${opts.incidentType} · Severity: ${opts.severity}</p>
  <p style="color:#334155;white-space:pre-wrap;">${opts.description}</p>
  ${trackUrl ? `<p style="margin-top:20px;"><a href="${trackUrl}" style="color:#ea580c;font-weight:600;">Open incident tracking page</a></p>` : ""}
  <p style="color:#94a3b8;font-size:12px;margin-top:24px;">Incident ID: ${opts.incidentId}</p>
</body>
</html>`;

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({ from: EMAIL_FROM, to, subject, text, html });
      if (error) {
        console.error("[email] Resend incident error:", error);
        return false;
      }
      return true;
    } catch (e) {
      console.error("[email] Incident send failed:", e);
      return false;
    }
  }
  console.log("[email] RESEND_API_KEY not set. Incident for", to, ":", opts.title);
  return true;
}
