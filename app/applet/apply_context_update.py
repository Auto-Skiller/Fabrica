import re

target_path = 'frontend-next/app/dashboard/page.tsx'
with open(target_path, 'r') as f:
    content = f.read()

# 1. Add state for isAgentsMdWindowOpen
state_target = "const [isToolsWindowOpen, setIsToolsWindowOpen] = useState<boolean>(false);"
state_replacement = """const [isToolsWindowOpen, setIsToolsWindowOpen] = useState<boolean>(false);
  const [isAgentsMdWindowOpen, setIsAgentsMdWindowOpen] = useState<boolean>(false);"""

if state_target in content:
    content = content.replace(state_target, state_replacement, 1)
    print("1. Added isAgentsMdWindowOpen state!")
else:
    print("WARNING: Could not find state_target")

# 2. Replace Agent/Context switcher in Top Header with Context Progress Bar
header_switcher_code = """                    {/* Agent / Cache Switcher */}
                    <div style={{ display: 'flex', gap: '1px', background: 'var(--surface-alt)', paddingTop: '1px', paddingBottom: '1px', borderRadius: '3px', border: '1px solid var(--border-soft)' }}>
                      <button
                        onClick={() => setLeftTab('agent')}
                        style={{
                          paddingLeft: '0px',
                          paddingRight: '7px',
                          paddingTop: '1px',
                          paddingBottom: '1px',
                          fontSize: '7px',
                          fontWeight: 800,
                          borderRadius: '2px',
                          border: 'none',
                          background: leftTab === 'agent' ? 'var(--accent)' : 'transparent',
                          color: leftTab === 'agent' ? '#fff' : 'var(--muted)',
                          cursor: 'pointer',
                          textTransform: 'uppercase',
                          transition: 'all 0.15s'
                        }}
                      >
                        {dtxt.agentTab}
                      </button>
                      <button
                        onClick={() => setLeftTab('context')}
                        style={{
                          padding: '1px 4px',
                          fontSize: '7px',
                          fontWeight: 800,
                          borderRadius: '2px',
                          border: 'none',
                          background: leftTab === 'context' ? 'var(--accent)' : 'transparent',
                          color: leftTab === 'context' ? '#fff' : 'var(--muted)',
                          cursor: 'pointer',
                          textTransform: 'uppercase',
                          transition: 'all 0.15s'
                        }}
                      >
                        {dtxt.contextTab || '📄 Context'}
                      </button>
                    </div>"""

header_ctx_bar_code = """                    {/* Real PI Agent Context Window Usage Meter Bar in Header */}
                    {(() => {
                      const fallbackTokens = Math.round((chatHistory.reduce((acc, m) => acc + (m.text?.length || 0), 0) + (agentsMdContent?.length || 0)) / 4);
                      const approxContextTokens = piContext ? piContext.tokensUsed : fallbackTokens;
                      const maxContextWindow = piContext ? piContext.maxTokens : (chatModel.includes('gemini') ? 1000000 : chatModel.includes('claude') ? 200000 : 128000);
                      const contextPct = piContext ? piContext.percentUsed : Math.min(100, Math.max(1, Math.round((approxContextTokens / maxContextWindow) * 100)));
                      return (
                        <div
                          onClick={() => {
                            const tenantKey = user?.id || activeEntity || 'default_user';
                            refreshPiContext(tenantKey);
                            fetchAgentsMd();
                            setIsAgentsMdWindowOpen(true);
                          }}
                          title={`Real PI Context Window Usage: ${approxContextTokens.toLocaleString()} / ${maxContextWindow >= 1000000 ? (maxContextWindow/1000000).toFixed(1) + 'M' : (maxContextWindow/1000).toFixed(0) + 'k'} tokens (${contextPct}%). Click to refresh & open Workspace Context.`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'var(--surface-alt)',
                            border: '1px solid var(--border-soft)',
                            borderRadius: '3px',
                            padding: '1px 5px',
                            height: '18px',
                            fontSize: '7px',
                            fontFamily: 'var(--mono)',
                            fontWeight: 800,
                            color: 'var(--text-bright)',
                            cursor: 'pointer',
                            flexShrink: 0,
                            transition: 'all 0.15s'
                          }}
                        >
                          <span style={{ color: 'var(--accent-2)', fontSize: '7.5px' }}>🧠</span>
                          <span>CTX: {(approxContextTokens / 1000).toFixed(1)}k / {maxContextWindow >= 1000000 ? `${(maxContextWindow/1000000).toFixed(1)}M` : `${(maxContextWindow/1000).toFixed(0)}k`} ({contextPct}%)</span>
                        </div>
                      );
                    })()}"""

if header_switcher_code in content:
    content = content.replace(header_switcher_code, header_ctx_bar_code, 1)
    print("2. Replaced Agent/Context switcher with Context Progress Bar in header!")
else:
    print("WARNING: Could not match header_switcher_code")

# 3. Remove CTX meter bar from bottom chat input bar
ctx_bottom_code_start = "                        {/* Real PI Agent Context Window Usage Meter Bar */}"
ctx_bottom_code_end = "                        })()}"

idx_ctx_start = content.find(ctx_bottom_code_start)
if idx_ctx_start != -1:
    idx_ctx_end = content.find(ctx_bottom_code_end, idx_ctx_start)
    if idx_ctx_end != -1:
        content = content[:idx_ctx_start] + content[idx_ctx_end + len(ctx_bottom_code_end):]
        print("3. Removed CTX meter bar from bottom toolbar!")
else:
    print("WARNING: Could not find ctx_bottom_code_start")

# 4. Add Project Context Button to the LEFT of Skills & Extensions button in bottombar
skills_btn_code = """          {/* Unified Capabilities Button (Skills & Extensions) */}"""

project_context_btn_code = """          {/* Project Context (Workspace Context - AGENTS.md) Button */}
          <button
            onClick={() => {
              fetchAgentsMd();
              setIsAgentsMdWindowOpen(true);
            }}
            className="mini accent"
            style={{
              padding: '4px 10px',
              fontSize: '9.5px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              border: 'none',
              color: '#fff',
              height: '24px',
              flexShrink: 0,
              cursor: 'pointer',
              borderRadius: '4px',
              transition: 'all 0.15s'
            }}
            title="Click to open Workspace Context (AGENTS.md) directives window"
          >
            <span>📄 Project Context</span>
          </button>

          {/* Unified Capabilities Button (Skills & Extensions) */}"""

if skills_btn_code in content:
    content = content.replace(skills_btn_code, project_context_btn_code, 1)
    print("4. Added Project Context button to left of Skills & Extensions button!")
else:
    print("WARNING: Could not find skills_btn_code")

# 5. Add Modal Window overlay for Workspace Context (AGENTS.md)
idx_tools = content.find("{/* ================= ACCOUNT & API ENGINE WINDOW ================= */}")

agents_md_modal_code = """      {/* ================= WORKSPACE CONTEXT (AGENTS.MD) WINDOW ================= */}
      {isAgentsMdWindowOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(9, 13, 22, 0.75)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          zIndex: 900,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}>
          <div dir={uiLang === 'AR' ? 'rtl' : 'ltr'} style={{
            width: 'min(75rem, 95vw)',
            height: 'min(45rem, 85vh)',
            background: 'var(--surface)',
            border: '2px solid var(--border)',
            borderRadius: '12px',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.4), var(--shadow)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justify: 'space-between',
              padding: '12px 18px',
              borderBottom: '2px solid var(--border)',
              background: 'var(--surface-alt)',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.25rem' }}>📄</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <b style={{ fontSize: '11px', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>WORKSPACE CONTEXT (AGENTS.md)</b>
                  <span style={{ fontSize: '8.5px', color: 'var(--muted)' }}>
                    System directives, project guidelines & context active for the AI agent
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsAgentsMdWindowOpen(false)}
                className="fw-close-btn"
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '14px',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  borderRadius: '4px',
                  transition: 'all 0.15s'
                }}
              >
                ✕
              </button>
            </div>

            {/* Body: AGENTS.md Editor / Viewer */}
            <div style={{ flex: 1, padding: '16px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }}>
              {/* Controls & Mode Bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justify: 'space-between',
                gap: '8px',
                background: 'var(--surface-alt)',
                border: '1px solid var(--border-soft)',
                borderRadius: '6px',
                padding: '6px 10px',
                flexShrink: 0
              }}>
                {/* Mode Switcher */}
                <div style={{ display: 'flex', gap: '4px', background: 'var(--surface)', padding: '2px', borderRadius: '4px', border: '1px solid var(--border-soft)' }}>
                  <button
                    onClick={() => setAgentsMdMode('edit')}
                    style={{
                      padding: '3px 10px',
                      fontSize: '9px',
                      fontWeight: 800,
                      borderRadius: '3px',
                      border: 'none',
                      background: agentsMdMode === 'edit' ? 'var(--accent)' : 'transparent',
                      color: agentsMdMode === 'edit' ? '#fff' : 'var(--muted)',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    ✏️ Edit Directives
                  </button>
                  <button
                    onClick={() => setAgentsMdMode('preview')}
                    style={{
                      padding: '3px 10px',
                      fontSize: '9px',
                      fontWeight: 800,
                      borderRadius: '3px',
                      border: 'none',
                      background: agentsMdMode === 'preview' ? 'var(--accent)' : 'transparent',
                      color: agentsMdMode === 'preview' ? '#fff' : 'var(--muted)',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    👁️ Formatted Preview
                  </button>
                </div>

                {/* Stats & Path */}
                <span style={{ fontSize: '9px', fontFamily: 'var(--mono)', color: 'var(--muted)' }}>
                  {agentsMdContent.split('\\n').length} lines · {agentsMdContent.length.toLocaleString()} chars · path: <code style={{ color: 'var(--accent)' }}>{agentsMdPath || 'AGENTS.md'}</code>
                </span>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    onClick={fetchAgentsMd}
                    disabled={isLoadingAgentsMd}
                    title="Reload AGENTS.md from disk"
                    className="mini outline"
                    style={{ height: '26px', padding: '0 8px', fontSize: '9px', fontWeight: 800 }}
                  >
                    {isLoadingAgentsMd ? '⌛ Loading...' : '↺ Reload'}
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(agentsMdContent);
                      setToast({ message: 'Copied AGENTS.md to clipboard!', type: 'success', isOpen: true });
                    }}
                    title="Copy full AGENTS.md content to clipboard"
                    className="mini outline"
                    style={{ height: '26px', padding: '0 8px', fontSize: '9px', fontWeight: 800 }}
                  >
                    📋 Copy
                  </button>
                  <button
                    onClick={handleSaveAgentsMd}
                    disabled={isSavingAgentsMd}
                    className="mini accent"
                    style={{ height: '26px', padding: '0 12px', fontSize: '9px', fontWeight: 800 }}
                  >
                    {isSavingAgentsMd ? '⚙️ Saving...' : '💾 Save Changes'}
                  </button>
                </div>
              </div>

              {/* Presets */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '9px', color: 'var(--muted)', fontWeight: 800 }}>⚡ Quick Directives:</span>
                <button
                  onClick={() => setAgentsMdContent(prev => prev + '\\n\\n## Custom Directive\\n- Always validate typescript types before writing file.')}
                  className="mini outline"
                  style={{ fontSize: '8px', padding: '2px 6px', height: '22px' }}
                >
                  + Type Validation
                </button>
                <button
                  onClick={() => setAgentsMdContent(prev => prev + '\\n\\n## Storage Directive\\n- Store state in db/missions.json.')}
                  className="mini outline"
                  style={{ fontSize: '8px', padding: '2px 6px', height: '22px' }}
                >
                  + Storage Protocol
                </button>
                <button
                  onClick={() => setAgentsMdContent(prev => prev + '\\n\\n## Security Directive\\n- Enforce strict RLS policies and never leak secret keys.')}
                  className="mini outline"
                  style={{ fontSize: '8px', padding: '2px 6px', height: '22px' }}
                >
                  + Security Policy
                </button>
              </div>

              {/* Editor / Preview Container */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
                {agentsMdMode === 'edit' ? (
                  <textarea
                    value={agentsMdContent}
                    onChange={(e) => setAgentsMdContent(e.target.value)}
                    placeholder="# AGENTS.md - System Directives & Context..."
                    style={{
                      width: '100%',
                      height: '100%',
                      background: 'var(--surface-alt)',
                      border: '1px solid var(--border-soft)',
                      borderRadius: '6px',
                      padding: '12px',
                      color: 'var(--text-bright)',
                      fontFamily: 'var(--mono)',
                      fontSize: '11px',
                      lineHeight: '1.6',
                      outline: 'none',
                      resize: 'none'
                    }}
                  />
                ) : (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    background: 'var(--surface-alt)',
                    border: '1px solid var(--border-soft)',
                    borderRadius: '6px',
                    padding: '14px',
                    color: 'var(--text)',
                    fontSize: '11px',
                    lineHeight: '1.6',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'var(--mono)'
                  }}>
                    {agentsMdContent}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

"""

if idx_tools != -1:
    content = content[:idx_tools] + agents_md_modal_code + content[idx_tools:]
    print("5. Added Workspace Context (AGENTS.md) Modal Window overlay!")
else:
    print("WARNING: Could not find idx_tools")

with open(target_path, 'w') as f:
    f.write(content)
