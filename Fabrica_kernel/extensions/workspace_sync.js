import fs from 'fs';
import path from 'path';

/**
 * Fabrica Workspace Sync Extension for pi agent
 * Event hooks: `message_end` and `agent_end`
 *
 * After each agent message/turn completes, parses response text and updates
 * `runtime.json` for the workspace:
 *   - suggestions[]    : next-step recommendation cards
 *   - backlogs[]       : pending tasks the agent identified
 *   - review_queues[]  : items requiring human-in-the-loop approval
 *   - recent_events[]  : action log entry for this turn
 */
export default function workspaceSyncExtension(pi) {
  if (!pi || typeof pi.on !== 'function') return;

  function syncWorkspaceState(responseText, cwd, eventType) {
    if (!responseText || typeof responseText !== 'string' || !responseText.trim()) return;

    // Locate runtime.json reliably
    const candidateDirs = [
      cwd,
      process.cwd(),
      path.join(process.cwd(), 'workspaces', 'default_user')
    ].filter(Boolean);

    let runtimePath = null;
    for (const d of candidateDirs) {
      const p1 = path.join(d, 'runtime.json');
      const p2 = path.join(d, 'db', 'runtime.json');
      if (fs.existsSync(p1)) {
        runtimePath = p1;
        break;
      } else if (fs.existsSync(p2)) {
        runtimePath = p2;
        break;
      }
    }

    if (!runtimePath) {
      const targetDir = cwd || process.cwd();
      runtimePath = path.join(targetDir, 'runtime.json');
    }

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

      // ── 1. Parse [SUGGEST: Title | Description] ──────────────────────
      const suggestRegex = /\[SUGGEST:\s*([^\]|]+?)(?:\s*\|\s*([^\]]+?))?\]/gi;
      let match;
      while ((match = suggestRegex.exec(responseText)) !== null) {
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
      while ((match = backlogRegex.exec(responseText)) !== null) {
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
      while ((match = reviewRegex.exec(responseText)) !== null) {
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
      while ((match = reviewDoneRegex.exec(responseText)) !== null) {
        const title = match[1].trim();
        runtime.review_queues = (runtime.review_queues || []).map(r =>
          r.title === title ? { ...r, status: 'RESOLVED', resolved_at: now } : r
        );
      }

      // ── 5. Parse [BACKLOG_DONE: Title] ────────────────────────────────
      const backlogDoneRegex = /\[BACKLOG_DONE:\s*([^\]]+?)\]/gi;
      while ((match = backlogDoneRegex.exec(responseText)) !== null) {
        const title = match[1].trim();
        runtime.backlogs = (runtime.backlogs || []).map(b =>
          b.title === title ? { ...b, status: 'DONE', completed_at: now } : b
        );
      }

      // ── 7. Parse [MISSION: Title | Objective | Category] ──────────────
      const missionRegex = /\[MISSION:\s*([^\]|]+?)(?:\s*\|\s*([^\]|]+?))?(?:\s*\|\s*([^\]]+?))?\]/gi;
      const missionsToSync = [];
      while ((match = missionRegex.exec(responseText)) !== null) {
        const title = match[1].trim();
        const objective = (match[2] || title).trim();
        const category = (match[3] || 'system_build').trim();
        missionsToSync.push({
          id: `msn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          title,
          objective,
          category,
          type: category,
          status: 'planning',
          phase: 'planning',
          created_at: now
        });
      }

      if (missionsToSync.length > 0) {
        for (const cd of candidateDirs) {
          const msnsPath = path.join(cd, 'db', 'missions.json');
          let msns = [];
          if (fs.existsSync(msnsPath)) {
            try { msns = JSON.parse(fs.readFileSync(msnsPath, 'utf8')); } catch {}
          }
          for (const m of missionsToSync) {
            if (!msns.some(item => item.title === m.title)) msns.push(m);
          }
          fs.mkdirSync(path.dirname(msnsPath), { recursive: true });
          fs.writeFileSync(msnsPath, JSON.stringify(msns, null, 2), 'utf8');
        }
      }

      // ── 8. Log recent_event ───────────────────────────────────────────
      const cleanSnippet = responseText.replace(/\n+/g, ' ').trim().slice(0, 150);
      const eventEntry = {
        date: now,
        type: eventType || 'AGENT',
        description: `Turn response: ${cleanSnippet}...`,
        details: responseText
      };
      runtime.recent_events = [eventEntry, ...(runtime.recent_events || [])].slice(0, 50);

      // ── 9. Save runtime.json to ALL candidate directories ─────────────
      for (const cd of candidateDirs) {
        const p = path.join(cd, 'runtime.json');
        try {
          fs.mkdirSync(path.dirname(p), { recursive: true });
          fs.writeFileSync(p, JSON.stringify(runtime, null, 2), 'utf8');
        } catch {}
      }
    } catch (err) {
      console.warn('[workspace_sync] Failed updating workspace state:', err.message);
    }
  }

  // Hook into pi's message_end event
  pi.on('message_end', async (event, ctx) => {
    if (!event.message) return;
    let content = '';
    if (typeof event.message.content === 'string') {
      content = event.message.content;
    } else if (Array.isArray(event.message.content)) {
      content = event.message.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('\n');
    }
    const cwd = ctx?.cwd || process.cwd();
    syncWorkspaceState(content, cwd, 'MESSAGE_END');
  });

  // Hook into pi's agent_end event
  pi.on('agent_end', async (event, ctx) => {
    let content = '';
    if (Array.isArray(event.messages)) {
      const assistantMsgs = event.messages.filter(m => m.role === 'assistant');
      const lastMsg = assistantMsgs[assistantMsgs.length - 1];
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
    }
    const cwd = ctx?.cwd || process.cwd();
    syncWorkspaceState(content, cwd, 'AGENT_END');
  });
}

