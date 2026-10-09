import { defineRailway, project, service, preserve } from "railway/iac";

// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "chatbot-template";

export default defineRailway(() => {
  const chatbot_template = service("chatbot-template", {
    source: { type: 'github', repo: 'agmgroupuk/chatbot-template', branch: 'main' },
    domains: [{ domain: 'onefinsolution.online', port: 8080 }],
    env: {
      DATABASE_URL: preserve(),
      NEXT_PUBLIC_SITE_URL: preserve(), PORT: preserve(),
      BILLING_PROVIDER: 'stripe', STRIPE_MODE: 'test', SIGNUP_CREDITS: '10', CHAT_CREDIT_COST: '1',
      AI_PROVIDER: 'openai', OPENAI_MODEL: 'gpt-4.1-mini', XAI_MODEL: 'grok-4.3',
    },
    build: "npm run build",
    start: "npm run start",
    preDeploy: "npm run db:migrate",
    healthcheck: "/api/health",
    healthcheckTimeout: 120,
    // builder from CaC: "RAILPACK"
  });
  return project("romantic-charm", {
    resources: [chatbot_template],
  });
});
