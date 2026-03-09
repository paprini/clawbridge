# ClawBridge Agent Onboarding Prompt

**Give this prompt to a new OpenClaw agent to install ClawBridge:**

---

## Prompt for Agent (Copy-Paste Ready)

```
Install ClawBridge from https://github.com/paprini/clawbridge

Clone the repo, run npm install, run the setup wizard, and configure 
this agent to join the network.

Let me know when it's done.
```

**That's it.** The agent will handle the rest.

---

## Detailed Prompt (Alternative)

If you want more control over the setup process, use this extended version:

```
Please install ClawBridge on this machine to connect to the agent network.

ClawBridge is an agent-to-agent communication system that lets OpenClaw agents 
on different machines talk to each other and execute skills remotely.

Repository: https://github.com/paprini/clawbridge

Steps:
1. Clone the repository
2. Navigate into the clawbridge directory
3. Install dependencies (npm install)
4. Run the interactive setup (npm run setup)
5. During setup, configure:
   - Agent name (use this instance's name)
   - Agent URL (http://[this machine's IP]:9100)
   - Peer agents to connect to
   - Skills to expose (enable "ping" and "get_status" at minimum)
6. Start ClawBridge (npm start)
7. Test connectivity (npm run ping)

Report back when installation is complete and connectivity test results.
```

---

## Prerequisites for This to Work

**Repository Access:**
- Repo must be public OR
- Agent must have GitHub access (collaborator or PAT) OR
- Use alternative distribution (tarball, private package registry)

**Agent Capabilities:**
- Must have exec/shell access
- Must have git installed
- Must have Node.js 18+ installed
- Must have npm installed

**Network:**
- Agent must be reachable at specified IP:9100
- Firewall must allow incoming connections on port 9100
- Other agents in the network must be able to reach this agent's URL

---

## For Marketing: Agent-Native Onboarding

**The pitch:** "Just ask your agent to install ClawBridge"

**User experience:**
1. User: "Install ClawBridge from GitHub"
2. Agent: *reads docs, runs commands, configures itself*
3. Agent: "ClawBridge installed. Connected to 2 peers. Ready."

**No command lines. No config files. Just natural language.**

This is what makes ClawBridge unique: the installation itself is agent-to-agent native.

---

## What the Agent Will Do

When you give the prompt above, your agent will:

1. **Read the README** — Understand what ClawBridge is and how it works
2. **Clone the repo** — Download ClawBridge to this machine
3. **Install dependencies** — Run `npm install`
4. **Run setup** — Execute `npm run setup` (conversational wizard)
5. **Configure itself** — Answer setup questions based on this machine's context
6. **Start ClawBridge** — Run `npm start` to join the network
7. **Test connectivity** — Ping other agents to verify connection
8. **Report back** — Tell you the results

**Total time:** 2-5 minutes (depending on network speed and setup questions)

---

## Terminology Note

- **ClawBridge** = The product (complete agent networking system)
- **OpenClaw Bridge** = A feature within ClawBridge (lets agents call OpenClaw gateway tools)

When giving the prompt, use "ClawBridge" (the product name), not "bridge" (ambiguous).
