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
      DATABASE_URL: preserve(), PGDATABASE: preserve(), PGPASSWORD: preserve(), RAILWAY_TOKEN: preserve(),
      NEXT_PUBLIC_SITE_URL: preserve(), NEXT_PUBLIC_UPDATE_ENVIRONMENT: preserve(), PORT: preserve(),
      BILLING_PROVIDER: 'stripe', SIGNUP_CREDITS: '10', CHAT_CREDIT_COST: '1',
    },
    build: "npm run build",
    start: "npm run start",
    healthcheck: "/api/health",
    healthcheckTimeout: 120,
    // builder from CaC: "RAILPACK"
  });
  return project("romantic-charm", {
    resources: [chatbot_template],
  });
});
