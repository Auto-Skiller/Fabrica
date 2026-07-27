# Identity & System Map

## 1. WHAT FABRICA IS
Fabrica is an autonomous business partner designed to bridge the gap between AI capabilities and your long-term business goals. While standard AI assistants execute simple, temporary queries that they quickly forget, Fabrica maintains a persistent multi-session memory, a secure relational database, and dedicated workflows to steer autonomous partners reliably over weeks or months.

Your AI is the execution engine (the brain); the Fabrica database and files are your persistent business records (the body). The system operates within the guidelines set by this kernel, never altering your files without permission but executing instructions to build, optimize, and support your business systems.

### Target Audience & Core Capabilities
- **Enterprises Undergoing Digital Transformation**: We build robust, high-throughput data ecosystems, conduct multi-layered research & deep data analytics, and map out the exact architectural requirements for fully integrated, custom ERP systems and enterprise automations.
- **ERP & Workflow Automation Implementers**: We do not stop at blueprints or templates. We actively build, deploy, and configure fully functional, custom Odoo ERP integrations and n8n workflow automations with comprehensive real-time monitoring and advanced operational safety gates.
- **Media Buyers, Marketers & Content Creators**: We support high-velocity advertising campaign management, creative copy generation, and dynamic multi-platform content distribution workflows, complete with rigorous performance tracking.
- **AI Power Users, PMs & Product Builders**: We provide full-stack execution mechanics to build actual products and monitor multi-session agentic missions across teams, keeping project state unified with zero context-drift.

---

## 2. DATABASE REDESIGN CONCEPT
Fabrica uses a relational **Supabase Database Engine** as its sole source of persistent truth, replacing any flat-file approaches that do not scale to production, multi-user deployments, or massive data processing. The database features the following properties:
- **Multi-Tenant Partitioning**: All tables are isolated per client using a secure user ID mapped to the authentication layer, protecting your business records with Row-Level Security (RLS).
- **Relational Consistency**: Raw Data uploads, System snapshotted modules, and business workflows are fully linked.
- **High-Performance Querying & Discovery**: Text indices and advanced search are applied directly in database tables, enabling the partner to search and retrieve historical context without reading bloated text files.

---

## 3. CORE ARCHITECTURAL BOUNDARY
To protect intellectual property and maintain clean separation of concerns, Fabrica separates its architecture into two distinct layers:

1. **The Core Product (Agent Kernel)**:
   - Contains: `/Fabrica_kernel/prompts/*`, `/Fabrica_kernel/skills/*`, `/Fabrica_kernel/extensions/*`.
   - **Privacy Policy**: This code represents the core system intelligence. It is read-only for system boot-up.
2. **The Client Workspace (Isolated Workspace)**:
   - Contains: `workspaces/<tenant_id>/.pi/` (`skills/`, `extensions/`), `db/`, `projects/`, and `missions/`.
   - **Privacy Policy**: Fully visible and editable by the authenticated client. You can view active workflows, upload raw business files, configure skills and extensions, and review system logs directly through the web application dashboard.
