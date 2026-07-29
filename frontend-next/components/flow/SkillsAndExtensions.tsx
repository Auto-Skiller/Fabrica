'use client';

import { useState, useMemo, useEffect } from 'react';
import { ToolboxesYaml } from '../../lib/types';
import { api } from '../../lib/api';

interface Props {
  entityName: string;
  toolboxes: ToolboxesYaml;
  onRefresh?: () => void;
  showToast?: (message: string, type: 'success' | 'info' | 'error') => void;
}

export interface SkillMetadata {
  what: string;
  when: string;
  why: string;
  triggers: string;
  inputs: string;
  outputs: string;
}

export function parseSkillMd(content: string, defaultFolder: string = ''): { metadata: SkillMetadata; body: string } {
  const metadata: SkillMetadata = {
    what: '',
    when: '',
    why: '',
    triggers: '',
    inputs: '',
    outputs: ''
  };

  let body = content || '';
  if (!content) return { metadata, body: '' };

  // 1. YAML Frontmatter Parsing
  if (content.trim().startsWith('---')) {
    const endYaml = content.indexOf('---', 3);
    if (endYaml !== -1) {
      const yamlStr = content.slice(3, endYaml);
      body = content.slice(endYaml + 3).trim();

      const lines = yamlStr.split('\n');
      for (const line of lines) {
        const idx = line.indexOf(':');
        if (idx !== -1) {
          const key = line.slice(0, idx).trim().toLowerCase();
          const val = line.slice(idx + 1).trim();
          if ((key === 'what' || key === 'description' || key === 'name') && !metadata.what) metadata.what = val;
          if ((key === 'when' || key === 'when_to_use') && !metadata.when) metadata.when = val;
          if ((key === 'why' || key === 'rationale' || key === 'purpose') && !metadata.why) metadata.why = val;
          if ((key === 'triggers' || key === 'trigger_keywords' || key === 'keywords') && !metadata.triggers) metadata.triggers = val;
          if ((key === 'inputs' || key === 'input' || key === 'params') && !metadata.inputs) metadata.inputs = val;
          if ((key === 'outputs' || key === 'output' || key === 'results') && !metadata.outputs) metadata.outputs = val;
        }
      }
      return { metadata, body };
    }
  }

  // 2. ## Metadata Section Parsing
  const metaMatch = content.match(/##\s*Metadata\s*([\s\S]*?)(?=(?:\n#+|\n\n#+|$))/i);
  if (metaMatch) {
    const metaBlock = metaMatch[1];
    body = content.replace(/##\s*Metadata\s*[\s\S]*?(?=(?:\n#+|\n\n#+|$))/i, '').trim();

    const lines = metaBlock.split('\n');
    for (const line of lines) {
      const cleanLine = line.replace(/^[*\-\s]+/, '').trim();
      const idx = cleanLine.indexOf(':');
      if (idx !== -1) {
        const key = cleanLine.slice(0, idx).replace(/\*/g, '').trim().toLowerCase();
        const val = cleanLine.slice(idx + 1).replace(/\*/g, '').trim();
        if ((key === 'what' || key === 'description') && !metadata.what) metadata.what = val;
        if ((key === 'when' || key === 'when_to_use') && !metadata.when) metadata.when = val;
        if ((key === 'why' || key === 'rationale' || key === 'purpose') && !metadata.why) metadata.why = val;
        if ((key === 'triggers' || key === 'trigger keywords' || key === 'trigger_keywords' || key === 'keywords') && !metadata.triggers) metadata.triggers = val;
        if ((key === 'inputs' || key === 'input' || key === 'params') && !metadata.inputs) metadata.inputs = val;
        if ((key === 'outputs' || key === 'output' || key === 'results') && !metadata.outputs) metadata.outputs = val;
      }
    }
    return { metadata, body };
  }

  return { metadata, body };
}

export function serializeSkillMd(metadata: SkillMetadata, body: string): string {
  return `## Metadata
- **What**: ${metadata.what || ''}
- **When**: ${metadata.when || ''}
- **Why**: ${metadata.why || ''}
- **Triggers**: ${metadata.triggers || ''}
- **Inputs**: ${metadata.inputs || ''}
- **Outputs**: ${metadata.outputs || ''}

# Skill Body
${body || ''}`;
}

// Tree Node interface & Helper
export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children: TreeNode[];
}

export function buildFileTree(items: Array<{ name: string; path: string; type: 'file' | 'folder' }>): TreeNode[] {
  const root: TreeNode[] = [];
  const map: { [path: string]: TreeNode } = {};

  const sorted = [...items].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.path.localeCompare(b.path);
  });

  for (const item of sorted) {
    const parts = item.path.split('/');
    const node: TreeNode = {
      name: item.name,
      path: item.path,
      type: item.type,
      children: []
    };
    map[item.path] = node;

    if (parts.length === 1) {
      root.push(node);
    } else {
      const parentPath = parts.slice(0, parts.length - 1).join('/');
      if (map[parentPath]) {
        map[parentPath].children.push(node);
      } else {
        root.push(node);
      }
    }
  }

  return root;
}

const iconBtnStyle: React.CSSProperties = {
  fontSize: '7.5px',
  fontWeight: 700,
  padding: '1px 5px',
  background: 'var(--surface-alt)',
  border: '1px solid var(--border-soft)',
  borderRadius: '3px',
  color: 'var(--text)',
  cursor: 'pointer'
};

// Component: Recursive Directory Tree View
export function DirectoryTreeView({
  nodes,
  level = 0,
  activePath,
  onSelectFile,
  editable,
  onAddFile,
  onAddFolder,
  onRename,
  onDelete
}: {
  nodes: TreeNode[];
  level?: number;
  activePath?: string;
  onSelectFile?: (path: string) => void;
  editable?: boolean;
  onAddFile?: (parentPath: string) => void;
  onAddFolder?: (parentPath: string) => void;
  onRename?: (oldPath: string) => void;
  onDelete?: (path: string) => void;
}) {
  if (!nodes || nodes.length === 0) {
    return <div style={{ fontSize: '8px', color: 'var(--muted)', paddingLeft: level ? `${level * 10}px` : '0px' }}>Empty directory</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: level ? `${level * 10}px` : '0px' }}>
      {nodes.map(node => (
        <div key={node.path} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '2px 5px',
              borderRadius: '3px',
              background: activePath === node.path ? 'rgba(192, 132, 252, 0.2)' : 'transparent',
              cursor: node.type === 'file' ? 'pointer' : 'default',
              fontSize: '8.5px',
              fontFamily: 'var(--mono)'
            }}
            onClick={() => {
              if (node.type === 'file' && onSelectFile) onSelectFile(node.path);
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
              <span>{node.type === 'folder' ? '📁' : '📄'}</span>
              <span style={{ fontWeight: activePath === node.path ? 800 : 500, color: 'var(--text)' }}>
                {node.name}
              </span>
            </div>

            {editable && (
              <div style={{ display: 'flex', gap: '3px' }} onClick={e => e.stopPropagation()}>
                {node.type === 'folder' && (
                  <>
                    <button title="Add file" onClick={() => onAddFile && onAddFile(node.path)} style={iconBtnStyle}>+📄</button>
                    <button title="Add folder" onClick={() => onAddFolder && onAddFolder(node.path)} style={iconBtnStyle}>+📁</button>
                  </>
                )}
                <button title="Rename" onClick={() => onRename && onRename(node.path)} style={iconBtnStyle}>✏️</button>
                {node.path !== 'SKILL.md' && (
                  <button title="Delete" onClick={() => onDelete && onDelete(node.path)} style={iconBtnStyle}>🗑️</button>
                )}
              </div>
            )}
          </div>

          {node.type === 'folder' && node.children.length > 0 && (
            <DirectoryTreeView
              nodes={node.children}
              level={level + 1}
              activePath={activePath}
              onSelectFile={onSelectFile}
              editable={editable}
              onAddFile={onAddFile}
              onAddFolder={onAddFolder}
              onRename={onRename}
              onDelete={onDelete}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// --------------------------------------------------
// CARD 1: Built-in Extension Card
// Shows ONLY extension name, NO inspecting.
// --------------------------------------------------
function BuiltInExtensionCard({ name }: { name: string }) {
  return (
    <div style={{
      background: 'var(--surface-alt)',
      border: '1px solid var(--border-soft)',
      borderRadius: 'var(--radius-md)',
      padding: '12px',
      display: 'flex',
      alignItems: 'center'
    }}>
      <b style={{ fontSize: '11px', color: 'var(--text)' }}>{name}</b>
    </div>
  );
}

// --------------------------------------------------
// CARD 2: Workspace Extension Card
// Shows ONLY editable extension name + inspect button.
// --------------------------------------------------
function WorkspaceExtensionCard({
  entityName,
  id,
  onInspect,
  onRefresh,
  showToast
}: {
  entityName: string;
  id: string;
  onInspect: () => void;
  onRefresh?: () => void;
  showToast?: (msg: string, type?: 'success' | 'info' | 'error') => void;
}) {
  const [extName, setExtName] = useState(id);

  const handleRename = async (newName: string) => {
    if (!newName.trim() || newName === id) return;
    const clean = newName.trim().replace(/[^a-zA-Z0-9_\-]/g, '_');
    try {
      await api.renameSkillFolder(entityName, 'plugin', [], id, clean, 'workspace');
      setExtName(clean);
      if (onRefresh) onRefresh();
      if (showToast) showToast(`Extension renamed to '${clean}'`, 'success');
    } catch (e: any) {
      if (showToast) showToast(e.message || 'Failed to rename extension', 'error');
    }
  };

  return (
    <div style={{
      background: 'var(--surface-alt)',
      border: '1px solid rgba(6, 182, 212, 0.4)',
      borderRadius: 'var(--radius-md)',
      padding: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '10px'
    }}>
      <input
        type="text"
        value={extName}
        onChange={(e) => setExtName(e.target.value)}
        onBlur={(e) => handleRename(e.target.value)}
        style={{
          fontSize: '11px',
          fontWeight: 700,
          background: 'var(--surface)',
          border: '1px solid var(--border-soft)',
          borderRadius: '4px',
          color: 'var(--text)',
          padding: '4px 8px',
          flex: 1
        }}
      />
      <button
        onClick={onInspect}
        style={{
          fontSize: '9px',
          fontWeight: 700,
          padding: '4px 10px',
          background: '#06b6d4',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        🔍 Inspect
      </button>
    </div>
  );
}

// --------------------------------------------------
// CARD 3: Built-in Skill Card
// Shows ONLY skill name + 6 fields + directory structure directly on card.
// NO inspecting.
// --------------------------------------------------
function BuiltInSkillCard({
  entityName,
  skillName,
  parents
}: {
  entityName: string;
  skillName: string;
  parents: string[];
}) {
  const [files, setFiles] = useState<Array<{ name: string; path: string; type: 'file' | 'folder'; content?: string }>>([]);
  const [metadata, setMetadata] = useState<SkillMetadata>({
    what: '', when: '', why: '', triggers: '', inputs: '', outputs: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.getToolboxFiles(entityName, 'skill', parents, skillName, 'built-in').then(res => {
      if (active && res.ok && res.files) {
        setFiles(res.files);
        const skillMd = res.files.find(f => f.path === 'SKILL.md' || f.name === 'SKILL.md');
        if (skillMd && skillMd.content) {
          const parsed = parseSkillMd(skillMd.content, skillName);
          setMetadata(parsed.metadata);
        }
      }
    }).catch(console.error).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [entityName, skillName, parents]);

  const tree = useMemo(() => buildFileTree(files), [files]);

  return (
    <div style={{
      background: 'var(--surface-alt)',
      border: '1px solid var(--border-soft)',
      borderRadius: 'var(--radius-md)',
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    }}>
      {/* 1. Skill Name */}
      <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text)' }}>
        📁 {skillName}
      </div>

      {/* 2. The 6 Fields */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', background: 'var(--surface)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-soft)' }}>
        <div style={{ fontSize: '8.5px', color: 'var(--text)' }}><b>What:</b> <span style={{ color: 'var(--muted)' }}>{metadata.what || 'N/A'}</span></div>
        <div style={{ fontSize: '8.5px', color: 'var(--text)' }}><b>When:</b> <span style={{ color: 'var(--muted)' }}>{metadata.when || 'N/A'}</span></div>
        <div style={{ fontSize: '8.5px', color: 'var(--text)' }}><b>Why:</b> <span style={{ color: 'var(--muted)' }}>{metadata.why || 'N/A'}</span></div>
        <div style={{ fontSize: '8.5px', color: 'var(--text)' }}><b>Triggers:</b> <span style={{ color: 'var(--muted)' }}>{metadata.triggers || 'N/A'}</span></div>
        <div style={{ fontSize: '8.5px', color: 'var(--text)' }}><b>Inputs:</b> <span style={{ color: 'var(--muted)' }}>{metadata.inputs || 'N/A'}</span></div>
        <div style={{ fontSize: '8.5px', color: 'var(--text)' }}><b>Outputs:</b> <span style={{ color: 'var(--muted)' }}>{metadata.outputs || 'N/A'}</span></div>
      </div>

      {/* 3. Skill Folder & Files Directory Structure */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--surface)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-soft)' }}>
        <div style={{ fontSize: '8px', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>
          Directory Structure
        </div>
        {loading ? (
          <span style={{ fontSize: '8px', color: 'var(--muted)' }}>Loading directory...</span>
        ) : (
          <DirectoryTreeView nodes={tree} editable={false} />
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------
// CARD 4: Workspace Skill Card
// Shows ONLY editable skill name + 6 editable fields + editable directory structure directly on card + inspect button.
// --------------------------------------------------
function WorkspaceSkillCard({
  entityName,
  skillName,
  parents,
  onInspect,
  onRefresh,
  showToast
}: {
  entityName: string;
  skillName: string;
  parents: string[];
  onInspect: () => void;
  onRefresh?: () => void;
  showToast?: (msg: string, type?: 'success' | 'info' | 'error') => void;
}) {
  const [folderName, setFolderName] = useState(skillName);
  const [files, setFiles] = useState<Array<{ name: string; path: string; type: 'file' | 'folder'; content?: string }>>([]);
  const [metadata, setMetadata] = useState<SkillMetadata>({
    what: '', when: '', why: '', triggers: '', inputs: '', outputs: ''
  });
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);

  const loadFiles = async () => {
    try {
      const res = await api.getToolboxFiles(entityName, 'skill', parents, folderName, 'workspace');
      if (res.ok && res.files) {
        setFiles(res.files);
        const skillMd = res.files.find(f => f.path === 'SKILL.md' || f.name === 'SKILL.md');
        if (skillMd && skillMd.content) {
          const parsed = parseSkillMd(skillMd.content, folderName);
          setMetadata(parsed.metadata);
          setBody(parsed.body);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [entityName, folderName]);

  const tree = useMemo(() => buildFileTree(files), [files]);

  const handleRenameFolder = async (newName: string) => {
    if (!newName.trim() || newName === folderName) return;
    const clean = newName.trim().replace(/[^a-zA-Z0-9_\-]/g, '_');
    try {
      await api.renameSkillFolder(entityName, 'skill', parents, folderName, clean, 'workspace');
      setFolderName(clean);
      if (onRefresh) onRefresh();
      if (showToast) showToast(`Skill renamed to '${clean}'`, 'success');
    } catch (e: any) {
      if (showToast) showToast(e.message || 'Failed to rename skill', 'error');
    }
  };

  const handleUpdateField = async (field: keyof SkillMetadata, value: string) => {
    const updated = { ...metadata, [field]: value };
    setMetadata(updated);
    const content = serializeSkillMd(updated, body);
    try {
      await api.saveToolboxFile(entityName, 'skill', parents, folderName, 'SKILL.md', content, 'workspace');
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddFile = async (parentFolder = '') => {
    const name = prompt('Enter filename (e.g. helper.ts):');
    if (!name || !name.trim()) return;
    const relPath = parentFolder ? `${parentFolder}/${name.trim()}` : name.trim();
    try {
      await api.saveToolboxFile(entityName, 'skill', parents, folderName, relPath, '// New file\n', 'workspace');
      await loadFiles();
      if (showToast) showToast(`Created file '${relPath}'`, 'success');
    } catch (e: any) {
      if (showToast) showToast(e.message || 'Error creating file', 'error');
    }
  };

  const handleAddFolder = async (parentFolder = '') => {
    const folder = prompt('Enter folder name:');
    if (!folder || !folder.trim()) return;
    const relPath = parentFolder ? `${parentFolder}/${folder.trim()}` : folder.trim();
    try {
      await api.createToolboxFolder(entityName, 'skill', parents, folderName, relPath, 'workspace');
      await api.saveToolboxFile(entityName, 'skill', parents, folderName, `${relPath}/.gitkeep`, '', 'workspace');
      await loadFiles();
      if (showToast) showToast(`Created folder '${relPath}'`, 'success');
    } catch (e: any) {
      if (showToast) showToast(e.message || 'Error creating folder', 'error');
    }
  };

  const handleRenamePath = async (oldPath: string) => {
    const newPath = prompt('Enter new path:', oldPath);
    if (!newPath || !newPath.trim() || newPath === oldPath) return;
    try {
      await api.renameToolboxFile(entityName, 'skill', parents, folderName, oldPath, newPath.trim(), 'workspace');
      await loadFiles();
      if (showToast) showToast(`Renamed '${oldPath}' -> '${newPath.trim()}'`, 'success');
    } catch (e: any) {
      if (showToast) showToast(e.message || 'Error renaming', 'error');
    }
  };

  const handleDeletePath = async (relPath: string) => {
    if (relPath === 'SKILL.md') return;
    if (!confirm(`Delete '${relPath}'?`)) return;
    try {
      await api.deleteToolboxFile(entityName, 'skill', parents, folderName, relPath, 'workspace');
      await loadFiles();
      if (showToast) showToast(`Deleted '${relPath}'`, 'success');
    } catch (e: any) {
      if (showToast) showToast(e.message || 'Error deleting', 'error');
    }
  };

  return (
    <div style={{
      background: 'var(--surface-alt)',
      border: '1px solid rgba(192, 132, 252, 0.4)',
      borderRadius: 'var(--radius-md)',
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    }}>
      {/* 1. Skill Name (Editable) + Inspect Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <input
          type="text"
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          onBlur={(e) => handleRenameFolder(e.target.value)}
          style={{
            fontSize: '11px',
            fontWeight: 800,
            background: 'var(--surface)',
            border: '1px solid var(--border-soft)',
            borderRadius: '4px',
            color: 'var(--text)',
            padding: '4px 8px',
            flex: 1
          }}
        />
        <button
          onClick={onInspect}
          style={{
            fontSize: '9px',
            fontWeight: 700,
            padding: '4px 10px',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          🔍 Inspect
        </button>
      </div>

      {/* 2. The 6 Fields (Editable) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', background: 'var(--surface)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-soft)' }}>
        {(['what', 'when', 'why', 'triggers', 'inputs', 'outputs'] as Array<keyof SkillMetadata>).map(field => (
          <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label style={{ fontSize: '7.5px', color: 'var(--muted)', fontWeight: 800, textTransform: 'uppercase' }}>
              {field}
            </label>
            <input
              type="text"
              value={metadata[field] || ''}
              onChange={(e) => handleUpdateField(field, e.target.value)}
              style={{
                fontSize: '8.5px',
                padding: '3px 6px',
                background: 'var(--surface-alt)',
                border: '1px solid var(--border-soft)',
                borderRadius: '3px',
                color: 'var(--text)'
              }}
            />
          </div>
        ))}
      </div>

      {/* 3. Skill Folder & Files Directory Structure (Editable) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--surface)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-soft)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '8px', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>
            Directory Structure
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={() => handleAddFile('')} style={iconBtnStyle}>+📄 File</button>
            <button onClick={() => handleAddFolder('')} style={iconBtnStyle}>+📁 Folder</button>
          </div>
        </div>

        {loading ? (
          <span style={{ fontSize: '8px', color: 'var(--muted)' }}>Loading directory...</span>
        ) : (
          <DirectoryTreeView
            nodes={tree}
            editable={true}
            onAddFile={handleAddFile}
            onAddFolder={handleAddFolder}
            onRename={handleRenamePath}
            onDelete={handleDeletePath}
          />
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------
// MAIN COMPONENT: SkillsAndExtensions
// --------------------------------------------------
export default function SkillsAndExtensions({ entityName, toolboxes, onRefresh, showToast }: Props) {
  const triggerToast = (msg: string, type: 'success' | 'info' | 'error' = 'error') => {
    if (showToast) showToast(msg, type);
    else alert(msg);
  };

  const [activeTab, setActiveTab] = useState<'skills' | 'extensions'>('skills');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'built-in' | 'workspace'>('all');

  // Modal inspection state
  const [modal, setModal] = useState<{
    isOpen: boolean;
    kind: 'skill' | 'plugin';
    parents: string[];
    entryName: string;
  }>({
    isOpen: false,
    kind: 'skill',
    parents: ['domain_general', 'system_mcp'],
    entryName: ''
  });

  // Files & active selection inside inspection modal
  const [filesList, setFilesList] = useState<{ name: string; path: string; type: 'file' | 'folder'; content?: string }[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string>('SKILL.md');
  const [activeFileContent, setActiveFileContent] = useState<string>('');

  const extraTools = useMemo(() => {
    const rawYaml = toolboxes as any || {};
    return {
      mcps: rawYaml.mcps || {},
      plugins: rawYaml.plugins || {}
    };
  }, [toolboxes]);

  const domains = useMemo(() => {
    const rawDomMap = (toolboxes as any)?.domains || (toolboxes as any)?.toolboxes || {};
    return Object.entries(rawDomMap).map(([key, item]: [string, any]) => ({
      id: key,
      ...item,
    }));
  }, [toolboxes]);

  // Skills List
  const skillsList = useMemo(() => {
    const items: any[] = [];
    domains.forEach(dom => {
      Object.entries(dom.toolboxes || {}).forEach(([tbId, tb]: [string, any]) => {
        Object.entries(tb.skills || {}).forEach(([sId, s]: [string, any]) => {
          const isBuiltIn = s.source === 'built-in' || (dom.id === 'domain_general' && s.source !== 'workspace');
          items.push({
            id: sId,
            name: sId,
            domainId: dom.id,
            toolboxId: tbId,
            source: isBuiltIn ? 'built-in' : 'workspace',
            parents: [dom.id, tbId]
          });
        });
      });
    });
    return items;
  }, [domains]);

  // Extensions List
  const extensionsList = useMemo(() => {
    const items: any[] = [];
    Object.entries(extraTools.plugins).forEach(([id, x]: [string, any]) => {
      const isBuiltIn = x.source === 'built-in';
      items.push({
        id,
        name: x.name || id,
        kind: 'plugin',
        source: isBuiltIn ? 'built-in' : 'workspace'
      });
    });
    return items;
  }, [extraTools]);

  const filteredSkills = useMemo(() => {
    return skillsList.filter(s => {
      const matchSearch = searchQuery === '' || s.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchSource = sourceFilter === 'all' || s.source === sourceFilter;
      return matchSearch && matchSource;
    });
  }, [skillsList, searchQuery, sourceFilter]);

  const filteredExtensions = useMemo(() => {
    return extensionsList.filter(e => {
      const matchSearch = searchQuery === '' || e.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchSource = sourceFilter === 'all' || e.source === sourceFilter;
      return matchSearch && matchSource;
    });
  }, [extensionsList, searchQuery, sourceFilter]);

  // Load modal files
  const loadModalFiles = async (kind: 'skill' | 'plugin', parents: string[], entryName: string) => {
    try {
      const res = await api.getToolboxFiles(entityName, kind, parents, entryName, 'workspace');
      if (res.ok && res.files) {
        setFilesList(res.files);
        const firstFile = res.files.find(f => f.type === 'file');
        if (firstFile) {
          setActiveFilePath(firstFile.path);
          setActiveFileContent(firstFile.content || '');
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openInspectModal = async (kind: 'skill' | 'plugin', parents: string[], entryName: string) => {
    setModal({ isOpen: true, kind, parents, entryName });
    await loadModalFiles(kind, parents, entryName);
  };

  // Switch selected file in Modal
  const handleSelectModalFile = (path: string) => {
    setActiveFilePath(path);
    const item = filesList.find(f => f.path === path);
    if (item && item.content !== undefined) {
      setActiveFileContent(item.content);
    }
  };

  // Save Modal File Content
  const handleSaveModalFileContent = async (newContent: string) => {
    setActiveFileContent(newContent);
    try {
      await api.saveToolboxFile(entityName, modal.kind, modal.parents, modal.entryName, activeFilePath, newContent, 'workspace');
      setFilesList(prev => prev.map(f => f.path === activeFilePath ? { ...f, content: newContent } : f));
    } catch (e) {
      console.error(e);
    }
  };

  // State for Add Skill Modal
  const [isAddSkillModalOpen, setIsAddSkillModalOpen] = useState(false);
  const [newSkillForm, setNewSkillForm] = useState({
    name: '',
    what: '',
    when: '',
    why: '',
    triggers: '',
    inputs: '',
    outputs: '',
    body: '# Instructions\n\nAdd implementation guidance here.'
  });

  // State for Add Extension Modal
  const [isAddExtensionModalOpen, setIsAddExtensionModalOpen] = useState(false);
  const [newExtForm, setNewExtForm] = useState({
    name: '',
    code: '// Workspace extension script\nexport function setup() {\n  console.log("Extension initialized");\n}\n'
  });

  // Add Custom Workspace Skill Submit
  const handleAddWorkspaceSkillSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newSkillForm.name.trim()) {
      triggerToast('Skill name is required', 'error');
      return;
    }
    const clean = newSkillForm.name.trim().replace(/[^a-zA-Z0-9_\-]/g, '_');
    const parents = ['domain_general', 'system_mcp'];

    try {
      await api.mutateToolbox(entityName, 'create', 'skill', parents, clean, {
        description: newSkillForm.what || 'Custom workspace skill',
        status: true,
        source: 'workspace'
      });

      const initialMd = serializeSkillMd({
        what: newSkillForm.what || 'Custom workspace skill task',
        when: newSkillForm.when || 'Triggered when needed',
        why: newSkillForm.why || 'Automates user workflow',
        triggers: newSkillForm.triggers || 'custom, workspace',
        inputs: newSkillForm.inputs || 'User instructions',
        outputs: newSkillForm.outputs || 'Completed workspace task'
      }, newSkillForm.body);

      await api.saveToolboxFile(entityName, 'skill', parents, clean, 'SKILL.md', initialMd, 'workspace');
      triggerToast(`Created skill '${clean}'`, 'success');
      setIsAddSkillModalOpen(false);
      setNewSkillForm({
        name: '',
        what: '',
        when: '',
        why: '',
        triggers: '',
        inputs: '',
        outputs: '',
        body: '# Instructions\n\nAdd implementation guidance here.'
      });
      if (onRefresh) onRefresh();
    } catch (e: any) {
      triggerToast(e.message || 'Failed to create skill', 'error');
    }
  };

  // Add Custom Workspace Extension Submit
  const handleAddWorkspaceExtensionSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newExtForm.name.trim()) {
      triggerToast('Extension name is required', 'error');
      return;
    }
    const clean = newExtForm.name.trim().replace(/[^a-zA-Z0-9_\-]/g, '_');

    try {
      const rawYaml = toolboxes as any || {};
      const plugins = { ...(rawYaml.plugins || {}) };
      plugins[clean] = { name: clean, source: 'workspace', status: true };

      await api.patchEntity(entityName, 'toolboxes', ['plugins'], plugins);
      await api.saveToolboxFile(entityName, 'plugin', [], clean, `${clean}.js`, newExtForm.code || '// Workspace extension script\nexport function setup() {}\n', 'workspace');
      triggerToast(`Created extension '${clean}'`, 'success');
      setIsAddExtensionModalOpen(false);
      setNewExtForm({
        name: '',
        code: '// Workspace extension script\nexport function setup() {\n  console.log("Extension initialized");\n}\n'
      });
      if (onRefresh) onRefresh();
    } catch (e: any) {
      triggerToast(e.message || 'Failed to create extension', 'error');
    }
  };

  const modalTree = useMemo(() => buildFileTree(filesList), [filesList]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', overflowY: 'auto', padding: '16px' }}>
      
      {/* TABS & FILTER BAR */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--surface-alt)',
        border: '1px solid var(--border-soft)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 14px',
        gap: '10px'
      }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', background: 'var(--surface)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-soft)' }}>
          <button
            onClick={() => setActiveTab('skills')}
            style={{
              fontSize: '9.5px',
              fontWeight: 900,
              padding: '6px 14px',
              background: activeTab === 'skills' ? 'linear-gradient(135deg, #c084fc, #9333ea)' : 'transparent',
              border: 'none',
              borderRadius: '4px',
              color: activeTab === 'skills' ? '#fff' : 'var(--muted)',
              cursor: 'pointer',
              fontFamily: 'var(--mono)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            ⚡ SKILLS ({skillsList.length})
          </button>
          <button
            onClick={() => setActiveTab('extensions')}
            style={{
              fontSize: '9.5px',
              fontWeight: 900,
              padding: '6px 14px',
              background: activeTab === 'extensions' ? 'linear-gradient(135deg, #06b6d4, #0284c7)' : 'transparent',
              border: 'none',
              borderRadius: '4px',
              color: activeTab === 'extensions' ? '#fff' : 'var(--muted)',
              cursor: 'pointer',
              fontFamily: 'var(--mono)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            🧩 EXTENSIONS ({extensionsList.length})
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            value={sourceFilter}
            onChange={(e: any) => setSourceFilter(e.target.value)}
            style={{
              fontSize: '9px',
              fontWeight: 700,
              padding: '4px 8px',
              background: 'var(--surface)',
              border: '1px solid var(--border-soft)',
              borderRadius: '4px',
              color: 'var(--text)'
            }}
          >
            <option value="all">All Sources</option>
            <option value="built-in">Kernel (Built-In)</option>
            <option value="workspace">Workspace (.pi/)</option>
          </select>

          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              fontSize: '9px',
              padding: '4px 8px',
              background: 'var(--surface)',
              border: '1px solid var(--border-soft)',
              borderRadius: '4px',
              color: 'var(--text)',
              width: '120px'
            }}
          />
        </div>
      </div>

      {/* SKILLS SECTION */}
      {activeTab === 'skills' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '9.5px', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>
              REGISTERED SKILLS ({filteredSkills.length})
            </span>
            <button
              onClick={() => setIsAddSkillModalOpen(true)}
              style={{
                fontSize: '9px',
                fontWeight: 800,
                padding: '4px 10px',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              + Add Custom Skill (.pi/skills)
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
            {filteredSkills.map(s => {
              if (s.source === 'built-in') {
                return (
                  <BuiltInSkillCard
                    key={s.id}
                    entityName={entityName}
                    skillName={s.name}
                    parents={s.parents}
                  />
                );
              } else {
                return (
                  <WorkspaceSkillCard
                    key={s.id}
                    entityName={entityName}
                    skillName={s.name}
                    parents={s.parents}
                    onInspect={() => openInspectModal('skill', s.parents, s.name)}
                    onRefresh={onRefresh}
                    showToast={triggerToast}
                  />
                );
              }
            })}
          </div>
        </div>
      )}

      {/* EXTENSIONS SECTION */}
      {activeTab === 'extensions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '9.5px', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>
              RUNTIME EXTENSIONS ({filteredExtensions.length})
            </span>
            <button
              onClick={() => setIsAddExtensionModalOpen(true)}
              style={{
                fontSize: '9px',
                fontWeight: 800,
                padding: '4px 10px',
                background: '#06b6d4',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              + Add Custom Extension (.pi/extensions)
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {filteredExtensions.map(e => {
              if (e.source === 'built-in') {
                return (
                  <BuiltInExtensionCard
                    key={e.id}
                    name={e.name}
                  />
                );
              } else {
                return (
                  <WorkspaceExtensionCard
                    key={e.id}
                    entityName={entityName}
                    id={e.id}
                    onInspect={() => openInspectModal('plugin', [], e.id)}
                    onRefresh={onRefresh}
                    showToast={triggerToast}
                  />
                );
              }
            })}
          </div>
        </div>
      )}

      {/* INSPECTION MODAL */}
      {modal.isOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            width: modal.kind === 'skill' ? 'min(56rem, 92vw)' : 'min(44rem, 90vw)',
            height: 'min(36rem, 85vh)',
            background: 'var(--surface)',
            border: '1.5px solid var(--border)',
            borderRadius: '10px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5)'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-alt)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px' }}>{modal.kind === 'skill' ? '⚡' : '🧩'}</span>
                <b style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text)' }}>
                  Inspect {modal.kind === 'skill' ? 'Skill Files' : 'Extension Code'}: {modal.entryName}
                </b>
              </div>
              <button onClick={() => setModal(m => ({ ...m, isOpen: false }))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '14px' }}>✕</button>
            </div>

            {/* Modal Content */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {modal.kind === 'skill' ? (
                <>
                  {/* WORKSPACE SKILL INSPECT: Editable and Switchable SKILL FOLDER & FILES DIRECTORY STRUCTURE */}
                  <div style={{ width: '220px', borderRight: '1px solid var(--border)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', background: 'var(--surface-alt)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '8.5px', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>
                        FILES & DIRECTORY
                      </span>
                      <div style={{ display: 'flex', gap: '3px' }}>
                        <button
                          title="Add File"
                          onClick={async () => {
                            const name = prompt('Enter filename:');
                            if (!name || !name.trim()) return;
                            await api.saveToolboxFile(entityName, 'skill', modal.parents, modal.entryName, name.trim(), '// New file\n', 'workspace');
                            await loadModalFiles('skill', modal.parents, modal.entryName);
                          }}
                          style={iconBtnStyle}
                        >
                          +📄
                        </button>
                        <button
                          title="Add Folder"
                          onClick={async () => {
                            const name = prompt('Enter folder name:');
                            if (!name || !name.trim()) return;
                            await api.createToolboxFolder(entityName, 'skill', modal.parents, modal.entryName, name.trim(), 'workspace');
                            await api.saveToolboxFile(entityName, 'skill', modal.parents, modal.entryName, `${name.trim()}/.gitkeep`, '', 'workspace');
                            await loadModalFiles('skill', modal.parents, modal.entryName);
                          }}
                          style={iconBtnStyle}
                        >
                          +📁
                        </button>
                      </div>
                    </div>

                    <DirectoryTreeView
                      nodes={modalTree}
                      activePath={activeFilePath}
                      onSelectFile={handleSelectModalFile}
                      editable={true}
                      onAddFile={async (parent) => {
                        const name = prompt('Enter filename:');
                        if (!name || !name.trim()) return;
                        const relPath = `${parent}/${name.trim()}`;
                        await api.saveToolboxFile(entityName, 'skill', modal.parents, modal.entryName, relPath, '// New file\n', 'workspace');
                        await loadModalFiles('skill', modal.parents, modal.entryName);
                      }}
                      onAddFolder={async (parent) => {
                        const name = prompt('Enter folder name:');
                        if (!name || !name.trim()) return;
                        const relPath = `${parent}/${name.trim()}`;
                        await api.createToolboxFolder(entityName, 'skill', modal.parents, modal.entryName, relPath, 'workspace');
                        await api.saveToolboxFile(entityName, 'skill', modal.parents, modal.entryName, `${relPath}/.gitkeep`, '', 'workspace');
                        await loadModalFiles('skill', modal.parents, modal.entryName);
                      }}
                      onRename={async (oldPath) => {
                        const newPath = prompt('Enter new path:', oldPath);
                        if (!newPath || !newPath.trim() || newPath === oldPath) return;
                        await api.renameToolboxFile(entityName, 'skill', modal.parents, modal.entryName, oldPath, newPath.trim(), 'workspace');
                        await loadModalFiles('skill', modal.parents, modal.entryName);
                      }}
                      onDelete={async (relPath) => {
                        if (relPath === 'SKILL.md') return;
                        if (!confirm(`Delete ${relPath}?`)) return;
                        await api.deleteToolboxFile(entityName, 'skill', modal.parents, modal.entryName, relPath, 'workspace');
                        await loadModalFiles('skill', modal.parents, modal.entryName);
                      }}
                    />
                  </div>

                  {/* WORKSPACE SKILL INSPECT: Editable Body of Selected File */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px', gap: '8px' }}>
                    <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                      Editing: {activeFilePath}
                    </div>
                    <textarea
                      value={activeFileContent}
                      onChange={(e) => handleSaveModalFileContent(e.target.value)}
                      style={{
                        flex: 1,
                        width: '100%',
                        fontSize: '11px',
                        fontFamily: 'var(--mono)',
                        padding: '10px',
                        background: 'var(--surface-alt)',
                        border: '1px solid var(--border-soft)',
                        borderRadius: '6px',
                        color: 'var(--text)',
                        resize: 'none',
                        lineHeight: '1.4'
                      }}
                    />
                  </div>
                </>
              ) : (
                /* WORKSPACE EXTENSION INSPECT: Editable Body (Full File) */
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '14px', gap: '8px' }}>
                  <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                    Extension File: {activeFilePath || `${modal.entryName}.js`}
                  </div>
                  <textarea
                    value={activeFileContent}
                    onChange={(e) => handleSaveModalFileContent(e.target.value)}
                    placeholder="// Extension code..."
                    style={{
                      flex: 1,
                      width: '100%',
                      fontSize: '11px',
                      fontFamily: 'var(--mono)',
                      padding: '10px',
                      background: 'var(--surface-alt)',
                      border: '1px solid var(--border-soft)',
                      borderRadius: '6px',
                      color: 'var(--text)',
                      resize: 'none',
                      lineHeight: '1.4'
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADD CUSTOM SKILL MODAL */}
      {isAddSkillModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            width: 'min(36rem, 90vw)',
            background: 'var(--surface)',
            border: '1.5px solid var(--border)',
            borderRadius: '10px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5)'
          }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-alt)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px' }}>⚡</span>
                <b style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text)' }}>
                  Add Custom Workspace Skill (.pi/skills)
                </b>
              </div>
              <button onClick={() => setIsAddSkillModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '14px' }}>✕</button>
            </div>

            <form onSubmit={handleAddWorkspaceSkillSubmit} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '9px', fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase' }}>
                  Skill Folder Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. my-custom-skill"
                  value={newSkillForm.name}
                  onChange={(e) => setNewSkillForm({ ...newSkillForm, name: e.target.value })}
                  required
                  style={{
                    fontSize: '11px',
                    padding: '6px 10px',
                    background: 'var(--surface-alt)',
                    border: '1px solid var(--border-soft)',
                    borderRadius: '4px',
                    color: 'var(--text)'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                {(['what', 'when', 'why', 'triggers', 'inputs', 'outputs'] as Array<keyof typeof newSkillForm>).map(field => {
                  if (field === 'name' || field === 'body') return null;
                  return (
                    <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <label style={{ fontSize: '8px', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>
                        {field}
                      </label>
                      <input
                        type="text"
                        placeholder={`e.g. Skill ${field}`}
                        value={newSkillForm[field]}
                        onChange={(e) => setNewSkillForm({ ...newSkillForm, [field]: e.target.value })}
                        style={{
                          fontSize: '10px',
                          padding: '4px 8px',
                          background: 'var(--surface-alt)',
                          border: '1px solid var(--border-soft)',
                          borderRadius: '4px',
                          color: 'var(--text)'
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '9px', fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase' }}>
                  Initial SKILL.md Instructions
                </label>
                <textarea
                  value={newSkillForm.body}
                  onChange={(e) => setNewSkillForm({ ...newSkillForm, body: e.target.value })}
                  rows={4}
                  style={{
                    fontSize: '10px',
                    fontFamily: 'var(--mono)',
                    padding: '8px',
                    background: 'var(--surface-alt)',
                    border: '1px solid var(--border-soft)',
                    borderRadius: '4px',
                    color: 'var(--text)',
                    resize: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddSkillModalOpen(false)}
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '6px 12px',
                    background: 'var(--surface-alt)',
                    border: '1px solid var(--border-soft)',
                    borderRadius: '4px',
                    color: 'var(--text)',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '6px 14px',
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Create Skill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD CUSTOM EXTENSION MODAL */}
      {isAddExtensionModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            width: 'min(36rem, 90vw)',
            background: 'var(--surface)',
            border: '1.5px solid var(--border)',
            borderRadius: '10px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5)'
          }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-alt)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px' }}>🧩</span>
                <b style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text)' }}>
                  Add Custom Workspace Extension (.pi/extensions)
                </b>
              </div>
              <button onClick={() => setIsAddExtensionModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '14px' }}>✕</button>
            </div>

            <form onSubmit={handleAddWorkspaceExtensionSubmit} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '9px', fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase' }}>
                  Extension Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. my_custom_extension"
                  value={newExtForm.name}
                  onChange={(e) => setNewExtForm({ ...newExtForm, name: e.target.value })}
                  required
                  style={{
                    fontSize: '11px',
                    padding: '6px 10px',
                    background: 'var(--surface-alt)',
                    border: '1px solid var(--border-soft)',
                    borderRadius: '4px',
                    color: 'var(--text)'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '9px', fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase' }}>
                  Extension JS/TS Code
                </label>
                <textarea
                  value={newExtForm.code}
                  onChange={(e) => setNewExtForm({ ...newExtForm, code: e.target.value })}
                  rows={8}
                  style={{
                    fontSize: '10.5px',
                    fontFamily: 'var(--mono)',
                    padding: '8px',
                    background: 'var(--surface-alt)',
                    border: '1px solid var(--border-soft)',
                    borderRadius: '4px',
                    color: 'var(--text)',
                    resize: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddExtensionModalOpen(false)}
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '6px 12px',
                    background: 'var(--surface-alt)',
                    border: '1px solid var(--border-soft)',
                    borderRadius: '4px',
                    color: 'var(--text)',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '6px 14px',
                    background: '#06b6d4',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Create Extension
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
