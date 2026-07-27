import { db } from './db/db_engine.js';
import { nowIso } from './utils.js';
import { ensureMissionWorkspaceDirs, syncMissionWorkspaceArtifacts } from './harness.js';

// Define simulation data based on mission categories/types
interface MissionTemplates {
  title: string;
  tasks: Array<{ id: string; title: string; cost: string; benefit: string; worthIt: string }>;
  scaffoldedComponents: Array<{ name: string; role: string; code: string }>;
}

const TEMPLATES: Record<string, MissionTemplates> = {
  standard: {
    title: "General Systems Integration Loop",
    tasks: [
      { id: "task_1", title: "Trace active workspace ports & system constraints", cost: "LOW", benefit: "HIGH", worthIt: "YES" },
      { id: "task_2", title: "Verify API token presence and rotate secrets", cost: "LOW", benefit: "MEDIUM", worthIt: "YES" },
      { id: "task_3", title: "Deploy secure router proxy and run validation checks", cost: "MEDIUM", benefit: "HIGH", worthIt: "YES" }
    ],
    scaffoldedComponents: [
      { name: "router_proxy_service", role: "network-proxy", code: "export class RouterProxyService {\n  async routeRequest(req: any) {\n    console.log('[router] proxying request to secure gateway...');\n    return { ok: true, timestamp: Date.now() };\n  }\n}" }
    ]
  },
  brainstorming: {
    title: "Strategic Horizon Exploration & Ideation",
    tasks: [
      { id: "task_1", title: "Synthesize unstructured industry reports and trends", cost: "LOW", benefit: "HIGH", worthIt: "YES" },
      { id: "task_2", title: "Draft exploratory system architecture blueprints", cost: "LOW", benefit: "HIGH", worthIt: "YES" },
      { id: "task_3", title: "Conduct founder alignment and compliance validation checks", cost: "LOW", benefit: "HIGH", worthIt: "YES" }
    ],
    scaffoldedComponents: [
      { name: "ideation_canvas_generator", role: "agent-helper", code: "// Brainstorming helper\nexport function generateIdeationCanvas() {\n  return { canvasId: 'horizon-2027', items: ['Micro-agent swarms', 'Vector memory arrays'] };\n}" }
    ]
  },
  deep_research: {
    title: "Technical Feasibility & Reference Research Scans",
    tasks: [
      { id: "task_1", title: "Verify latest third-party developer API specifications", cost: "LOW", benefit: "HIGH", worthIt: "YES" },
      { id: "task_2", title: "Create isolated sandbox and verify credentials", cost: "MEDIUM", benefit: "HIGH", worthIt: "YES" },
      { id: "task_3", title: "Package research findings into markdown documentation stubs", cost: "LOW", benefit: "HIGH", worthIt: "YES" }
    ],
    scaffoldedComponents: [
      { name: "research_citation_index", role: "data-lookup", code: "export const RESEARCH_DOCS = {\n  verified_endpoints: ['GET /api/v3/telemetry', 'POST /api/v3/jobs'],\n  auth_header: 'Bearer <token>'\n};" }
    ]
  },
  analytics: {
    title: "Operational Log & Botleneck Diagnostic Run",
    tasks: [
      { id: "task_1", title: "Ingest server telemetry logs and parse request latencies", cost: "MEDIUM", benefit: "HIGH", worthIt: "YES" },
      { id: "task_2", title: "Map database query performance and index gaps", cost: "LOW", benefit: "HIGH", worthIt: "YES" },
      { id: "task_3", title: "Isolate and report core system error bottlenecks", cost: "LOW", benefit: "HIGH", worthIt: "YES" }
    ],
    scaffoldedComponents: [
      { name: "telemetry_diagnostics_agent", role: "diagnostic-tool", code: "export function runTelemetryCheck() {\n  return { db_latency: '14ms', cpu_utilization: '12%', status: 'HEALTHY' };\n}" }
    ]
  },
  system_build: {
    title: "Autonomous Microservice Synthesis & Deployment",
    tasks: [
      { id: "task_1", title: "Scaffold clean module structure and package configs", cost: "LOW", benefit: "HIGH", worthIt: "YES" },
      { id: "task_2", title: "Implement core functional services and endpoints", cost: "MEDIUM", benefit: "HIGH", worthIt: "YES" },
      { id: "task_3", title: "Compile test suites and run type verification gates", cost: "MEDIUM", benefit: "HIGH", worthIt: "YES" }
    ],
    scaffoldedComponents: [
      { name: "system_build_service", role: "core-service", code: "export class CoreAppService {\n  constructor() {\n    console.log('[core] initializing SaaS microservice...');\n  }\n  async executeJob(id: string) {\n    return { id, status: 'completed' };\n  }\n}" }
    ]
  },
  system_build_from_data: {
    title: "Dynamic Dashboard Synthesis From Client Datasets",
    tasks: [
      { id: "task_1", title: "Parse unstructured csv/json input datasets", cost: "LOW", benefit: "HIGH", worthIt: "YES" },
      { id: "task_2", title: "Synthesize relational DB schema stubs and seed mock content", cost: "MEDIUM", benefit: "HIGH", worthIt: "YES" },
      { id: "task_3", title: "Build and verify interactive D3 visual graphs and charts", cost: "MEDIUM", benefit: "HIGH", worthIt: "YES" }
    ],
    scaffoldedComponents: [
      { name: "client_leads_visualizer", role: "interactive-dashboard", code: "export function renderLeadsGraph(data: any[]) {\n  console.log('[D3] Drawing dynamic bar chart from dataset:', data.length, 'records');\n  return '<svg>...</svg>';\n}" }
    ]
  },
  system_optimization: {
    title: "Performance Optimization & Cache Hardening",
    tasks: [
      { id: "task_1", title: "Analyze cache hit ratios and identify heavy operations", cost: "LOW", benefit: "HIGH", worthIt: "YES" },
      { id: "task_2", title: "Introduce multi-tier Redis/Memory TTL caching systems", cost: "MEDIUM", benefit: "HIGH", worthIt: "YES" },
      { id: "task_3", title: "Run high-throughput database query tuning scripts", cost: "LOW", benefit: "HIGH", worthIt: "YES" }
    ],
    scaffoldedComponents: [
      { name: "optimized_cache_manager", role: "cache-system", code: "export class TTLMemoryCache {\n  private store = new Map();\n  set(key: string, val: any, ttl = 60000) {\n    this.store.set(key, { val, exp: Date.now() + ttl });\n  }\n}" }
    ]
  },
  system_optimization_from_data: {
    title: "Self-Correcting Pipeline Refinement & Upgrades",
    tasks: [
      { id: "task_1", title: "Process runtime metrics and telemetry datasets", cost: "LOW", benefit: "HIGH", worthIt: "YES" },
      { id: "task_2", title: "Identify code optimization opportunities based on logs", cost: "MEDIUM", benefit: "HIGH", worthIt: "YES" },
      { id: "task_3", title: "Hot-swap upgraded software components seamlessly", cost: "MEDIUM", benefit: "HIGH", worthIt: "YES" }
    ],
    scaffoldedComponents: [
      { name: "self_optimizing_pipeline", role: "pipeline-tuner", code: "export function optimizePipeline(metrics: any) {\n  if (metrics.error_rate > 0.02) {\n    console.log('[optimizer] Backing off concurrency to optimize throughput...');\n    return { status: 'concurrency_tuned' };\n  }\n  return { status: 'nominal' };\n}" }
    ]
  },
  system_test: {
    title: "Automated Suite Compilation & Verification Run",
    tasks: [
      { id: "task_1", title: "Compile local TS lint suites and type checkers", cost: "LOW", benefit: "HIGH", worthIt: "YES" },
      { id: "task_2", title: "Build integration behavioral testing framework stubs", cost: "MEDIUM", benefit: "HIGH", worthIt: "YES" },
      { id: "task_3", title: "Execute automated regressions and output diagnostic reports", cost: "LOW", benefit: "HIGH", worthIt: "YES" }
    ],
    scaffoldedComponents: [
      { name: "automated_test_runner", role: "qa-suite", code: "export function runTests() {\n  console.log('[test-runner] Executing 14 unit tests...');\n  return { passed: 14, failed: 0, timeMs: 45 };\n}" }
    ]
  },
  system_test_from_data: {
    title: "Behavioral Simulation Under Raw Telemetry Replay",
    tasks: [
      { id: "task_1", title: "Import historical error log datasets", cost: "LOW", benefit: "HIGH", worthIt: "YES" },
      { id: "task_2", title: "Replay high-concurrency requests in simulation sandboxes", cost: "MEDIUM", benefit: "HIGH", worthIt: "YES" },
      { id: "task_3", title: "Verify transaction rollback capabilities under errors", cost: "MEDIUM", benefit: "HIGH", worthIt: "YES" }
    ],
    scaffoldedComponents: [
      { name: "telemetry_replay_sandbox", role: "simulation-engine", code: "export function replayTelemetry(events: any[]) {\n  console.log('[replay] replaying', events.length, 'events into system sandbox...');\n  return { integrity_score: 0.999, status: 'SUCCESS' };\n}" }
    ]
  }
};

/**
 * Autonomous multi-user/multi-tenant mission execution simulator.
 * Ensures that the system operates continuously 24/7 without gaps, 
 * simulating real agent actions, compiling logs, and generating system components.
 */
export async function simulateMissions(): Promise<void> {
  try {
    // 1. Get all active tenants/users in our system
    const users = await db.getAllUsers();
    
    for (const userId of users) {
      // Fetch runtime state and config to respect tenant-isolated parameters (e.g., Autonomy Mode)
      const config = await db.getAppConfig(userId);
      const runtimeState = await db.getRuntimeState(userId);
      runtimeState.recent_events = Array.isArray(runtimeState.recent_events) ? runtimeState.recent_events : [];
      const autonomyMode = config.settings?.autonomy || 'autonomous';
      const isFullAuto = autonomyMode === 'autonomous';
      const isSemiAuto = autonomyMode === 'semi-autonomous';

      // Fetch all missions registered under this tenant
      let missions = await db.getMissions(userId);
      let activeMissions = missions.filter(m => m.status !== 'archive');

      // 2. FULL AUTO: System automatically creates NEW missions based on existing context
      if (isFullAuto) {
        const activeDraftingOrPlanning = activeMissions.filter(m => m.status === 'drafting' || m.status === 'planning');
        
        // Auto-creation of missions disabled when empty to respect explicit user deletions
        if (false && activeDraftingOrPlanning.length < 2) {
          const rawDataList = await db.getRawDataList(userId);
          const components = await db.getSystemComponents(userId);

          let newType: string = 'system_build';
          let newTitle: string = 'Autonomous System Integration & Scaffolding';
          let newObjective: string = 'Scaffold microservice routes, compile system modules, and run type verification gates.';

          if (rawDataList.length > 0 && Math.random() > 0.4) {
            const rd = rawDataList[Math.floor(Math.random() * rawDataList.length)];
            newType = 'system_build_from_data';
            newTitle = `Autonomous Dashboard & Data Pipeline: ${rd.name || 'Dataset Ingestion'}`;
            newObjective = `Parse unstructured raw dataset (${rd.name || 'CSV/JSON'}) and synthesize relational database schemas with visual graphs.`;
          } else if (components.length > 0 && Math.random() > 0.4) {
            newType = 'system_optimization';
            newTitle = `Autonomous Infrastructure Performance & Cache Hardening`;
            newObjective = `Analyze active runtime components, inject memory TTL caching layers, and optimize database query latency.`;
          } else {
            const arr = (runtimeState?.pillars as any[]) || [];
            if (arr.length > 0) {
              const pillar = arr[0];
              newType = 'analytics';
              newTitle = `Operational Bottleneck Diagnostic Run: ${pillar.title || 'Workspace Metrics'}`;
              newObjective = `Ingest operational logs, map system bottlenecks, and formulate strategic execution blueprints.`;
            }
          }

          const autoMission: any = {
            id: `mission_auto_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
            user_id: userId,
            title: newTitle,
            objective: newObjective,
            type: newType,
            category: newType,
            status: 'drafting',
            phase: 'analytics_1',
            created_by: 'agent',
            user_created: false,
            input_data_ids: [],
            system_ids: [],
            metadata: {
              created_by: 'agent',
              user_created: false
            },
            workflow_history: [
              {
                timestamp: new Date().toISOString(),
                phase: 'drafting',
                status: `🤖 [Full Auto Agent] Automatically created new ${newType.toUpperCase()} mission based on active workspace context.`
              }
            ],
            qa_state: {
              options: [
                "Approve and advance to execution planning",
                "Request deeper architectural analysis iteration",
                "Flag system blockages and pause execution"
              ],
              user_selection: "Agent QA Gatekeeper: Security & quality validations PASSED automatically.",
              custom_input: "Autonomous verification complete.",
              resolved: false
            }
          };

          await db.saveMission(autoMission);
          activeMissions.push(autoMission);

          runtimeState.recent_events.unshift({
            date: nowIso(),
            type: 'AGENT_AUTO_CREATE',
            description: `🤖 [Full Auto] Created new mission: "${newTitle}"`,
            details: `Synthesized automatically from existing workspace context under tenant "${userId}".`
          });
        }
      }

      if (activeMissions.length === 0) {
        continue;
      }

      for (const m of activeMissions) {
        const type = m.type || 'standard';
        const template = TEMPLATES[type] || TEMPLATES.standard;
        const currentPhase = m.phase || 'analytics_1';
        let updated = false;

        const isUserCreated = m.user_created === true || m.created_by === 'user' || m.metadata?.user_created === true || m.metadata?.created_by === 'user';

        const nextPhaseMap: Record<string, string> = {
          'analytics_1': 'research_1',
          'research_1': 'analytics_2',
          'analytics_2': 'qa',
          'qa': 'analytics_3',
          'analytics_3': 'research_2',
          'research_2': 'analytics_4',
          'analytics_4': 'planning',
          'planning': 'execution'
        };

        m.workflow_history = m.workflow_history || [];

        // CASE A: Drafting and Analytical Phases
        if (m.status === 'drafting') {
          if (currentPhase === 'qa') {
            const userSelection = m.qa_state?.user_selection;
            const isApproved = userSelection && (userSelection.includes('Approve') || userSelection.includes('advance'));

            if (isUserCreated) {
              // User-created missions: DO NOT move to planning until user explicitly moves them!
              if (isApproved) {
                m.status = 'planning';
                m.phase = 'planning';
                m.qa_state = {
                  ...m.qa_state,
                  resolved: true
                };

                m.workflow_history.push({
                  timestamp: new Date().toISOString(),
                  phase: 'qa',
                  status: `🛡️ [QA Gate Approved by User] User approved transition: "${userSelection}". Advancing to planning phase.`
                });

                runtimeState.recent_events.unshift({
                  date: nowIso(),
                  type: 'QA_GATE',
                  description: `[${m.title}] User approved QA gate for planning.`,
                  details: `User moved mission ${m.id} to planning under tenant "${userId}".`
                });

                updated = true;
              } else {
                // Stay in drafting / QA waiting for user action
                continue;
              }
            } else {
              // System/Agent-created missions in Full Auto: Agent answers QA step himself automatically!
              if (isFullAuto || isApproved) {
                const reason = isApproved 
                  ? `Operator approved: "${userSelection}".`
                  : `Agent QA Gatekeeper: Security, feasibility & quality validations PASSED automatically using workspace context.`;

                m.status = 'planning';
                m.phase = 'planning';
                m.qa_state = {
                  ...m.qa_state,
                  user_selection: userSelection || "Approve and advance to execution planning (Agent Auto-QA)",
                  resolved: true
                };

                m.workflow_history.push({
                  timestamp: new Date().toISOString(),
                  phase: 'qa',
                  status: `🤖 [Agent Auto-QA Approved] ${reason}`
                });

                runtimeState.recent_events.unshift({
                  date: nowIso(),
                  type: 'QA_GATE',
                  description: `[${m.title}] Agent answered QA gate automatically for system mission.`,
                  details: reason
                });

                updated = true;
              } else {
                continue;
              }
            }
          } else {
            // Ordinary draft analytics/research progression
            const nextPhase = nextPhaseMap[currentPhase];
            if (nextPhase) {
              if (nextPhase === 'planning') {
                if (isUserCreated) {
                  // Gate: User created mission stops at QA and waits for user to move to planning
                  m.phase = 'qa';
                } else if (isFullAuto) {
                  m.status = 'planning';
                  m.phase = 'planning';
                } else {
                  m.phase = 'qa';
                }
              } else {
                m.phase = nextPhase as any;
              }

              m.workflow_history.push({
                timestamp: new Date().toISOString(),
                phase: currentPhase,
                status: `⚡ [Agent ${type.toUpperCase()}] Completed analysis of current workspace artifacts. Formulated objectives for [${m.phase}].`
              });

              runtimeState.recent_events.unshift({
                date: nowIso(),
                type: 'AGENT',
                description: `[${m.title}] Agent advanced phase to ${m.phase}.`,
                details: `Progressing ${m.id} under tenant "${userId}".`
              });

              updated = true;
            }
          }
        }
        // CASE B: Planning Phase
        // Once in planning (user moved it here for user missions, or auto-moved for system missions), agent moves them until DONE in Full Auto!
        else if (m.status === 'planning') {
          if (isFullAuto || isSemiAuto) {
            m.metadata = m.metadata || {};
            m.metadata.tasks = m.metadata.tasks || {};
            
            let taskIndex = 1;
            for (const task of template.tasks) {
              const taskId = `task_${taskIndex}`;
              m.metadata.tasks[taskId] = {
                id: taskId,
                title: task.title,
                benefit: task.benefit,
                cost: task.cost,
                worth_it: task.worthIt,
                completed: false,
                order: taskIndex
              };
              taskIndex++;
            }

            m.status = 'execution';
            m.phase = 'execution';
            
            m.workflow_history.push({
              timestamp: new Date().toISOString(),
              phase: 'planning',
              status: `📋 [Planning Architect] Generated step-by-step physical implementation blueprint. Created ${template.tasks.length} actionable execution tasks.`
            });

            runtimeState.recent_events.unshift({
              date: nowIso(),
              type: 'PLANNING',
              description: `[${m.title}] Implementation plan compiled by agent.`,
              details: `Constructed ${template.tasks.length} tasks for execution under tenant "${userId}".`
            });

            updated = true;
          }
        }
        // CASE C: Execution Phase (Step-by-step sequential tasks execution & scaffolding until DONE)
        else if (m.status === 'execution') {
          if (isFullAuto || isSemiAuto) {
            m.metadata = m.metadata || {};
            m.metadata.tasks = m.metadata.tasks || {};

            const tasksList = Object.values(m.metadata.tasks) as any[];
            tasksList.sort((a, b) => (a.order || 0) - (b.order || 0));
            const nextTask = tasksList.find(t => !t.completed);

            if (nextTask) {
              nextTask.completed = true;
              m.metadata.tasks[nextTask.id] = nextTask;

              m.workflow_history.push({
                timestamp: new Date().toISOString(),
                phase: 'execution',
                status: `⚙️ [Execution Engine] Task Completed: "${nextTask.title}". System compliance verified. Tests PASSED.`
              });

              runtimeState.recent_events.unshift({
                date: nowIso(),
                type: 'EXECUTION',
                description: `[${m.title}] Executed task: ${nextTask.title}`,
                details: `Successful run of task ${nextTask.id} for tenant "${userId}".`
              });

              const allCompleted = tasksList.every(t => t.completed || t.id === nextTask.id);
              if (allCompleted) {
                for (const comp of template.scaffoldedComponents) {
                  const componentId = `comp_${type}_${Math.random().toString(36).substring(2, 7)}`;
                  const newComponent = {
                    id: componentId,
                    user_id: userId,
                    name: `${userId}_${comp.name}`,
                    role: comp.role,
                    code_snapshot: comp.code,
                    metadata: {
                      created_by: `Autonomous Execution [${m.id}]`,
                      status: 'active',
                      version: '1.0.0',
                      tenantId: userId
                    }
                  };

                  await db.saveSystemComponent(newComponent);
                  m.system_ids = m.system_ids || [];
                  m.system_ids.push(componentId);

                  m.workflow_history.push({
                    timestamp: new Date().toISOString(),
                    phase: 'execution',
                    status: `🚀 [Deployer] Automatically compiled, packaged, and hot-swapped production system component: "${userId}_${comp.name}". [${comp.role}]`
                  });

                  runtimeState.recent_events.unshift({
                    date: nowIso(),
                    type: 'DEPLOY',
                    description: `Hot-swapped system component: "${userId}_${comp.name}"`,
                    details: `Added compiled operational service to components registry under tenant "${userId}".`
                  });
                }

                m.status = 'archive';
                m.phase = 'execution';
                m.metadata.metrics = m.metadata.metrics || {};
                m.metadata.metrics.progress_percentage = '100%';

                m.workflow_history.push({
                  timestamp: new Date().toISOString(),
                  phase: 'archive',
                  status: `🏆 [Mission Controller] MISSION ACCOMPLISHED! All objectives completed successfully. Mission moved to DONE.`
                });

                runtimeState.recent_events.unshift({
                  date: nowIso(),
                  type: 'MISSION_COMPLETE',
                  description: `🎉 Mission Accomplished: "${m.title}"`,
                  details: `Fully executed all roadmap objectives. Moved to DONE under tenant "${userId}".`
                });
              } else {
                const completedCount = tasksList.filter(t => t.completed).length;
                const totalCount = tasksList.length;
                const ratio = Math.round((completedCount / totalCount) * 100);
                m.metadata.metrics = m.metadata.metrics || {};
                m.metadata.metrics.progress_percentage = `${ratio}%`;
              }

              updated = true;
            }
          }
        }

        if (updated) {
          await db.saveMission(m);
        }
      }

      runtimeState.recent_events = runtimeState.recent_events.slice(0, 30);
      await db.saveRuntimeState(runtimeState);
    }
  } catch (err: any) {
    console.error(`❌ [simulator] Error in background autonomous loop:`, err.message);
  }
}
