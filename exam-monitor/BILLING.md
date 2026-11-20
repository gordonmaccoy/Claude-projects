# Automatic billing connections

Costs & Usage reads billing sources on the server, hourly and on stale admin reads.
No user-entered bills or model rates are used by the dashboard. Existing legacy ledger records are preserved.

## One-time credentials (Railway Public service variables)
- OPENAI_BILLING_KEY: organization admin key restricted to Usage API Scope: Read.
- OPENAI_BILLING_PROJECT_ID: the project used by Examio's workload key. Required to avoid including unrelated projects.
- RAILWAY_BILLING_TOKEN: workspace-scoped Railway API token. Railway's token UI does not offer a billing-only permission; this grants broader workspace access. Obtain owner approval before creating it.
- RAILWAY_BILLING_WORKSPACE_ID: workspace ID.

Never use OPENAI_API_KEY or SUPABASE_ADMIN_KEY as billing credentials. Never expose billing keys in client configuration, responses or logs.

## Data and limits
OpenAI costs are calendar-month USD, paginated, filtered to the configured project. Startup/hourly job backfills current and two prior months; selecting an older month fetches it. Provider charges may lag. Feature token usage is recorded locally; the costs API cannot assign charges to Examio feature names, so no exact feature cost is claimed.
Railway uses currentUsage from the workspace customer, with the actual billing period and configured usage limits. This is workspace-wide, not only Examio. History accumulates as periodic snapshots; archived values are not guaranteed final invoices. Forecasts use elapsed-period average after at least one day. Sources are never summed across incompatible periods/scopes.
Supabase public Management API documents addon configuration but no invoice/total-cost reader. Email/domain billing is not connected. These display Not connected, never $0.
Failures preserve the last successful snapshot and show the attempt and success timestamps. No prompts, student responses or credentials are saved to billing tables. Tables have RLS enabled. The admin owner gate protects the endpoint.

Sources verified 2026-11-20:
https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage/methods/costs
https://raw.githubusercontent.com/railwayapp/cli/master/src/commands/usage.rs
https://supabase.com/docs/reference/api/introduction
