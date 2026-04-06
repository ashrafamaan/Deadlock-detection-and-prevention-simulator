# 🔐 Deadlock Prevention & Recovery Toolkit

> A real-time web toolkit for detecting, preventing, and recovering from deadlocks in operating systems.

[![Live Demo](https://img.shields.io/badge/🚀%20Live%20Demo-Visit%20Site-00d4ff?style=for-the-badge)](https://ashrafamaan.github.io/Deadlock-detection-and-prevention-simulator/)
[![HTML](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)](https://ashrafamaan.github.io/Deadlock-detection-and-prevention-simulator/)
[![CSS](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)](https://ashrafamaan.github.io/Deadlock-detection-and-prevention-simulator/)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)](https://ashrafamaan.github.io/Deadlock-detection-and-prevention-simulator/)

---

## 🌐 Live Demo

**[https://ashrafamaan.github.io/Deadlock-detection-and-prevention-simulator/](https://ashrafamaan.github.io/Deadlock-detection-and-prevention-simulator/)**

---

## 📖 Overview

This toolkit provides an interactive, visual environment to understand and simulate deadlock concepts in operating systems. It implements the core OS algorithms taught in computer science curricula — Banker's Algorithm, Resource Allocation Graph (RAG), and multiple recovery strategies — all running live in the browser with no backend required.

Built as a project for **OS Concepts (B.Tech CSE)** at **Lovely Professional University**.

---

## 🚀 Features

| Feature | Description |
|---|---|
| **Banker's Algorithm** | Full safety algorithm with configurable processes and resources. Computes Need matrix automatically and traces the safe sequence step-by-step |
| **Resource Allocation Graph** | Live interactive canvas with drag-and-drop nodes, add/remove edges, and DFS-based cycle detection with visual highlighting |
| **Deadlock Simulator** | Step-by-step or full-run simulation engine with Acquire, Request, Release, and Hold actions. Uses wait-for graph to accurately detect circular wait |
| **Recovery Strategies** | Process Termination, Resource Preemption, Checkpoint Rollback, and intelligent Auto Recovery |
| **Preset Scenarios** | Circular Wait, Dining Philosophers, Producer-Consumer, Two-Process deadlock |
| **Hero Animation** | Live animated RAG canvas in the background showing floating process/resource nodes |

---

## 📁 Project Structure

```
deadlock-toolkit/
├── index.html              # Main HTML — all 4 sections in one page
├── css/
│   └── style.css           # Dark cyberpunk theme with CSS variables
└── js/
    ├── banker.js           # Banker's Algorithm logic + matrix rendering
    ├── graph.js            # RAG canvas renderer, drag support, DFS cycle detection
    ├── simulator.js        # Scenario builder, simulation engine, wait-for graph
    ├── recovery.js         # Recovery strategy implementations
    └── app.js              # Orchestrator, hero canvas animation, navigation
```

---

## 🧠 Algorithms Implemented

### 1. Banker's Algorithm (Safety Algorithm)
- Reads Available, Max, and Allocation matrices
- Auto-computes the **Need matrix** (Need = Max − Allocation)
- Runs the safety check: finds a sequence of processes that can each finish using current available resources
- Outputs the **safe sequence** or flags an **unsafe state**
- Validates that Allocation never exceeds Max

### 2. Resource Allocation Graph (RAG) + Cycle Detection
- Nodes: Processes (circles) and Resources (squares)
- Edges: Request edges (P → R) and Assignment edges (R → P)
- **DFS-based cycle detection** — finds back edges in directed graph
- Highlights the cycle path in red with glow effects
- Supports drag-and-drop repositioning of all nodes

### 3. Deadlock Simulator — Wait-For Graph Detection
- Simulates real OS process-resource interactions step by step
- **4 actions:** Acquire (take free resource), Request (block if unavailable), Hold (acquire and sit on it), Release (free and grant to next in queue)
- Builds a **wait-for graph** at the end: maps each blocked process to the process holding its needed resource
- Runs **DFS on the wait-for graph** to find circular wait — only truly deadlocked processes are reported
- Distinguishes between deadlocked (in cycle) and merely blocked (linear wait)

### 4. Recovery Strategies
| Strategy | Mechanism | Best For |
|---|---|---|
| **Process Termination** | Kills lowest-priority process, releases its resources, checks if deadlock resolves | Small number of processes |
| **Resource Preemption** | Forcibly reclaims resource from least-cost victim process | When rollback is supported |
| **Checkpoint Rollback** | Rolls back processes to saved checkpoints, releases held resources | Young processes with recent checkpoints |
| **Auto Recovery** | Analyzes scenario (process count, age, cost) and selects optimal strategy | General use |

---

## 🎮 How to Use

### Running Locally
```bash
# Clone the repository
git clone https://github.com/ashrafamaan/Deadlock-detection-and-prevention-simulator.git

# Open in browser — no build step needed
cd Deadlock-detection-and-prevention-simulator
open index.html
```

### Banker's Algorithm Tab
1. Set number of processes and resources
2. Click **Load Sample** to use the classic OS textbook example, or fill in values manually
3. Click **Run Safety Check** → see the step-by-step trace and safe sequence

### RAG Visualizer Tab
1. Set processes and resources → **Initialize Graph**
2. Add edges using the panel (select type, process, resource → Add Edge)
3. Drag nodes to rearrange the graph
4. Click **Detect Cycle** → cycle nodes glow red if deadlock exists
5. Use **Load Preset** for an instant circular wait demo

### Simulator Tab
1. Click any **preset** to load a ready-made scenario, or click **Custom** and add steps manually
2. Choose **Run** for full animation or **Step** to execute one action at a time
3. Adjust **Speed** slider (0.5x to 5x)
4. Event log shows each action and final deadlock verdict with exact processes in the circular wait

### Recovery Tab
1. Set processes and resources → **Setup Scenario** (generates a synthetic deadlock)
2. Choose a recovery strategy card and configure its options
3. Click **Apply Strategy** → see step-by-step resolution log
4. Try **Auto Recover** to see intelligent strategy selection

---

## 🧪 Test Scenarios

### Quick Demo — Two-Process Deadlock
1. Simulator tab → click **Two-Process**
2. Run → P0 acquires R0, P1 acquires R1, then each blocks on the other
3. Result: `🚨 DEADLOCK — Circular wait: P0, P1`

### Classic — Dining Philosophers
1. Simulator tab → click **Dining Philosophers**
2. Run → 4 philosophers each pick up left fork, then try right
3. Result: All 4 deadlocked

### Safe vs Unsafe — Banker's
1. Banker's tab → Load Sample → Run → Safe (P1→P3→P4→P0→P2)
2. Change Available to `[0,0,0]` → Run → Unsafe state

### Visual Deadlock — RAG
1. RAG tab → Load Preset → Detect Cycle
2. Cycle P0→R0→P1→R1→P2→R2→P0 highlighted in red

---

## 📚 Concepts Covered

- Deadlock definition and the 4 Coffman conditions (Mutual Exclusion, Hold & Wait, No Preemption, Circular Wait)
- Deadlock Prevention vs Avoidance vs Detection vs Recovery
- Banker's Algorithm — safe state, unsafe state, safe sequence
- Resource Allocation Graph — request edges, assignment edges, cycle detection
- Wait-for graph — derived from RAG for multi-instance deadlock detection
- Process termination and resource preemption trade-offs
- Checkpoint and rollback mechanisms

---

## 🛠️ Tech Stack

- **HTML5** — structure and layout
- **CSS3** — dark cyberpunk theme, CSS variables, animations
- **Vanilla JavaScript** — all algorithms, Canvas 2D API for graph rendering
- **Google Fonts** — Exo 2, Rajdhani, Share Tech Mono
- **No frameworks, no dependencies** — runs entirely in the browser

---

## 👨‍💻 Author

**Ashraf Amaan**
B.Tech CSE — Lovely Professional University
Roll No: R425HPA07 | Enrollment: 12522925

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

*Built for OS Concepts coursework — Deadlock Prevention & Recovery Toolkit v2.0*
