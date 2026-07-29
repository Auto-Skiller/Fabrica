import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Fabrica Context Injector Extension for pi agent
 * Event hook: `before_agent_start`
 *
 * Dynamically loads and injects:
 *   1. Kernel system prompt files from Fabrica_kernel/prompts/
 *   2. Active workspace state & recent events from db/runtime.json
 */
export default function contextInjectorExtension(pi) {
  if (!pi || typeof pi.on !== 'function') return;

  pi.on('before_agent_start', async (event, ctx) => {
    // ── 1. Resolve Fabrica_kernel/prompts/ directory ─────────────────────
    const candidatePromptDirs = [
      path.resolve(__dirname, '..', 'prompts'),
      path.join(process.cwd(), 'Fabrica_kernel', 'prompts'),
      path.join(process.cwd(), '..', '..', 'Fabrica_kernel', 'prompts'),
      '/Fabrica_kernel/prompts'
    ];

    const promptsDir = candidatePromptDirs.find(d => {
      try { return fs.existsSync(d) && fs.statSync(d).isDirectory(); } catch { return false; }
    });

    let kernelPrompts = '';
    try {
      if (promptsDir) {
        const files = fs.readdirSync(promptsDir)
          .filter(f => f.endsWith('.md'))
          .sort();
        kernelPrompts = files
          .map(f => fs.readFileSync(path.join(promptsDir, f), 'utf8'))
          .join('\n\n---\n\n');
      }
    } catch (err) {
      console.warn('[context_injector] Failed loading kernel prompts:', err.message);
    }

    // ── 2. Load workspace runtime context from db/runtime.json ─────────
    const cwd = event.systemPromptOptions?.cwd || ctx?.cwd || process.cwd();
    const candidateRuntimePaths = [
      path.join(cwd, 'db', 'runtime.json'),
      path.join(process.cwd(), 'db', 'runtime.json'),
      path.join(process.cwd(), 'workspaces', 'default_user', 'db', 'runtime.json')
    ];

    const runtimePath = candidateRuntimePaths.find(p => fs.existsSync(p));
    let workspaceContext = '';

    try {
      if (runtimePath) {
        const runtime = JSON.parse(fs.readFileSync(runtimePath, 'utf8'));
        const parts = [];

        if (runtime.active_mission_id) {
          parts.push(`## Active Mission\n${runtime.active_mission_id}`);
        }
        if (runtime.suggestions && runtime.suggestions.length > 0) {
          parts.push(
            `## Current Suggestions\n` +
            runtime.suggestions.map(s => `- ${s.title || s}${s.description ? `: ${s.description}` : ''}`).join('\n')
          );
        }
        if (runtime.backlogs && runtime.backlogs.length > 0) {
          parts.push(
            `## Workspace Backlog\n` +
            runtime.backlogs.map(b => `- [${b.status || 'OPEN'}] ${b.title || b}${b.priority ? ` (${b.priority})` : ''}`).join('\n')
          );
        }
        if (runtime.review_queues && runtime.review_queues.length > 0) {
          const pending = runtime.review_queues.filter(r => r.status === 'PENDING_USER_APPROVAL');
          if (pending.length > 0) {
            parts.push(
              `## Items Requiring Approval\n` +
              pending.map(r => `- [${r.id}] ${r.title}: ${r.details || ''}`).join('\n')
            );
          }
        }
        if (runtime.recent_events && runtime.recent_events.length > 0) {
          const last3 = runtime.recent_events.slice(0, 3);
          parts.push(
            `## Recent Workspace Events\n` +
            last3.map(e => `- [${e.type || 'EVENT'}] ${e.description || e.details || ''}`).join('\n')
          );
        }

        if (parts.length > 0) {
          workspaceContext = `# Active Workspace State\n\n${parts.join('\n\n')}`;
        }
      }
    } catch (err) {
      console.warn('[context_injector] Failed loading workspace context:', err.message);
    }

    // ── 3. Append to system prompt ───────────────────────────────────────
    const injected = [kernelPrompts, workspaceContext].filter(Boolean).join('\n\n---\n\n');
    if (!injected) return;

    const basePrompt = event.systemPrompt || '';
    return {
      systemPrompt: `${basePrompt}\n\n---\n\n${injected}`
    };
  });
}

