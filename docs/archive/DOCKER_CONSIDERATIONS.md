# Docker & Container Considerations

## The Problem

**Containerized OpenClaw installations have networking challenges:**

1. **Isolated networks** — Containers can't see each other by default
2. **Port mapping required** — A2A sidecar on :9100 needs to be exposed
3. **Auto-discovery fails** — Network scanning doesn't work across Docker networks
4. **systemd unavailable** — Can't use systemd service in containers
5. **IP addressing** — Container IPs are ephemeral, change on restart

---

## Solutions

### **1. Docker Networking Modes**

#### **Option A: Host Network (Easiest)**

**How it works:**
- Container shares host's network stack
- A2A sidecar binds to host's port 9100
- Auto-discovery works (sees host network)

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  openclaw:
    image: openclaw:latest
    network_mode: host
    volumes:
      - ./workspace:/workspace
      - ./skills:/skills
    environment:
      - A2A_ENABLED=true
      - A2A_PORT=9100
```

**Pros:**
- ✅ Simplest setup
- ✅ Auto-discovery works
- ✅ No port mapping needed

**Cons:**
- ❌ Less isolation
- ❌ Port conflicts possible
- ❌ Not recommended for production multi-tenant

---

#### **Option B: Bridge Network with Port Mapping (Recommended)**

**How it works:**
- Containers on custom bridge network
- Expose A2A port 9100 to host
- Manual peer configuration (auto-discovery limited)

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  openclaw-discord:
    image: openclaw:latest
    container_name: openclaw-discord
    networks:
      - a2a-network
    ports:
      - "18789:18789"  # OpenClaw gateway
      - "9100:9100"    # A2A sidecar
    environment:
      - A2A_ENABLED=true
      - A2A_PORT=9100
      - A2A_BIND=0.0.0.0  # Listen on all interfaces
    volumes:
      - ./discord-workspace:/workspace

  openclaw-telegram:
    image: openclaw:latest
    container_name: openclaw-telegram
    networks:
      - a2a-network
    ports:
      - "18790:18789"  # Different host port
      - "9101:9100"    # Different host port
    environment:
      - A2A_ENABLED=true
      - A2A_PORT=9100
      - A2A_BIND=0.0.0.0
    volumes:
      - ./telegram-workspace:/workspace

networks:
  a2a-network:
    driver: bridge
```

**Peer configuration (manual):**
```json
{
  "peers": [
    {
      "id": "openclaw-telegram",
      "url": "http://openclaw-telegram:9100",  // Container name (works on bridge)
      "token": "a2a_shared_xxx"
    }
  ]
}
```

**Or from host:**
```json
{
  "peers": [
    {
      "id": "openclaw-telegram",
      "url": "http://localhost:9101",  // Host port mapping
      "token": "a2a_shared_xxx"
    }
  ]
}
```

**Pros:**
- ✅ Better isolation
- ✅ Containers can communicate via bridge network
- ✅ Production-ready

**Cons:**
- ❌ Manual peer configuration required
- ❌ Auto-discovery limited to same bridge network

---

#### **Option C: Kubernetes / Multi-Host**

**For production clusters:**

**kubernetes.yaml:**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: openclaw-discord-a2a
spec:
  selector:
    app: openclaw-discord
  ports:
    - protocol: TCP
      port: 9100
      targetPort: 9100
  type: ClusterIP  # Internal only (VPC-like)

---

apiVersion: apps/v1
kind: Deployment
metadata:
  name: openclaw-discord
spec:
  replicas: 1
  selector:
    matchLabels:
      app: openclaw-discord
  template:
    metadata:
      labels:
        app: openclaw-discord
    spec:
      containers:
      - name: openclaw
        image: openclaw:latest
        ports:
        - containerPort: 18789  # Gateway
        - containerPort: 9100   # A2A
        env:
        - name: A2A_ENABLED
          value: "true"
        - name: A2A_PORT
          value: "9100"
```

**Service discovery:**
```json
{
  "peers": [
    {
      "id": "openclaw-telegram",
      "url": "http://openclaw-telegram-a2a:9100",  // K8s service name
      "token": "a2a_shared_xxx"
    }
  ]
}
```

**Pros:**
- ✅ Production-grade
- ✅ Service discovery built-in
- ✅ Auto-scaling possible

**Cons:**
- ❌ More complex setup
- ❌ Requires K8s knowledge

---

### **2. Process Management (No systemd)**

**Problem:** systemd doesn't work in containers

**Solution A: supervisord**

**supervisord.conf:**
```ini
[supervisord]
nodaemon=true

[program:openclaw]
command=/usr/local/bin/openclaw gateway start
autostart=true
autorestart=true

[program:a2a-sidecar]
command=node /opt/openclaw-a2a/src/server.js
autostart=true
autorestart=true
environment=A2A_PORT=9100,A2A_CONFIG=/workspace/.a2a/config.json
```

**Dockerfile:**
```dockerfile
FROM node:18

# Install supervisord
RUN apt-get update && apt-get install -y supervisor

# Copy supervisord config
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Start supervisord
CMD ["/usr/bin/supervisord"]
```

---

**Solution B: Docker ENTRYPOINT script**

**entrypoint.sh:**
```bash
#!/bin/bash

# Start A2A sidecar in background
node /opt/openclaw-a2a/src/server.js &
A2A_PID=$!

# Start OpenClaw gateway (foreground)
openclaw gateway start

# If OpenClaw exits, kill A2A
kill $A2A_PID
```

**Dockerfile:**
```dockerfile
FROM node:18

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
```

---

**Solution C: docker-compose healthcheck**

**docker-compose.yml:**
```yaml
services:
  openclaw:
    image: openclaw:latest
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9100/.well-known/agent-card"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
```

---

### **3. Auto-Discovery Fallback**

**Problem:** Auto-discovery (network scanning) doesn't work across Docker networks

**Solution: Hybrid approach**

**Setup agent logic:**
```javascript
// Try auto-discovery first (works if same network)
const discovered = await scanNetwork('172.18.0.0/24');  // Docker bridge subnet

if (discovered.length === 0) {
  console.log('No agents discovered. Using manual configuration.');
  
  // Fall back to manual peer list
  const manualPeers = loadPeersFromConfig();
  
  // Test connectivity to each peer
  for (const peer of manualPeers) {
    const reachable = await testConnection(peer.url);
    if (reachable) {
      console.log(`✅ ${peer.id} reachable at ${peer.url}`);
    } else {
      console.log(`❌ ${peer.id} NOT reachable at ${peer.url}`);
    }
  }
}
```

**User experience:**
```
Setup Agent: Scanning Docker network...
             Found 0 agents (auto-discovery doesn't work in containers)
             
             No problem! I'll help you add peers manually.
             
             Your A2A endpoint: http://openclaw-discord:9100
             
             What's the URL of the peer you want to connect?
             Examples:
             - http://openclaw-telegram:9100 (same Docker network)
             - http://10.0.1.11:9100 (different host)
             - http://host.docker.internal:9101 (from container to host)

You: http://openclaw-telegram:9100

Setup Agent: Testing connection...
             ✅ Connected! openclaw-telegram is reachable.
             
             Generating shared bearer token...
             🔑 a2a_shared_x7K9mP2nQ4vB8wL...
             
             Add this to openclaw-telegram's config:
             
             {
               "peers": [{
                 "id": "openclaw-discord",
                 "url": "http://openclaw-discord:9100",
                 "token": "a2a_shared_x7K9mP2nQ4vB8wL..."
               }]
             }
             
             Done on your side?

You: Yes

Setup Agent: ✅ Both sides configured!
             Testing bidirectional communication...
             
             openclaw-discord → openclaw-telegram: ✅
             openclaw-telegram → openclaw-discord: ✅
             
             All set! Your agents can now talk.
```

---

### **4. Health Checks for Containers**

**A2A sidecar should expose health endpoint:**

**src/server.js:**
```javascript
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    peers: peers.map(p => ({
      id: p.id,
      reachable: p.lastSeen > Date.now() - 60000  // Seen in last 60s
    }))
  });
});
```

**Docker healthcheck:**
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:9100/health"]
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 10s
```

---

## Recommendations

### **For Most Users (Docker Compose):**
1. Use **bridge network** with port mapping
2. Manual peer configuration (setup agent guides you)
3. Use **supervisord** or **entrypoint script** for process management
4. Health checks enabled

### **For Single-Host (Easier):**
1. Use **host network mode**
2. Auto-discovery works
3. systemd can be used on host

### **For Production (Kubernetes):**
1. Use **K8s Services** for discovery
2. ClusterIP type (internal only)
3. ConfigMaps for peer configuration
4. Liveness/readiness probes

---

## Documentation Needed

### **Phase 1 MVP:**
- [ ] Docker compose example (bridge network)
- [ ] Environment variables documented
- [ ] Manual peer configuration guide
- [ ] Health check endpoint
- [ ] Troubleshooting (connectivity issues)

### **Phase 2 (After MVP):**
- [ ] Kubernetes deployment example
- [ ] Multi-host Docker Swarm
- [ ] Docker networking deep dive
- [ ] Container-to-container vs container-to-host

---

## Testing Strategy

**We need to test:**
1. ✅ Host network mode (auto-discovery)
2. ✅ Bridge network mode (manual config)
3. ✅ Container-to-container communication (same bridge)
4. ✅ Container-to-host communication (port mapping)
5. ✅ Health checks working
6. ✅ Process management (supervisord)

**Use our existing 3 instances:**
- One in Docker (bridge mode)
- One in Docker (host mode)
- One bare metal
- Test cross-communication

---

## Open Questions

1. **Should we provide pre-built Docker image?**
   - `docker pull openclaw/openclaw-a2a:latest`
   - Or just Dockerfile + instructions?

2. **Default to host or bridge networking?**
   - Host is easier (auto-discovery works)
   - Bridge is more isolated (better for production)

3. **Support Docker Swarm / K8s in Phase 1?**
   - Or defer to Phase 2?

4. **How to handle container restarts?**
   - Ephemeral IPs change
   - Need stable service names or static IPs

---

## Impact on Timeline

**Phase 1 additions:**
- Docker compose example: +1 day
- Manual peer config UI: +1 day
- Health checks: +0.5 days
- Container testing: +1 day

**Total:** +3-4 days if we support Docker properly in Phase 1

**Alternative:** Ship Phase 1 for bare metal only, add Docker support in Phase 1.5

**Recommendation:** Include basic Docker support in Phase 1 (bridge + manual config). Many users run OpenClaw in containers.

---

**Should we include Docker support in Phase 1, or defer to Phase 1.5?**
