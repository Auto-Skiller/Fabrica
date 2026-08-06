'use client';

import React, { useState, useEffect, useMemo } from 'react';

export interface GcsFileNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  updatedAt?: string;
  content?: string;
  children?: GcsFileNode[];
}

interface GcsFileExplorerProps {
  tenantId?: string;
  bucketName?: string;
  workspaceRoot?: string;
  onFileSelect?: (file: GcsFileNode) => void;
  className?: string;
}

const DEFAULT_MOCK_TREE: GcsFileNode[] = [
  {
    id: 'root-workspace-json',
    name: 'workspace.json',
    path: 'workspace.json',
    type: 'file',
    size: 1420,
    updatedAt: new Date().toISOString(),
    content: JSON.stringify({
      version: '2.0.0',
      workspace_id: 'ws-tenant-primary',
      tenant_id: 'tenant-usr-123',
      storage_backend: 'gcs_fuse_mount',
      gcs_bucket: 'gs://fabrica-tenant-usr-123/',
      mount_path: '/mnt/workspace',
      active_project: 'market_intelligence',
      created_at: new Date().toISOString()
    }, null, 2)
  },
  {
    id: 'root-harness-json',
    name: 'harness.json',
    path: 'harness.json',
    type: 'file',
    size: 2840,
    updatedAt: new Date().toISOString(),
    content: JSON.stringify({
      runner_service: 'fabrica-runner-usr-123',
      region: 'europe-west2',
      autonomy_level: 'supervised',
      auto_missions: true,
      max_iterations: 15,
      thinking_level: 'medium',
      llm_model: 'gemini-2.5-flash'
    }, null, 2)
  },
  {
    id: 'dir-src',
    name: 'src',
    path: 'src',
    type: 'directory',
    children: [
      {
        id: 'src-server-ts',
        name: 'server.ts',
        path: 'src/server.ts',
        type: 'file',
        size: 3820,
        updatedAt: new Date().toISOString(),
        content: `import express from 'express';
import { runAgentCliTurn } from './core/harness';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const TENANT_ID = process.env.TENANT_ID || 'tenant-usr-123';

// GCS Mount Health Status Endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    tenant_id: TENANT_ID,
    storage_type: 'GCS_DEDICATED_BUCKET',
    bucket: \`gs://fabrica-tenant-\${TENANT_ID}/\`,
    mount_path: '/mnt/workspace'
  });
});

// Execute Agent CLI Turn locally inside tenant Cloud Run container
app.post('/api/runner/turn', async (req, res) => {
  try {
    const workspaceRoot = '/mnt/workspace';
    const result = await runAgentCliTurn(TENANT_ID, workspaceRoot, req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(\`[User Runner] Dedicated server online for tenant \${TENANT_ID} on port \${PORT}\`);
});`
      },
      {
        id: 'src-utils-ts',
        name: 'utils.ts',
        path: 'src/utils.ts',
        type: 'file',
        size: 940,
        updatedAt: new Date().toISOString(),
        content: `export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}`
      }
    ]
  },
  {
    id: 'dir-missions',
    name: 'missions',
    path: 'missions',
    type: 'directory',
    children: [
      {
        id: 'mission-001',
        name: 'mission-standard-scaffold.json',
        path: 'missions/mission-standard-scaffold.json',
        type: 'file',
        size: 1890,
        updatedAt: new Date().toISOString(),
        content: JSON.stringify({
          id: 'mission-001',
          title: 'Initialize Market Intelligence Microservice',
          status: 'COMPLETED',
          effort: 'MEDIUM',
          gcs_synced: true,
          steps_completed: 4,
          total_steps: 4
        }, null, 2)
      }
    ]
  },
  {
    id: 'dir-pi',
    name: '.pi',
    path: '.pi',
    type: 'directory',
    children: [
      {
        id: 'pi-skills',
        name: 'skills.json',
        path: '.pi/skills.json',
        type: 'file',
        size: 1120,
        updatedAt: new Date().toISOString(),
        content: JSON.stringify({
          installed_skills: [
            'gcs-fuse-sync',
            'cloudrun-orchestrator',
            'google-genai-sdk'
          ]
        }, null, 2)
      }
    ]
  }
];

export const GcsFileExplorer: React.FC<GcsFileExplorerProps> = ({
  tenantId = 'usr-123',
  bucketName,
  workspaceRoot = '/mnt/workspace',
  onFileSelect,
  className = ''
}) => {
  const actualBucket = bucketName || `gs://fabrica-tenant-${tenantId.toLowerCase().replace(/[^a-z0-9_\-]/g, '-')}/`;
  const [fileTree, setFileTree] = useState<GcsFileNode[]>(DEFAULT_MOCK_TREE);
  const [selectedFile, setSelectedFile] = useState<GcsFileNode | null>(DEFAULT_MOCK_TREE[0]);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    'src': true,
    'missions': true,
    '.pi': false
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Toggle directory expansion
  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => ({ ...prev, [folderPath]: !prev[folderPath] }));
  };

  // Filter nodes based on search query
  const filterNodes = (nodes: GcsFileNode[], query: string): GcsFileNode[] => {
    if (!query.trim()) return nodes;
    const q = query.toLowerCase();
    
    return nodes.reduce<GcsFileNode[]>((acc, node) => {
      if (node.type === 'file') {
        if (node.name.toLowerCase().includes(q) || node.path.toLowerCase().includes(q)) {
          acc.push(node);
        }
      } else if (node.type === 'directory' && node.children) {
        const filteredChildren = filterNodes(node.children, query);
        if (filteredChildren.length > 0 || node.name.toLowerCase().includes(q)) {
          acc.push({ ...node, children: filteredChildren });
        }
      }
      return acc;
    }, []);
  };

  const filteredTree = useMemo(() => filterNodes(fileTree, searchQuery), [fileTree, searchQuery]);

  const handleSelectFile = (file: GcsFileNode) => {
    setSelectedFile(file);
    if (onFileSelect) onFileSelect(file);
  };

  const handleCopyContent = () => {
    if (!selectedFile?.content) return;
    navigator.clipboard.writeText(selectedFile.content);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  const handleDownloadFile = () => {
    if (!selectedFile) return;
    const blob = new Blob([selectedFile.content || ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRefreshTree = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  // Helper to render tree nodes recursively
  const renderTreeNodes = (nodes: GcsFileNode[], level = 0) => {
    return nodes.map(node => {
      const isDir = node.type === 'directory';
      const isExpanded = expandedFolders[node.path];
      const isSelected = selectedFile?.path === node.path;

      return (
        <div key={node.id} style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            onClick={() => {
              if (isDir) {
                toggleFolder(node.path);
              } else {
                handleSelectFile(node);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 8px',
              paddingLeft: `${level * 14 + 10}px`,
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontFamily: 'var(--mono)',
              backgroundColor: isSelected ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent',
              color: isSelected ? 'var(--accent)' : 'var(--text)',
              borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'all 0.15s ease'
            }}
          >
            {isDir ? (
              <span style={{ fontSize: '10px', color: 'var(--muted)', width: '12px', textAlign: 'center' }}>
                {isExpanded ? '▼' : '▶'}
              </span>
            ) : (
              <span style={{ width: '12px' }} />
            )}

            <span style={{ fontSize: '12px' }}>
              {isDir ? (isExpanded ? '📂' : '📁') : getFileIcon(node.name)}
            </span>

            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontWeight: isDir ? 700 : 400
            }}>
              {node.name}
            </span>

            {node.size && !isDir && (
              <span style={{ marginLeft: 'auto', fontSize: '9px', color: 'var(--muted)' }}>
                {formatFileSize(node.size)}
              </span>
            )}
          </div>

          {isDir && isExpanded && node.children && (
            <div>{renderTreeNodes(node.children, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        backgroundColor: 'var(--surface)',
        color: 'var(--text)',
        borderRadius: '0',
        border: 'none',
        overflow: 'hidden'
      }}
    >
      {/* Bucket & Path Diagnostic Header */}
      <div style={{
        padding: '8px 12px',
        backgroundColor: 'var(--surface-alt)',
        borderBottom: '1px solid var(--border-soft)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span style={{ fontSize: '13px' }}>🗄️</span>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '9.5px', fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>
                DEDICATED GCS BUCKET
              </span>
              <span style={{ fontSize: '8px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--status-success)', padding: '1px 5px', borderRadius: '3px', fontWeight: 800 }}>
                FUSE MOUNTED
              </span>
            </div>
            <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {actualBucket}
            </div>
          </div>
        </div>

        <button
          onClick={handleRefreshTree}
          disabled={isRefreshing}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-soft)',
            color: 'var(--muted)',
            borderRadius: '4px',
            padding: '3px 7px',
            fontSize: '9.5px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <span style={{ display: 'inline-block', transform: isRefreshing ? 'rotate(360deg)' : 'none', transition: 'transform 0.5s' }}>
            🔄
          </span>
          Refresh
        </button>
      </div>

      {/* Main Split View: Left Tree + Right Editor */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left Tree Panel */}
        <div style={{
          width: '220px',
          borderRight: '1px solid var(--border-soft)',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--surface-alt)'
        }}>
          {/* Search Box */}
          <div style={{ padding: '6px' }}>
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '4px 8px',
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border-soft)',
                borderRadius: '4px',
                color: 'var(--text)',
                fontSize: '10px',
                outline: 'none',
                fontFamily: 'var(--mono)'
              }}
            />
          </div>

          {/* Tree View list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px' }}>
            {filteredTree.length > 0 ? (
              renderTreeNodes(filteredTree)
            ) : (
              <div style={{ padding: '16px', textOverflow: 'ellipsis', fontSize: '10px', color: 'var(--muted)', textAlign: 'center' }}>
                No files found matching "{searchQuery}"
              </div>
            )}
          </div>

          {/* Directory Mount Info */}
          <div style={{
            padding: '5px 8px',
            borderTop: '1px solid var(--border-soft)',
            fontSize: '8.5px',
            color: 'var(--muted)',
            fontFamily: 'var(--mono)',
            backgroundColor: 'var(--surface-alt)'
          }}>
            Mount: <span style={{ color: 'var(--text)' }}>{workspaceRoot}</span>
          </div>
        </div>

        {/* Right Code Viewer Panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--surface)', minWidth: 0 }}>
          {selectedFile ? (
            <>
              {/* File Header Bar */}
              <div style={{
                padding: '6px 12px',
                backgroundColor: 'var(--surface-alt)',
                borderBottom: '1px solid var(--border-soft)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <span style={{ fontSize: '13px' }}>{getFileIcon(selectedFile.name)}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedFile.path}
                    </div>
                    <div style={{ fontSize: '8.5px', color: 'var(--muted)', display: 'flex', gap: '8px' }}>
                      <span>Size: {formatFileSize(selectedFile.size || 0)}</span>
                      <span>Lines: {(selectedFile.content || '').split('\n').length}</span>
                      <span>GCS Updated: {selectedFile.updatedAt ? new Date(selectedFile.updatedAt).toLocaleTimeString() : 'Recent'}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    onClick={handleCopyContent}
                    style={{
                      backgroundColor: copiedNotification ? 'rgba(16, 185, 129, 0.15)' : 'var(--surface)',
                      border: '1px solid var(--border-soft)',
                      color: copiedNotification ? 'var(--status-success)' : 'var(--text)',
                      borderRadius: '4px',
                      padding: '3px 8px',
                      fontSize: '9.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {copiedNotification ? '✓ Copied!' : '📋 Copy'}
                  </button>
                  <button
                    onClick={handleDownloadFile}
                    style={{
                      backgroundColor: 'var(--accent)',
                      border: 'none',
                      color: 'var(--accent-contrast)',
                      borderRadius: '4px',
                      padding: '3px 8px',
                      fontSize: '9.5px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    📥 Download
                  </button>
                </div>
              </div>

              {/* Code Content Area */}
              <div style={{ flex: 1, overflow: 'auto', padding: '10px', backgroundColor: 'var(--surface)' }}>
                <pre style={{
                  margin: 0,
                  fontFamily: 'var(--mono)',
                  fontSize: '10.5px',
                  lineHeight: '1.6',
                  color: 'var(--text)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  <code>
                    {(selectedFile.content || '// Empty file').split('\n').map((line, idx) => (
                      <div key={idx} style={{ display: 'flex' }}>
                        <span style={{
                          width: '32px',
                          display: 'inline-block',
                          color: 'var(--muted)',
                          opacity: 0.7,
                          textAlign: 'right',
                          paddingRight: '10px',
                          userSelect: 'none',
                          flexShrink: 0
                        }}>
                          {idx + 1}
                        </span>
                        <span style={{ flex: 1 }}>{line || ' '}</span>
                      </div>
                    ))}
                  </code>
                </pre>
              </div>
            </>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--muted)',
              gap: '8px'
            }}>
              <span style={{ fontSize: '24px' }}>📂</span>
              <span style={{ fontSize: '10px' }}>Select a file from the GCS tree to inspect its contents</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function getFileIcon(filename: string): string {
  if (filename.endsWith('.ts') || filename.endsWith('.tsx')) return '📘';
  if (filename.endsWith('.js') || filename.endsWith('.jsx')) return '🟨';
  if (filename.endsWith('.json')) return '⚙️';
  if (filename.endsWith('.md')) return '📝';
  if (filename.endsWith('.css')) return '🎨';
  if (filename.endsWith('.html')) return '🌐';
  if (filename.endsWith('.sh')) return '📜';
  return '📄';
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default GcsFileExplorer;
