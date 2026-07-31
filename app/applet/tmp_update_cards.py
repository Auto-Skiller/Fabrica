with open('frontend-next/app/dashboard/page.tsx', 'r') as f:
    content = f.read()

target_anchor = "{/* 2 Agent Suggestion Cards - Line 1 */}"
idx = content.find(target_anchor)
print("Anchor index:", idx)

if idx != -1:
    # Find the closing tag for <div style={{ marginBottom: '6px' }}> ... </div>
    # It ends before {/* Chat Input Top Border Divider */}
    divider_idx = content.find("{/* Chat Input Top Border Divider */}", idx)
    print("Divider index:", divider_idx)
    if divider_idx != -1:
        old_slice = content[idx:divider_idx]
        new_slice = """{/* 3 Agent Suggestion Cards (1 Top Card + 2 Grid Cards) */}
                    <div style={{ marginBottom: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {(() => {
                        const baseDefaults = pbSuggestions;
                        let displayList: Array<{ title: string; icon: string; prompt: string; desc: string }> = [];

                        if (agentSuggestions && agentSuggestions.length > 0) {
                          displayList = agentSuggestions.map((s: any, idx: number) => {
                            if (typeof s === 'object' && s !== null) {
                              const promptVal = s.prompt || s.description || s.title || '';
                              return {
                                title: s.title || s.name || `Option ${idx + 1}`,
                                icon: s.icon || '⚡',
                                prompt: promptVal,
                                desc: s.description || s.title || promptVal
                              };
                            }
                            const strVal = String(s);
                            return {
                              title: `Option ${idx + 1}`,
                              icon: '⚡',
                              prompt: strVal,
                              desc: strVal
                            };
                          });
                        }

                        // Always pad with base defaults to guarantee at least 3 cards
                        if (displayList.length < 3) {
                          const missingCount = 3 - displayList.length;
                          for (let i = 0; i < missingCount; i++) {
                            if (baseDefaults[i]) {
                              displayList.push(baseDefaults[i]);
                            }
                          }
                        }

                        const items = displayList.slice(0, 3);
                        const topCard = items[0];
                        const bottomCards = items.slice(1, 3);

                        return (
                          <>
                            {/* Top Suggestion Card (3rd card placed above) */}
                            {topCard && (
                              <button
                                onClick={() => handleSendChat(topCard.prompt)}
                                title={`${topCard.title}: ${topCard.desc}`}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justify: 'space-between',
                                  padding: '4px 6px',
                                  borderRadius: '4px',
                                  background: 'var(--surface-alt)',
                                  border: '1px solid var(--border-soft)',
                                  color: 'var(--text)',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s',
                                  textAlign: 'left',
                                  gap: '4px',
                                  width: '100%',
                                  minWidth: 0,
                                  overflow: 'hidden'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                  <span style={{ fontSize: '8px', flexShrink: 0 }}>{topCard.icon || '⚡'}</span>
                                  <span style={{ fontWeight: 800, fontSize: '7.5px', whiteSpace: 'nowrap', color: 'var(--accent)', flexShrink: 0 }}>
                                    {topCard.title}
                                  </span>
                                  <span style={{ fontSize: '6.5px', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>
                                    — {topCard.desc}
                                  </span>
                                </div>
                                <span style={{ fontSize: '7px', color: 'var(--accent)', fontWeight: 800, flexShrink: 0 }}>⚡</span>
                              </button>
                            )}

                            {/* 2 Cards Grid underneath */}
                            <div style={{ 
                              display: 'grid', 
                              gridTemplateColumns: 'repeat(2, 1fr)', 
                              gap: '4px'
                            }}>
                              {bottomCards.map((s, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => handleSendChat(s.prompt)}
                                  title={`${s.title}: ${s.desc}`}
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justify: 'center',
                                    alignItems: 'flex-start',
                                    padding: '4px 6px',
                                    borderRadius: '4px',
                                    background: 'var(--surface-alt)',
                                    border: '1px solid var(--border-soft)',
                                    color: 'var(--text)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                    textAlign: 'left',
                                    gap: '1px',
                                    minWidth: 0,
                                    overflow: 'hidden'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '3px', width: '100%', minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                      <span style={{ fontSize: '8px', flexShrink: 0 }}>{s.icon || '🤖'}</span>
                                      <span style={{ fontWeight: 800, fontSize: '7.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--accent)', flex: 1, minWidth: 0 }}>
                                        {s.title}
                                      </span>
                                    </div>
                                  </div>
                                  <span style={{ fontSize: '6.5px', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', minWidth: 0 }}>
                                    {s.desc}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    """
        content = content[:idx] + new_slice + content[divider_idx:]
        with open('frontend-next/app/dashboard/page.tsx', 'w') as f:
            f.write(content)
        print("REPLACED SUCCESSFULLY!")
