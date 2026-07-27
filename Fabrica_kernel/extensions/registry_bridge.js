import fs from 'fs';
import path from 'path';

/**
 * Fabrica Programmatic Registry Bridge Extension for PI Agent
 * Dynamically queries, indexes, and exports the live Skill & Extension Registry
 * for both Kernel (built-in) and Workspace (.pi/) capabilities.
 */
export function buildProgrammaticRegistry(tenantId = 'default_user') {
  const cwd = process.cwd();

  const kernelSkillsDir = path.join(cwd, 'Fabrica_kernel', 'skills');
  const kernelExtDir = path.join(cwd, 'Fabrica_kernel', 'extensions');

  const userPiSkillsDir = path.join(cwd, 'workspaces', tenantId, '.pi', 'skills');
  const userPiExtDir = path.join(cwd, 'workspaces', tenantId, '.pi', 'extensions');

  const skillsRegistry = {};
  const extensionsRegistry = {};

  // 1. Programmatically Index Kernel Built-in Skills
  if (fs.existsSync(kernelSkillsDir)) {
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
          else desc = text.slice(0, 180).replace(/^[#\s]+/, '');
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
  }

  // 2. Programmatically Index Workspace Custom Skills (.pi/skills)
  if (fs.existsSync(userPiSkillsDir)) {
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
          desc = text.slice(0, 200).replace(/^[#\s]+/, '');
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
  }

  // 3. Programmatically Index Kernel Built-in Extensions
  if (fs.existsSync(kernelExtDir)) {
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
  }

  // 4. Programmatically Index Workspace Custom Extensions (.pi/extensions)
  if (fs.existsSync(userPiExtDir)) {
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
  }

  return {
    skills: skillsRegistry,
    extensions: extensionsRegistry
  };
}

export default function registryBridgeExtension(pi) {
  if (!pi || typeof pi.on !== 'function') return;

  pi.on('session_start', async (event, ctx) => {
    const tenantId = ctx?.tenantId || 'default_user';
    buildProgrammaticRegistry(tenantId);
  });
}
