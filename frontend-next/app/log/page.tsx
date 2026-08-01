'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../components/auth/supabase';

function renderDashboardMock() {
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      height: '100%',
      zIndex: 0,
      overflow: 'hidden',
      pointerEvents: 'none',
      userSelect: 'none',
      display: 'flex',
      flexDirection: 'column',
      background: '#EAECEE',
      opacity: 0.8,
      filter: 'blur(3px)',
      paddingBottom: '42px',
      boxSizing: 'border-box'
    }}>
      {/* 3 Panels Row */}
      <div style={{
        flex: 1,
        display: 'flex',
        padding: '16px 16px 12px 16px',
        gap: '12px',
        height: 'calc(100% - 42px)',
        boxSizing: 'border-box'
      }}>
        {/* Panel 1: Agent Chat (Left Panel) */}
        <div style={{
          width: '24%',
          minWidth: '290px',
          background: '#FFFFFF',
          border: '2px solid #1C1C1E',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}>
          {/* Panel Header */}
          <div style={{
            padding: '10px 12px',
            borderBottom: '2px solid #1C1C1E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#FAF9F6'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                background: 'rgba(204, 122, 74, 0.1)',
                border: '1.5px solid #CC7A4A',
                borderRadius: '6px',
                padding: '3px 8px',
                fontSize: '9px',
                fontWeight: 900,
                color: '#CC7A4A',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                💬 PI CHAT
              </div>
              <div style={{
                border: '1.5px solid #1C1C1E',
                borderRadius: '6px',
                padding: '3px 6px',
                fontSize: '9px',
                fontWeight: 800,
                color: '#CC7A4A',
                background: '#FFFFFF'
              }}>
                PI CLI AGENT ∨
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{
                border: '1.5px solid #1C1C1E',
                borderRadius: '6px',
                padding: '3px 6px',
                fontSize: '8px',
                fontWeight: 800,
                background: 'rgba(204, 122, 74, 0.15)',
                color: '#CC7A4A'
              }}>
                SESSION 1
              </div>
              <div style={{
                width: '18px',
                height: '18px',
                border: '1.5px solid #1C1C1E',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                fontWeight: 'bold',
                background: '#FFFFFF'
              }}>+</div>
            </div>
          </div>

          {/* Chat Messages */}
          <div style={{
            flex: 1,
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            overflowY: 'auto'
          }}>
            {/* Message 1: Fabrica Assistant */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '8px', fontWeight: 900, textTransform: 'uppercase', color: '#64748B', letterSpacing: '0.04em' }}>
                FABRICA ASSISTANT
              </span>
              <div style={{
                background: '#FAF9F6',
                border: '1.5px solid #1C1C1E',
                borderRadius: '12px',
                padding: '10px',
                fontSize: '10px',
                color: '#1C1C1E',
                lineHeight: 1.4
              }}>
                Hello! I am your Fabrica build assistant. I learn how your business actually works, structure your data, and help you watch your company get built. Ask me anything or select one of the suggested paths below!
              </div>
            </div>

            {/* Message 2: You */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '8px', fontWeight: 900, textTransform: 'uppercase', color: '#64748B', letterSpacing: '0.04em' }}>
                YOU
              </span>
              <div style={{
                background: '#CC7A4A',
                border: '1.5px solid #1C1C1E',
                borderRadius: '12px',
                padding: '10px',
                fontSize: '10px',
                color: '#FFFFFF',
                lineHeight: 1.4,
                maxWidth: '90%'
              }}>
                Generate a clear, prioritized executive summary of our active backlog items, including strategic pillars and objectives.
              </div>
            </div>

            {/* Message 3: Fabrica Assistant Error */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '8px', fontWeight: 900, textTransform: 'uppercase', color: '#64748B', letterSpacing: '0.04em' }}>
                FABRICA ASSISTANT
              </span>
              <div style={{
                background: '#FAF9F6',
                border: '1.5px solid #1C1C1E',
                borderRadius: '12px',
                padding: '10px',
                fontSize: '10px',
                color: '#ef4444',
                fontFamily: 'monospace',
                lineHeight: 1.4,
                wordBreak: 'break-all'
              }}>
                Failed to stream response: {"{"}"error": {"{"}"code": 429, "message": "You exceeded your current quota, please check your plan and billing details..."{"}"}{"}"}
              </div>
            </div>
          </div>

          {/* Bottom Action Suggestion buttons */}
          <div style={{
            padding: '8px 12px',
            borderTop: '1.5px solid #1C1C1E',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            background: '#FAF9F6'
          }}>
            <div style={{
              background: '#FFFFFF',
              border: '1.5px solid #1C1C1E',
              borderRadius: '6px',
              padding: '6px 10px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}>
              <span style={{ fontSize: '9px', fontWeight: 900, color: '#1C1C1E' }}>📋 Summarize Backlog</span>
              <span style={{ fontSize: '7.5px', color: '#64748B' }}>Get a prioritized audit of current tasks.</span>
            </div>
            <div style={{
              background: '#FFFFFF',
              border: '1.5px solid #1C1C1E',
              borderRadius: '6px',
              padding: '6px 10px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}>
              <span style={{ fontSize: '9px', fontWeight: 900, color: '#1C1C1E' }}>🎯 Alignment Audit</span>
              <span style={{ fontSize: '7.5px', color: '#64748B' }}>Check if goals and missions are synced.</span>
            </div>
          </div>

          {/* Chat input box */}
          <div style={{
            padding: '10px 12px',
            borderTop: '2px solid #1C1C1E',
            background: '#FFFFFF',
            display: 'flex',
            gap: '8px',
            alignItems: 'center'
          }}>
            <input
              type="text"
              placeholder="Ask the Fabrica Agent..."
              disabled
              style={{
                flex: 1,
                background: '#FAF9F6',
                border: '1.5px solid #1C1C1E',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '10px',
                outline: 'none',
                color: '#64748B'
              }}
            />
            <div style={{
              background: '#CC7A4A',
              color: '#FFFFFF',
              border: '1.5px solid #1C1C1E',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '10px',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              Send
            </div>
          </div>
        </div>

        {/* Panel 2: Kanban columns (Middle Panel) */}
        <div style={{
          flex: 1,
          background: '#FFFFFF',
          border: '2px solid #1C1C1E',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          boxSizing: 'border-box'
        }}>
          {/* Overlapping side tabs in margins */}
          <div style={{
            position: 'absolute',
            left: '-2px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '12px',
            height: '42px',
            background: '#FFFFFF',
            border: '2px solid #1C1C1E',
            borderLeft: 'none',
            borderRadius: '0 6px 6px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '8px',
            fontWeight: 'bold',
            zIndex: 10
          }}>
            &lt;
          </div>
          <div style={{
            position: 'absolute',
            right: '-2px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '12px',
            height: '42px',
            background: '#FFFFFF',
            border: '2px solid #1C1C1E',
            borderRight: 'none',
            borderRadius: '6px 0 0 6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '8px',
            fontWeight: 'bold',
            zIndex: 10
          }}>
            &gt;
          </div>

          {/* Kanban Header Controls */}
          <div style={{
            padding: '10px 14px',
            borderBottom: '2px solid #1C1C1E',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#FAF9F6',
            flexWrap: 'wrap'
          }}>
            {/* Tabs */}
            <div style={{ display: 'flex', border: '1.5px solid #1C1C1E', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{ background: '#CC7A4A', color: '#FFFFFF', padding: '4px 8px', fontSize: '9px', fontWeight: 900 }}>Board</div>
              <div style={{ background: '#FFFFFF', color: '#64748B', padding: '4px 8px', fontSize: '9px', fontWeight: 800, borderLeft: '1.5px solid #1C1C1E' }}>Graph</div>
            </div>

            {/* Search */}
            <input
              type="text"
              placeholder="🔍 Search..."
              disabled
              style={{
                background: '#FFFFFF',
                border: '1.5px solid #1C1C1E',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '9px',
                width: '100px',
                color: '#64748B'
              }}
            />

            {/* Filters */}
            {['All Categories', 'All States', 'All Priorities', 'Default Sort'].map((filter, index) => (
              <div key={index} style={{
                background: '#FFFFFF',
                border: '1.5px solid #1C1C1E',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '9px',
                fontWeight: 800,
                color: '#64748B',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                {filter} <span style={{ fontSize: '7px' }}>▼</span>
              </div>
            ))}
          </div>

          {/* Kanban Columns */}
          <div style={{
            flex: 1,
            padding: '16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px',
            background: '#FFFFFF'
          }}>
            {/* Column 1: New */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10px', fontWeight: 900, color: '#1C1C1E', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  📝 NEW (0)
                </span>
                <div style={{
                  background: 'rgba(204, 122, 74, 0.1)',
                  border: '1px solid #CC7A4A',
                  color: '#CC7A4A',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  fontSize: '8px',
                  fontWeight: 900
                }}>
                  + Add
                </div>
              </div>
              <div style={{
                flex: 1,
                border: '1.5px dashed #cbd5e1',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                background: '#FAF9F6'
              }}>
                <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>No new items.</span>
              </div>
            </div>

            {/* Column 2: Planning */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10px', fontWeight: 900, color: '#1C1C1E', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  📋 PLANNING (0)
                </span>
              </div>
              <div style={{
                flex: 1,
                border: '1.5px dashed #cbd5e1',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                background: '#FAF9F6'
              }}>
                <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>No items in planning phase.</span>
              </div>
            </div>

            {/* Column 3: Execution */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10px', fontWeight: 900, color: '#1C1C1E', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  ⚡ EXECUTION (0)
                </span>
              </div>
              <div style={{
                flex: 1,
                border: '1.5px dashed #cbd5e1',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                background: '#FAF9F6'
              }}>
                <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>No projects currently executing.</span>
              </div>
            </div>

            {/* Column 4: Done */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10px', fontWeight: 900, color: '#1C1C1E', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  🗄️ DONE (0)
                </span>
              </div>
              <div style={{
                flex: 1,
                border: '1.5px dashed #cbd5e1',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                background: '#FAF9F6'
              }}>
                <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>No completed items.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Panel 3: Data & Projects (Right Panel) */}
        <div style={{
          width: '28%',
          minWidth: '330px',
          background: '#FFFFFF',
          border: '2px solid #1C1C1E',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}>
          {/* Header */}
          <div style={{
            padding: '10px 12px',
            borderBottom: '2px solid #1C1C1E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#FAF9F6'
          }}>
            <span style={{ fontSize: '10px', fontWeight: 900, color: '#1C1C1E', display: 'flex', alignItems: 'center', gap: '4px' }}>
              📂 YOUR DATA & PROJECTS
            </span>
            {/* List, Graph, Cache switcher */}
            <div style={{ display: 'flex', border: '1.5px solid #1C1C1E', borderRadius: '6px', overflow: 'hidden', background: '#FFFFFF' }}>
              <div style={{ background: '#CC7A4A', color: '#FFFFFF', padding: '3px 6px', fontSize: '8px', fontWeight: 900 }}>List</div>
              <div style={{ background: '#FFFFFF', color: '#64748B', padding: '3px 6px', fontSize: '8px', fontWeight: 800, borderLeft: '1.5px solid #1C1C1E' }}>Graph</div>
              <div style={{ background: '#FFFFFF', color: '#64748B', padding: '3px 6px', fontSize: '8px', fontWeight: 800, borderLeft: '1.5px solid #1C1C1E' }}>Cache</div>
            </div>
          </div>

          {/* Scrollable Contents */}
          <div style={{
            flex: 1,
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            overflowY: 'auto'
          }}>
            {/* Section 1: Your Data */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: 900, color: '#1C1C1E' }}>YOUR DATA (0)</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {['NEW', 'REVIEWING', 'UNDERSTOOD'].map((tag, i) => (
                    <span key={i} style={{ fontSize: '7px', fontWeight: 800, color: '#64748B', border: '1px solid #cbd5e1', borderRadius: '3px', padding: '1px 3px' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Upload Drag Box */}
              <div style={{
                border: '1.5px dashed #cbd5e1',
                borderRadius: '8px',
                padding: '20px 12px',
                textAlign: 'center',
                background: '#FAF9F6',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px'
              }}>
                <div style={{ fontSize: '18px', color: '#94a3b8' }}>📄</div>
                <div>
                  <span style={{ fontSize: '9px', fontWeight: 800, color: '#1C1C1E', textDecoration: 'underline' }}>Drag or Click to Upload Your Data</span>
                  <p style={{ margin: '3px 0 0', fontSize: '7.5px', color: '#64748B' }}>Saves securely inside your project space</p>
                </div>
              </div>

              {/* Add Data Source Button */}
              <div style={{
                background: '#CC7A4A',
                color: '#FFFFFF',
                border: '1.5px solid #1C1C1E',
                borderRadius: '6px',
                padding: '6px',
                textAlign: 'center',
                fontSize: '9px',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                + Add Data Source
              </div>
            </div>

            <div style={{ height: '1px', background: '#e2e8f0' }} />

            {/* Section 2: Vertex AI Semantic Search */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '9px', fontWeight: 900, color: '#CC7A4A', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  ⚡ VERTEX AI TENANT SEMANTIC SEARCH
                </span>
                <span style={{ fontSize: '7.5px', fontWeight: 800, background: '#FAF9F6', border: '1px solid #cbd5e1', padding: '1px 3px', borderRadius: '3px' }}>
                  Tenant: workspace
                </span>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  placeholder="Ask questions about your uploaded documents.."
                  disabled
                  style={{
                    flex: 1,
                    background: '#FAF9F6',
                    border: '1.5px solid #1C1C1E',
                    borderRadius: '6px',
                    padding: '5px 8px',
                    fontSize: '9px',
                    color: '#64748B'
                  }}
                />
                <div style={{
                  background: '#CC7A4A',
                  color: '#FFFFFF',
                  border: '1.5px solid #1C1C1E',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  fontSize: '9px',
                  fontWeight: 900
                }}>
                  Search
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '8px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' }}>
                No data sources match the current filter.
              </p>
            </div>

            <div style={{ height: '1px', background: '#e2e8f0' }} />

            {/* Section 3: Your Projects */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: 900, color: '#1C1C1E' }}>YOUR PROJECTS (0)</span>
                <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {['NEW', 'REVIEWING', 'UNDERSTOOD', 'BUILT', 'UPGRADED'].map((tag, i) => (
                    <span key={i} style={{ fontSize: '6.5px', fontWeight: 800, color: '#64748B', border: '1px solid #cbd5e1', borderRadius: '3px', padding: '1px 3px' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Section 4: Add Project Form */}
            <div style={{
              border: '1.5px solid #1C1C1E',
              borderRadius: '8px',
              padding: '10px',
              background: '#FAF9F6',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <span style={{ fontSize: '9px', fontWeight: 900, color: '#1C1C1E' }}>ADD PROJECT</span>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '7.5px', fontWeight: 800, color: '#64748B' }}>Name (e.g. web_storefront_v2)</span>
                <input
                  type="text"
                  placeholder="e.g. web_storefront_v2"
                  disabled
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    padding: '4px 6px',
                    fontSize: '9px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '7.5px', fontWeight: 800, color: '#64748B' }}>Current code snapshot or config YAML...</span>
                <textarea
                  placeholder="Current code snapshot or config YAML..."
                  disabled
                  rows={2}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    padding: '4px 6px',
                    fontSize: '9px',
                    resize: 'none',
                    fontFamily: 'monospace'
                  }}
                />
              </div>

              <div style={{
                background: '#CC7A4A',
                color: '#FFFFFF',
                border: '1.5px solid #1C1C1E',
                borderRadius: '6px',
                padding: '6px',
                textAlign: 'center',
                fontSize: '9px',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                ✓ Add Project
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar (Taskbar) */}
      <div style={{
        height: '42px',
        background: '#FAF9F6',
        borderTop: '2px solid #1C1C1E',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        boxSizing: 'border-box',
        zIndex: 10
      }}>
        {/* Left indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px' }}>📂</span>
            <span style={{ fontSize: '9px', fontWeight: 800, color: '#1C1C1E' }}>0</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px' }}>🔍</span>
            <span style={{ fontSize: '9px', fontWeight: 800, color: '#1C1C1E' }}>0</span>
          </div>
          <div style={{
            background: 'rgba(16, 185, 129, 0.15)',
            color: '#10B981',
            border: '1px solid #10B981',
            borderRadius: '4px',
            padding: '2px 6px',
            fontSize: '8px',
            fontWeight: 900,
            letterSpacing: '0.04em'
          }}>
            APPROVALS PENDING
          </div>
        </div>

        {/* Middle Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', fontWeight: 800 }}>
            <span style={{ color: '#64748B' }}>AUTONOMY:</span>
            <span style={{ color: '#CC7A4A', display: 'flex', alignItems: 'center', gap: '2px' }}>
              • FULL AUTO <span style={{ fontSize: '7px' }}>▼</span>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', fontWeight: 800 }}>
            <span style={{ color: '#1C1C1E' }}>🛠️ TOOLS ON</span>
          </div>
          <div style={{ fontSize: '9px', fontWeight: 800, color: '#64748B' }}>
            Workspace (Orchestrator)
          </div>
        </div>

        {/* Right Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            background: '#10B981',
            color: '#FFFFFF',
            border: '1.5px solid #1C1C1E',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '9px',
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            🛠️ Tools
          </div>
          <div style={{
            background: '#3B82F6',
            color: '#FFFFFF',
            border: '1.5px solid #1C1C1E',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '9px',
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            🔑 Account & API
          </div>
          <div style={{
            background: '#1C1C1E',
            color: '#FFFFFF',
            border: '1.5px solid #1C1C1E',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '9px',
            fontWeight: 900
          }}>
            Logs (0)
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LogPage() {
  const router = useRouter();

  // Theme state (for design consistency)
  const [theme] = useState<'light' | 'dark'>('light');

  // Supabase Auth States
  const [user, setUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);
  const [sandboxEmail, setSandboxEmail] = useState<string>('');
  const [sandboxPassword, setSandboxPassword] = useState<string>('');
  const [isSandboxSignUp, setIsSandboxSignUp] = useState<boolean>(false);

  // Onboarding & Plan Selection States
  const SHOW_PAYMENT_UI = true; // Enabled payment gateway and plan selection
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(false);
  const [onboardingStep, setOnboardingStep] = useState<'info' | 'plan'>('info');
  const [onboardingFullName, setOnboardingFullName] = useState<string>('');
  const [onboardingUsername, setOnboardingUsername] = useState<string>('');
  const [onboardingHearAbout, setOnboardingHearAbout] = useState<string>('');
  const [onboardingCompanyName, setOnboardingCompanyName] = useState<string>('');
  const [onboardingCompanySize, setOnboardingCompanySize] = useState<string>('');
  const [onboardingCompanyRole, setOnboardingCompanyRole] = useState<string>('');
  const [onboardingUseCases, setOnboardingUseCases] = useState<string>('');
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'paug' | 'power' | 'enterprise'>('free');

  // Stripe Onboarding Checkout States
  const [showStripeCheckout, setShowStripeCheckout] = useState<boolean>(false);
  const [isPayingStripe, setIsPayingStripe] = useState<boolean>(false);
  const [cardHolder, setCardHolder] = useState<string>('');
  const [stripeCardNum, setStripeCardNum] = useState<string>('4242 4242 4242 4242');
  const [stripeCardExp, setStripeCardExp] = useState<string>('12/29');
  const [stripeCardCvc, setStripeCardCvc] = useState<string>('123');
  const [stripeCardZip, setStripeCardZip] = useState<string>('90210');
  const [stripeCardBrand, setStripeCardBrand] = useState<string>('Visa');

  // Forgot Password / Recovery States
  const [isForgotPassword, setIsForgotPassword] = useState<boolean>(false);
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [isRecoveryMode, setIsRecoveryMode] = useState<boolean>(false);
  const [newPassword, setNewPassword] = useState<string>('');

  // Toast Notification State
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
    isOpen: boolean;
  }>({
    message: '',
    type: 'info',
    isOpen: false
  });

  // Automatically hide toast
  useEffect(() => {
    if (toast.isOpen) {
      const timer = setTimeout(() => {
        setToast((t) => ({ ...t, isOpen: false }));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toast.isOpen]);

  // Sync recovery mode from URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const hash = window.location.hash;
      if (params.get('recovery') === 'true' || hash.includes('type=recovery') || hash.includes('access_token=')) {
        setIsRecoveryMode(true);
      }
    }
  }, []);

  // Auth session initialization
  useEffect(() => {
    let active = true;

    const initializeAuth = async () => {
      let initialUser: any = null;

      // 1. Check local sandbox session
      const savedUser = typeof window !== 'undefined' ? localStorage.getItem('fabrica_sandbox_user') : null;
      if (savedUser) {
        try {
          initialUser = JSON.parse(savedUser);
        } catch (e) {
          console.warn('Failed parsing sandbox user:', e);
        }
      }

      // 2. Check Supabase session
      if (supabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            initialUser = session.user;
          }
        } catch (err) {
          console.warn('[auth] Error retrieving Supabase session:', err);
        }
      }

      if (active) {
        setUser(initialUser);
        if (initialUser) {
          const key = `fabrica_onboarding_completed_${initialUser.id}`;
          const completed = localStorage.getItem(key) === 'true';
          setOnboardingCompleted(completed);
          
          // If onboarding is completed, redirect directly to dashboard
          if (completed) {
            router.push('/dashboard');
          }
        }
        setCheckingAuth(false);
      }
    };

    initializeAuth();

    let subscription: any = null;
    if (supabase) {
      try {
        const { data } = supabase.auth.onAuthStateChange((event, session) => {
          if (!active) return;
          const currentUser = session?.user || null;
          if (currentUser) {
            setUser(currentUser);
            localStorage.removeItem('fabrica_sandbox_user');

            const key = `fabrica_onboarding_completed_${currentUser.id}`;
            const completed = localStorage.getItem(key) === 'true';

            if (completed) {
              router.push('/dashboard');
            } else {
              // Standard vs. Sign Up check:
              // If the user's created_at and last_sign_in_at are within 15 seconds, we treat it as a sign up (new registration).
              const isNewReg = currentUser.created_at && currentUser.last_sign_in_at &&
                Math.abs(new Date(currentUser.created_at).getTime() - new Date(currentUser.last_sign_in_at).getTime()) < 15000;

              if (isNewReg) {
                // Show the onboarding wizard
                setOnboardingCompleted(false);
              } else {
                // Skip onboarding for regular sign in
                localStorage.setItem(key, 'true');
                setOnboardingCompleted(true);
                setToast({ message: 'Welcome back! Syncing workspace data...', type: 'success', isOpen: true });
                setTimeout(() => {
                  router.push('/dashboard');
                }, 1000);
              }
            }
          } else {
            const savedUser = typeof window !== 'undefined' ? localStorage.getItem('fabrica_sandbox_user') : null;
            if (!savedUser) {
              setUser(null);
            }
          }
          setCheckingAuth(false);
        });
        subscription = data.subscription;
      } catch (err) {
        console.warn('[auth] Error establishing session listeners:', err);
      }
    }

    return () => {
      active = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [router]);

  const handleSandboxLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sandboxEmail) return;
    const mockUser = {
      email: sandboxEmail,
      id: 'usr_sandbox_' + Math.random().toString(36).substring(2, 9),
      isSandbox: true
    };
    setUser(mockUser);
    localStorage.setItem('fabrica_sandbox_user', JSON.stringify(mockUser));

    if (isSandboxSignUp) {
      // Sign Up: Show the onboarding setup
      setToast({ message: `Sandbox account created! Please complete your workspace profile.`, type: 'success', isOpen: true });
      setOnboardingCompleted(false);
    } else {
      // Sign In: Bypass onboarding, go straight to dashboard
      localStorage.setItem(`fabrica_onboarding_completed_${mockUser.id}`, 'true');
      setOnboardingCompleted(true);
      setToast({ message: `Securely authenticated! Redirecting...`, type: 'success', isOpen: true });
      setTimeout(() => {
        router.push('/dashboard');
      }, 1000);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    try {
      if (supabase) {
        const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
          redirectTo: typeof window !== 'undefined' ? window.location.origin + '/log?recovery=true' : undefined,
        });
        if (error) {
          setToast({ message: error.message, type: 'error', isOpen: true });
        } else {
          setToast({ message: 'Password recovery email sent! Check your inbox.', type: 'success', isOpen: true });
          setIsForgotPassword(false);
        }
      } else {
        setToast({ message: `[Sandbox] Mock recovery email sent to ${forgotEmail}.`, type: 'success', isOpen: true });
        setIsForgotPassword(false);
      }
    } catch (err: any) {
      setToast({ message: err.message || 'An error occurred', type: 'error', isOpen: true });
    }
  };

  const handleUpdatePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) return;
    try {
      if (supabase) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) {
          setToast({ message: error.message, type: 'error', isOpen: true });
        } else {
          setToast({ message: 'Password reset successful! You are now logged in.', type: 'success', isOpen: true });
          setIsRecoveryMode(false);
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            setUser(session.user);
            localStorage.setItem(`fabrica_onboarding_completed_${session.user.id}`, 'true');
            setOnboardingCompleted(true);
            router.push('/dashboard');
          }
        }
      } else {
        setToast({ message: '[Sandbox] Password updated successfully in mock sandbox!', type: 'success', isOpen: true });
        setIsRecoveryMode(false);
      }
    } catch (err: any) {
      setToast({ message: err.message || 'An error occurred', type: 'error', isOpen: true });
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'github') => {
    if (!supabase) {
      // High fidelity sandbox simulation for OAuth
      const email = `sandbox.${provider}@gmail.com`;
      const mockUser = {
        email,
        id: 'usr_sandbox_' + Math.random().toString(36).substring(2, 9),
        isSandbox: true,
        app_metadata: { provider }
      };
      setUser(mockUser);
      localStorage.setItem('fabrica_sandbox_user', JSON.stringify(mockUser));
      localStorage.setItem(`fabrica_onboarding_completed_${mockUser.id}`, 'true');
      setOnboardingCompleted(true);
      setToast({ message: `Securely authenticated sandbox session as ${email}!`, type: 'success', isOpen: true });
      setTimeout(() => {
        router.push('/dashboard');
      }, 1000);
      return;
    }
    try {
      let scopes = '';
      if (provider === 'google') {
        scopes = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/spreadsheets.readonly';
      } else if (provider === 'github') {
        scopes = 'repo read:user';
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          scopes,
          redirectTo: typeof window !== 'undefined' ? window.location.origin + '/log' : undefined
        }
      });
      if (error) throw error;
    } catch (err: any) {
      console.error(err);
      setToast({ message: `OAuth login failed: ${err.message}`, type: 'error', isOpen: true });
    }
  };

  if (checkingAuth) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#FAF9F6',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#1C1C1E',
        fontFamily: '"Inter", system-ui, sans-serif',
        gap: '16px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(204, 122, 74, 0.15)',
          borderTopColor: '#CC7A4A',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        ` }} />
        <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#CC7A4A' }}>
          Syncing Security Session...
        </div>
      </div>
    );
  }

  // 1. IF AUTHENTICATED AND ONBOARDING IS REQUIRED (Only on registration / signup)
  if (user && !onboardingCompleted) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#FAF9F6',
        color: '#1C1C1E',
        fontFamily: '"Inter", system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {renderDashboardMock()}
        <div style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: onboardingStep === 'plan' ? '920px' : '520px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.02)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transition: 'max-width 0.3s ease-in-out'
        }}>
          {/* Header */}
          <div style={{
            background: '#ffffff',
            borderBottom: '1px solid #f1f5f9',
            padding: '24px 32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img 
                src="/fabrica-logo-2d.jpg" 
                alt="Fabrica Brand Logo" 
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}
              />
              <div>
                <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 900, letterSpacing: '-0.02em', color: '#1C1C1E' }}>
                  Setup Your Fabrica Workspace
                </h1>
                <p style={{ margin: 0, fontSize: '10px', color: '#64748b', fontWeight: 500 }}>
                  Personalize your isolated SaaS multi-tenant environment
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ height: '3px', background: '#CC7A4A', borderRadius: '2px' }}></div>
                <span style={{ fontSize: '9px', fontWeight: 800, color: '#CC7A4A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  1. Profile Details
                </span>
              </div>
              {SHOW_PAYMENT_UI && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ height: '3px', background: onboardingStep === 'plan' ? '#CC7A4A' : '#e2e8f0', borderRadius: '2px', transition: 'background-color 0.2s' }}></div>
                  <span style={{ fontSize: '9px', fontWeight: 800, color: onboardingStep === 'plan' ? '#CC7A4A' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', transition: 'color 0.2s' }}>
                    2. Choose Plan
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Onboarding Step 1: Profile Details */}
          <div style={{ padding: '32px', background: '#ffffff' }}>
            {onboardingStep === 'info' ? (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!onboardingUsername.trim()) {
                    setToast({ message: 'Username is required to isolate your workspace tenant.', type: 'error', isOpen: true });
                    return;
                  }
                  if (!onboardingUseCases.trim()) {
                    setToast({ message: 'Please specify what you will use Fabrica for.', type: 'error', isOpen: true });
                    return;
                  }
                  
                  // Save values to localStorage as a durable draft
                  localStorage.setItem(`fabrica_ob_fullname_${user.id}`, onboardingFullName);
                  localStorage.setItem(`fabrica_ob_username_${user.id}`, onboardingUsername.replace('@', '').trim());
                  localStorage.setItem(`fabrica_ob_hear_${user.id}`, onboardingHearAbout);
                  localStorage.setItem(`fabrica_ob_compname_${user.id}`, onboardingCompanyName);
                  localStorage.setItem(`fabrica_ob_compsize_${user.id}`, onboardingCompanySize);
                  localStorage.setItem(`fabrica_ob_comprole_${user.id}`, onboardingCompanyRole);
                  localStorage.setItem(`fabrica_ob_usecases_${user.id}`, onboardingUseCases);

                  if (SHOW_PAYMENT_UI) {
                    setOnboardingStep('plan');
                  } else {
                    setSelectedPlan('free');
                    localStorage.setItem(`fabrica_onboarding_completed_${user?.id || 'default'}`, 'true');
                    setOnboardingCompleted(true);
                    setToast({
                      message: `Welcome to Fabrica! Workspace launched on Free Beta Access.`,
                      type: 'success',
                      isOpen: true
                    });
                    setTimeout(() => {
                      router.push('/dashboard');
                    }, 500);
                  }
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
              >
                {/* Username and Full Name */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569' }}>
                      Username <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <span style={{ position: 'absolute', left: '12px', fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>@</span>
                      <input
                        type="text"
                        required
                        placeholder="username"
                        value={onboardingUsername}
                        onChange={(e) => setOnboardingUsername(e.target.value.replace(/\s+/g, '').replace('@', ''))}
                        style={{
                          width: '100%',
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          padding: '8px 12px 8px 24px',
                          color: '#1c1c1e',
                          fontSize: '11px',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569' }}>
                      Full Name <span style={{ color: '#94a3b8', fontWeight: 500 }}>(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Alex Johnson"
                      value={onboardingFullName}
                      onChange={(e) => setOnboardingFullName(e.target.value)}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        color: '#1c1c1e',
                        fontSize: '11px',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                {/* Hear About Us */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569' }}>
                    Where did you hear about us? <span style={{ color: '#94a3b8', fontWeight: 500 }}>(Optional)</span>
                  </label>
                  <select
                    value={onboardingHearAbout}
                    onChange={(e) => setOnboardingHearAbout(e.target.value)}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: '#1c1c1e',
                      fontSize: '11px',
                      outline: 'none'
                    }}
                  >
                    <option value="">Select an option...</option>
                    <option value="google">Google Search</option>
                    <option value="twitter">Twitter / X</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="friend">Friend or Colleague</option>
                    <option value="newsletter">Tech Blog / Newsletter</option>
                    <option value="youtube">YouTube</option>
                    <option value="other">Other Source</option>
                  </select>
                </div>

                <div style={{ height: '1px', background: '#f1f5f9', margin: '4px 0' }}></div>

                {/* Corporate Details */}
                <div>
                  <h3 style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#1c1c1e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🏢 Corporate & Company Information <span style={{ color: '#94a3b8', fontWeight: 500, textTransform: 'none', fontSize: '9px', letterSpacing: 0 }}>(Optional)</span>
                  </h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>
                        Company Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Acme SaaS Corp"
                        value={onboardingCompanyName}
                        onChange={(e) => setOnboardingCompanyName(e.target.value)}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          padding: '8px 12px',
                          color: '#1c1c1e',
                          fontSize: '11px',
                          outline: 'none'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>
                        Company Size
                      </label>
                      <select
                        value={onboardingCompanySize}
                        onChange={(e) => setOnboardingCompanySize(e.target.value)}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          padding: '8px 12px',
                          color: '#1c1c1e',
                          fontSize: '11px',
                          outline: 'none'
                        }}
                      >
                        <option value="">Choose Size...</option>
                        <option value="solo">Just Me</option>
                        <option value="small">2-10 people</option>
                        <option value="mid">11-50 people</option>
                        <option value="growth">51-200 people</option>
                        <option value="enterprise">200+ people</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>
                        Your Role
                      </label>
                      <select
                        value={onboardingCompanyRole}
                        onChange={(e) => setOnboardingCompanyRole(e.target.value)}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          padding: '8px 12px',
                          color: '#1c1c1e',
                          fontSize: '11px',
                          outline: 'none'
                        }}
                      >
                        <option value="">Role...</option>
                        <option value="founder">Founder / CEO</option>
                        <option value="lead">Lead Architect</option>
                        <option value="engineer">Engineer</option>
                        <option value="pm">Product Mgr</option>
                        <option value="ops">DevOps / SRE</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div style={{ height: '1px', background: '#f1f5f9', margin: '4px 0' }}></div>

                {/* Primary Use Case */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569' }}>
                    What will you use Fabrica for? <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    required
                    value={onboardingUseCases}
                    onChange={(e) => setOnboardingUseCases(e.target.value)}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: '#1c1c1e',
                      fontSize: '11px',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">Select a primary use case...</option>
                    <option value="Architecting & simulating agent specs">Architecting & simulating agent specs</option>
                    <option value="Personal project exploration">Personal project exploration</option>
                    <option value="Enterprise multi-tenant integration">Enterprise multi-tenant integration</option>
                    <option value="Academic research / Learning">Academic research / Learning</option>
                    <option value="Other SaaS development">Other SaaS development</option>
                  </select>
                </div>

                <button
                  type="submit"
                  style={{
                    background: '#CC7A4A',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#ffffff',
                    padding: '12px',
                    fontWeight: 800,
                    fontSize: '11px',
                    cursor: 'pointer',
                    marginTop: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    textAlign: 'center'
                  }}
                >
                  {SHOW_PAYMENT_UI ? 'Continue to Plan Selection ➔' : 'Complete Profile & Launch Workspace ➔'}
                </button>
              </form>
            ) : (
              /* Onboarding Step 2: Choose Plan */
              <div>
                <p style={{ margin: '0 0 20px', fontSize: '11.5px', color: '#475569', lineHeight: 1.5, textAlign: 'center' }}>
                  Select the operations pipeline scale suited for your enterprise multi-agent workflows.
                </p>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                  gap: '14px',
                  alignItems: 'stretch',
                  marginTop: '10px'
                }}>
                  {/* Free Plan */}
                  <div 
                    onClick={() => {
                      setSelectedPlan('free');
                      localStorage.setItem(`fabrica_ob_plan_${user?.id || 'default'}`, 'free');
                    }}
                    style={{
                      background: selectedPlan === 'free' ? '#ffffff' : '#fcfcfc',
                      border: selectedPlan === 'free' ? '2.5px solid #CC7A4A' : '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '20px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                      boxShadow: selectedPlan === 'free' ? '0 12px 24px rgba(204, 122, 74, 0.08)' : 'none',
                      transition: 'all 0.15s ease-in-out'
                    }}
                  >
                    <div style={{ marginBottom: '14px' }}>
                      <span style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>
                        Free Beta
                      </span>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '6px' }}>
                        <b style={{ fontSize: '22px', fontWeight: 900, color: '#1c1c1e' }}>$0</b>
                        <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 500 }}>/ month</span>
                      </div>
                      <p style={{ margin: '6px 0 0', fontSize: '9px', color: '#64748b', lineHeight: 1.4 }}>
                        Perfect for workspace drafting & quick solo evaluations.
                      </p>
                    </div>

                    <div style={{ height: '1px', background: '#f1f5f9', margin: '10px 0' }}></div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '8.5px', color: '#475569', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}><b>✓</b> <span>Shared sandbox environment</span></div>
                      <div style={{ display: 'flex', gap: '6px' }}><b>✓</b> <span>20 AI spec pipelines/mo</span></div>
                      <div style={{ display: 'flex', gap: '6px' }}><b>✓</b> <span>BYOK or Managed Credits</span></div>
                      <div style={{ display: 'flex', gap: '6px' }}><b>✓</b> <span>Community forum support</span></div>
                    </div>
                  </div>

                  {/* Dedicated PAUG Plan */}
                  <div 
                    onClick={() => {
                      setSelectedPlan('paug');
                      localStorage.setItem(`fabrica_ob_plan_${user?.id || 'default'}`, 'paug');
                    }}
                    style={{
                      background: selectedPlan === 'paug' ? '#ffffff' : '#fcfcfc',
                      border: selectedPlan === 'paug' ? '2.5px solid #3b82f6' : '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '20px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                      boxShadow: selectedPlan === 'paug' ? '0 12px 24px rgba(59, 130, 246, 0.12)' : 'none',
                      transition: 'all 0.15s ease-in-out'
                    }}
                  >
                    <div style={{ marginBottom: '14px' }}>
                      <span style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', color: '#3b82f6', letterSpacing: '0.04em' }}>
                        Dedicated PAUG
                      </span>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '6px' }}>
                        <b style={{ fontSize: '22px', fontWeight: 900, color: '#1c1c1e' }}>$15</b>
                        <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 500 }}>/ month</span>
                      </div>
                      <p style={{ margin: '6px 0 0', fontSize: '9px', color: '#64748b', lineHeight: 1.4 }}>
                        Pay-as-you-go exact cost dedicated resources & DB.
                      </p>
                    </div>

                    <div style={{ height: '1px', background: '#f1f5f9', margin: '10px 0' }}></div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '8.5px', color: '#475569', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}><b>✓</b> <span>Private isolated DB instance</span></div>
                      <div style={{ display: 'flex', gap: '6px' }}><b>✓</b> <span>Dedicated storage bucket</span></div>
                      <div style={{ display: 'flex', gap: '6px' }}><b>✓</b> <span>Isolated runner space</span></div>
                      <div style={{ display: 'flex', gap: '6px' }}><b>✓</b> <span>Zero-config auto maintenance</span></div>
                    </div>
                  </div>

                  {/* Power User Plan */}
                  <div 
                    onClick={() => {
                      setSelectedPlan('power');
                      localStorage.setItem(`fabrica_ob_plan_${user?.id || 'default'}`, 'power');
                    }}
                    style={{
                      background: '#ffffff',
                      border: selectedPlan === 'power' ? '2.5px solid #CC7A4A' : '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '20px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                      boxShadow: selectedPlan === 'power' ? '0 16px 36px rgba(204, 122, 74, 0.12)' : '0 4px 12px rgba(0,0,0,0.01)',
                      transform: selectedPlan === 'power' ? 'translateY(-2px)' : 'none',
                      transition: 'all 0.15s ease-in-out'
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      top: '-10px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#CC7A4A',
                      color: '#ffffff',
                      fontSize: '7.5px',
                      fontWeight: 900,
                      padding: '3px 8px',
                      borderRadius: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      boxShadow: '0 4px 10px rgba(204, 122, 74, 0.25)'
                    }}>
                      ⭐ Best Value
                    </div>

                    <div style={{ marginBottom: '14px', marginTop: '2px' }}>
                      <span style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', color: '#CC7A4A', letterSpacing: '0.04em' }}>
                        Power User
                      </span>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '6px' }}>
                        <b style={{ fontSize: '24px', fontWeight: 900, color: '#1c1c1e' }}>$49</b>
                        <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 500 }}>/ month</span>
                      </div>
                      <p style={{ margin: '6px 0 0', fontSize: '9px', color: '#64748b', lineHeight: 1.4 }}>
                        Ideal for active builders & advanced automated triggers.
                      </p>
                    </div>

                    <div style={{ height: '1px', background: '#f1f5f9', margin: '10px 0' }}></div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '8.5px', color: '#475569', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}><b>✓</b> <span>Unlimited active projects</span></div>
                      <div style={{ display: 'flex', gap: '6px' }}><b>✓</b> <span>500 AI spec pipelines/mo</span></div>
                      <div style={{ display: 'flex', gap: '6px' }}><b>✓</b> <span>Dedicated runtime proxies</span></div>
                      <div style={{ display: 'flex', gap: '6px' }}><b>✓</b> <span>Priority SLA chat support</span></div>
                    </div>
                  </div>

                  {/* Enterprise Plan */}
                  <div 
                    onClick={() => {
                      setSelectedPlan('enterprise');
                      localStorage.setItem(`fabrica_ob_plan_${user?.id || 'default'}`, 'enterprise');
                    }}
                    style={{
                      background: selectedPlan === 'enterprise' ? '#ffffff' : '#fcfcfc',
                      border: selectedPlan === 'enterprise' ? '2.5px solid #8b5cf6' : '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '20px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                      boxShadow: selectedPlan === 'enterprise' ? '0 12px 24px rgba(139, 92, 246, 0.12)' : 'none',
                      transition: 'all 0.15s ease-in-out'
                    }}
                  >
                    <div style={{ marginBottom: '14px' }}>
                      <span style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', color: '#8b5cf6', letterSpacing: '0.04em' }}>
                        Enterprise Custom
                      </span>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '6px' }}>
                        <b style={{ fontSize: '22px', fontWeight: 900, color: '#1c1c1e' }}>$249</b>
                        <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 500 }}>/ month</span>
                      </div>
                      <p style={{ margin: '6px 0 0', fontSize: '9px', color: '#64748b', lineHeight: 1.4 }}>
                        Built for multi-region teams & dedicated high-custom nodes.
                      </p>
                    </div>

                    <div style={{ height: '1px', background: '#f1f5f9', margin: '10px 0' }}></div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '8.5px', color: '#475569', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}><b>✓</b> <span>Full scale multi-tenancy</span></div>
                      <div style={{ display: 'flex', gap: '6px' }}><b>✓</b> <span>Unlimited AI spec executions</span></div>
                      <div style={{ display: 'flex', gap: '6px' }}><b>✓</b> <span>0.5s cold-start warm pooling</span></div>
                      <div style={{ display: 'flex', gap: '6px' }}><b>✓</b> <span>24/7 Dedicated Account Engineer</span></div>
                    </div>
                  </div>
                </div>

                {/* Confirm Plan / Checkout redirection */}
                <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                  <button
                    type="button"
                    onClick={() => setOnboardingStep('info')}
                    style={{
                      background: 'transparent',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      color: '#64748b',
                      padding: '12px 20px',
                      fontWeight: 700,
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    ← Back
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (selectedPlan === 'free') {
                        // Free Tier goes directly to dashboard
                        localStorage.setItem(`fabrica_onboarding_completed_${user?.id || 'default'}`, 'true');
                        setOnboardingCompleted(true);
                        setToast({
                          message: `Welcome to Fabrica! Your workspace is active on the FREE tier.`,
                          type: 'success',
                          isOpen: true
                        });
                        setTimeout(() => {
                          router.push('/dashboard');
                        }, 1200);
                      } else {
                        // Paid Tiers trigger standard secure Stripe Checkout Overlay
                        setShowStripeCheckout(true);
                      }
                    }}
                    style={{
                      flex: 1,
                      background: '#CC7A4A',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#ffffff',
                      padding: '12px',
                      fontWeight: 800,
                      fontSize: '11px',
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      textAlign: 'center'
                    }}
                  >
                    {selectedPlan === 'free' ? 'Go to dashboard ➔' : 'Go to Payment ➔'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer of Card */}
          <div style={{
            background: '#fafafa',
            borderTop: '1px solid #f1f5f9',
            padding: '16px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '10.5px'
          }}>
            <Link href="/" style={{ color: '#64748b', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
              ← Return to Landing Page
            </Link>
            <span style={{ color: '#94a3b8', fontWeight: 500 }}>v1.0.0 (Production)</span>
          </div>
        </div>

        {/* Interactive Stripe Checkout Overlay Modal */}
        {showStripeCheckout && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(9, 13, 22, 0.85)',
            backdropFilter: 'blur(12px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}>
            <div style={{
              width: 'min(28rem, 95vw)',
              background: '#ffffff',
              color: '#0f172a',
              borderRadius: '16px',
              border: '1.5px solid #e2e8f0',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Stripe Header */}
              <div style={{
                background: '#635bff',
                color: '#ffffff',
                padding: '18px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>🔒</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Stripe Secure Checkout
                    </h3>
                    <p style={{ margin: 0, fontSize: '8px', opacity: 0.85 }}>Standard TLS 256-Bit SSL tokenization</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowStripeCheckout(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    opacity: 0.8,
                    padding: '4px'
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Order breakdown */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
                <span style={{ fontSize: '8px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Your Selected Subscription
                </span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <b style={{ fontSize: '13px', color: '#0f172a' }}>
                    {selectedPlan === 'enterprise' ? '🏆 Enterprise Custom Suite' : selectedPlan === 'paug' ? '⚡ Dedicated PAUG Infrastructure' : '⚡ Power User Pipeline'}
                  </b>
                  <b style={{ fontSize: '15px', color: '#635bff' }}>
                    {selectedPlan === 'enterprise' ? '$249.00' : selectedPlan === 'paug' ? '$15.00' : '$49.00'}<span style={{ fontSize: '9px', color: '#64748b', fontWeight: 500 }}> / mo</span>
                  </b>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: '8.5px', color: '#64748b', lineHeight: 1.4 }}>
                  {selectedPlan === 'enterprise'
                    ? 'Full enterprise isolation virtual queues, guaranteed multi-region runtime proxies, cryptographically signed API logs. Auto-renews monthly.'
                    : selectedPlan === 'paug'
                    ? 'Dedicated isolated DB instance, dedicated bucket storage & runner execution space. Exact pay-as-you-go billing.'
                    : 'Unlimited active projects, 500 AI spec pipelines/mo, dedicated runtime proxies, priority SLA chat support.'}
                </p>
              </div>

              {/* Elements Form */}
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '8.5px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                    Cardholder Full Name
                  </label>
                  <input
                    type="text"
                    value={cardHolder}
                    onChange={(e) => setCardHolder(e.target.value)}
                    placeholder="John Doe"
                    disabled={isPayingStripe}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a',
                      background: '#ffffff',
                      fontSize: '11px',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '8.5px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                    Card Number (Stripe Elements)
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={stripeCardNum}
                      onChange={(e) => {
                        let val = e.target.value.replace(/\D/g, '');
                        if (val.length > 16) val = val.substring(0, 16);
                        if (val.startsWith('3')) setStripeCardBrand('Amex');
                        else if (val.startsWith('5')) setStripeCardBrand('Mastercard');
                        else setStripeCardBrand('Visa');
                        const formatted = val.replace(/(\d{4})(?=\d)/g, '$1 ');
                        setStripeCardNum(formatted);
                      }}
                      placeholder="4242 4242 4242 4242"
                      disabled={isPayingStripe}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        paddingRight: '40px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        color: '#0f172a',
                        background: '#ffffff',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        outline: 'none'
                      }}
                    />
                    <span style={{ position: 'absolute', right: '10px', fontSize: '9px', fontWeight: 900, color: '#635bff', textTransform: 'uppercase' }}>
                      {stripeCardBrand}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '8.5px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                      Expiration Date
                    </label>
                    <input
                      type="text"
                      value={stripeCardExp}
                      onChange={(e) => {
                        let val = e.target.value.replace(/\D/g, '');
                        if (val.length > 4) val = val.substring(0, 4);
                        if (val.length >= 2) {
                          setStripeCardExp(val.substring(0, 2) + '/' + val.substring(2));
                        } else {
                          setStripeCardExp(val);
                        }
                      }}
                      placeholder="MM/YY"
                      disabled={isPayingStripe}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        color: '#0f172a',
                        background: '#ffffff',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '8.5px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                      CVC / Security Code
                    </label>
                    <input
                      type="password"
                      value={stripeCardCvc}
                      onChange={(e) => setStripeCardCvc(e.target.value.replace(/\D/g, '').substring(0, 4))}
                      placeholder="•••"
                      disabled={isPayingStripe}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        color: '#0f172a',
                        background: '#ffffff',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '8.5px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                    Postal Code / ZIP
                  </label>
                  <input
                    type="text"
                    value={stripeCardZip}
                    onChange={(e) => setStripeCardZip(e.target.value)}
                    placeholder="90210"
                    disabled={isPayingStripe}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a',
                      background: '#ffffff',
                      fontSize: '11px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Submit / Pay CTA */}
                <button
                  type="button"
                  disabled={isPayingStripe}
                  onClick={() => {
                    if (!cardHolder) {
                      setToast({ message: "Please specify cardholder full name", type: "error", isOpen: true });
                      return;
                    }
                    if (!stripeCardNum || stripeCardNum.replace(/\s/g, '').length < 13) {
                      setToast({ message: "Please specify valid card credentials", type: "error", isOpen: true });
                      return;
                    }

                    setIsPayingStripe(true);
                    setToast({ message: "Contacting Stripe Gateway API...", type: "info", isOpen: true });

                    // Simulating step by step real Stripe processing
                    setTimeout(() => {
                      setToast({ message: "Stripe Element: Authorizing credit method safety...", type: "info", isOpen: true });
                      setTimeout(() => {
                        setToast({ message: "Stripe Element: Creating cryptographically signed user record...", type: "info", isOpen: true });
                        setTimeout(() => {
                          // Compile standard payment receipt
                          const initialCharge = {
                            id: 'ch_' + Math.random().toString(36).substring(2, 11),
                            amount: selectedPlan === 'enterprise' ? 249.00 : selectedPlan === 'paug' ? 15.00 : 49.00,
                            date: new Date().toISOString(),
                            status: 'succeeded',
                            plan: selectedPlan,
                            cardBrand: stripeCardBrand,
                            cardLast4: stripeCardNum.replace(/\s/g, '').slice(-4) || '4242'
                          };
                          
                          // Save completed state to client databases
                          localStorage.setItem(`fabrica_payment_history_${user?.id || 'default'}`, JSON.stringify([initialCharge]));
                          localStorage.setItem(`fabrica_onboarding_completed_${user?.id || 'default'}`, 'true');
                          setOnboardingCompleted(true);
                          setIsPayingStripe(false);
                          setShowStripeCheckout(false);

                          setToast({
                            message: `Payment Succeeded! Welcome to your upgraded Fabrica ${selectedPlan.toUpperCase()} Workspace.`,
                            type: 'success',
                            isOpen: true
                          });

                          setTimeout(() => {
                            router.push('/dashboard');
                          }, 1200);

                        }, 1200);
                      }, 1200);
                    }, 1200);
                  }}
                  style={{
                    background: '#635bff',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#ffffff',
                    padding: '12px',
                    fontWeight: 900,
                    fontSize: '11.5px',
                    cursor: isPayingStripe ? 'not-allowed' : 'pointer',
                    marginTop: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(99, 91, 255, 0.2)',
                    transition: 'all 0.15s'
                  }}
                >
                  {isPayingStripe ? 'Processing Securely...' : `Pay $${selectedPlan === 'enterprise' ? '249.00' : selectedPlan === 'paug' ? '15.00' : '49.00'} USD`}
                </button>

                <p style={{ margin: '4px 0 0', fontSize: '7.5px', color: '#64748b', textAlign: 'center', lineHeight: 1.35 }}>
                  By checking out, you authorize Fabrica to securely bill your credit instrument monthly. Canceled instantly at any point through client portal settings.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. MAIN LOG IN / SIGN UP SCREEN
  return (
    <div style={{
      minHeight: '100vh',
      background: '#FAF9F6',
      color: '#1C1C1E',
      fontFamily: '"Inter", system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {renderDashboardMock()}
      <div style={{
        position: 'relative',
        zIndex: 10,
        width: '100%',
        maxWidth: '420px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.02)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Brand/Gateway Header */}
        <div style={{
          background: '#ffffff',
          borderBottom: '1px solid #f1f5f9',
          padding: '28px 24px 20px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px'
        }}>
          <img 
            src="/fabrica-logo-2d.jpg" 
            alt="Fabrica Brand Logo" 
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
            }}
          />
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 900, letterSpacing: '-0.03em', color: '#1C1C1E' }}>
              Fabrica<span style={{ color: '#CC7A4A' }}>.</span> SaaS Gateway
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
              Secure multi-tenant workspace registry
            </p>
          </div>
        </div>

        {/* Core Auth Area */}
        <div style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {isRecoveryMode ? (
            <form onSubmit={handleUpdatePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{
                background: 'rgba(204, 122, 74, 0.05)',
                border: '1px solid rgba(204, 122, 74, 0.2)',
                borderRadius: '8px',
                padding: '12px 14px'
              }}>
                <div style={{ color: '#CC7A4A', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  🔒 Password Recovery
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#64748b', lineHeight: 1.45 }}>
                  Enter a secure, robust new password to finalize authentication with your account.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569' }}>
                  New Secure Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: '#1c1c1e',
                    fontSize: '11px',
                    outline: 'none'
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  background: '#CC7A4A',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#ffffff',
                  padding: '10px',
                  fontWeight: 800,
                  fontSize: '11px',
                  cursor: 'pointer',
                  marginTop: '6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}
              >
                Save New Password & Log In ➔
              </button>

              <button
                type="button"
                onClick={() => setIsRecoveryMode(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '10px',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontWeight: 600
                }}
              >
                Cancel and Return to Login
              </button>
            </form>
          ) : isForgotPassword ? (
            <form onSubmit={handleResetPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{
                background: 'rgba(204, 122, 74, 0.05)',
                border: '1px solid rgba(204, 122, 74, 0.2)',
                borderRadius: '8px',
                padding: '12px 14px'
              }}>
                <div style={{ color: '#CC7A4A', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  🔑 Reset Password
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#64748b', lineHeight: 1.45 }}>
                  Enter your email to receive a secure recovery link.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: '#1c1c1e',
                    fontSize: '11px',
                    outline: 'none'
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  background: '#CC7A4A',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#ffffff',
                  padding: '10px',
                  fontWeight: 800,
                  fontSize: '11px',
                  cursor: 'pointer',
                  marginTop: '6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}
              >
                Send Recovery Link ➔
              </button>

              <button
                type="button"
                onClick={() => setIsForgotPassword(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '10px',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontWeight: 600
                }}
              >
                Cancel and Return to Login
              </button>
            </form>
          ) : (
            <>
              {supabase ? (
                <>
                  <p style={{ margin: 0, fontSize: '11.5px', color: '#475569', lineHeight: 1.5, textAlign: 'center', marginBottom: '16px' }}>
                    Please authenticate with your corporate credentials to access your isolated workspace records and active agent execution backlogs.
                  </p>

                  {/* Premium OAuth SSO Providers */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    <button
                      type="button"
                      onClick={() => handleOAuthSignIn('google')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        color: '#1C1C1E',
                        padding: '10px 16px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                      </svg>
                      <span>Continue with Google</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOAuthSignIn('github')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        background: '#1C1C1E',
                        border: '1px solid #1C1C1E',
                        borderRadius: '8px',
                        color: '#ffffff',
                        padding: '10px 16px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                      </svg>
                      <span>Continue with GitHub</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '16px 0' }}>
                    <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
                    <span style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>or use secure email</span>
                    <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
                  </div>

                  <div className="supabase-auth-wrapper" style={{
                    '--colors-brand': '#CC7A4A',
                    '--colors-brandAccent': '#b2693e',
                    '--colors-inputBackground': '#ffffff',
                    '--colors-inputText': '#1c1c1e',
                    '--colors-inputBorder': '#cbd5e1',
                    '--colors-inputLabelText': '#475569',
                    '--colors-dividerBackground': '#e2e8f0',
                    '--colors-messageText': '#CC7A4A',
                    '--colors-anchorTextColor': '#CC7A4A'
                  } as any}>
                    <Auth
                      supabaseClient={supabase}
                      appearance={{
                        theme: ThemeSupa,
                        style: {
                          button: { background: '#CC7A4A', color: '#ffffff', border: 'none', fontWeight: '800', borderRadius: '6px', fontSize: '11px', padding: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' },
                          input: { background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#1c1c1e', fontSize: '11px', padding: '8px 12px' },
                          label: { fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', color: '#475569', marginBottom: '4px', letterSpacing: '0.04em' },
                          anchor: { color: '#CC7A4A', fontSize: '10px', fontWeight: 700 }
                        }
                      }}
                      theme="default"
                      providers={[]}
                      redirectTo={typeof window !== 'undefined' ? `${window.location.origin}/log` : undefined}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setIsForgotPassword(true)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#CC7A4A',
                        fontSize: '10px',
                        cursor: 'pointer',
                        fontWeight: 700,
                        textDecoration: 'underline'
                      }}
                    >
                      🔑 Forgot Password?
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{
                    background: 'rgba(204, 122, 74, 0.05)',
                    border: '1px solid rgba(204, 122, 74, 0.2)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    <div style={{ color: '#CC7A4A', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      💡 Sandbox Demo Mode Active
                    </div>
                    <p style={{ margin: 0, fontSize: '10px', color: '#64748b', lineHeight: 1.45 }}>
                      Real Supabase connection keys are not yet configured in your server environment variables. A high-fidelity sandbox is available to test the registration experience.
                    </p>
                  </div>

                  {/* Premium OAuth SSO Providers */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '16px 0' }}>
                    <button
                      type="button"
                      onClick={() => handleOAuthSignIn('google')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        color: '#1C1C1E',
                        padding: '10px 16px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                      </svg>
                      <span>Continue with Google</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOAuthSignIn('github')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        background: '#1C1C1E',
                        border: '1px solid #1C1C1E',
                        borderRadius: '8px',
                        color: '#ffffff',
                        padding: '10px 16px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                      </svg>
                      <span>Continue with GitHub</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '16px 0' }}>
                    <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
                    <span style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>or use secure email</span>
                    <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
                  </div>

                  <form onSubmit={handleSandboxLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                      <button
                        type="button"
                        onClick={() => setIsSandboxSignUp(false)}
                        style={{
                          flex: 1,
                          background: !isSandboxSignUp ? '#1C1C1E' : 'transparent',
                          border: 'none',
                          borderRadius: '4px',
                          color: !isSandboxSignUp ? '#fff' : '#64748b',
                          padding: '6px',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        Sign In
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsSandboxSignUp(true)}
                        style={{
                          flex: 1,
                          background: isSandboxSignUp ? '#1C1C1E' : 'transparent',
                          border: 'none',
                          borderRadius: '4px',
                          color: isSandboxSignUp ? '#fff' : '#64748b',
                          padding: '6px',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        Sign Up (New Tenant)
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569' }}>
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={sandboxEmail}
                        onChange={(e) => setSandboxEmail(e.target.value)}
                        placeholder="service.mrigel@gmail.com"
                        style={{
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          padding: '8px 12px',
                          color: '#1c1c1e',
                          fontSize: '11px',
                          outline: 'none',
                          transition: 'border-color 0.15s'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569' }}>
                          Password
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsForgotPassword(true)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#CC7A4A',
                            fontSize: '9px',
                            cursor: 'pointer',
                            fontWeight: 700,
                            textDecoration: 'underline',
                            padding: 0
                          }}
                        >
                          Forgot Password?
                        </button>
                      </div>
                      <input
                        type="password"
                        required
                        value={sandboxPassword}
                        onChange={(e) => setSandboxPassword(e.target.value)}
                        placeholder="••••••••"
                        style={{
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          padding: '8px 12px',
                          color: '#1c1c1e',
                          fontSize: '11px',
                          outline: 'none',
                          transition: 'border-color 0.15s'
                        }}
                      />
                    </div>

                    <button
                      type="submit"
                      style={{
                        background: '#CC7A4A',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#ffffff',
                        padding: '10px',
                        fontWeight: 800,
                        fontSize: '11px',
                        cursor: 'pointer',
                        marginTop: '6px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        transition: 'background-color 0.15s'
                      }}
                    >
                      {isSandboxSignUp ? 'Create Isolated Tenant ➔' : 'Secure Authenticate Session ➔'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSandboxEmail('service.mrigel@gmail.com');
                        setSandboxPassword('demopass123');
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#CC7A4A',
                        fontSize: '10px',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        marginTop: '4px',
                        fontWeight: 600
                      }}
                    >
                      💡 Autofill Quick-Demo Tenant Credentials
                    </button>
                  </form>

                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '14px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotEmail(sandboxEmail || '');
                        setIsForgotPassword(true);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#CC7A4A',
                        fontSize: '10.5px',
                        cursor: 'pointer',
                        fontWeight: 700,
                        textDecoration: 'underline',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      🔑 Forgot your password? Click here to reset
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer of card */}
        <div style={{
          background: '#fafafa',
          borderTop: '1px solid #f1f5f9',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '10.5px'
        }}>
          <Link href="/" style={{ color: '#64748b', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
            ← Return to Landing Page
          </Link>
          <button
            type="button"
            onClick={() => {
              if (!user) {
                const mockUser = {
                  email: 'visitor@fabrica.io',
                  id: 'usr_preview_' + Math.random().toString(36).substring(2, 7),
                  isSandbox: true
                };
                setUser(mockUser);
              }
              setOnboardingCompleted(false);
              setOnboardingStep('plan');
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#CC7A4A',
              fontWeight: 700,
              fontSize: '10.5px',
              cursor: 'pointer',
              textDecoration: 'underline',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            💳 View Pricing & Business Plans
          </button>
          <span style={{ color: '#94a3b8', fontWeight: 500 }}>v1.0.0 (Production)</span>
        </div>
      </div>

      {/* Inline Toast Notification Component */}
      {toast.isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: toast.type === 'success' ? '#10b981' : toast.type === 'error' ? '#ef4444' : '#3b82f6',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
          fontSize: '11px',
          fontWeight: 700,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'slideIn 0.2s ease-out'
        }}>
          <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}</span>
          <span>{toast.message}</span>
          <button 
            onClick={() => setToast({ ...toast, isOpen: false })}
            style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', fontWeight: 'bold', marginLeft: '12px' }}
          >
            ✕
          </button>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideIn {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      ` }} />
    </div>
  );
}
