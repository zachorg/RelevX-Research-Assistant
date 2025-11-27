
import { sendReportEmail } from "../packages/core/src/services/email";
import { CompiledReport } from "../packages/core/src/services/openai/types";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

async function testEmail() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log("Skipping email test: RESEND_API_KEY not set");
    return;
  }

  console.log("Testing email sending...");

  const mockReport: CompiledReport = {
    title: "Test Research Report",
    summary: "This is a test report generated to verify email functionality.",
    markdown: "# Test Report\n\nThis is the **markdown** content of the report.\n\n- Point 1\n- Point 2",
    resultCount: 5,
    averageScore: 85,
  };

  try {
    // Use a dummy email or the one from env if available for testing
    // For safety, maybe just log what would happen if we don't want to spam
    // But the user asked for "actual email sending", so we should try if key is present.
    // We'll send to a placeholder or the user's email if they provided one in a separate env var for testing?
    // For now, let's just try to send to a dummy address which Resend might block or allow in test mode (delivered to the account owner)
    
    const testEmail = process.env.TEST_EMAIL_RECIPIENT || "delivered@resend.dev";
    
    console.log(`Sending to ${testEmail}...`);
    
    const result = await sendReportEmail(testEmail, mockReport, "test-project-id");
    
    if (result.success) {
      console.log("Email sent successfully! ID:", result.id);
    } else {
      console.error("Failed to send email:", result.error);
    }
  } catch (error) {
    console.error("Error running test:", error);
  }
}

testEmail();
