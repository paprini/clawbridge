# ClawBridge Agent Onboarding Prompt

**This document is FOR HUMANS — what to tell your agent to install ClawBridge.**

---

## Ultra-Short Prompt (Recommended)

**Copy this and give it to your OpenClaw agent:**

```
Install ClawBridge from https://github.com/paprini/clawbridge

Follow the agent installation guide in AGENT_INSTALL.md

Report back when complete.
```

**That's it.** Three lines. Your agent will:
1. Clone the repository
2. Read `AGENT_INSTALL.md` (comprehensive instructions for agents)
3. Install, configure, test, and verify everything
4. Report back with results

**Total time:** 2-5 minutes (depending on network and setup)

---

## Why This Works

**All instructions are in the repository.**

The agent doesn't need you to tell it every step. It reads `AGENT_INSTALL.md`, which contains:
- Prerequisite checks (Node.js, git, network)
- Step-by-step installation instructions
- Configuration guidance
- **Testing before starting** (verify config is valid)
- **Safe restart procedures** (check if already running first)
- Troubleshooting for common issues
- Clear success/failure reporting criteria
- What to report at each stage

**The prompt is short because the repo has the details.**

---

## What Your Agent Will Do

When you give the prompt above, your agent will:

1. **Clone the repo** — `git clone https://github.com/paprini/clawbridge.git`
2. **Read AGENT_INSTALL.md** — Comprehensive installation guide written for agents
3. **Check prerequisites** — Node.js 18+, npm, git, network access
4. **Install dependencies** — `npm install`
5. **Run setup wizard** — `npm run setup` (conversational config)
6. **Verify configuration** — `npm run verify` (test BEFORE starting)
7. **Start ClawBridge** — `npm start` (carefully, checking if already running)
8. **Test connectivity** — Health checks, peer pings
9. **Report results** — Summary of installation status

**No manual intervention needed.**

---

## Alternative: Detailed Prompt (Not Recommended)

If you want more control or your agent doesn't automatically read repo documentation, use this longer version:

```
Install ClawBridge on this machine to connect to the agent network.

Repository: https://github.com/paprini/clawbridge

Installation steps:
1. Check prerequisites (Node.js 18+, npm, git)
2. Clone the repository
3. Install dependencies (npm install)
4. Run interactive setup (npm run setup)
5. Verify configuration (npm run verify)
6. Check if server already running (lsof -i :9100)
7. Start ClawBridge (npm start)
8. Test connectivity (npm run ping)
9. Report installation status

IMPORTANT:
- Test configuration with 'npm run verify' BEFORE starting
- Check if port 9100 is already in use before starting
- Report progress at each stage
- If anything fails, report the error and ask for guidance

For complete instructions, see AGENT_INSTALL.md in the repository.
```

**Why not recommended:** Adds clutter to the prompt when all this is already documented in `AGENT_INSTALL.md`.

---

## Prerequisites for This to Work

**Repository Access:**
- ✅ Repository is public (it is)
- OR agent has GitHub credentials (collaborator or PAT)

**Agent Capabilities:**
- ✅ Shell access (exec/command execution)
- ✅ git installed
- ✅ Node.js 18+ installed
- ✅ npm installed

**Network:**
- ✅ Agent can reach GitHub
- ✅ Machine's port 9100 is available
- ✅ Firewall allows incoming connections on port 9100 (for other agents to connect)

**If prerequisites are missing:**
- Agent will detect this during installation
- Agent will report which prerequisite is missing
- You install the missing requirement
- Agent continues installation

---

## For Marketing: Agent-Native Everything

**The pitch:** "Installation itself is agent-to-agent native."

**User experience:**
1. User: "Install ClawBridge from GitHub"
2. Agent: *reads AGENT_INSTALL.md, runs commands, configures itself, tests everything*
3. Agent: "ClawBridge installed. Connected to 2 peers. Ready."

**No command lines. No config files. No human intervention.**

**This is unique to ClawBridge.** Other tools require humans to:
- Run install commands manually
- Edit config files
- Troubleshoot errors
- Test connectivity

With ClawBridge, the **agent does all of this**. The installation guide is written for agent consumption, not human consumption.

**Example final report from agent:**
```
✅ ClawBridge installation complete

Summary:
- Agent name: work-laptop
- Agent URL: http://192.168.1.100:9100
- Peers configured: 2
- Peers reachable: 2 (home-vps, office-desktop)
- Status: Running (systemd service active)

This agent can now communicate with:
- home-vps (http://192.168.1.50:9100)
- office-desktop (http://192.168.1.75:9100)

To verify from another machine:
curl http://192.168.1.100:9100/health

Next steps:
- Configure additional skills in config/skills.json
- Monitor logs: journalctl -u clawbridge -f
```

---

## What Makes AGENT_INSTALL.md Different

**Traditional setup docs:**
- Written for humans
- Assume human is reading and executing commands
- Vague success criteria
- No clear error handling instructions

**AGENT_INSTALL.md:**
- ✅ Written FOR AGENTS (clear, parseable, unambiguous)
- ✅ Explicit prerequisite checks with commands to run
- ✅ Clear success/failure reporting at each step
- ✅ Troubleshooting guidance built into each section
- ✅ **Emphasizes testing before starting** (npm run verify)
- ✅ **Safe restart procedures** (check if already running, don't break existing setup)
- ✅ Example installation flow showing what good output looks like
- ✅ What to report back to human at each stage
- ✅ Security considerations agents should flag

**Agents can follow it autonomously.** Humans can too, but that's not the primary use case.

---

## Troubleshooting Common Issues

### "My agent didn't read AGENT_INSTALL.md"

Some agents don't automatically read documentation files. Solutions:

1. **Explicitly tell it to:** "Clone the repo and read AGENT_INSTALL.md for instructions"
2. **Use the detailed prompt** (see Alternative Prompt section above)
3. **Give it the URL:** "Follow the installation guide at https://github.com/paprini/clawbridge/blob/main/AGENT_INSTALL.md"

### "Agent asks how to configure peers"

The setup wizard will guide this, but if agent needs help:
- Peer ID: unique identifier (e.g., "home-vps", "work-laptop")
- Peer URL: `http://[peer-IP]:9100`
- Token: Generated automatically by setup wizard (64-char hex)

### "Agent reports port 9100 already in use"

This means ClawBridge (or another service) is already running. Agent should:
1. Check what's using it: `lsof -i :9100`
2. Ask you: "ClawBridge may already be running. Should I restart it or use a different port?"
3. Don't blindly kill processes

### "Agent can't reach peers after installation"

Common causes:
- Firewall blocking port 9100 on this machine or peer machines
- Peer URLs incorrect in config/peers.json
- Peer agents not actually running
- Network connectivity issues

Agent should run: `npm run ping` and report which peers are unreachable.

---

## Terminology Note

- **ClawBridge** = The product (agent networking system)
- **OpenClaw Bridge** = A feature within ClawBridge (exposes OpenClaw tools to remote agents)

When giving the prompt, use "**ClawBridge**" (the product name).

---

## After Installation

Your agent is now part of the agent network. Other agents can:
- Call this agent's exposed skills
- Receive responses from this agent
- Collaborate on multi-agent tasks

**Next steps:**
- Configure which skills to expose (config/skills.json)
- Add more peer agents (config/peers.json)
- Optionally enable OpenClaw Bridge (config/bridge.json) to let remote agents use your local tools
- Monitor activity (logs, health endpoint)

**See the main README for architecture details, examples, and advanced features.**

---

## Remember

**The magic of ClawBridge:** Installation is agent-to-agent native.

1. **Prompt is ultra-short** — All details in the repository
2. **Instructions are for agents** — Clear, parseable, autonomous
3. **Agent handles everything** — Prerequisites, install, config, testing, reporting
4. **Human just watches** — Agent reports progress and results

**This is how agent infrastructure should work.**
