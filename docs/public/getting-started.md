# Getting Started

Set up Convixa for your organization in under 5 minutes.

## Step 1: Create Your Account

1. Go to [convixa.io/register](https://convixa.io/register)
2. Enter your email and name
3. Verify your email (check your inbox for the verification link)

## Step 2: Your Organization

When you create an account, Convixa automatically creates a **personal organization** for you. This is a private workspace where you can add Safes and monitor them.

If you're joining an existing organization, ask your admin for an invite link.

To create a new team organization:
1. Go to **Create Organization**
2. Enter your organization name and domain
3. Your 14-day free trial starts immediately with full access to all features

## Step 3: Add Your First Safe

1. From the dashboard, click **Add Safe**
2. Enter your Safe address (e.g., `0x1234...`)
3. Select the network (Ethereum, Base, Arbitrum, etc.)
4. Optionally give it a name and assign it to a team
5. Click **Add**

Convixa will immediately fetch your Safe's data: signer list, threshold, balances, and pending transactions.

## Step 4: Explore Your Dashboard

Your dashboard shows:

- **Overview** — Key metrics: total Safes, aggregate balances, pending approvals, unique signers
- **Inventory** — All your Safes in a searchable, filterable table
- **Safe Detail** — Click any Safe to see balances, signers with reputation badges, transaction history, and pending queue

## Step 5: Set Up Alerting (Recommended)

1. Go to **Alerts** in the sidebar
2. Click **Create Alert Rule**
3. Choose what to monitor:
   - All governance changes (add/remove signer, threshold changes)
   - Transfers above a certain value
   - Specific Safe activity
4. Choose how to get notified:
   - Email (add individual addresses or a recipient list)
   - Slack (webhook URL)
5. Save

You'll get notified within ~15 seconds of any matching transaction being proposed.

## Step 6: Invite Your Team

1. Go to **Settings → Invites**
2. Generate an invite link (set expiry and usage limits if needed)
3. Share the link with your team
4. Members who accept are added to your organization
5. Assign them to teams and roles in **Settings → Members**

## Step 7: Configure Policies (Optional, Pro Plan)

1. Go to **Controls → Policies**
2. Create a policy — for example:
   - "Alert when any transfer exceeds 50 ETH"
   - "Block transactions to addresses on the vendor blocklist"
3. Test the policy against recent transactions
4. Deploy on-chain if you want programmatic enforcement

## Next Steps

- [Set up real-time alerting](features/real-time-alerting.md) for your most critical Safes
- [Register as a signer](features/signer-registry.md) to build cross-org reputation
- [Configure teams and roles](features/org-team-management.md) for your organization
- [Set up your personal dashboard](features/personal-dashboard.md) if you sign for multiple orgs

---

**Need help?** Reach out to support@convixa.io
