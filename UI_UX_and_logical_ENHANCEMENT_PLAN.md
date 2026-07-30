# Fabrica — Dashboard UI/UX, Nomenclature & System Engine Architecture Plan

am thinking about a Real massive migration of logics, UI/UX where we should keep the missions section and rename it to **AI Agent Missions**, but in the section bellow the missions we should have **Sources** section in the left and **Deliverables** section at the right (no more artifacs or projects).

## 1. Executive Summary & Core Business Value

### The Core Business Problem Solved

Modern teams suffer from fragmented workflows: business context is locked in documents/files, AI prompts are ephemeral chat conversations, and deliverables are buried across disconnected tools. AI knows HOW to build NOT the WHAT, he just chat, he cant build or preview actual deliverables, he helusinate to much, he dont have a relational database, a sandboxed execution channel, a real file interactions, a real browser to use, a history that remembers what the brain forgot. he cant remember workflows to execute, no skills, no tools, no memory.

**Fabrica** bridges those gaps by acting as an **Adaptable AI Agent Operations & Live Monitoring and Deliverable preview Platform** that drives an **AI Agents Revolution** for any purpose (founders, marketers, developers, operators).
we help make Digital Transformations for Enterprises & Power Users.
USER can :
Guide the agent with real time visulation and control over everythign.
swap Gemini for Claude for any OpenRouter model without losing a thing.
Do advanced researches and analytics and coding Tasks.
BUILD/RUN CUSTOM production level SYSTEMS & Any OUTPUTS FROM ANY INPUT.
upload his own sources to works on or building new ones.

## 2. Architectural Directives

1. **Universal Purpose (AI Agents Revolution):** Multi-purpose platform for everyone ("AI Agents Revolution"). Features remain adaptable across all industries. Keep features modular and flexible so any team or user (marketing, product, dev, ops) can leverage the exact same system for their specific goals.

2. **Deep Functional Value (No Superficial Fluff):** Focus on real system logic, enhanced agent prompt execution, skills,  context indexing, and automated deliverable generation.

3. **Interactive 4-Panel Human-AI Collaboration:** Users have full visibility, real-time interactivity, and direct editing rights across all 4 workspace areas.


## 3. the new Fabrica Logical Architecture and bussines value

### 1. **AI Agent Missions** 
where users launch, monitor and see the autonomous AI agents execute at specific operational goals as cards moving via sections Drafting -> Planning -> Execution -> Delivery.
supporting Launch, pause, adjust EFFORT and Gates, everything with the real-time execution logs.

**Standard / Quick Mission:** Supports user goal targets, autonomous multi-step agent execution tasks, passing by Drafting -> Planning -> Execution -> Delivery.

**Full Pipeline Mission:** execute the entire end-to-end pipeline from **Idea to Production-Grade Deliverable**, this full pipeline have 4 main phases (Drafting, Planning loop, Execution loop, Delivering), some loops/non-loops have sub-loops, some have not.
Each loop/sub-loop/non-loop operates under it strict workfows and uses it own skills, some have spesific inputs and outputs and some have configurable user approval gates and effort levels, some have fixed.

1. Drafting (not-loop):
    1. Discovery & Scoping (loop):
        - AI Agent engages in interactive brainstorming and Q&A with the user.
        - Presents structural options with suggestions, cost/time trade-offs, and pros & cons.
        - Debates strategy, captures preferences, and stores approved scoping parameters in **Sources/Discovery & Scoping**.

2. Planning (loop): 
    1. Deep Research & Intelligence Gathering (loop)
        - Operates based on **Sources/Discovery & Scoping**.
        - Executes deep web searches and scrapers for research papers, PDFs, knowledge bases, industry reports, market segmentations, and competitor breakdowns.
        - Registers discovered data directly into **Sources/Deep Research & Intelligence Gathering** for downstream analysis.
    2. Data Analysis & Pattern Extraction (non-loop)
        - Operates based on **Sources/Discovery & Scoping** + **Sources/Deep Research & Intelligence Gathering**.
        - Ingests raw inputs to detect anomalies, compute key metrics, and extract actionable insights into **Sources/Data Analysis & Pattern Extraction**.
    3. Strategic Synthesis & Decision Support (non-loop)
        - Operates based on **Sources/Discovery & Scoping** + **Sources/Deep Research & Intelligence Gathering** + **Sources/Data Analysis & Pattern Extraction**.
        - Synthesizes complex findings into executive summaries, risk audits, strategic roadmaps, and decision frameworks.
        - Outputs an Actionable Strategic Plan and an Interactive Decision Matrix into **Sources/Strategic Synthesis & Decision Support**.

3. Execution (non-loop):
    1. Generation : (non-loop)
        - Operates based on **Sources/Strategic Synthesis & Decision Support** or based on Review feedback or based on verification feedback.
        - Generate Assets, Do Coding or c based on what you need to do.
        - Outputs into **Deliverables/Executions**
    2. verification : (non-loop)
        - Operates based on **Sources/Strategic Synthesis & Decision Support** + **Deliverables/Executions**.
        - verify that the Execution outputs is correctly matching the Strategic Synthesis & Decision Support, no gaps.
            - if not ok -> continue proccesing the full execution loop based on this verification feedback.
            - if ok -> move the work to **Deliverables/Reviews**

4. Delivering (not-loop) :
    1. Review (not-loop) : 
        - for Final production-grade deliverable in **Deliverables/Reviews** that are correct, validated, and waiting to be reviewd or accepted by user.
        - work get presented to user for Review :
            - if he accepted it -> move the work to **Deliverables/Completed**.
            - if he gives a feedback -> move the work to **Deliverables/Executions** and continue proccesing the full execution loop based on it feedback.

### 2. **Sources** 
supporting Adding (uploading), editing, removing, includes those sub-sections: 
- Discovery & Scoping
- Deep Research & Intelligence Gathering
- Data Analysis & Pattern Extraction
- Strategic Synthesis & Decision Support

### 3. **Deliverables** 
supporting Adding (uploading), editing, removing, includes those sub-sections: 
- Executions
- Reviews
- Completed

### Features & Logics :

#### User Approval Gate Control (when user approval is granted to move forward)
a button that triggers a small window of all loops and non-loops on/off Approval Gates toggles, the button located just at the right of the "+ new" button.

#### Effort Parameter Control (`EFFORT`)
a button that triggers a small window of only loops EFFORT dropdowns, the button located just at the right of the new button.

#### "+ new" launcher
now we have only 2 types of missions, adapt the window UI to matches the new models.
when launching the pipeline shows options of all Approval Gates and Efforts.

#### Import / Export Capabilities
import or export for any item inside **Sources** and **Deliverables** sections.
enable multi and per sub-section selections.

#### loop/Stage Dependency Engine:
Each loop/non-loop consumes outputs generated by preceding loop/non-loop or even by the same loop and explicit context added by the user, it need to store the aready proccesed items so it does not re-procces them in a new loop round or in a feedback falback to prevent redundant re-processing and force continuous evolution.
Users can see those dependency mapping across **Sources** and **Deliverables** sub-sections items. 


## 4. Prompt & Skill Architecture Hierarchy
To support universal adaptability across any scenario while enabling deep domain-specific capability:

**Global Root Prompts:** 
for non-relevnt missions details in the promtps, feel free to add and keep as much details you need, this is only for missions details and workflows that should be only in skills. 
you should also mention how to handell missions executions and how and when to use them in the system prompts, just not the spesififc-domains workflows, you can mentions the loop systems and everyhting that are needed for the agent to execute the missions.

**Skills:**
for High-Level main `SKILL.md` files : instruction need to remain completely global, domain-agnostic, and outcome-driven. but they should list all possibles domains and senarios and maps all there domains paths (for extra loading when relevent).
Sub-Level Granular Skill Modules: Detailed scenario-specific logic, and action subroutines are mapped into dedicated sub-level folders inside skill directories (e.g., `/skills/<skill_name>/<domain-name>/...`).

skills Structure : 

pipeline_Drafting/
    pipeline_Drafting_Discovery-Scoping/
        SKILL.md
pipeline_Planning/
    pipeline_Planning_Deep-Research_Intelligence-Gathering/
        SKILL.md
    pipeline_Planning_Data-Analysis_Pattern-Extraction/
        SKILL.md
    pipeline_Planning_Strategic-Synthesis_Decision-Support/
        SKILL.md
pipeline_Execution/
    pipeline_Execution_Generation/
        SKILL.md
        pipeline_Execution_Generation_Assets/
            SKILL.md
        pipeline_Execution_Generation_Coding/
            SKILL.md
        pipeline_Execution_Generation_Run-Automations/
            SKILL.md
    pipeline_Execution_verification/
        SKILL.md
pipeline_Delivering/
    pipeline_Delivering_Review/
        SKILL.md

- we keep this naming so the agent know about the pipeline skills (all starts with pipeline_) and witch domain they belonges to. but for folders that dont have a SKILL.md file or the non-pipeline skills, feel free to name as you want. 

- also feel free to add as mutch sub folders just with those pipeline SKILL.md files, just make sure they are mapped in it relevent SKILL.md file.

**Dynamic Skill Routing:** The AI Agent dynamically maps user tasks to relevant sub-level skill modules during mission execution based on active task goals and context.
