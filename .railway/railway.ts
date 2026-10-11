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
      CHAT_CREDIT_COST: preserve(),
      RESEND_API_KEY: preserve(),
      EMAIL_FROM: preserve(),
      EMAIL_FROM_AUTH: preserve(),
      EMAIL_FROM_BILLING: preserve(),
      EMAIL_REPLY_TO: preserve(),
      PORT: preserve(),
      SESSION_COOKIE_DOMAIN: preserve(),
      BILLING_PROVIDER: preserve(),
      STRIPE_MODE: preserve(),
      STRIPE_EXPECTED_ACCOUNT_ID: preserve(),
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: preserve(),
      STRIPE_SECRET_KEY: preserve(),
      STRIPE_WEBHOOK_SECRET: preserve(),
      STRIPE_CREDIT_PLANS: preserve(),
      SIGNUP_CREDITS: preserve(),
      WORKSPACE_CREDIT_COST: preserve(),
      WORKSPACE_SIGNING_KEY: preserve(),
      AI_PROVIDER: preserve(),
      OPENAI_API_KEY: preserve(),
      OPENAI_MODEL: preserve(),
      XAI_API_KEY: preserve(),
      XAI_MODEL: preserve(),
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
