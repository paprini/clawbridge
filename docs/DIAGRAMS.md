# Mermaid Diagrams for openclaw-a2a

These diagrams can be embedded directly in the README using Mermaid syntax.

---

## 1. Before/After Comparison

### Before: Manual Coordination
```mermaid
graph TB
    A[Laptop Agent<br/>needs music analysis] -->|1. Manual SSH| B[VPS]
    B -->|2. Copy file| C[Music Expert Agent]
    C -->|3. Run command| D[Process audio]
    D -->|4. Copy results back| B
    B -->|5. Manual transfer| A
    
    style A fill:#ff6b6b,stroke:#c92a2a,color:#fff
    style D fill:#ff6b6b,stroke:#c92a2a,color:#fff
    
    Note[❌ 5 manual steps<br/>❌ Context switching<br/>❌ Error-prone]
    
    style Note fill:#ffe066,stroke:#f59f00,stroke-width:2px
```

### After: A2A Communication
```mermaid
graph LR
    A[Laptop Agent] -->|"analyze_song()"| B[Music Expert<br/>@VPS]
    B -->|results| A
    
    style A fill:#51cf66,stroke:#2f9e44,color:#fff
    style B fill:#51cf66,stroke:#2f9e44,color:#fff
    
    Note[✅ One function call<br/>✅ Automatic<br/>✅ Seamless]
    
    style Note fill:#d0ebff,stroke:#1971c2,stroke-width:2px
```

---

## 2. Architecture Diagram

```mermaid
graph TB
    subgraph Laptop["🖥️ OpenClaw Instance (Laptop)"]
        LA1[💬 main-agent]
        LA2[📝 writing-assistant]
        LGW[Gateway :18789]
        LSC[A2A Sidecar :9100]
        
        LA1 & LA2 --> LGW
        LGW <--> LSC
    end
    
    subgraph VPS["☁️ OpenClaw Instance (VPS)"]
        VA1[🎼 music-expert]
        VA2[🏗️ architect]
        VGW[Gateway :18789]
        VSC[A2A Sidecar :9100]
        
        VA1 & VA2 --> VGW
        VGW <--> VSC
    end
    
    subgraph RPI["🔌 OpenClaw Instance (Raspberry Pi)"]
        RA1[🔔 notification-bot]
        RGW[Gateway :18789]
        RSC[A2A Sidecar :9100]
        
        RA1 --> RGW
        RGW <--> RSC
    end
    
    LSC <-->|A2A Protocol<br/>JSON-RPC + SSE| VSC
    LSC <-->|A2A Protocol| RSC
    VSC <-->|A2A Protocol| RSC
    
    style LSC fill:#4c6ef5,stroke:#364fc7,color:#fff
    style VSC fill:#4c6ef5,stroke:#364fc7,color:#fff
    style RSC fill:#4c6ef5,stroke:#364fc7,color:#fff
```

---

## 3. User Flow (Setup)

```mermaid
graph TD
    Start([User types:<br/>'Set up A2A']) --> Install[Install openclaw-a2a]
    Install --> Scan[A2A scans network]
    Scan --> Discover{Found agents?}
    
    Discover -->|Yes| List[Display agent list<br/>with emojis]
    Discover -->|No| Manual[Prompt for manual config]
    
    List --> ConfirmAll{Connect all?}
    ConfirmAll -->|Yes| Connect[Generate bearer tokens<br/>Configure peers]
    ConfirmAll -->|No| SelectAgents[Choose specific agents]
    
    SelectAgents --> Connect
    
    Connect --> Skills[Show available skills]
    Skills --> ChooseSkills{Which skills<br/>to expose?}
    
    ChooseSkills --> Whitelist[Create skill whitelist]
    Whitelist --> Save[Save configuration]
    Save --> Start2[Start A2A sidecar]
    Start2 --> Done([✅ Setup complete!<br/>Agents can now talk])
    
    style Start fill:#d0ebff,stroke:#1971c2
    style Done fill:#b2f2bb,stroke:#2b8a3e
    style Connect fill:#ffd8a8,stroke:#e67700
    style Whitelist fill:#ffd8a8,stroke:#e67700
```

---

## 4. Skill Execution Flow

```mermaid
sequenceDiagram
    participant User
    participant WritingAgent as 📝 Writing Agent<br/>(Laptop)
    participant A2AClient as A2A Client
    participant A2AServer as A2A Server
    participant MusicAgent as 🎼 Music Expert<br/>(VPS)
    
    User->>WritingAgent: "Analyze chords in Hotel California"
    WritingAgent->>A2AClient: call_skill("music-expert@vps",<br/>"detect_chords", {song: "..."})
    
    A2AClient->>A2AClient: Find peer config<br/>(IP + token)
    A2AClient->>A2AServer: POST /a2a/jsonrpc<br/>+ Bearer token
    A2AServer->>A2AServer: Validate token<br/>Check skill whitelist
    
    alt Skill allowed
        A2AServer->>MusicAgent: Execute skill via Gateway
        MusicAgent->>MusicAgent: Process audio<br/>Detect chords
        MusicAgent->>A2AServer: Return: "Am, E7, G, D..."
        A2AServer->>A2AClient: SSE stream result
        A2AClient->>WritingAgent: Chord data
        WritingAgent->>User: "The song uses Am-E7-G-D..."
    else Skill blocked
        A2AServer->>A2AClient: 403 Forbidden<br/>(not whitelisted)
        A2AClient->>WritingAgent: Error: skill not exposed
        WritingAgent->>User: "Music agent doesn't expose that skill"
    end
    
    style WritingAgent fill:#51cf66,stroke:#2f9e44
    style MusicAgent fill:#51cf66,stroke:#2f9e44
    style A2AServer fill:#4c6ef5,stroke:#364fc7
```

---

## 5. Security Model (Visual)

```mermaid
graph TB
    subgraph Public["🌐 Public Internet"]
        Attacker[❌ Attacker]
    end
    
    subgraph VPC["🔒 Private Network (VPC)"]
        subgraph Instance1["Instance 1"]
            Agent1[Agent A]
            Sidecar1[A2A Sidecar]
            Whitelist1[Skill Whitelist:<br/>✅ ping<br/>✅ detect_chords<br/>❌ read_files]
            
            Agent1 --> Sidecar1
            Sidecar1 -.checks.-> Whitelist1
        end
        
        subgraph Instance2["Instance 2"]
            Agent2[Agent B]
            Sidecar2[A2A Sidecar]
            Token2[Bearer Token]
            
            Agent2 --> Sidecar2
            Sidecar2 -.requires.-> Token2
        end
        
        Sidecar1 <-->|✅ Authenticated<br/>✅ Whitelisted| Sidecar2
    end
    
    Attacker -.->|❌ Blocked<br/>No route to VPC| Sidecar1
    Attacker -.->|❌ Blocked<br/>No route to VPC| Sidecar2
    
    style Attacker fill:#ff6b6b,stroke:#c92a2a,color:#fff
    style VPC fill:#d0f4de,stroke:#2d6a4f,stroke-width:3px
    style Whitelist1 fill:#ffe066,stroke:#f59f00
    style Token2 fill:#ffe066,stroke:#f59f00
```

---

## 6. Multi-Agent Collaboration Example

```mermaid
graph TB
    User[👤 User: "Write an article<br/>about Hotel California"]
    
    User --> WA[📝 Writing Assistant<br/>Laptop]
    
    WA -->|"I need chord analysis"| ME[🎼 Music Expert<br/>VPS]
    WA -->|"I need historical context"| RE[🔍 Research Agent<br/>Pi]
    
    ME -->|"Am-E7-G-D progression<br/>+ music theory explanation"| WA
    RE -->|"Released 1976<br/>Eagles' best-selling single"| WA
    
    WA -->|Synthesizes:<br/>✅ Chord analysis<br/>✅ Historical context<br/>✅ Cohesive narrative| Draft[📄 Article Draft]
    
    Draft --> User
    
    style User fill:#e7f5ff,stroke:#1971c2
    style WA fill:#51cf66,stroke:#2f9e44,color:#fff
    style ME fill:#ffd8a8,stroke:#e67700
    style RE fill:#ffd8a8,stroke:#e67700
    style Draft fill:#b2f2bb,stroke:#2b8a3e
```

---

## 7. Phase 1 vs Phase 3 Comparison

```mermaid
graph TB
    subgraph Phase1["Phase 1: Private Network<br/>(Shipping March 19-21)"]
        P1A[Your laptop]
        P1B[Your VPS]
        P1C[Your Raspberry Pi]
        
        P1A <--> P1B
        P1B <--> P1C
        P1A <--> P1C
        
        P1Note[🔒 Private only<br/>✅ Your instances<br/>✅ Bearer tokens<br/>✅ VPC-only]
    end
    
    subgraph Phase3["Phase 3: Community Network<br/>(Weeks later)"]
        P3You[Your agent]
        P3Comm1[Community agent 1]
        P3Comm2[Community agent 2]
        P3Comm3[Community agent 3]
        Registry[Public Registry<br/>🔍 Searchable by skill]
        
        P3You <--> P3Comm1
        P3You <--> P3Comm2
        P3You --> Registry
        P3Comm3 --> Registry
        
        P3Note[🌐 Optional public<br/>✅ Skill-based search<br/>✅ Reputation system<br/>✅ Free + donations]
    end
    
    style Phase1 fill:#d0f4de,stroke:#2d6a4f,stroke-width:2px
    style Phase3 fill:#e7f5ff,stroke:#1971c2,stroke-width:2px
    style P1Note fill:#ffe066,stroke:#f59f00
    style P3Note fill:#ffe066,stroke:#f59f00
```

---

## 8. "5 Minutes to Working Agents" Visual Timeline

```mermaid
gantt
    title 5-Minute Setup Timeline
    dateFormat mm:ss
    axisFormat %M:%S
    
    section Install
    clawhub install openclaw-a2a :a1, 00:00, 90s
    
    section Discovery
    Agent scans network :a2, after a1, 30s
    Display found agents :a3, after a2, 10s
    
    section Configuration
    User confirms: connect all :a4, after a3, 20s
    Generate bearer tokens :a5, after a4, 30s
    
    section Skills
    Choose skills to expose :a6, after a5, 60s
    Save configuration :a7, after a6, 20s
    
    section Launch
    Start A2A sidecar :a8, after a7, 40s
    ✅ Agents connected! :milestone, after a8, 0s
```

---

## Usage Instructions for README

Add these diagrams to the README at strategic points:

1. **Before/After Comparison** → Right after "What You Can Do" section
2. **Architecture Diagram** → In "Technical Overview" section
3. **User Flow (Setup)** → In "How Easy Is It?" section
4. **Skill Execution Flow** → In "Real-World Examples" section
5. **Security Model** → In "Security (Simple & Clear)" section
6. **Multi-Agent Collaboration** → In "Real-World Examples" section
7. **Phase Comparison** → In "Roadmap & Timeline" section
8. **5-Minute Timeline** → In "How Easy Is It?" section

GitHub automatically renders Mermaid diagrams in markdown files.
