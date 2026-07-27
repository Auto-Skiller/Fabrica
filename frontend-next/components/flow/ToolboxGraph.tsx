'use client';

import { useState, useMemo } from 'react';
import { ToolboxesYaml } from '../../lib/types';
import { api } from '../../lib/api';

interface Props {
  entityName: string;
  toolboxes: ToolboxesYaml;
  onRefresh?: () => void;
  showToast?: (message: string, type: 'success' | 'info' | 'error') => void;
}

export default function ToolboxGraph({ entityName, toolboxes, onRefresh, showToast }: Props) {
  const triggerToast = (msg: string, type: 'success' | 'info' | 'error' = 'error') => {
    if (showToast) {
      showToast(msg, type);
    } else {
      alert(msg);
    }
  };

  // Main Section Tabs (Skills vs Extensions)
  const [activeTab, setActiveTab] = useState<'skills' | 'extensions'>('skills');

  // Filtering
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'built-in' | 'workspace'>('all');

  const [isMutating, setIsMutating] = useState<boolean>(false);

  // Workspace File Management States
  const [modalFiles, setModalFiles] = useState<{ name: string; content: string }[]>([]);
  const [modalActiveFile, setModalActiveFile] = useState<string>('');
  const [modalFileContent, setModalFileContent] = useState<string>('');

  // Form Modal States
  const [modal, setModal] = useState<{
    isOpen: boolean;
    type: 'add' | 'edit';
    kind: 'domain' | 'toolbox' | 'skill' | 'mcp' | 'plugin' | 'enterprise_tool' | 'website_connection';
    parents: string[];
    id?: string;
    fields: Record<string, any>;
  }>({
    isOpen: false,
    type: 'add',
    kind: 'skill',
    parents: [],
    fields: {}
  });

  const handleModalFileChange = (filename: string) => {
    setModalFiles(prev => prev.map(f => f.name === modalActiveFile ? { ...f, content: modalFileContent } : f));
    setModalActiveFile(filename);
    const selected = modalFiles.find(f => f.name === filename);
    setModalFileContent(selected ? selected.content : '');
  };

  const handleAddFile = () => {
    if (modal.fields.source === 'built-in') {
      triggerToast("Built-in kernel capabilities are read-only.", "info");
      return;
    }
    const newName = prompt("Enter new filename (e.g. SKILL.md, index.ts):");
    if (!newName || !newName.trim()) return;
    const trimmed = newName.trim();
    if (modalFiles.some(f => f.name.toLowerCase() === trimmed.toLowerCase())) {
      triggerToast("A file with this name already exists.");
      return;
    }
    const updated = modalFiles.map(f => f.name === modalActiveFile ? { ...f, content: modalFileContent } : f);
    const newFileList = [...updated, { name: trimmed, content: '' }];
    setModalFiles(newFileList);
    setModalActiveFile(trimmed);
    setModalFileContent('');
  };

  const handleDeleteFile = (fileNameToDelete: string) => {
    if (modal.fields.source === 'built-in') {
      triggerToast("Built-in kernel capabilities are read-only.", "info");
      return;
    }
    if (modalFiles.length <= 1) {
      triggerToast("Skills must retain at least one implementation file.");
      return;
    }
    if (!confirm(`Are you sure you want to remove ${fileNameToDelete}?`)) return;
    const remaining = modalFiles.filter(f => f.name !== fileNameToDelete);
    setModalFiles(remaining);
    if (modalActiveFile === fileNameToDelete) {
      setModalActiveFile(remaining[0].name);
      setModalFileContent(remaining[0].content);
    }
  };

  const extraTools = useMemo(() => {
    const rawYaml = toolboxes as any;
    const mcpsList = rawYaml.mcps || {};
    const pluginsList = rawYaml.plugins || {};
    const enterpriseList = rawYaml.enterprise_tools || {};
    const websitesList = rawYaml.website_connections || {};
    return { mcps: mcpsList, plugins: pluginsList, enterprise: enterpriseList, websites: websitesList };
  }, [toolboxes]);

  const domains = useMemo(() => {
    const rawDomMap = (toolboxes as any)?.domains || (toolboxes as any)?.toolboxes || {};
    return Object.entries(rawDomMap).map(([key, item]: [string, any]) => ({
      id: key,
      ...item,
    }));
  }, [toolboxes]);

  // 1. SKILLS List (Only real skills from backend)
  const skillsList = useMemo(() => {
    const items: any[] = [];
    domains.forEach(dom => {
      Object.entries(dom.toolboxes || {}).forEach(([tbId, tb]: [string, any]) => {
        Object.entries(tb.skills || {}).forEach(([sId, s]: [string, any]) => {
          const isBuiltIn = s.source === 'built-in' || dom.id === 'domain_general' && s.source !== 'workspace';
          items.push({
            id: sId,
            name: sId,
            type: 'skill',
            domainId: dom.id,
            toolboxId: tbId,
            source: isBuiltIn ? 'built-in' : 'workspace',
            status: s.status !== false,
            maturity: s.maturity || (isBuiltIn ? 'battle-tested' : 'functional'),
            role: s.role || (isBuiltIn ? 'Kernel Skill' : 'Workspace Skill'),
            when_to_use: s.when_to_use || s.description || 'Executable skill routine',
            description: s.description || s.when_to_use || 'Capability specification',
            raw: s
          });
        });
      });
    });
    return items;
  }, [domains]);

  // 2. EXTENSIONS List (Only real plugins/MCPs from backend)
  const extensionsList = useMemo(() => {
    const items: any[] = [];

    // Plugins & extensions
    Object.entries(extraTools.plugins).forEach(([id, x]: [string, any]) => {
      const isBuiltIn = x.source === 'built-in';
      items.push({
        id,
        name: x.name || id,
        category: isBuiltIn ? 'Kernel Extension' : 'Workspace Plugin',
        kind: 'plugin',
        source: isBuiltIn ? 'built-in' : 'workspace',
        status: x.status !== false,
        description: x.description || 'Runtime plugin extension',
        details: `Endpoint: ${x.endpoint || (isBuiltIn ? 'Kernel' : 'Local .pi/extensions')}`,
        raw: x
      });
    });

    // MCP Servers
    Object.entries(extraTools.mcps).forEach(([id, x]: [string, any]) => {
      items.push({
        id,
        name: x.name || id,
        category: 'MCP Server',
        kind: 'mcp',
        source: x.source || 'workspace',
        status: x.status !== false,
        description: x.description || 'Model Context Protocol Provider',
        details: `URL: ${x.url || 'Local'}`,
        raw: x
      });
    });

    return items;
  }, [extraTools]);

  const filteredSkills = useMemo(() => {
    return skillsList.filter(item => {
      const matchesSearch = searchQuery === '' || 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' && item.status) || (statusFilter === 'inactive' && !item.status);
      const matchesSource = sourceFilter === 'all' || item.source === sourceFilter;
      return matchesSearch && matchesStatus && matchesSource;
    });
  }, [skillsList, searchQuery, statusFilter, sourceFilter]);

  const filteredExtensions = useMemo(() => {
    return extensionsList.filter(item => {
      const matchesSearch = searchQuery === '' || 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' && item.status) || (statusFilter === 'inactive' && !item.status);
      const matchesSource = sourceFilter === 'all' || item.source === sourceFilter;
      return matchesSearch && matchesStatus && matchesSource;
    });
  }, [extensionsList, searchQuery, statusFilter, sourceFilter]);

  const openFormModal = (
    type: 'add' | 'edit',
    kind: 'domain' | 'toolbox' | 'skill' | 'mcp' | 'plugin' | 'enterprise_tool' | 'website_connection',
    parents: string[],
    id?: string,
    existingFields?: Record<string, any>
  ) => {
    const fieldsToSet = existingFields ? { ...existingFields } : { status: true, maturity: 'functional', source: 'workspace' };
    setModal({
      isOpen: true,
      type,
      kind,
      parents,
      id,
      fields: fieldsToSet
    });

    setModalFiles([]);
    setModalActiveFile('');
    setModalFileContent('');

    if (kind === 'skill') {
      const entryId = id || (existingFields ? existingFields.name : '');
      if (entryId && type === 'edit') {
        api.getToolboxFiles(entityName, kind, parents, entryId, existingFields?.source).then(res => {
          if (res.ok && res.files) {
            let filesList = res.files;
            if (filesList.length > 1) {
              filesList = filesList.filter(f => f.name !== '.gitkeep');
            }
            if (filesList.length === 0) {
              const defaultFiles = [
                { name: 'SKILL.md', content: `# ${entryId}\n\nSkill specification.` },
                { name: 'index.ts', content: '// Skill implementation logic\n' }
              ];
              setModalFiles(defaultFiles);
              setModalActiveFile(defaultFiles[0].name);
              setModalFileContent(defaultFiles[0].content);
            } else {
              setModalFiles(filesList);
              setModalActiveFile(filesList[0].name);
              setModalFileContent(filesList[0].content);
            }
          }
        }).catch(err => {
          console.error("Error fetching files:", err);
        });
      } else {
        const defaultFiles = [
          { name: 'SKILL.md', content: `# Custom Workspace Skill\n\nInstructions for this skill.` },
          { name: 'index.ts', content: '// Implementation logic\n' }
        ];
        setModalFiles(defaultFiles);
        setModalActiveFile(defaultFiles[0].name);
        setModalFileContent(defaultFiles[0].content);
      }
    }
  };

  const handleSaveModal = async () => {
    if (modal.type === 'edit' && modal.fields.source === 'built-in') {
      triggerToast("Built-in system capabilities are read-only and cannot be modified.", "info");
      return;
    }
    setIsMutating(true);
    try {
      const { type, kind, parents, id, fields } = modal;
      const targetName = fields.name || id || '';

      if (!targetName.trim()) {
        triggerToast("Name / Identifier is required!", "error");
        return;
      }

      if (['domain', 'toolbox', 'skill'].includes(kind)) {
        const opType = type === 'add' ? 'create' : 'edit';
        const res = await api.mutateToolbox(entityName, opType, kind as any, parents, targetName, fields);
        if (res.ok) {
          if (kind === 'skill') {
            const updatedFiles = modalFiles.map(f => f.name === modalActiveFile ? { ...f, content: modalFileContent } : f);
            for (const file of updatedFiles) {
              if (file.name === '.gitkeep') continue;
              await api.saveToolboxFile(entityName, kind, parents, targetName, file.name, file.content, fields.source);
            }
          }
          if (onRefresh) onRefresh();
          triggerToast("Saved workspace capability configuration!", "success");
        }
      } else {
        const mapKey = kind === 'mcp' ? 'mcps' : 'plugins';
        const rawYaml = toolboxes as any;
        const currentGroup = { ...(rawYaml[mapKey] || {}) };
        const itemId = id || targetName.toLowerCase().replace(/\s+/g, '_');
        currentGroup[itemId] = { ...fields, name: targetName, source: 'workspace' };
        await api.patchEntity(entityName, 'toolboxes', [mapKey], currentGroup);
        if (onRefresh) onRefresh();
        triggerToast("Saved extension configuration!", "success");
      }
      setModal(m => ({ ...m, isOpen: false }));
    } catch (err: any) {
      triggerToast(err.message || "Failed to save capability", "error");
    } finally {
      setIsMutating(false);
    }
  };

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
        {/* Tab Selection */}
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
            ⚡ SKILLS <span style={{ opacity: 0.8, fontSize: '8.5px' }}>({skillsList.length})</span>
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
            🧩 EXTENSIONS <span style={{ opacity: 0.8, fontSize: '8.5px' }}>({extensionsList.length})</span>
          </button>
        </div>

        {/* Filter Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Source Filter */}
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

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
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
            <option value="all">All States</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>

          {/* Search Box */}
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
            <span style={{ fontSize: '9.5px', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              REGISTERED MICRO-SKILLS ({filteredSkills.length} / {skillsList.length})
            </span>
            <button
              onClick={() => openFormModal('add', 'skill', ['domain_general', 'system_mcp'])}
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
              + Add Custom Skill
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
            {filteredSkills.map(s => {
              const isBuiltIn = s.source === 'built-in';
              return (
                <div key={s.id} style={{
                  background: 'var(--surface-alt)',
                  border: `1px solid ${isBuiltIn ? 'var(--border-soft)' : 'rgba(192, 132, 252, 0.4)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  position: 'relative'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <b style={{ fontSize: '11px', color: 'var(--text)' }}>{s.name}</b>
                        <span style={{
                          fontSize: '7px',
                          fontWeight: 800,
                          padding: '1px 5px',
                          borderRadius: '3px',
                          background: isBuiltIn ? 'rgba(6, 182, 212, 0.15)' : 'rgba(192, 132, 252, 0.15)',
                          color: isBuiltIn ? '#06b6d4' : '#c084fc',
                          textTransform: 'uppercase'
                        }}>
                          {isBuiltIn ? 'BUILT-IN' : 'WORKSPACE'}
                        </span>
                      </div>
                      <span style={{ fontSize: '8px', color: 'var(--muted)' }}>
                        {s.role} • {s.maturity}
                      </span>
                    </div>

                    <span style={{
                      fontSize: '7px',
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: '3px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981'
                    }}>
                      • ACTIVE
                    </span>
                  </div>

                  <p style={{ fontSize: '8.5px', color: 'var(--muted)', margin: 0, lineHeight: '1.3' }}>
                    {s.description}
                  </p>

                  <div style={{ background: 'var(--surface)', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border-soft)', fontSize: '7.5px', color: 'var(--text)' }}>
                    <b>Trigger:</b> {s.when_to_use}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                    <button
                      onClick={() => openFormModal('edit', 'skill', ['domain_general', 'system_mcp'], s.id, { ...s.raw, name: s.id, source: s.source })}
                      style={{
                        fontSize: '8px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        background: 'transparent',
                        border: '1px solid var(--border-soft)',
                        borderRadius: '3px',
                        color: 'var(--muted)',
                        cursor: 'pointer'
                      }}
                    >
                      {isBuiltIn ? '🔒 View Specs' : '✏️ Edit Skill & Code'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* EXTENSIONS SECTION */}
      {activeTab === 'extensions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '9.5px', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              RUNTIME EXTENSIONS & PLUGINS ({filteredExtensions.length} / {extensionsList.length})
            </span>
            <button
              onClick={() => openFormModal('add', 'plugin', [])}
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
              + Add Extension (.pi/extensions)
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
            {filteredExtensions.map(e => {
              const isBuiltIn = e.source === 'built-in';
              return (
                <div key={e.id} style={{
                  background: 'var(--surface-alt)',
                  border: `1px solid ${isBuiltIn ? 'var(--border-soft)' : 'rgba(6, 182, 212, 0.4)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <b style={{ fontSize: '11px', color: 'var(--text)' }}>{e.name}</b>
                        <span style={{
                          fontSize: '7px',
                          fontWeight: 800,
                          padding: '1px 5px',
                          borderRadius: '3px',
                          background: isBuiltIn ? 'rgba(6, 182, 212, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: isBuiltIn ? '#06b6d4' : '#10b981',
                          textTransform: 'uppercase'
                        }}>
                          {isBuiltIn ? 'BUILT-IN' : 'WORKSPACE'}
                        </span>
                      </div>
                      <span style={{ fontSize: '8px', color: 'var(--muted)' }}>
                        {e.category}
                      </span>
                    </div>

                    <span style={{
                      fontSize: '7px',
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: '3px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981'
                    }}>
                      • ACTIVE
                    </span>
                  </div>

                  <p style={{ fontSize: '8.5px', color: 'var(--muted)', margin: 0 }}>
                    {e.description}
                  </p>

                  <div style={{ fontSize: '7.5px', color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                    {e.details}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                    <button
                      onClick={() => openFormModal('edit', e.kind as any, [], e.id, { ...e.raw, name: e.id, source: e.source })}
                      style={{
                        fontSize: '8px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        background: 'transparent',
                        border: '1px solid var(--border-soft)',
                        borderRadius: '3px',
                        color: 'var(--muted)',
                        cursor: 'pointer'
                      }}
                    >
                      {isBuiltIn ? '🔒 View Specs' : '✏️ Edit Config'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* EDIT / VIEW MODAL */}
      {modal.isOpen && (() => {
        const isBuiltInModal = modal.fields.source === 'built-in';
        return (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(5px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <div style={{
              width: 'min(45rem, 90vw)',
              maxHeight: '85vh',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-alt)' }}>
                <b style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text)' }}>
                  {isBuiltInModal ? '🔒 Built-in Kernel Capability Specs (Read-Only)' : modal.type === 'add' ? 'Add Workspace Capability' : 'Edit Workspace Capability'}
                </b>
                <button onClick={() => setModal(m => ({ ...m, isOpen: false }))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {isBuiltInModal && (
                  <div style={{ padding: '8px 12px', background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.25)', borderRadius: '4px', fontSize: '8.5px', color: '#06b6d4' }}>
                    🔒 This capability is part of the protected Fabrica Kernel. Its metadata is visible for inspection, but its file contents are locked and read-only.
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '8px', color: 'var(--muted)', fontWeight: 700 }}>NAME / IDENTIFIER</label>
                  <input
                    type="text"
                    disabled={isBuiltInModal || modal.type === 'edit'}
                    value={modal.fields.name || modal.id || ''}
                    onChange={(e) => setModal(m => ({ ...m, fields: { ...m.fields, name: e.target.value } }))}
                    style={{ fontSize: '9px', padding: '6px', background: 'var(--surface-alt)', border: '1px solid var(--border-soft)', borderRadius: '4px', color: 'var(--text)' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '8px', color: 'var(--muted)', fontWeight: 700 }}>DESCRIPTION / PURPOSE</label>
                  <textarea
                    disabled={isBuiltInModal}
                    rows={2}
                    value={modal.fields.description || ''}
                    onChange={(e) => setModal(m => ({ ...m, fields: { ...m.fields, description: e.target.value } }))}
                    style={{ fontSize: '9px', padding: '6px', background: 'var(--surface-alt)', border: '1px solid var(--border-soft)', borderRadius: '4px', color: 'var(--text)' }}
                  />
                </div>

                {modal.kind === 'skill' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '8px', color: 'var(--muted)', fontWeight: 700 }}>SKILL IMPLEMENTATION FILES (.pi/skills)</label>
                      {!isBuiltInModal && (
                        <button onClick={handleAddFile} style={{ fontSize: '8px', padding: '2px 6px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>+ Add File</button>
                      )}
                    </div>

                    {!isBuiltInModal && modalFiles.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border-soft)', paddingBottom: '4px' }}>
                          {modalFiles.map(f => (
                            <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <button
                                onClick={() => handleModalFileChange(f.name)}
                                style={{
                                  fontSize: '8px',
                                  padding: '2px 8px',
                                  background: modalActiveFile === f.name ? 'var(--accent)' : 'var(--surface-alt)',
                                  color: modalActiveFile === f.name ? '#fff' : 'var(--muted)',
                                  border: 'none',
                                  borderRadius: '3px',
                                  cursor: 'pointer'
                                }}
                              >
                                {f.name}
                              </button>
                              {modalFiles.length > 1 && (
                                <span onClick={() => handleDeleteFile(f.name)} style={{ fontSize: '8px', cursor: 'pointer', color: '#ef4444' }}>✕</span>
                              )}
                            </div>
                          ))}
                        </div>
                        <textarea
                          rows={8}
                          value={modalFileContent}
                          onChange={(e) => setModalFileContent(e.target.value)}
                          style={{ fontSize: '8.5px', fontFamily: 'var(--mono)', padding: '8px', background: '#0b0f19', color: '#e2e8f0', border: '1px solid var(--border-soft)', borderRadius: '4px' }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: 'var(--surface-alt)' }}>
                <button onClick={() => setModal(m => ({ ...m, isOpen: false }))} style={{ fontSize: '8px', background: 'transparent', border: '1px solid var(--border-soft)', color: 'var(--text)', padding: '5px 12px', borderRadius: '4px', cursor: 'pointer' }}>
                  Close
                </button>
                {!isBuiltInModal && (
                  <button onClick={handleSaveModal} disabled={isMutating} style={{ fontSize: '8px', background: 'var(--accent)', border: 'none', color: '#fff', padding: '5px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 800 }}>
                    {isMutating ? 'Saving...' : 'Save Configuration'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
