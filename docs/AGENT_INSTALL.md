# Agent Install Guide

**Audience:** AI agents installing ClawBridge for a human user  
**Not for:** normal human readers

## Objective

Install ClawBridge, create a valid local config, verify it, start it safely, and report status back to the human.

## Required Behavior

- check prerequisites first
- do not disrupt an existing running instance without asking
- run `npm run verify` before starting the server
- report exact failures, not vague summaries
- avoid destructive actions unless the human explicitly asks

## Minimum Install Flow

### 1. Check prerequisites

```bash
node --version
npm --version
git --version
```

If required tools are missing, stop and report that clearly.

### 2. Clone and install

```bash
git clone https://github.com/paprini/clawbridge.git
cd clawbridge
npm install
```

### 3. Run setup

Prefer:

```bash
npm run setup
```

Fallback:

```bash
npm run setup:auto
```

### 4. Verify before start

```bash
npm run verify
```

If verification fails, do not start the server yet.

### 5. Check for an existing process

```bash
lsof -i :9100
```

If the port is already in use, ask the human whether to reuse, restart, or move to another port.

### 6. Start the server

Foreground:

```bash
npm start
```

Production-style service management should follow [OPERATOR_GUIDE.md](OPERATOR_GUIDE.md), not ad hoc `nohup`.

### 7. Confirm the instance is healthy

```bash
curl http://localhost:9100/health
curl http://localhost:9100/.well-known/agent-card.json
```

## Reporting Format

At minimum, report:
- whether install succeeded
- whether verify passed
- whether the server started
- whether health and agent-card checks succeeded
- what the human needs to do next
