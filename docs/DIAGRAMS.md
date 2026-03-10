# Diagrams

**Audience:** community-facing marketing, docs authors, and advanced explainers

These diagrams are intentionally separated from setup docs so beginner flows stay short.

## Community Overview

Use this when explaining the product at a high level:

```mermaid
graph LR
    U["You"] --> A["OpenClaw Agent on Laptop"]
    A --> B["ClawBridge"]
    B <-->|"A2A"| C["ClawBridge"]
    C --> D["OpenClaw Agent on VPS"]
    D --> E["Specialized Skills"]

    F["Simple path"] --- B
    G["Operator path"] --- C
    H["Advanced bridge path"] --- D

    style B fill:#0f766e,stroke:#134e4a,color:#fff
    style C fill:#312e81,stroke:#1e1b4b,color:#fff
    style E fill:#9a3412,stroke:#7c2d12,color:#fff
    style F fill:#ecfeff,stroke:#155e75
    style G fill:#eef2ff,stroke:#3730a3
    style H fill:#fff7ed,stroke:#9a3412
```

## Benefit Diagram

Use this when positioning the value of ClawBridge to the community:

```mermaid
graph TD
    A["Without ClawBridge"] --> A1["SSH"]
    A --> A2["Manual copy/paste"]
    A --> A3["One-off scripts"]
    A --> A4["Context switching"]

    B["With ClawBridge"] --> B1["Agent-to-agent calls"]
    B --> B2["Shared peer model"]
    B --> B3["Permissions and rate limits"]
    B --> B4["Operator-ready deployment"]

    style A fill:#fee2e2,stroke:#b91c1c
    style B fill:#dcfce7,stroke:#15803d
```

## Audience Model

This is the docs structure the repo now follows:

```mermaid
graph TD
    R["README"] --> S["Simple users"]
    R --> O["Operators"]
    R --> X["Advanced integrators"]
    R --> A["AI agents"]

    S --> S1["QUICKSTART_SIMPLE"]
    S --> S2["USER_GUIDE"]
    O --> O1["OPERATOR_GUIDE"]
    O --> O2["PRODUCTION_DEPLOY"]
    X --> X1["BRIDGE_SETUP"]
    X --> X2["API_REFERENCE"]
    A --> A1["AGENT_INSTALL"]

    style R fill:#0f172a,stroke:#1e293b,color:#fff
    style S fill:#ecfeff,stroke:#0e7490
    style O fill:#eef2ff,stroke:#4338ca
    style X fill:#fff7ed,stroke:#c2410c
    style A fill:#f5f3ff,stroke:#6d28d9
```
