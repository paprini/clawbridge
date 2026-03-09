# ClawBridge Agent Onboarding Prompt

**Give this prompt to a new OpenClaw agent to install ClawBridge:**

---

## Prompt for Agent

```
Please install ClawBridge on this machine to connect to the agent network.

ClawBridge is an agent-to-agent communication system that lets OpenClaw agents on different machines talk to each other and execute skills remotely.

Steps:
1. Go to the GitHub repository: https://github.com/paprini/clawbridge
2. Clone the repository to the home directory
3. Navigate into the clawbridge directory
4. Install the Node.js dependencies (npm install)
5. Run the interactive setup (npm run setup)
6. When asked for agent information:
   - Agent name: [your instance name, e.g., "whatsapp-agent"]
   - Agent URL: http://[your IP]:9100 (use this machine's IP address)
   - Peer configuration: Add the other agents you want to connect to
   - Skills to expose: Enable "ping" and "get_status" at minimum
7. Start the ClawBridge server (npm start)
8. Test connectivity by pinging other agents (npm run ping)

After installation, this agent will be able to communicate with other agents in the network and execute skills remotely.

Let me know when installation is complete and whether the connectivity test succeeded.
```

---

## Prerequisites for This to Work

**Repository Access:**
- Repo must be public OR
- Test agent must have GitHub access (collaborator or PAT) OR
- Use alternative distribution (tarball, private package registry)

**Agent Capabilities:**
- Must have exec/shell access
- Must have git installed
- Must have Node.js 18+ installed
- Must have npm installed

**Network:**
- Agent must be reachable at specified IP:9100
- Firewall must allow incoming connections on port 9100
- Other agents must be able to reach this agent's URL

---

## For Marketing: Standard Onboarding

**The pitch:** "Just ask your agent to install ClawBridge"

**User experience:**
1. User: "Install ClawBridge from GitHub"
2. Agent: *reads docs, runs commands, configures itself*
3. Agent: "ClawBridge installed. Connected to 2 peers. Ready."

**No command lines. No config files. Just natural language.**

This is the marketing-ready onboarding flow.
