# AI-Core — Claw Deployment Bot

Discord bot that executes deployment prompts and sends task-completion notifications.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Fill in your `.env`:
   - `DISCORD_BOT_TOKEN` — your bot token from the [Discord Developer Portal](https://discord.com/developers/applications)
   - `DISCORD_CHANNEL_ID` — the channel where deployment notifications are posted
   - `NOTIFY_ON_COMPLETE` — set to `true` (default) to receive task-complete notifications

3. **Start the bot**
   ```bash
   npm start
   ```

## Usage

In any channel the bot can read:

| Command | Description |
|---|---|
| `!deploy <target>` | Deploy to a target (production, staging, preview) |
| `!deploy list` | List available deployment targets |
| `!deploy status` | Show currently running deployments |

## Notifications

When `NOTIFY_ON_COMPLETE=true`, the bot sends rich embed notifications to the configured channel:

- **Deployment Started** — amber embed when a deploy begins
- **Deployment Complete** — green embed on success, red on failure
- Each embed includes the target, who requested it, and command output

## Adding Deployment Targets

Edit `DEPLOY_TARGETS` in `src/deployer.js` to add your own shell commands:

```js
const DEPLOY_TARGETS = {
  production: 'your-deploy-script --env production',
  staging:    'your-deploy-script --env staging',
  preview:    'your-deploy-script --env preview',
};
```
