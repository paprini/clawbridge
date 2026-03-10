# Getting Started For Contributors

**Audience:** contributors and developers working on ClawBridge itself  
**Not for:** first-time end users looking for the easiest install path

If you want to connect two machines quickly, use [QUICKSTART_SIMPLE.md](QUICKSTART_SIMPLE.md).  
If you want to operate a deployment, use [OPERATOR_GUIDE.md](OPERATOR_GUIDE.md).

## Development Setup

```bash
git clone https://github.com/paprini/clawbridge.git
cd clawbridge
npm install
```

## Create A Local Config

Fastest path:

```bash
npm run setup:auto
```

For development, a local repo-managed config is acceptable.

## Validate And Run

```bash
A2A_SHARED_TOKEN=dev-shared-token npm run verify
npm run dev
```

## Useful Commands

```bash
npm test
npm run verify
npm run status
npm run ping
```

## What To Read Next

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [API_REFERENCE.md](API_REFERENCE.md)
- [BUILTIN_SKILLS.md](BUILTIN_SKILLS.md)
- [BRIDGE_SETUP.md](BRIDGE_SETUP.md)
