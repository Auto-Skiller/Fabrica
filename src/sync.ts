import fs from 'fs';
import path from 'path';
import {
  FIXED_ASPECTS,
  ANALYSING_FIELDS,
  readYaml,
  smartWrite,
  listEntities,
  rglobFiles,
  copyRecursiveSync,
  _isEmpty,
  _WEAK_WHEN,
  nowIso,
  stampFreshness
} from './utils.js';
import { orchestrator } from './pipeline/orchestrator.js';

const _sync_sig = new Map<string, string>();

function getEntitySig(name: string, root: string, prefix: string): string {
  const parts: string[] = [];
  const files = [
    `${prefix}-runtime.yaml`,
    `${prefix}-missions.yaml`,
    `${prefix}-inbox.yaml`,
    `${prefix}-toolboxes.yaml`
  ];
  for (const fn of files) {
    const filePath = path.join(root, fn);
    if (fs.existsSync(filePath)) {
      const st = fs.statSync(filePath);
      parts.push(`${fn}:${Math.floor(st.mtimeMs)}:${st.size}`);
    } else {
      parts.push(`${fn}:0:0`);
    }
  }

  const dirs = [
    path.join(root, `.${prefix}-toolboxes`),
    path.join(root, `${prefix}-inbox`)
  ];
  for (const d of dirs) {
    if (fs.existsSync(d) && fs.statSync(d).isDirectory()) {
      const st = fs.statSync(d);
      parts.push(`${d}:${Math.floor(st.mtimeMs)}`);
    } else {
      parts.push(`${d}:0`);
    }
  }
  return parts.join('|');
}

export function detectFillGaps(entityRoot: string, prefix: string): any {
  const dataKey = 'data';
  const fq: any = {
    [dataKey]: [],
    missions: [],
    toolboxes: [],
    inbox: { discovery: [], raw: [], analysing: [], gateway: [] }
  };

  const inboxDir = path.join(entityRoot, `${prefix}-inbox`);
  const inboxYaml = path.join(entityRoot, `${prefix}-inbox.yaml`);
  const inboxData = readYaml(inboxYaml) || {};
  const rawBlock = inboxData.raw || {};
  const discoveryBlock = inboxData.discovery || {};

  if (fs.existsSync(inboxDir) && fs.statSync(inboxDir).isDirectory()) {
    for (const item of fs.readdirSync(inboxDir)) {
      if (item.startsWith('.') || item.startsWith('_drained_raw')) continue;
      const itemPath = path.join(inboxDir, item);

      if (!discoveryBlock[item]) {
        fq.inbox.discovery.push(item);
        continue;
      }
      const de = discoveryBlock[item] || {};
      if (String(de.status || '').toLowerCase() !== 'analyzed') {
        fq.inbox.discovery.push(item);
        continue;
      }

      const entry = rawBlock[item] || {};
      if (entry.needs_semantics === false && ['delivered', 'done', 'complete'].includes(String(entry.status || '').toLowerCase())) {
        continue;
      }
      fq.inbox.raw.push(item);
    }
  }

  const gwDir = path.join(inboxDir, `.${prefix}-inbox_gateway`);
  if (fs.existsSync(gwDir) && fs.statSync(gwDir).isDirectory()) {
    for (const pillar of fs.readdirSync(gwDir)) {
      if (pillar.startsWith('.') || !fs.statSync(path.join(gwDir, pillar)).isDirectory()) continue;
      const pillarPath = path.join(gwDir, pillar);
      const existingAspects = new Set(
        fs.readdirSync(pillarPath).filter(name => fs.statSync(path.join(pillarPath, name)).isDirectory() && !name.startsWith('.'))
      );
      for (const aspect of FIXED_ASPECTS) {
        if (!existingAspects.has(aspect)) {
          fq.inbox.gateway.push(`${pillar}/${aspect}`);
        }
      }
    }
  }

  const dataDir = path.join(entityRoot, `${prefix}-data`);
  if (fs.existsSync(dataDir) && fs.statSync(dataDir).isDirectory()) {
    const rFiles = rglobFiles(dataDir, process.cwd());
    for (const rf of rFiles) {
      fq[dataKey].push(rf);
    }
  }

  return fq;
}

export function scaffoldGap(yamlPath: string, section: string, itemName: string, skeleton: any): boolean {
  const data = readYaml(yamlPath) || {};
  const old = JSON.parse(JSON.stringify(data));
  if (!data[section] || typeof data[section] !== 'object') {
    data[section] = {};
  }
  const bucket = data[section];
  if (!bucket[itemName] || typeof bucket[itemName] !== 'object') {
    bucket[itemName] = {};
  }
  const entry = bucket[itemName];
  let changed = false;
  for (const [k, v] of Object.entries(skeleton)) {
    if (!(k in entry)) {
      entry[k] = v;
      changed = true;
    }
  }
  if (entry.scaffolded_by !== 'daemon') {
    entry.scaffolded_by = 'daemon';
    entry.needs_semantics = true;
    changed = true;
  }
  if (changed) {
    smartWrite(yamlPath, old, data);
  }
  return changed;
}

export function scaffoldAllGaps(entityRoot: string, prefix: string, fq: any): void {
  const seenPillars = new Set<string>();
  const inboxYaml = path.join(entityRoot, `${prefix}-inbox.yaml`);
  const rawGaps = fq?.inbox?.raw || [];

  for (const item of rawGaps) {
    if (item.includes(':')) continue;
    const itemPath = path.join(entityRoot, `${prefix}-inbox`, item);
    const isDir = fs.existsSync(itemPath) && fs.statSync(itemPath).isDirectory();
    scaffoldGap(
      inboxYaml, "raw", item,
      {
        name: item,
        type: isDir ? "dir" : "file",
        description: "",
        contains: [],
        when_to_use: ""
      }
    );
    if (isDir) {
      const readme = path.join(itemPath, "README.md");
      if (!fs.existsSync(readme)) {
        fs.writeFileSync(readme, `# ${item}\n\n<!-- scaffolded by daemon; agent fills semantics -->\n`, 'utf8');
      }
    }
  }

  const mMissionsYaml = path.join(entityRoot, `${prefix}-missions.yaml`);
  const missionGaps = fq?.missions || [];
  for (const item of missionGaps) {
    if (item.includes(':')) continue;
    scaffoldGap(mMissionsYaml, "mission_shell", item, {
      status: "PLANNING",
      proposal_name: item,
      objective: ""
    });
  }

  const rtYaml = path.join(entityRoot, `${prefix}-runtime.yaml`);
  const promptKey = 'data';
  const dataGaps = fq?.[promptKey] || [];
  for (const item of dataGaps) {
    if (item.includes(':')) continue;
    scaffoldGap(rtYaml, "data_shell", item, {
      description: "",
      contains: []
    });
  }

  const gwRoot = path.join(entityRoot, `${prefix}-inbox`, `.${prefix}-inbox_gateway`);
  const gatewayGaps = fq?.inbox?.gateway || [];
  for (const item of gatewayGaps) {
    if (item.includes(':')) continue;
    const parts = item.split('/').filter(Boolean);
    let cur = gwRoot;
    for (const part of parts) {
      cur = path.join(cur, part);
    }
    fs.mkdirSync(cur, { recursive: true });

    if (parts.length === 1) {
      seenPillars.add(parts[0]);
      for (const aspect of FIXED_ASPECTS) {
        fs.mkdirSync(path.join(gwRoot, parts[0], aspect), { recursive: true });
      }
    }

    const pillarReadme = path.join(gwRoot, parts[0], "README.md");
    if (!fs.existsSync(pillarReadme)) {
      fs.writeFileSync(
        pillarReadme,
        `# Gateway: ${parts[0]}\n\n<!-- scaffolded by daemon; agent curates copies of inbox items here under <functional_group>/ -->\n`,
        'utf8'
      );
    }
  }
}

export function snapshotRawArchive(entityRoot: string, prefix: string): void {
  const inboxDir = path.join(entityRoot, `${prefix}-inbox`);
  if (!fs.existsSync(inboxDir) || !fs.statSync(inboxDir).isDirectory()) return;

  const live: string[] = [];
  for (const item of fs.readdirSync(inboxDir)) {
    const p = path.join(inboxDir, item);
    if (fs.statSync(p).isDirectory() && !item.startsWith('.') && !item.startsWith('_drained_raw')) {
      live.push(item);
    }
  }
  if (live.length === 0) return;

  const stamp = new Date().toISOString().split('T')[0];
  const archive = path.join(inboxDir, `_drained_raw_${stamp}`);
  fs.mkdirSync(archive, { recursive: true });

  const doneFile = path.join(archive, ".snapshot_done");
  if (fs.existsSync(doneFile)) return;

  for (const name of live) {
    const src = path.join(inboxDir, name);
    const dst = path.join(archive, name);
    if (fs.existsSync(dst)) continue;
    copyRecursiveSync(src, dst);
  }

  fs.writeFileSync(doneFile, `raw inbox snapshot ${stamp}; immutable archive of live drop before routing\n`, 'utf8');
}

export function buildTree(folder: string, root: string): any {
  const node: any = {};
  if (!fs.existsSync(folder)) return node;
  const entries = fs.readdirSync(folder).sort();
  for (const name of entries) {
    if (name.startsWith('.')) continue;
    const childPath = path.join(folder, name);
    const stats = fs.statSync(childPath);
    if (stats.isDirectory()) {
      node[`${name}/`] = buildTree(childPath, root);
    } else if (stats.isFile()) {
      const relpath = path.relative(root, childPath).replace(/\\/g, '/');
      node[name] = [relpath];
    }
  }
  return node;
}

export function writeDiscovery(inboxYaml: string, prefix: string): void {
  const inboxDir = path.join(path.dirname(inboxYaml), `${prefix}-inbox`);
  if (!fs.existsSync(inboxDir) || !fs.statSync(inboxDir).isDirectory()) return;

  const inbox = readYaml(inboxYaml) || {};
  if (!inbox.discovery || typeof inbox.discovery !== 'object') {
    inbox.discovery = {};
  }
  const disc = inbox.discovery;
  let changed = false;

  const entries = fs.readdirSync(inboxDir).sort();
  for (const name of entries) {
    const dropPath = path.join(inboxDir, name);
    if (fs.statSync(dropPath).isDirectory() && !name.startsWith('.') && !name.startsWith('_drained_raw')) {
      if (name in disc) continue;
      const tree = buildTree(dropPath, dropPath);
      disc[name] = {
        drop: path.relative(path.dirname(inboxDir), dropPath).replace(/\\/g, '/'),
        archived_at: new Date().toISOString(),
        status: "needs_analysis",
        tree: tree,
      };
      changed = true;
    }
  }

  if (changed) {
    smartWrite(inboxYaml, readYaml(inboxYaml), inbox);
  }
}

export function syncMembersToPaths(entry: any): boolean {
  const paths = entry.paths || [];
  if (!entry.members || typeof entry.members !== 'object') {
    entry.members = {};
  }
  const members = entry.members;
  let changed = false;

  for (const p of paths) {
    if (!members[p] || typeof members[p] !== 'object') {
      members[p] = {
        raw_path: p,
        gateway_path: "",
        description: "",
        contains: "",
        when_to_use: "",
        status: "pending"
      };
      changed = true;
    }
  }

  const pathsSet = new Set(paths);
  for (const stale of Object.keys(members)) {
    if (!pathsSet.has(stale)) {
      delete members[stale];
      changed = true;
    }
  }

  return changed;
}

export function routeAnalysingToGateway(inboxYaml: string, prefix: string): void {
  const inbox = readYaml(inboxYaml) || {};
  const analysing = inbox.analysing;
  if (!analysing || typeof analysing !== 'object') return;

  if (!inbox.gateway || typeof inbox.gateway !== 'object') {
    inbox.gateway = {};
  }
  const gw = inbox.gateway;
  let changed = false;

  for (const [name, entry] of Object.entries(analysing)) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as any;

    if (e.disposition !== 'route') continue;
    if (e.status === 'routed') continue;

    const hasAllFields = ANALYSING_FIELDS.every(k => e[k] && (_isEmpty(e[k]) === false));
    if (!hasAllFields || !e.paths || !Array.isArray(e.paths)) continue;

    if (syncMembersToPaths(e)) {
      changed = true;
    }

    const members = e.members || {};
    const allMembersDone = e.paths.every((p: string) => {
      const m = members[p];
      return m && typeof m === 'object' && ANALYSING_FIELDS.every(k => m[k] && (_isEmpty(m[k]) === false));
    });
    if (!allMembersDone) continue;

    const pillar = String(e.suggested_pillar || "Uncategorized");
    const aspect = String(e.suggested_aspect || "Architecture");
    const fg = String(e.suggested_fg || "General");

    if (!gw[pillar]) gw[pillar] = {};
    if (!gw[pillar][aspect]) gw[pillar][aspect] = {};
    if (!gw[pillar][aspect][fg]) gw[pillar][aspect][fg] = {};

    const gwItemPath = `${pillar}/${aspect}/${fg}/${name}`;
    const gwMembers: any = {};

    for (const p of e.paths) {
      const m = members[p] || {};
      gwMembers[p] = {
        raw_path: m.raw_path || p,
        gateway_path: m.gateway_path || `${gwItemPath}#${p}`,
        description: m.description || "",
        contains: m.contains || "",
        when_to_use: m.when_to_use || "",
        status: "routed",
      };
    }

    gw[pillar][aspect][fg][name] = {
      path: e.drop || name,
      description: e.description,
      contains: e.contains,
      when_to_use: e.when_to_use,
      extracted_concern: e.extracted_concern || "",
      source_raw_item: name,
      content_hash: e.content_hash || "",
      members: gwMembers,
    };

    for (const p of e.paths) {
      if (members[p]) {
        members[p].gateway_path = gwMembers[p].gateway_path;
        members[p].status = "routed";
      }
    }

    e.status = "routed";
    changed = true;
  }

  if (changed) {
    smartWrite(inboxYaml, readYaml(inboxYaml), inbox);
  }
}

export function detectEmptySections(runtime: any): void {
  if (!runtime || typeof runtime !== 'object') return;
  const fq = runtime.fill_queue || {};
  runtime.fill_queue = fq;
  const rt = fq.runtime || {};
  fq.runtime = rt;

  for (const key of ["pillars", "evolution_objectives"]) {
    const sec = runtime[key];
    if (sec && typeof sec === 'object') {
      const suggestions = sec.suggestions;
      const total = suggestions && typeof suggestions === 'object' ? parseInt(suggestions.total) || 0 : 0;
      const empty = !suggestions || typeof suggestions !== 'object' || total === 0;

      if (empty) {
        if (!rt[key]) {
          rt[key] = [`${key} is empty - agent should read, analyse and suggest.`];
        }
      } else {
        if (rt[key]) {
          delete rt[key];
        }
      }
    }
  }
}

export function reconcileToolboxes(entityRoot: string, prefix: string, toolboxesData: any): string[] {
  if (!toolboxesData || typeof toolboxesData !== 'object') return [];
  const tbRoot = path.join(entityRoot, `.${prefix}-toolboxes`);
  if (!toolboxesData.toolboxes || typeof toolboxesData.toolboxes !== 'object') {
    toolboxesData.toolboxes = {};
  }
  const tb = toolboxesData.toolboxes;
  const flagged: string[] = [];

  const diskDomains = new Set<string>();
  if (fs.existsSync(tbRoot) && fs.statSync(tbRoot).isDirectory()) {
    for (const d of fs.readdirSync(tbRoot)) {
      if (!d.startsWith('.') && fs.statSync(path.join(tbRoot, d)).isDirectory()) {
        diskDomains.add(d);
      }
    }
  }

  for (const k of Object.keys(tb)) {
    const v = tb[k];
    const isValid = v && typeof v === 'object' && (diskDomains.has(k) || 'toolboxes' in v);
    if (!isValid) {
      delete tb[k];
    }
  }

  const AGENT_FIELDS = ["role", "description", "when_to_use", "triggers"];
  const SKILL_FIELDS = ["role", "description", "when_to_use", "triggers", "inputs", "outputs"];
  const TB_FIELDS = ["description", "when_to_use"];
  const DOMAIN_FIELDS = ["description", "when_to_use"];

  if (fs.existsSync(tbRoot) && fs.statSync(tbRoot).isDirectory()) {
    const domains = fs.readdirSync(tbRoot).sort();
    for (const dName of domains) {
      const dPath = path.join(tbRoot, dName);
      if (dName.startsWith('.') || !fs.statSync(dPath).isDirectory()) continue;

      if (!tb[dName]) {
        tb[dName] = { status: true, type: "domain", description: "", when_to_use: "", toolboxes: {} };
      }
      const dentry = tb[dName];
      if (!dentry.toolboxes || typeof dentry.toolboxes !== 'object') dentry.toolboxes = {};
      let dHasChildren = false;

      const toolboxes = fs.readdirSync(dPath).sort();
      for (const tName of toolboxes) {
        const tPath = path.join(dPath, tName);
        if (tName.startsWith('.') || !fs.statSync(tPath).isDirectory()) continue;

        if (!dentry.toolboxes[tName]) {
          dentry.toolboxes[tName] = {
            status: true,
            type: "toolbox",
            description: "",
            when_to_use: "",
            agents: {},
            skills: {}
          };
        }
        const tentry = dentry.toolboxes[tName];
        if (!tentry.agents || typeof tentry.agents !== 'object') tentry.agents = {};
        if (!tentry.skills || typeof tentry.skills !== 'object') tentry.skills = {};
        let tHasChildren = false;

        const adir = path.join(tPath, "agents");
        if (fs.existsSync(adir) && fs.statSync(adir).isDirectory()) {
          const agents = fs.readdirSync(adir).sort();
          for (const aName of agents) {
            const aPath = path.join(adir, aName);
            if (aName.startsWith('.') || !fs.statSync(aPath).isDirectory()) continue;
            tHasChildren = true;

            if (!tentry.agents[aName]) {
              tentry.agents[aName] = {
                status: true,
                maturity: "stub",
                role: "",
                description: "",
                when_to_use: "",
                triggers: []
              };
            }
            const aentry = tentry.agents[aName];
            const tbFile = `${dName}/${tName}/agents/${aName}`;
            const miss = AGENT_FIELDS.filter(f => _isEmpty(aentry[f]));
            if (miss.length > 0) {
              flagged.push(`${tbFile} | MISSING: ${miss.join(',')}`);
            }
            if (aentry.when_to_use && _WEAK_WHEN.test(aentry.when_to_use)) {
              flagged.push(`${tbFile}: weak when_to_use (no real use-case — rewrite with concrete scenarios)`);
            }
          }
        }

        const sdir = path.join(tPath, "skills");
        if (fs.existsSync(sdir) && fs.statSync(sdir).isDirectory()) {
          const skills = fs.readdirSync(sdir).sort();
          for (const sName of skills) {
            const sPath = path.join(sdir, sName);
            if (sName.startsWith('.') || !fs.statSync(sPath).isDirectory()) continue;
            tHasChildren = true;

            if (!tentry.skills[sName]) {
              tentry.skills[sName] = {
                status: true,
                maturity: "stub",
                role: "",
                description: "",
                when_to_use: "",
                triggers: [],
                inputs: [],
                outputs: [],
                references: {}
              };
            }
            const sentry = tentry.skills[sName];
            const tbFile = `${dName}/${tName}/skills/${sName}`;
            const miss = SKILL_FIELDS.filter(f => _isEmpty(sentry[f]));
            if (miss.length > 0) {
              flagged.push(`${tbFile} | MISSING: ${miss.join(',')}`);
            }
            if (sentry.when_to_use && _WEAK_WHEN.test(sentry.when_to_use)) {
              flagged.push(`${tbFile}: weak when_to_use (no real use-case — rewrite with concrete scenarios)`);
            }

            const refs = sentry.references || {};
            for (const [rname, rentry] of Object.entries(refs)) {
              if (rentry && typeof rentry === 'object') {
                const re = rentry as any;
                if (re.when_to_use && _WEAK_WHEN.test(re.when_to_use)) {
                  flagged.push(`${dName}/${tName}/skills/${sName}/references/${rname}: weak when_to_use (no real use-case — rewrite with concrete scenarios)`);
                }
              }
            }
          }
        }

        if (tHasChildren) {
          const tbPath = `${dName}/${tName}`;
          const miss = TB_FIELDS.filter(f => _isEmpty(tentry[f]));
          if (miss.length > 0) {
            flagged.push(`${tbPath} | MISSING: ${miss.join(',')}`);
          }
          if (tentry.when_to_use && _WEAK_WHEN.test(tentry.when_to_use)) {
            flagged.push(`${tbPath}: weak when_to_use (no real use-case — rewrite with concrete scenarios)`);
          }
          dHasChildren = true;
        }
      }

      if (dHasChildren) {
        const miss = DOMAIN_FIELDS.filter(f => _isEmpty(dentry[f]));
        if (miss.length > 0) {
          flagged.push(`${dName} | MISSING: ${miss.join(',')}`);
        }
        if (dentry.when_to_use && _WEAK_WHEN.test(dentry.when_to_use)) {
          flagged.push(`${dName}: weak when_to_use (no real use-case — rewrite with concrete scenarios)`);
        }
      }
    }
  }

  return flagged;
}

export function flagMissing(entry: any, fields: string[], label: string, tbFile?: string): string[] {
  const miss = fields.filter(f => _isEmpty(entry?.[f]));
  if (miss.length === 0) return [];
  if (tbFile) {
    return [`${tbFile} | MISSING: ${miss.join(',')}`];
  }
  return miss.map(f => `${label}: missing ${f}`);
}

export function flagWeakWhen(entry: any, label: string): string[] {
  const wt = entry?.when_to_use;
  if (typeof wt === 'string' && _WEAK_WHEN.test(wt)) {
    return [`${label}: weak when_to_use (no real use-case — rewrite with concrete scenarios)`];
  }
  return [];
}

export function flagContains(entry: any, label: string): string[] {
  const contains = entry?.contains;
  if (contains === undefined || contains === null) return [];
  const items = Array.isArray(contains) ? contains : [contains];
  const PROV = /(moved from|drained to archive|raw drop|inbox|^\s*_os\/|\.md$|\.txt$|\.yaml$|^\/|\.gitkeep)/i;
  for (const it of items) {
    if (typeof it === 'string' && it.trim() && PROV.test(it)) {
      return [`${label}: bad contains (file list / path / provenance text — describe actual things inside, not 'moved from raw')`];
    }
  }
  return [];
}

export function flagInboxAnalysing(entityRoot: string, prefix: string, fq: any): void {
  const inboxYaml = path.join(entityRoot, `${prefix}-inbox.yaml`);
  const inbox = readYaml(inboxYaml) || {};
  const analysing = inbox.analysing;
  if (!analysing || typeof analysing !== 'object') return;

  if (!fq.inbox) fq.inbox = {};
  if (!fq.inbox.analysing) fq.inbox.analysing = [];

  const baseSeen = new Set<string>();
  const gw = inbox.gateway;
  if (gw && typeof gw === 'object') {
    for (const aspectMap of Object.values(gw)) {
      if (aspectMap && typeof aspectMap === 'object') {
        for (const fgMap of Object.values(aspectMap as any)) {
          if (fgMap && typeof fgMap === 'object') {
            for (const itemMap of Object.values(fgMap as any)) {
              if (itemMap && typeof itemMap === 'object') {
                for (const entry of Object.values(itemMap as any)) {
                  if (entry && typeof entry === 'object' && (entry as any).content_hash) {
                    baseSeen.add((entry as any).content_hash);
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  const rejected = inbox.rejected;
  if (rejected && typeof rejected === 'object') {
    for (const entry of Object.values(rejected)) {
      if (entry && typeof entry === 'object' && (entry as any).content_hash) {
        baseSeen.add((entry as any).content_hash);
      }
    }
  }

  const seenAnalysing = new Set<string>();

  for (const [name, entry] of Object.entries(analysing)) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as any;

    const status = String(e.status || '').toLowerCase();
    if (['routed', 'rejected', 'delivered'].includes(status)) continue;

    const label = `inbox_analysing:${name}`;
    const h = e.content_hash;

    if (h && (baseSeen.has(h) || seenAnalysing.has(h))) {
      fq.inbox.analysing.push(`${label}: dupe (content_hash ${h} already in gateway/rejected/analysing — blocked)`);
      seenAnalysing.add(h);
      continue;
    }
    if (h) {
      seenAnalysing.add(h);
    }

    for (const fl of flagMissing(e, ANALYSING_FIELDS, label)) {
      fq.inbox.analysing.push(fl);
    }
    for (const fl of flagContains(e, label)) {
      fq.inbox.analysing.push(fl);
    }
    for (const fl of flagWeakWhen(e, label)) {
      fq.inbox.analysing.push(fl);
    }

    const members = e.members || {};
    const paths = e.paths || [];
    for (const mpath of paths) {
      const mlabel = `${label}/members/${mpath}`;
      const me = members[mpath];
      if (!me || typeof me !== 'object') {
        fq.inbox.analysing.push(`${mlabel}: MISSING member record (raw_path/status/description/contains/when_to_use)`);
        continue;
      }
      for (const fl of flagMissing(me, ["raw_path", "description", "contains", "when_to_use", "status"], mlabel)) {
        fq.inbox.analysing.push(fl);
      }
      for (const fl of flagContains(me, mlabel)) {
        fq.inbox.analysing.push(fl);
      }
      for (const fl of flagWeakWhen(me, mlabel)) {
        fq.inbox.analysing.push(fl);
      }
    }

    if (!['route', 'reject'].includes(e.disposition)) {
      fq.inbox.analysing.push(`${label}: needs disposition (route | reject)`);
    }
  }
}

export function flagNeedsTasks(fq: any, entry: any, label: string): void {
  const goals = entry?.goals;
  const hasGoals = goals && typeof goals === 'object' && Object.keys(goals).length > 0;
  const tasks = entry?.tasks;
  const hasTasks = tasks && typeof tasks === 'object' && Object.keys(tasks).length > 0;
  if (hasGoals && !hasTasks) {
    if (!fq.missions) fq.missions = [];
    fq.missions.push(`${label}: needs task generation — AGENT must create tasks from goals (never programmatic)`);
  }
}

export function detectPartialFills(entityRoot: string, prefix: string, runtime: any): any {
  const fq = runtime.fill_queue || {};
  runtime.fill_queue = fq;

  const PROMPT_FIELDS = ["role", "contains", "when_to_use", "triggers"];
  const DATA_FIELDS = ["role", "description", "contains", "when_to_use", "triggers"];
  const RAW_FIELDS = ["description", "contains", "when_to_use"];
  const GW_FIELDS = ["description", "contains", "when_to_use", "extracted_concern", "source_raw_item", "members"];
  const PILLAR_FIELDS = ["description", "why", "contains", "triggers"];
  const EO_FIELDS = ["description", "objective"];
  const MISSION_FIELDS = ["proposal_name", "model", "objective", "priority", "state", "rounds"];

  const promptsYaml = path.join(entityRoot, `${prefix}-prompts.yaml`);
  const pd = readYaml(promptsYaml) || {};
  const cat = 'data';
  fq[cat] = [];

  for (const [name, entry] of Object.entries(pd)) {
    if (!entry || typeof entry !== 'object' || name === 'freshness') continue;
    const label = `${cat}:${name}`;
    const fields = DATA_FIELDS;
    for (const fl of flagMissing(entry, fields, label)) {
      fq[cat].push(fl);
    }
    for (const fl of flagWeakWhen(entry, label)) {
      fq[cat].push(fl);
    }
  }

  if (!fq.inbox) fq.inbox = {};
  fq.inbox.raw = [];
  fq.inbox.gateway = [];

  const inboxYaml = path.join(entityRoot, `${prefix}-inbox.yaml`);
  const inbox = readYaml(inboxYaml) || {};
  const raw = inbox.raw;
  if (raw && typeof raw === 'object') {
    for (const [name, entry] of Object.entries(raw)) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as any;
      const status = String(e.status || '').toLowerCase();
      if (['delivered', 'done', 'complete'].includes(status) || e.needs_semantics === false) continue;
      for (const fl of flagMissing(e, RAW_FIELDS, `inbox_raw:${name}`)) {
        fq.inbox.raw.push(fl);
      }
    }
  }

  const gw = inbox.gateway;
  if (gw && typeof gw === 'object') {
    for (const [pillar, aspects] of Object.entries(gw)) {
      if (!aspects || typeof aspects !== 'object') continue;
      for (const [aspect, fgs] of Object.entries(aspects as any)) {
        if (!fgs || typeof fgs !== 'object') continue;
        for (const [fg, items] of Object.entries(fgs as any)) {
          if (!items || typeof items !== 'object') continue;
          for (const [name, entry] of Object.entries(items as any)) {
            if (!entry || typeof entry !== 'object') continue;
            const e = entry as any;
            const glabel = `gateway:${pillar}/${aspect}/${fg}/${name}`;
            for (const fl of flagMissing(e, GW_FIELDS, glabel)) {
              fq.inbox.gateway.push(fl);
            }

            const members = e.members || {};
            const paths = e.paths || [];
            if (paths.length === 0) {
              if (Object.keys(members).length === 0) {
                fq.inbox.gateway.push(`${glabel}: needs members (merged per-member record)`);
              }
              for (const [mpath, me] of Object.entries(members)) {
                const mlabel = `${glabel}/members/${mpath}`;
                if (!me || typeof me !== 'object') {
                  fq.inbox.gateway.push(`${mlabel}: MISSING member record (raw_path/status/description/contains/when_to_use)`);
                  continue;
                }
                for (const fl of flagMissing(me, ["raw_path", "description", "contains", "when_to_use", "status"], mlabel)) {
                  fq.inbox.gateway.push(fl);
                }
              }
            } else {
              for (const mpath of paths) {
                const mlabel = `${glabel}/members/${mpath}`;
                const me = members[mpath];
                if (!me || typeof me !== 'object') {
                  fq.inbox.gateway.push(`${mlabel}: MISSING member record (raw_path/status/description/contains/when_to_use)`);
                  continue;
                }
                for (const fl of flagMissing(me, ["raw_path", "description", "contains", "when_to_use", "status"], mlabel)) {
                  fq.inbox.gateway.push(fl);
                }
              }
            }
          }
        }
      }
    }
  }

  flagInboxAnalysing(entityRoot, prefix, fq);

  if (!fq.runtime) fq.runtime = {};
  fq.runtime.pillars = [];
  const pillars = runtime.pillars;
  if (pillars && typeof pillars === 'object') {
    for (const bucketKey of ["validated", "suggestions"]) {
      const bucket = pillars[bucketKey];
      if (bucket && typeof bucket === 'object') {
        for (const [name, entry] of Object.entries(bucket)) {
          if (!entry || typeof entry !== 'object' || name === 'total' || name === 'active') continue;
          for (const fl of flagMissing(entry, PILLAR_FIELDS, `pillars.${bucketKey}:${name}`)) {
            fq.runtime.pillars.push(fl);
          }
        }
      }
    }
  }

  fq.runtime.evolution_objectives = [];
  const evo = runtime.evolution_objectives;
  if (evo && typeof evo === 'object') {
    for (const bucketKey of ["validated", "suggestions"]) {
      const bucket = evo[bucketKey];
      if (bucket && typeof bucket === 'object') {
        for (const [name, entry] of Object.entries(bucket)) {
          if (!entry || typeof entry !== 'object' || name === 'total' || name === 'active') continue;
          for (const fl of flagMissing(entry, EO_FIELDS, `evolution_objectives.${bucketKey}:${name}`)) {
            fq.runtime.evolution_objectives.push(fl);
          }
        }
      }
    }
  }

  fq.missions = [];
  const missionsYaml = path.join(entityRoot, `${prefix}-missions.yaml`);
  const md = readYaml(missionsYaml) || {};
  for (const mode of ["standard", "research", "evolution", "analytics"]) {
    const bucket = md[mode];
    if (!bucket || typeof bucket !== 'object') continue;

    if (mode === 'evolution') {
      for (const [sub, proposals] of Object.entries(bucket)) {
        if (!proposals || typeof proposals !== 'object') continue;
        for (const [pname, entry] of Object.entries(proposals as any)) {
          if (!entry || typeof entry !== 'object') continue;
          for (const fl of flagMissing(entry, MISSION_FIELDS, `missions.evolution.${sub}:${pname}`)) {
            fq.missions.push(fl);
          }
        }
      }
    } else {
      for (const [mname, entry] of Object.entries(bucket)) {
        if (!entry || typeof entry !== 'object') continue;
        for (const fl of flagMissing(entry, MISSION_FIELDS, `missions.${mode}:${mname}`)) {
          fq.missions.push(fl);
        }
        flagNeedsTasks(fq, entry, `missions.${mode}:${mname}`);
      }
    }
  }

  return fq;
}

export function checkEvolutionReadiness(missionsData: any): void {
  const evo = missionsData?.evolution;
  if (!evo || typeof evo !== 'object') return;
  for (const mode of ["FAST", "DEEP", "RESEARCH", "INBOX", "ANALYTICS"]) {
    const bucket = evo[mode];
    if (!bucket || typeof bucket !== 'object') continue;
    for (const [name, mission] of Object.entries(bucket)) {
      if (!mission || typeof mission !== 'object') continue;
      const m = mission as any;
      const state = m.state || {};
      const readiness = m.readiness || {};
      if (state.class === 'EXECUTION' && !readiness.ready_to_advance) {
        state.class = 'PLANNING';
        m.state = state;
        console.log(`[gate] Evolution '${name}' blocked: readiness.ready_to_advance is false. Reverted to PLANNING.`);
      }
    }
  }
}

export function checkArchivingGate(missionsData: any): void {
  const standard = missionsData?.standard || {};
  for (const [name, mission] of Object.entries(standard)) {
    if (!mission || typeof mission !== 'object') continue;
    const m = mission as any;
    const state = m.state || {};
    if (state.class === 'DRAFT') continue;
    if (state.progress === 'completed') {
      const tasks = m.tasks || {};
      for (const [tname, task] of Object.entries(tasks)) {
        if (task && typeof task === 'object' && (task as any).progress !== 'completed') {
          state.progress = 'in-progress';
          m.state = state;
          console.log(`[gate] Standard mission '${name}' cannot be archived: task '${tname}' is not completed.`);
          break;
        }
      }
    }
  }

  const research = missionsData?.research || {};
  for (const [name, mission] of Object.entries(research)) {
    if (!mission || typeof mission !== 'object') continue;
    const m = mission as any;
    const state = m.state || {};
    if (state.class === 'DRAFT') continue;
    if (state.progress === 'completed') {
      const topics = m.topics || {};
      for (const [tname, topic] of Object.entries(topics)) {
        if (topic && typeof topic === 'object' && (topic as any).status === false) {
          state.progress = 'in-progress';
          m.state = state;
          console.log(`[gate] Research mission '${name}' cannot be archived: topic '${tname}' is not complete.`);
          break;
        }
      }
    }
  }

  const evo = missionsData?.evolution;
  if (!evo || typeof evo !== 'object') return;
  for (const mode of ["FAST", "DEEP", "RESEARCH", "INBOX", "ANALYTICS"]) {
    const bucket = evo[mode];
    if (!bucket || typeof bucket !== 'object') continue;
    for (const [name, mission] of Object.entries(bucket)) {
      if (!mission || typeof mission !== 'object') continue;
      const m = mission as any;
      const state = m.state || {};
      if (state.class === 'DRAFT') continue;
      if (state.progress === 'completed') {
        const cases = m.cases || {};
        for (const [cname, caseObj] of Object.entries(cases)) {
          if (caseObj && typeof caseObj === 'object' && (caseObj as any).status === false) {
            state.progress = 'in-progress';
            m.state = state;
            console.log(`[gate] Evolution '${name}' cannot be archived: case '${cname}' is not complete.`);
            break;
          }
        }
      }
    }
  }
}

export function computeMetrics(runtime: any, prefix: string): any {
  const fq = runtime.fill_queue || {};
  const rq = Array.isArray(runtime.review_queue) ? runtime.review_queue : [];
  const bl = Array.isArray(runtime.backlog) ? runtime.backlog : [];
  const pl = runtime.pillars || {};
  const ev = runtime.evolution_objectives || {};

  return {
    review_queue: rq.length,
    backlog: bl.length,
    pillars: {
      actives: Array.isArray(pl.actives) ? pl.actives.length : 0,
      validated: parseInt(pl.validated?.total) || 0,
      suggestions: parseInt(pl.suggestions?.total) || 0,
    },
    evolution_objectives: {
      actives: Array.isArray(ev.actives) ? ev.actives.length : 0,
      validated: parseInt(ev.validated?.total) || 0,
      suggestions: parseInt(ev.suggestions?.total) || 0,
    },
    fill_queue: {
      os_prompts: Array.isArray(fq.os_prompts) ? fq.os_prompts.length : 0,
      data: Array.isArray(fq.data) ? fq.data.length : 0,
      missions: Array.isArray(fq.missions) ? fq.missions.length : 0,
      toolboxes: Array.isArray(fq.toolboxes) ? fq.toolboxes.length : 0,
      inbox: {
        raw: Array.isArray(fq.inbox?.raw) ? fq.inbox.raw.length : 0,
        analysing: Array.isArray(fq.inbox?.analysing) ? fq.inbox.analysing.length : 0,
        gateway: Array.isArray(fq.inbox?.gateway) ? fq.inbox.gateway.length : 0,
      },
      runtime: {
        pillars: Array.isArray(fq.runtime?.pillars) ? fq.runtime.pillars.length : 0,
        evolution_objectives: Array.isArray(fq.runtime?.evolution_objectives) ? fq.runtime.evolution_objectives.length : 0,
      },
    },
  };
}

export function syncEntity(name: string, root: string): void {
  const prefix = name;
  const sig = getEntitySig(name, root, prefix);
  if (_sync_sig.get(name) === sig) {
    return;
  }
  _sync_sig.set(name, sig);

  const runtimePath = path.join(root, `${prefix}-runtime.yaml`);
  const runtime = readYaml(runtimePath);
  if (!runtime || Object.keys(runtime).length === 0) return;
  const oldRuntime = JSON.parse(JSON.stringify(runtime));

  runtime.fill_queue = detectFillGaps(root, prefix);

  snapshotRawArchive(root, prefix);

  const inboxYaml = path.join(root, `${prefix}-inbox.yaml`);
  writeDiscovery(inboxYaml, prefix);

  routeAnalysingToGateway(inboxYaml, prefix);

  detectEmptySections(runtime);

  const tbPath = path.join(root, `${prefix}-toolboxes.yaml`);
  const tbData = readYaml(tbPath) || {};
  const tbFlags = reconcileToolboxes(root, prefix, tbData);
  runtime.fill_queue.toolboxes = tbFlags;
  smartWrite(tbPath, readYaml(tbPath), tbData);

  detectPartialFills(root, prefix, runtime);

  const ev = runtime.recent_events;
  if (Array.isArray(ev)) {
    const norm: string[] = [];
    for (const e of ev) {
      if (typeof e === 'string') {
        norm.push(e);
      } else if (e && typeof e === 'object' && e.event) {
        let t = e.time || '';
        if (t) {
          try {
            const dt = new Date(t);
            const pad = (n: number) => n.toString().padStart(2, '0');
            t = `${pad(dt.getDate())}-${pad(dt.getMonth() + 1)}-${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
          } catch {
            t = String(t);
          }
        }
        norm.push(`${t} "${e.event}"`.trim());
      }
    }
    runtime.recent_events = norm.slice(0, 10);
  }

  runtime.metrics = computeMetrics(runtime, prefix);

  scaffoldAllGaps(root, prefix, runtime.fill_queue);

  const ordered = {
    freshness: runtime.freshness || {},
    metrics: runtime.metrics || {},
    review_queue: runtime.review_queue || [],
    backlog: runtime.backlog || [],
    pillars: runtime.pillars || {},
    evolution_objectives: runtime.evolution_objectives || {},
    fill_queue: runtime.fill_queue || {},
    recent_events: runtime.recent_events || [],
  };

  smartWrite(runtimePath, oldRuntime, ordered);

  const miscFiles = [`${prefix}-missions.yaml`, `${prefix}-inbox.yaml`];
  for (const fn of miscFiles) {
    const p = path.join(root, fn);
    const data = readYaml(p);
    if (!data || Object.keys(data).length === 0) continue;
    const oldData = JSON.parse(JSON.stringify(data));
    if (fn.endsWith('-missions.yaml')) {
      checkEvolutionReadiness(data);
      checkArchivingGate(data);
    }
    smartWrite(p, oldData, data);
  }

  console.log(`[sync] ${name} @ ${new Date().toISOString()}`);
}

const CONFIG_FILE = path.join(process.cwd(), "config.yaml");
const INDEX_FILE = path.join(process.cwd(), "index.yaml");

export function syncCycle(): void {
  const config = readYaml(CONFIG_FILE);
  if (!config || config.sync_daemon === false) {
    return;
  }
  const oldConfig = JSON.parse(JSON.stringify(config));
  smartWrite(CONFIG_FILE, oldConfig, config);

  const idx = readYaml(INDEX_FILE);
  if (idx && Object.keys(idx).length > 0) {
    const oldIdx = JSON.parse(JSON.stringify(idx));
    smartWrite(INDEX_FILE, oldIdx, idx);
  }

  // 2. Enqueue each tenant's entity sync task separately to run in parallel
  const ents = listEntities(config);
  for (const [name, rootPath] of ents) {
    orchestrator.enqueue(name, 'sync', `Sync and Reconcile Tenant Workspace [${name}]`, async () => {
      syncEntity(name, rootPath);
    });
  }
}
