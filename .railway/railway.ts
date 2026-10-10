import { defineRailway, project, service, preserve } from "railway/iac";

// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "chatbot-template";

export default defineRailway(() => {
  const chatbot_template = service("chatbot-template", {
    source: { type: "github", repo: "agmgroupuk/chatbot-template", branch: "main" },
    domains: [{ domain: "onefinsolution.online", port: 8080 }],
    env: {
      DATABASE_URL: preserve(),
      NEXT_PUBLIC_SITE_URL: preserve(),
      RESEND_API_KEY: preserve(),
      EMAIL_FROM: preserve(),
      EMAIL_FROM_AUTH: preserve(),
      EMAIL_FROM_BILLING: preserve(),
      EMAIL_REPLY_TO: preserve(),
      PORT: preserve(),
      BILLING_PROVIDER: "stripe",
      STRIPE_MODE: "test",
      STRIPE_EXPECTED_ACCOUNT_ID: preserve(),
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: preserve(),
      STRIPE_SECRET_KEY: preserve(),
      STRIPE_WEBHOOK_SECRET: preserve(),
      STRIPE_CREDIT_PLANS: preserve(),
      SIGNUP_CREDITS: "10",
      WORKSPACE_CREDIT_COST: "1",
      WORKSPACE_SIGNING_KEY: preserve(),
      AI_PROVIDER: "xai",
      OPENAI_API_KEY: preserve(),
      OPENAI_MODEL: "gpt-4.1-mini",
      XAI_API_KEY: preserve(),
      XAI_MODEL: "grok-4.3",
    },
    build: "npm run build",
    start: "npm run start",
    preDeploy: "npm run db:migrate",
    healthcheck: "/api/health",
    healthcheckTimeout: 120,
  });
  return project("romantic-charm", {
    resources: [chatbot_template],
  });
});
