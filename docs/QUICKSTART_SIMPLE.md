# Simple Quickstart

**Audience:** first-time human users  
**Goal:** connect two OpenClaw machines with the fewest moving parts  
**Do not start here if:** you need public HTTPS, production ops, or bridge tool exposure

## What You Will End Up With

After this guide:
- machine A can reach machine B
- machine B can reach machine A
- both agents can `ping` and `get_status`
- you have a clean base for `chat` and `broadcast`

## What You Need

- two machines running OpenClaw
- Node.js 18+ on both machines
- network access between them
- about 10 minutes

We will call them:
- machine A
- machine B

## Step 1: Install on both machines

Run this on both machines:

```bash
git clone https://github.com/paprini/clawbridge.git
cd clawbridge
npm install
```

## Step 2: Run setup on machine A

```bash
npm run setup
```

If you do not have an LLM configured, ClawBridge falls back to prompt-based setup automatically.

During setup:
- name the agent
- confirm the machine URL
- add machine B as a peer if you already know its address

## Step 3: Run setup on machine B

```bash
npm run setup
```

During setup:
- name the agent
- confirm the machine URL
- add machine A as a peer

## Step 4: Verify both configs

Run on both machines:

```bash
A2A_SHARED_TOKEN=your-shared-token npm run verify
```

If you have not chosen a final token yet, use the same temporary token value on both machines for setup and replace it later.

## Step 5: Start both servers

Run on both machines:

```bash
npm start
```

## Step 6: Test the connection

From either machine:

```bash
npm run ping
```

If the peer is reachable, you are done.

## What To Do Next

- To understand the system better: [USER_GUIDE.md](USER_GUIDE.md)
- To expose bridge tools: [BRIDGE_SETUP.md](BRIDGE_SETUP.md)
- To deploy publicly with HTTPS: [OPERATOR_GUIDE.md](OPERATOR_GUIDE.md)

## Common Mistakes

- Wrong machine URL in `config/agent.json`
- Peer URL points to `localhost` instead of the remote machine
- Port `9100` blocked by firewall or VPN policy
- Token mismatch between peers

If you get stuck, use [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
