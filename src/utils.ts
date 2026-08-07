import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import YAML from 'yaml';

export const FIXED_ASPECTS = ["Architecture", "Capabilities", "Monetization"];
export const ANALYSING_FIELDS = ["description", "contains", "when_to_use"];

export function nowIso(): string {
  return new Date().toISOString();
}

export function readYaml(filePath: string): any {
  try {
    if (fs.existsSync(filePath)) {
      const text = fs.readFileSync(filePath, 'utf8');
      return YAML.parse(text) || {};
    }
  } catch (e: any) {
    console.error(`[read] ${filePath}: ${e.message}`);
  }
  return {};
}

export function writeYaml(filePath: string, data: any): void {
  const dir = path.dirname(filePath);
  const tempPath = path.join(dir, `.tmp_${path.basename(filePath)}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const text = YAML.stringify(data, { indent: 2, lineWidth: 4096 });
    fs.writeFileSync(tempPath, text, 'utf8');
    fs.renameSync(tempPath, filePath);
  } catch (e: any) {
    console.error(`[write] ${filePath}: ${e.message}`);
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch {}
    }
  }
}

export function stripFreshness(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(stripFreshness);
  }
  const result: any = {};
  for (const key of Object.keys(obj)) {
    if (key !== 'freshness') {
      result[key] = stripFreshness(obj[key]);
    }
  }
  return result;
}

export function hasRealChange(oldData: any, newData: any): boolean {
  return JSON.stringify(stripFreshness(oldData)) !== JSON.stringify(stripFreshness(newData));
}

export function stampFreshness(block: any): any {
  if (!block || typeof block !== 'object') block = {};
  const fr = block.freshness || {};
  fr.sync_status = 'fresh';
  fr.sync_count = (parseInt(fr.sync_count) || 0) + 1;
  fr.last_synced = nowIso();
  block.freshness = fr;
  return block;
}

export function smartWrite(filePath: string, oldData: any, newData: any): boolean {
  if (hasRealChange(oldData, newData)) {
    stampFreshness(newData);
    writeYaml(filePath, newData);
    return true;
  }
  return false;
}

export function rglobFiles(dirPath: string, rootDir: string): string[] {
  const result: string[] = [];
  function traverse(cur: string) {
    if (!fs.existsSync(cur)) return;
    const stats = fs.statSync(cur);
    if (stats.isDirectory()) {
      for (const child of fs.readdirSync(cur)) {
        if (child.startsWith('.')) continue;
        traverse(path.join(cur, child));
      }
    } else if (stats.isFile()) {
      result.push(path.relative(rootDir, cur).replace(/\\/g, '/'));
    }
  }
  traverse(dirPath);
  return result;
}

export function copyRecursiveSync(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursiveSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export function _isEmpty(v: any): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v).length === 0;
  return false;
}

export const _WEAK_WHEN = /^\s*(use this skill when|use this when|when the task involves|when the task involves)\b/i;

export function setNestedValue(obj: any, ypath: string[], value: any) {
  let node = obj;
  for (let i = 0; i < ypath.length - 1; i++) {
    const k = ypath[i];
    if (!node[k] || typeof node[k] !== 'object') {
      node[k] = {};
    }
    node = node[k];
  }
  node[ypath[ypath.length - 1]] = value;
}

export function getNestedValue(obj: any, ypath: string[]): any {
  let node = obj;
  for (const k of ypath) {
    if (!node || typeof node !== 'object') return undefined;
    node = node[k];
  }
  return node;
}

export function getTbDiskPath(root: string, prefix: string, kind: string, parents: string[], name: string): string {
  // Always use workspace .pi/skills and .pi/extensions for skills and extensions
  if (kind === 'skill') {
    return path.join(root, '.pi', 'skills', name);
  }
  if (kind === 'plugin' || kind === 'mcp' || kind === 'extension') {
    return path.join(root, '.pi', 'extensions');
  }

  const systemsDir = path.join(root, 'systems');
  const base = fs.existsSync(systemsDir)
    ? path.join(systemsDir, `.${prefix}-toolboxes`)
    : path.join(root, `.${prefix}-toolboxes`);

  if (kind === 'domain') {
    return path.join(base, name);
  }
  if (kind === 'toolbox') {
    return path.join(base, parents[0] || 'domain_general', name);
  }
  if (kind === 'agent') {
    return path.join(base, parents[0] || 'domain_general', parents[1] || 'system_mcp', 'agents', name);
  }
  if (kind === 'skill') {
    return path.join(base, parents[0] || 'domain_general', parents[1] || 'system_mcp', 'skills', name);
  }
  if (kind === 'plugin' || kind === 'mcp' || kind === 'enterprise_tool' || kind === 'website_connection') {
    return path.join(base, 'plugins', name);
  }
  return path.join(base, name);
}

export function getTbYamlPath(kind: string, parents: string[], name: string): string[] {
  if (kind === 'domain') {
    return ["toolboxes", name];
  }
  if (kind === 'toolbox') {
    return ["toolboxes", parents[0], "toolboxes", name];
  }
  if (kind === 'agent') {
    return ["toolboxes", parents[0], "toolboxes", parents[1], "agents", name];
  }
  if (kind === 'skill') {
    return ["toolboxes", parents[0], "toolboxes", parents[1], "skills", name];
  }
  throw new Error(`unknown kind '${kind}'`);
}
