import fs from 'fs';
import path from 'path';

/**
 * Fabrica Workspace Sync Extension for pi agent
 * Event hooks: `turn_end` and `agent_end`
 *
 * After each agent turn/action completes, parses response text and updates
 * `db/runtime.json` for the workspace:
 *   - suggestions[]    : next-step recommendation cards
 *   - backlogs[]       : pending tasks the agent identified
 *   - review_queues[]  : items requiring human-in-the-loop approval
 *   - recent_events[]  : action log entry for this turn
 */
export default function workspaceSyncExtension(pi) {
  if (!pi || typeof pi.on !== 'function') return;

  function syncWorkspaceState(responseText, cwd, eventType) {
    if (!responseText) return;
    const runtimePath = path.join(cwd || process.cwd(), 'db', 'runtime.json');

    try {
      let runtime = {
        tenant_id: 'default_user',
        status: 'running',
        suggestions: [],
        backlogs: [],
        review_queues: [],
        recent_events: [],
        active_mission_id: null,
        last_active: new Date().toISOString()
      };

      if (fs.existsSync(runtimePath)) {
        try {
          runtime = JSON.parse(fs.readFileSync(runtimePath, 'utf8'));
        } catch {}
      }

      const now = new Date().toISOString();
      runtime.last_active = now;
      const text = responseText.toString();

      // ── 1. Parse [SUGGEST: Title | Description] ──────────────────────
      const suggestRegex = /\[SUGGEST:\s*([^\]|]+?)(?:\s*\|\s*([^\]]+?))?\]/gi;
      let match;
      while ((match = suggestRegex.exec(text)) !== null) {
        const title = match[1].trim();
        const description = (match[2] || '').trim();
        runtime.suggestions = (runtime.suggestions || []).filter(s => s.title !== title);
        runtime.suggestions.unshift({
          id: `sug_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          title,
          description,
          created_at: now
        });
      }

      // ── 2. Parse [BACKLOG: Title | Priority] ─────────────────────────
      const backlogRegex = /\[BACKLOG:\s*([^\]|]+?)(?:\s*\|\s*([^\]]+?))?\]/gi;
      while ((match = backlogRegex.exec(text)) !== null) {
        const title = match[1].trim();
        const priority = (match[2] || 'MEDIUM').trim().toUpperCase();
        runtime.backlogs = (runtime.backlogs || []).filter(b => b.title !== title);
        runtime.backlogs.push({
          id: `bl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          title,
          priority,
          status: 'OPEN',
          created_at: now
        });
      }

      // ── 3. Parse [REVIEW: Title | Details] ────────────────────────────
      const reviewRegex = /\[REVIEW:\s*([^\]|]+?)(?:\s*\|\s*([^\]]+?))?\]/gi;
      while ((match = reviewRegex.exec(text)) !== null) {
        const title = match[1].trim();
        const details = (match[2] || '').trim();
        const alreadyPending = (runtime.review_queues || []).some(
          r => r.title === title && r.status === 'PENDING_USER_APPROVAL'
        );
        if (!alreadyPending) {
          runtime.review_queues = runtime.review_queues || [];
          runtime.review_queues.push({
            id: `rv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            title,
            details,
            status: 'PENDING_USER_APPROVAL',
            created_at: now
          });
        }
      }

      // ── 4. Parse [REVIEW_DONE: Title] ─────────────────────────────────
      const reviewDoneRegex = /\[REVIEW_DONE:\s*([^\]]+?)\]/gi;
      while ((match = reviewDoneRegex.exec(text)) !== null) {
        const title = match[1].trim();
        runtime.review_queues = (runtime.review_queues || []).map(r =>
          r.title === title ? { ...r, status: 'RESOLVED', resolved_at: now } : r
        );
      }

      // ── 5. Parse [BACKLOG_DONE: Title] ────────────────────────────────
      const backlogDoneRegex = /\[BACKLOG_DONE:\s*([^\]]+?)\]/gi;
      while ((match = backlogDoneRegex.exec(text)) !== null) {
        const title = match[1].trim();
        runtime.backlogs = (runtime.backlogs || []).map(b =>
          b.title === title ? { ...b, status: 'DONE', completed_at: now } : b
        );
      }

      // ── 6. Log recent_event ───────────────────────────────────────────
      const snippet = text.slice(0, 120).replace(/\n/g, ' ');
      const eventEntry = {
        date: now,
        type: eventType || 'AGENT',
        description: `Completed turn: ${snippet}...`,
        details: text
      };
      runtime.recent_events = [eventEntry, ...(runtime.recent_events || [])].slice(0, 50);

      // ── 7. Save runtime.json ─────────────────────────────────────────
      fs.mkdirSync(path.dirname(runtimePath), { recursive: true });
      fs.writeFileSync(runtimePath, JSON.stringify(runtime, null, 2), 'utf8');
    } catch (err) {
      console.warn('[workspace_sync] Failed updating workspace state:', err.message);
    }
  }

  // Hook into pi's turn_end event
  pi.on('turn_end', async (event, ctx) => {
    let content = '';
    if (event.message) {
      if (typeof event.message.content === 'string') {
        content = event.message.content;
      } else if (Array.isArray(event.message.content)) {
        content = event.message.content
          .filter(c => c.type === 'text')
          .map(c => c.text)
          .join('\n');
      }
    }
    const cwd = ctx?.cwd || process.cwd();
    syncWorkspaceState(content, cwd, 'TURN_END');
  });

  // Hook into pi's agent_end event for overall run logging
  pi.on('agent_end', async (event, ctx) => {
    const cwd = ctx?.cwd || process.cwd();
    const lastMsg = (event.messages || []).slice(-1)[0];
    let content = '';
    if (lastMsg) {
      if (typeof lastMsg.content === 'string') {
        content = lastMsg.content;
      } else if (Array.isArray(lastMsg.content)) {
        content = lastMsg.content
          .filter(c => c.type === 'text')
          .map(c => c.text)
          .join('\n');
      }
    }
    syncWorkspaceState(content, cwd, 'AGENT_END');
  });
}
