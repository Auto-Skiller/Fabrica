const fs = require('fs');
const path = require('path');

const userRoot = process.cwd();

// --- 1. Populate Runtime State (Suggestions, Backlogs, Review Queues) ---
const runtimePath = path.join(userRoot, 'runtime.json');
let runtimeData = {
  tenant_id: 'usr_sandbox_q21c9pc',
  status: 'running',
  suggestions: [],
  backlogs: [],
  review_queues: [],
  recent_events: [],
  last_active: new Date().toISOString()
};

if (fs.existsSync(runtimePath)) {
  try {
    runtimeData = JSON.parse(fs.readFileSync(runtimePath, 'utf8'));
  } catch (_) {}
}

runtimeData.suggestions = [
  {
    id: 'sug_001',
    title: 'Implement Context Compression Caching for Long-Running Sessions',
    description: 'Optimize prompt token consumption across multi-turn sessions using Gemini Context Caching.',
    category: 'Optimization',
    created_at: new Date().toISOString()
  },
  {
    id: 'sug_002',
    title: 'Automate Weekly Executive Summary Report Generation',
    description: 'Compile active mission metrics, system events, and deliverable status into weekly summaries.',
    category: 'Automation',
    created_at: new Date().toISOString()
  }
];

runtimeData.backlogs = [
  {
    id: 'backlog_001',
    title: 'Upgrade Supabase RLS Policies for Enterprise Multi-Tenancy',
    priority: 'HIGH',
    status: 'pending',
    created_at: new Date().toISOString()
  },
  {
    id: 'backlog_002',
    title: 'Add Support for OpenRouter Custom Model Endpoints',
    priority: 'MEDIUM',
    status: 'pending',
    created_at: new Date().toISOString()
  },
  {
    id: 'backlog_003',
    title: 'Implement Webhook Verification for Stripe Payment Events',
    priority: 'HIGH',
    status: 'in_progress',
    created_at: new Date().toISOString()
  },
  {
    id: 'backlog_004',
    title: 'Optimize Sandbox Code Execution Timeout Handling',
    priority: 'MEDIUM',
    status: 'pending',
    created_at: new Date().toISOString()
  },
  {
    id: 'backlog_005',
    title: 'Design Dark/Light Theme Transition Animations',
    priority: 'LOW',
    status: 'pending',
    created_at: new Date().toISOString()
  }
];

runtimeData.review_queues = [
  {
    id: 'rev_001',
    title: 'Production API Gateway Refactoring Output',
    details: 'Verified JWT authentication middleware, async worker task queue, and rate limiting route handlers.',
    status: 'pending_review',
    created_at: new Date().toISOString()
  },
  {
    id: 'rev_002',
    title: 'Data Ingestion Pipeline Integration Test Results',
    details: 'PDF invoice parser field extractions validated against synthetic transaction datasets.',
    status: 'pending_review',
    created_at: new Date().toISOString()
  },
  {
    id: 'rev_003',
    title: 'Security Audit & Token Rate Limiting Policy Specification',
    details: 'Static code analysis report and key pool load balancer limits review.',
    status: 'pending_review',
    created_at: new Date().toISOString()
  }
];

fs.mkdirSync(path.join(userRoot, 'db'), { recursive: true });
fs.writeFileSync(runtimePath, JSON.stringify(runtimeData, null, 2), 'utf8');
console.log('✅ Updated db/runtime.json with 2 suggestions, 5 backlogs, and 3 review queues.');


// --- 2. Create Sources Files & db/sources.json ---
const sourcesSubSections = [
  'Discovery & Scoping',
  'Deep Research & Intelligence Gathering',
  'Data Analysis & Pattern Extraction',
  'Strategic Synthesis & Decision Support'
];

const sourceItems = [
  // Discovery & Scoping
  {
    folder: 'Discovery & Scoping',
    filename: 'client_onboarding_scope.md',
    title: 'Client Onboarding & Project Scope Requirements',
    content: `# Discovery Brief: Client Onboarding Scope
## Overview
Detailed scoping documentation capturing operational parameters, tech stack choices, and project boundaries.

## Key Scoping Parameters
- Architecture: Decoupled Express API + Next.js UI
- Database: Supabase PostgreSQL with RLS
- Deployment Target: Sandboxed Container on Port 3000
`
  },
  {
    folder: 'Discovery & Scoping',
    filename: 'tradeoff_analysis_matrix.md',
    title: 'Cost vs Time Infrastructure Migration Trade-offs',
    content: `# Trade-off Analysis Matrix
| Option | Implementation Time | Infrastructure Cost | Scalability Score |
| :--- | :--- | :--- | :--- |
| Monolithic Express | 1 Week | LOW | 6/10 |
| Microservice Queue | 3 Weeks | MEDIUM | 9/10 |
| Hybrid Worker Pool | 2 Weeks | LOW | 8.5/10 |
`
  },
  // Deep Research & Intelligence Gathering
  {
    folder: 'Deep Research & Intelligence Gathering',
    filename: 'vector_db_benchmark_2026.md',
    title: 'Vector Search Engine Latency & Index Benchmarks',
    content: `# Deep Research: Vector Database Performance
Comprehensive research on vector search engines, indexing algorithms (HNSW vs IVFFlat), and memory footprints.

## Key Findings
- PGVector HNSW offers excellent recall with low operational complexity.
- Qdrant yields ultra-fast filtering for multi-tenant payloads.
`
  },
  {
    folder: 'Deep Research & Intelligence Gathering',
    filename: 'llm_orchestration_frameworks.md',
    title: 'Multi-Agent System Framework Comparison',
    content: `# Research Brief: Multi-Agent Orchestration Systems
Comparative study of autonomous agent loops, context management strategies, and multi-round verification routines.
`
  },
  // Data Analysis & Pattern Extraction
  {
    folder: 'Data Analysis & Pattern Extraction',
    filename: 'user_engagement_metrics_q2.json',
    title: 'User Cohort Retention Metrics Q2',
    content: JSON.stringify({
      metric: 'cohort_retention',
      period: 'Q2 2026',
      total_users: 14200,
      decay_rates: {
        day_1: 0.85,
        day_7: 0.62,
        day_30: 0.48
      },
      insights: [
        'Retention spikes significantly after setting up active automated missions.',
        'Low drop-off observed during semi-autonomous pipeline runs.'
      ]
    }, null, 2)
  },
  {
    folder: 'Data Analysis & Pattern Extraction',
    filename: 'latency_anomaly_audit.md',
    title: 'Server Performance Log Anomaly Audit',
    content: `# Data Analysis: Server Latency Anomalies
Statistical analysis of server request logs over 1,000,000 requests.

- Mean response time: 42ms
- p99 response time: 180ms
- Identified 3 anomaly bursts during concurrent background worker syncs.
`
  },
  // Strategic Synthesis & Decision Support
  {
    folder: 'Strategic Synthesis & Decision Support',
    filename: 'q3_technology_roadmap.md',
    title: 'Strategic Synthesis: Q3 Platform Scaling Roadmap',
    content: `# Strategic Synthesis Plan: Q3 Scaling
## Objectives
1. Implement 3-way real-time bi-directional state synchronization across DB, UI, and Disk.
2. Expand BYOK model provider routing with key load balancing.
3. Harden sandboxed V8 code execution context timeouts.
`
  },
  {
    folder: 'Strategic Synthesis & Decision Support',
    filename: 'vendor_selection_decision_matrix.md',
    title: 'Scored Decision Matrix: Cloud Infrastructure Providers',
    content: `# Scored Decision Matrix
- Google Cloud Platform: Score 92/100 (Worth It: YES)
- AWS: Score 86/100 (Worth It: YES)
- Bare Metal / Self-Hosted: Score 74/100 (Worth It: NO)
`
  }
];

const sourcesDbItems = [];

for (const sub of sourcesSubSections) {
  const subDirPath = path.join(userRoot, 'Sources', sub);
  fs.mkdirSync(subDirPath, { recursive: true });
}

for (const item of sourceItems) {
  const filePath = path.join(userRoot, 'Sources', item.folder, item.filename);
  fs.writeFileSync(filePath, item.content, 'utf8');

  sourcesDbItems.push({
    id: `src_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: item.filename,
    title: item.title,
    sub_section: item.folder,
    file_path: `Sources/${item.folder}/${item.filename}`,
    created_at: new Date().toISOString()
  });
}

fs.writeFileSync(path.join(userRoot, 'db', 'sources.json'), JSON.stringify({ sources: sourcesDbItems }, null, 2), 'utf8');
console.log('✅ Created 2 items in each Sources sub-section (8 total) & updated db/sources.json.');


// --- 3. Create Deliverables Files & db/deliverables.json ---
const deliverablesSubSections = [
  'Executions',
  'Reviews',
  'Completed'
];

const deliverableItems = [
  // Executions
  {
    folder: 'Executions',
    filename: 'auth_middleware_v2.ts',
    title: 'Refactored JWT & RLS Authentication Middleware',
    content: `import { Request, Response, NextFunction } from 'express';

export function authenticateTenant(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  // Validate tenant identity and assign to req.user
  next();
}
`
  },
  {
    folder: 'Executions',
    filename: 'data_ingestion_worker.py',
    title: 'Automated ETL Data Ingestion Worker',
    content: `import os
import json

def process_batch(payload):
    print(f"Processing batch of {len(payload)} items...")
    return {"status": "success", "processed_count": len(payload)}
`
  },
  // Reviews
  {
    folder: 'Reviews',
    filename: 'api_gateway_benchmark_review.md',
    title: 'API Gateway Benchmark Sign-off Package',
    content: `# Review Package: API Gateway Benchmarks
- Concurrent requests: 5,000 req/sec
- Error rate: 0.00%
- Status: Ready for human sign-off & promotion to Completed.
`
  },
  {
    folder: 'Reviews',
    filename: 'security_audit_deliverable.md',
    title: 'Security Vulnerability Audit Deliverable',
    content: `# Security Audit Deliverable
- Code analysis status: PASS
- Prototype freezing: ENABLED
- Timeout enforcement: 1000ms VERIFIED
`
  },
  // Completed
  {
    folder: 'Completed',
    filename: 'production_schema_v1.sql',
    title: 'Production Schema Migration SQL',
    content: `-- Production Schema Migration v1.0
CREATE TABLE IF NOT EXISTS tenant_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`
  },
  {
    folder: 'Completed',
    filename: 'dashboard_analytics_component.tsx',
    title: 'Analytics Dashboard Widget React Component',
    content: `import React from 'react';

export const AnalyticsWidget: React.FC<{ metrics: any }> = ({ metrics }) => {
  return (
    <div className="p-4 bg-surface border border-border-soft rounded-lg">
      <h3 className="text-sm font-bold text-text-bright">System Performance Metrics</h3>
      <p className="text-xs text-text-soft">Live active workers: {metrics?.activeWorkers || 0}</p>
    </div>
  );
};
`
  }
];

const deliverablesDbItems = [];

for (const sub of deliverablesSubSections) {
  const subDirPath = path.join(userRoot, 'Deliverables', sub);
  fs.mkdirSync(subDirPath, { recursive: true });
}

for (const item of deliverableItems) {
  const filePath = path.join(userRoot, 'Deliverables', item.folder, item.filename);
  fs.writeFileSync(filePath, item.content, 'utf8');

  deliverablesDbItems.push({
    id: `del_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: item.filename,
    title: item.title,
    sub_section: item.folder,
    file_path: `Deliverables/${item.folder}/${item.filename}`,
    created_at: new Date().toISOString()
  });
}

fs.writeFileSync(path.join(userRoot, 'db', 'deliverables.json'), JSON.stringify({ deliverables: deliverablesDbItems }, null, 2), 'utf8');
console.log('✅ Created 2 items in each Deliverables sub-section (6 total) & updated db/deliverables.json.');


// --- 4. Create 2 Custom Skills ---
const skill1Dir = path.join(userRoot, '.pi', 'skills', 'data_pipeline_optimizer');
fs.mkdirSync(skill1Dir, { recursive: true });
fs.writeFileSync(path.join(skill1Dir, 'SKILL.md'), `---
name: data_pipeline_optimizer
description: Specialized skill for optimizing ETL batch pipelines, SQL queries, and streaming data transforms.
---

# Data Pipeline Optimizer Skill

## Overview
Use this skill when analyzing data transformation bottlenecks, optimizing SQL query execution plans, or structuring streaming data pipelines.

## Step-by-Step Execution Protocol
1. Ingest query execution plan or pipeline metrics.
2. Identify memory bottlenecks or missing index definitions.
3. Generate optimized query refactoring or worker batch configurations.
4. Verify execution metrics against performance benchmarks.
`, 'utf8');

const skill2Dir = path.join(userRoot, '.pi', 'skills', 'security_audit_scanner');
fs.mkdirSync(skill2Dir, { recursive: true });
fs.writeFileSync(path.join(skill2Dir, 'SKILL.md'), `---
name: security_audit_scanner
description: Specialized skill for running static code analysis, vulnerability audits, and access policy checks.
---

# Security Audit Scanner Skill

## Overview
Use this skill when auditing REST API endpoints, verifying Row-Level Security (RLS) policies, or checking code for security vulnerabilities.

## Step-by-Step Audit Protocol
1. Scan source files for hardcoded secrets or unescaped queries.
2. Verify prototype freezing and isolation in sandboxed execution blocks.
3. Validate user_id filtering across database queries.
4. Output structured vulnerability audit report.
`, 'utf8');

console.log('✅ Created 2 Custom Skills under .pi/skills/.');


// --- 5. Create 2 Custom Extensions ---
const extDir = path.join(userRoot, '.pi', 'extensions');
fs.mkdirSync(extDir, { recursive: true });

fs.writeFileSync(path.join(extDir, 'telemetry_logger.js'), `/**
 * Custom Extension: Telemetry Logger
 * Logs execution timing and action telemetry for agent steps.
 */
export default function telemetryLogger(pi) {
  pi.on('action', (event) => {
    console.log(\`[TelemetryLogger] Action executed: \${event?.action || 'unknown'} @ \${new Date().toISOString()}\`);
  });
}
`, 'utf8');

fs.writeFileSync(path.join(extDir, 'auto_formatter.js'), `/**
 * Custom Extension: Auto Formatter
 * Pre-processes code block outputs prior to saving.
 */
export default function autoFormatter(pi) {
  pi.on('before_save', (event) => {
    if (event && event.content && typeof event.content === 'string') {
      event.content = event.content.trim() + '\\n';
    }
  });
}
`, 'utf8');

console.log('✅ Created 2 Custom Extensions under .pi/extensions/.');
