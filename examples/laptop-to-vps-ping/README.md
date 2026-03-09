# Example: Laptop to VPS Ping

Two agents on different machines. Laptop pings VPS.

## Setup

### On VPS (10.0.1.10):

```bash
cd clawbridge
cp examples/laptop-to-vps-ping/config-vps/* config/
echo "A2A_SHARED_TOKEN=your_shared_token_here" > .env
node src/server.js
```

### On Laptop:

```bash
cd clawbridge
cp examples/laptop-to-vps-ping/config-laptop/* config/
echo "A2A_SHARED_TOKEN=your_shared_token_here" > .env
node src/server.js
```

## Test

From laptop:
```bash
npm run ping
# Expected: vps-agent: ✅ pong
```

Or manually:
```bash
curl -X POST http://localhost:9100/a2a \
  -H "Authorization: Bearer your_shared_token_here" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"message/send","params":{"message":{"kind":"message","messageId":"test","role":"user","parts":[{"kind":"text","text":"ping"}]}},"id":1}'
```
