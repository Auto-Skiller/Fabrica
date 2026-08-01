import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Fabrica Programmatic Registry Bridge Extension for PI Agent
 * Dynamically queries, indexes, and exports the live Skill & Extension Registry
 * for both Kernel (built-in) and Workspace (.pi/) capabilities.
 */
export function buildProgrammaticRegistry(tenantId = 'default_user', customCwd) {
  const cwd = customCwd || process.cwd();
  
  // Find root directory containing Fabrica_kernel
  let rootDir = cwd;
  if (!fs.existsSync(path.join(rootDir, 'Fabrica_kernel'))) {
    rootDir = path.resolve(__dirname, '..', '..');
  }

  const kernelSkillsDir = path.join(rootDir, 'Fabrica_kernel', 'skills');
  const kernelExtDir = path.join(rootDir, 'Fabrica_kernel', 'extensions');

  const userPiSkillsDir = path.join(rootDir, 'workspaces', tenantId, '.pi', 'skills');
  const userPiExtDir = path.join(rootDir, 'workspaces', tenantId, '.pi', 'extensions');

  const skillsRegistry = {};
  const extensionsRegistry = {};

  // 1. Programmatically Index Kernel Built-in Skills
  if (fs.existsSync(kernelSkillsDir)) {
    try {
      const kSkills = fs.readdirSync(kernelSkillsDir).filter(f => {
        try { return fs.statSync(path.join(kernelSkillsDir, f)).isDirectory(); } catch { return false; }
      });

      for (const ksName of kSkills) {
        const ksDir = path.join(kernelSkillsDir, ksName);
        const skillMdPath = path.join(ksDir, 'SKILL.md');
        let desc = 'Kernel built-in capability';
        let whenToUse = 'Built-in system capability';

        if (fs.existsSync(skillMdPath)) {
          try {
            const text = fs.readFileSync(skillMdPath, 'utf8');
            const lines = text.split('\n');
            const whatLine = lines.find(l => l.includes('- **What**:') || l.includes('What:'));
            const whenLine = lines.find(l => l.includes('- **When**:') || l.includes('When:'));
            if (whatLine) desc = whatLine.replace(/.*(?:What\*\*:|What:)/, '').trim();
            else desc = text.slice(0, 180).replace(/^[#\s]+/, '').replace(/\n/g, ' ');
            if (whenLine) whenToUse = whenLine.replace(/.*(?:When\*\*:|When:)/, '').trim();
          } catch {}
        }

        skillsRegistry[ksName] = {
          name: ksName,
          source: 'built-in',
          read_only: true,
          maturity: 'battle-tested',
          role: 'Kernel System Skill',
          description: desc,
          when_to_use: whenToUse,
          path: ksDir
        };
      }
    } catch (err) {
      console.warn('[registry_bridge] Error indexing kernel skills:', err.message);
    }
  }

  // 2. Programmatically Index Workspace Custom Skills (.pi/skills & project system skills)
  if (fs.existsSync(userPiSkillsDir)) {
    try {
      const customSkills = fs.readdirSync(userPiSkillsDir).filter(f => {
        try { return fs.statSync(path.join(userPiSkillsDir, f)).isDirectory(); } catch { return false; }
      });

      for (const csName of customSkills) {
        const csDir = path.join(userPiSkillsDir, csName);
        const skillMdPath = path.join(csDir, 'SKILL.md');
        let desc = 'Custom workspace skill';
        const whenToUse = 'User and agent executable custom skill';

        if (fs.existsSync(skillMdPath)) {
          try {
            const text = fs.readFileSync(skillMdPath, 'utf8');
            desc = text.slice(0, 200).replace(/^[#\s]+/, '').replace(/\n/g, ' ');
          } catch {}
        }

        skillsRegistry[csName] = {
          name: csName,
          source: 'workspace',
          read_only: false,
          maturity: 'functional',
          role: 'Workspace Skill',
          description: desc,
          when_to_use: whenToUse,
          path: csDir
        };
      }
    } catch (err) {
      console.warn('[registry_bridge] Error indexing workspace skills:', err.message);
    }
  }

  // 3. Programmatically Index Kernel Built-in Extensions
  if (fs.existsSync(kernelExtDir)) {
    try {
      const kExts = fs.readdirSync(kernelExtDir);
      for (const extItem of kExts) {
        const extName = extItem.replace(/\.(js|ts)$/, '');
        extensionsRegistry[extName] = {
          name: extName,
          source: 'built-in',
          read_only: true,
          endpoint: 'Kernel System Extension',
          description: `Built-in kernel extension runtime (${extItem})`,
          status: true
        };
      }
    } catch (err) {
      console.warn('[registry_bridge] Error indexing kernel extensions:', err.message);
    }
  }

  // 4. Programmatically Index Workspace Custom Extensions (.pi/extensions & project system extensions)
  if (fs.existsSync(userPiExtDir)) {
    try {
      const userExts = fs.readdirSync(userPiExtDir);
      for (const uExtItem of userExts) {
        const uExtName = uExtItem.replace(/\.(js|ts)$/, '');
        extensionsRegistry[uExtName] = {
          name: uExtName,
          source: 'workspace',
          read_only: false,
          endpoint: 'Workspace Extension',
          description: `User workspace custom extension (${uExtItem})`,
          status: true
        };
      }
    } catch (err) {
      console.warn('[registry_bridge] Error indexing workspace extensions:', err.message);
    }
  }

  return {
    skills: skillsRegistry,
    extensions: extensionsRegistry
  };
}

export default function registryBridgeExtension(pi) {
  if (!pi || typeof pi.on !== 'function') return;

  pi.on('before_agent_start', async (event, ctx) => {
    try {
      const tenantId = ctx?.tenantId || 'default_user';
      const registry = buildProgrammaticRegistry(tenantId, ctx?.cwd);

      const skillKeys = Object.keys(registry.skills);
      const extKeys = Object.keys(registry.extensions);

      let summary = '# Active Capability Registry Index\n\n';
      summary += `### Registered Skills (${skillKeys.length})\n`;
      for (const key of skillKeys) {
        const s = registry.skills[key];
        summary += `- **${s.name}** [${s.source}]: ${s.description}\n`;
      }

      summary += `\n### Active Extensions (${extKeys.length})\n`;
      for (const key of extKeys) {
        const e = registry.extensions[key];
        summary += `- **${e.name}** [${e.source}]: ${e.description}\n`;
      }

      const basePrompt = event.systemPrompt || '';
      return {
        systemPrompt: `${basePrompt}\n\n---\n\n${summary}`
      };
    } catch (err) {
      console.warn('[registry_bridge] Failed injecting capability registry summary:', err.message);
    }
  });
}

