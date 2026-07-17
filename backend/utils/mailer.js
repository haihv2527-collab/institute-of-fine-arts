const nodemailer = require("nodemailer");

let transporter = null;
let usingRealSmtp = false;

/**
 * Lazily builds the mail transporter on first use.
 *
 * If SMTP_HOST is set in .env, we send real email.
 * If not, we fall back to a "console transport" that just prints the
 * email to the server log — so the project runs and the notification
 * flow is fully visible/demoable without requiring a real mail account.
 */
function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
    usingRealSmtp = true;
  } else {
    // Console fallback transport — implements just enough of the
    // nodemailer transport interface to be a drop-in replacement.
    transporter = {
      sendMail: async (mail) => {
        console.log("\n📧  [EMAIL — SMTP not configured, printing instead]");
        console.log(`    To:      ${mail.to}`);
        console.log(`    Subject: ${mail.subject}`);
        console.log(`    ${mail.text.replace(/\n/g, "\n    ")}`);
        console.log("");
        return { messageId: "console-fallback" };
      },
    };
    usingRealSmtp = false;
  }

  return transporter;
}

/**
 * Sends a notification email. Never throws — a failed/unconfigured
 * email must never break the API request that triggered it, so all
 * errors are caught and logged instead.
 */
async function sendMail({ to, subject, text }) {
  if (!to) return;
  try {
    const from = `"${process.env.SMTP_FROM_NAME || "Institute of Fine Arts"}" <${process.env.SMTP_FROM || "no-reply@ifa.edu"}>`;
    await getTransporter().sendMail({ from, to, subject, text });
  } catch (err) {
    console.error("Failed to send email:", err.message);
  }
}

const templates = {
  submissionScored({ studentName, competitionTitle, judgeName, mark, remark, paintingTitle }) {
    return {
      subject: `Your painting "${paintingTitle || "Untitled"}" was scored — ${competitionTitle}`,
      text: `Hi ${studentName},

${judgeName} scored your submission to "${competitionTitle}":

  Mark:   ${mark}
  Remark: ${remark || "(no written remark)"}

Log in to the Institute of Fine Arts portal to see your full results, including scores from any other judges.

— Institute of Fine Arts`,
    };
  },

  awardGiven({ studentName, competitionTitle, awardName }) {
    return {
      subject: `Congratulations! You won "${awardName}" — ${competitionTitle}`,
      text: `Hi ${studentName},

Wonderful news — you've been awarded "${awardName}" in "${competitionTitle}"!

Log in to the Institute of Fine Arts portal to see the details.

— Institute of Fine Arts`,
    };
  },

  paintingSold({ studentName, paintingTitle, exhibitionTitle, soldPrice }) {
    return {
      subject: `Your painting sold at ${exhibitionTitle}!`,
      text: `Hi ${studentName},

Great news — your painting "${paintingTitle || "Untitled"}" sold at "${exhibitionTitle}"${soldPrice ? ` for ${soldPrice}` : ""}.

Log in to the Institute of Fine Arts portal to see the sale details and payment status.

— Institute of Fine Arts`,
    };
  },
};

module.exports = { sendMail, templates, isUsingRealSmtp: () => usingRealSmtp };
