import { Resend } from "resend";
import { ClientReport } from "../llm/types";
import { marked } from "marked";

// Initialize Resend client
// We'll lazily initialize this to avoid errors if the API key is missing during build/test
let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not set in environment variables");
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

/**
 * Extended report options for email
 */
export interface ReportEmailOptions {
  summary?: string;
  resultCount?: number;
  averageScore?: number;
}

/**
 * Generate the branded HTML email template
 */
async function generateEmailHTML(
  report: ClientReport,
  projectId: string,
  options?: ReportEmailOptions
): Promise<string> {
  // Convert markdown to HTML
  const markdownHtml = await marked.parse(report.markdown, { async: true });

  // Format current date
  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Build summary section if available
  const summarySection = options?.summary
    ? `
        <tr>
          <td style="padding: 0 40px 30px 40px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%); border-radius: 12px;">
              <tr>
                <td style="padding: 24px 28px;">
                  <div style="font-size: 11px; font-weight: 600; color: #38bdf8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Summary</div>
                  <div style="font-size: 15px; color: #e2e8f0; line-height: 1.7;">${options.summary}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `
    : "";

  return `
<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
  <meta charset="utf-8">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings xmlns:o="urn:schemas-microsoft-com:office:office">
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <style>
    td,th,div,p,a,h1,h2,h3,h4,h5,h6 {font-family: "Segoe UI", sans-serif; mso-line-height-rule: exactly;}
  </style>
  <![endif]-->
  <style>
    /* Reset styles */
    body, table, td, p, a, li, blockquote { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #f1f5f9; }
    
    /* Content styles */
    .content-area h1 { color: #0f172a; font-size: 22px; font-weight: 700; line-height: 1.4; margin: 0 0 20px 0; }
    .content-area h2 { color: #1e293b; font-size: 18px; font-weight: 700; line-height: 1.4; margin: 32px 0 16px 0; padding-bottom: 10px; border-bottom: 2px solid #e2e8f0; }
    .content-area h3 { color: #334155; font-size: 16px; font-weight: 600; line-height: 1.4; margin: 24px 0 12px 0; }
    .content-area p { color: #475569; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0; }
    .content-area a { color: #0284c7; text-decoration: none; border-bottom: 1px solid #bae6fd; transition: border-color 0.2s; }
    .content-area a:hover { border-bottom-color: #0284c7; }
    .content-area ul, .content-area ol { margin: 0 0 20px 0; padding-left: 24px; color: #475569; }
    .content-area li { margin-bottom: 8px; font-size: 15px; line-height: 1.6; }
    .content-area strong { color: #1e293b; font-weight: 600; }
    .content-area blockquote { 
      margin: 20px 0; 
      padding: 16px 20px; 
      background-color: #f8fafc; 
      border-left: 4px solid #0284c7; 
      border-radius: 0 8px 8px 0;
      font-style: italic;
      color: #64748b;
    }
    .content-area img { 
      max-width: 100%; 
      height: auto; 
      border-radius: 8px; 
      margin: 20px 0; 
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
    }
    .content-area code { 
      background-color: #f1f5f9; 
      padding: 2px 6px; 
      border-radius: 4px; 
      font-family: "SF Mono", Monaco, "Cascadia Code", monospace; 
      font-size: 13px;
      color: #0f172a;
    }
    .content-area pre { 
      background-color: #0f172a; 
      padding: 20px; 
      border-radius: 8px; 
      overflow-x: auto; 
      margin: 20px 0;
    }
    .content-area pre code {
      background: none;
      padding: 0;
      color: #e2e8f0;
      font-size: 13px;
      line-height: 1.6;
    }
    
    /* Responsive styles */
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; }
      .mobile-padding { padding-left: 24px !important; padding-right: 24px !important; }
      .content-area h1 { font-size: 20px !important; }
      .content-area h2 { font-size: 17px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9;">
  <!-- Preview text -->
  <div style="display: none; font-size: 1px; color: #f1f5f9; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${report.title} - Your latest research insights from Relevx
  </div>
  
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <!-- Email Container -->
        <table role="presentation" class="email-container" width="640" cellspacing="0" cellpadding="0" border="0" style="max-width: 640px; width: 100%;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 0 0 24px 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: linear-gradient(135deg, #0c4a6e 0%, #164e63 100%); border-radius: 16px 16px 0 0;">
                <tr>
                  <td style="padding: 32px 40px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td>
                          <!-- Logo/Brand -->
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td style="padding-right: 12px; vertical-align: middle;">
                                <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                                  <table role="presentation" width="40" height="40" cellspacing="0" cellpadding="0" border="0">
                                    <tr>
                                      <td align="center" valign="middle" style="font-size: 20px; font-weight: 700; color: #0c4a6e;">R</td>
                                    </tr>
                                  </table>
                                </div>
                              </td>
                              <td style="vertical-align: middle;">
                                <div style="font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Relevx</div>
                                <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">AI Research Assistant</div>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td align="right" style="vertical-align: middle;">
                          <div style="font-size: 12px; color: #94a3b8;">${currentDate}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Content Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);">
                
                <!-- Report Title Section -->
                <tr>
                  <td class="mobile-padding" style="padding: 40px 40px 24px 40px;">
                    <div style="font-size: 11px; font-weight: 600; color: #0891b2; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px;">Research Report</div>
                    <h1 style="font-size: 26px; font-weight: 700; color: #0f172a; line-height: 1.3; margin: 0;">${
                      report.title
                    }</h1>
                  </td>
                </tr>
                
                <!-- Summary Section -->
                ${summarySection}
                
                <!-- Divider -->
                <tr>
                  <td style="padding: 0 40px 30px 40px;">
                    <div style="height: 1px; background: linear-gradient(90deg, transparent 0%, #e2e8f0 20%, #e2e8f0 80%, transparent 100%);"></div>
                  </td>
                </tr>
                
                <!-- Main Report Content -->
                <tr>
                  <td class="mobile-padding content-area" style="padding: 0 40px 40px 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                    ${markdownHtml}
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 32px 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <!-- Footer Logo -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding-right: 8px; vertical-align: middle;">
                          <div style="width: 24px; height: 24px; background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%); border-radius: 6px;">
                            <table role="presentation" width="24" height="24" cellspacing="0" cellpadding="0" border="0">
                              <tr>
                                <td align="center" valign="middle" style="font-size: 12px; font-weight: 700; color: #ffffff;">R</td>
                              </tr>
                            </table>
                          </div>
                        </td>
                        <td style="vertical-align: middle;">
                          <span style="font-size: 14px; font-weight: 600; color: #64748b;">Relevx</span>
                        </td>
                      </tr>
                    </table>
                    <div style="margin-top: 16px; font-size: 13px; color: #94a3b8; line-height: 1.6;">
                      Automated research intelligence, delivered to your inbox.
                    </div>
                    <div style="margin-top: 20px;">
                      <a href="https://relevx.ai/projects" style="display: inline-block; padding: 10px 24px; background-color: #0891b2; color: #ffffff; font-size: 13px; font-weight: 600; text-decoration: none; border-radius: 6px;">Manage Project</a>
                    </div>
                    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                      <span style="font-size: 11px; color: #94a3b8;">
                        &copy; ${new Date().getFullYear()} Relevx. All rights reserved.
                      </span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
        
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Send a research report via email
 */
export async function sendReportEmail(
  to: string,
  report: ClientReport,
  projectId: string,
  options?: ReportEmailOptions
): Promise<{ success: boolean; id?: string; error?: any }> {
  try {
    const resend = getResendClient();

    const htmlContent = await generateEmailHTML(report, projectId, options);

    const fromEmail = process.env.RESEND_FROM_EMAIL;
    if (!fromEmail) {
      throw new Error("RESEND_FROM_EMAIL is not set in environment variables");
    }

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject: `Research Report: ${report.title}`,
      html: htmlContent,
    });

    if (error) {
      console.error("Error sending email:", error);
      return { success: false, error };
    }

    return { success: true, id: data?.id };
  } catch (error) {
    console.error("Failed to send email:", error);
    return { success: false, error };
  }
}
