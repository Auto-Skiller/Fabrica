import sys

with open('frontend-next/app/dashboard/page.tsx', 'r') as f:
    content = f.read()

# 1. Add to chat input toolbar (next to CTX meter before Send button)
old_chat_action_toolbar = '''                        {/* Real PI Agent Context Window Usage Meter Bar */}'''

new_chat_controls = '''                        {/* Agent Output Language Dropdown */}
                        <select
                          value={agentLang}
                          onChange={(e) => handleAgentLangChange(e.target.value as 'EN' | 'FR' | 'AR')}
                          title="Agent Output Language"
                          style={{
                            height: '22px',
                            background: 'var(--surface-alt)',
                            border: '1px solid var(--border-soft)',
                            borderRadius: '4px',
                            color: 'var(--text-bright)',
                            fontSize: '8px',
                            fontWeight: 800,
                            padding: '0 4px',
                            cursor: 'pointer',
                            outline: 'none',
                            flexShrink: 0
                          }}
                        >
                          <option value="EN">🗣️ EN</option>
                          <option value="FR">🗣️ FR</option>
                          <option value="AR">🗣️ AR</option>
                        </select>

                        {/* Internet / Web Search Toggle Button */}
                        <button
                          type="button"
                          onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                          title={webSearchEnabled ? "Web Search Grounding (Internet Access) ENABLED" : "Web Search Grounding (Internet Access) DISABLED"}
                          style={{
                            height: '22px',
                            padding: '0 6px',
                            fontSize: '8px',
                            fontWeight: 800,
                            borderRadius: '4px',
                            border: `1px solid ${webSearchEnabled ? '#10b981' : 'var(--border-soft)'}`,
                            background: webSearchEnabled ? 'rgba(16, 185, 129, 0.15)' : 'var(--surface-alt)',
                            color: webSearchEnabled ? '#10b981' : 'var(--text-bright)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            flexShrink: 0,
                            transition: 'all 0.15s'
                          }}
                        >
                          <span style={{ fontSize: '9.5px' }}>🌐</span>
                          <span>{webSearchEnabled ? 'WEB ON' : 'WEB OFF'}</span>
                        </button>

                        {/* Real PI Agent Context Window Usage Meter Bar */}'''

if old_chat_action_toolbar in content:
    content = content.replace(old_chat_action_toolbar, new_chat_controls, 1)
    print('Added Agent Lang Dropdown & Web Search Toggle to chat input toolbar!')

# 2. Add to Agent Chat Header next to Model selector
old_header_model_selector = '''                    {/* Model Selector */}'''

new_header_controls = '''                    {/* Internet / Web Search Toggle Button */}
                    <button
                      type="button"
                      onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                      title={webSearchEnabled ? "Web Search Grounding (Internet Access) ENABLED" : "Web Search Grounding (Internet Access) DISABLED"}
                      style={{
                        height: '18px',
                        padding: '0 4px',
                        fontSize: '7px',
                        fontWeight: 800,
                        borderRadius: '3px',
                        border: `1px solid ${webSearchEnabled ? '#10b981' : 'var(--border-soft)'}`,
                        background: webSearchEnabled ? 'rgba(16, 185, 129, 0.15)' : 'var(--surface-alt)',
                        color: webSearchEnabled ? '#10b981' : 'var(--text-bright)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        flexShrink: 0,
                        transition: 'all 0.15s'
                      }}
                    >
                      <span style={{ fontSize: '8.5px' }}>🌐</span>
                      <span>{webSearchEnabled ? 'WEB ON' : 'WEB OFF'}</span>
                    </button>

                    {/* Agent Output Language Dropdown */}
                    <select
                      value={agentLang}
                      onChange={(e) => handleAgentLangChange(e.target.value as 'EN' | 'FR' | 'AR')}
                      title="Agent Response Output Language"
                      style={{
                        height: '18px',
                        background: 'var(--surface-alt)',
                        border: '1px solid var(--border-soft)',
                        borderRadius: '3px',
                        color: 'var(--accent)',
                        fontSize: '7px',
                        fontWeight: 800,
                        padding: '0 2px',
                        cursor: 'pointer',
                        outline: 'none',
                        flexShrink: 0
                      }}
                    >
                      <option value="EN">🗣️ EN</option>
                      <option value="FR">🗣️ FR</option>
                      <option value="AR">🗣️ AR</option>
                    </select>

                    {/* Model Selector */}'''

if old_header_model_selector in content:
    content = content.replace(old_header_model_selector, new_header_controls, 1)
    print('Added Agent Lang Dropdown & Web Search Toggle to Agent Header!')

with open('frontend-next/app/dashboard/page.tsx', 'w') as f:
    f.write(content)
