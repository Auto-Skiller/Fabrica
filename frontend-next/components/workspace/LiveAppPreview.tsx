'use client';

import React, { useState, useRef } from 'react';

export type ContainerState = 'warm' | 'waking_up' | 'idle';

interface LiveAppPreviewProps {
  tenantId?: string;
  runnerUrl?: string;
  containerState?: ContainerState;
  onPrewarm?: () => void;
  className?: string;
}

export const LiveAppPreview: React.FC<LiveAppPreviewProps> = ({
  tenantId = 'usr-123',
  runnerUrl,
  containerState = 'warm',
  onPrewarm,
  className = ''
}) => {
  const safeTenant = tenantId.toLowerCase().replace(/[^a-z0-9_\-]/g, '-');
  const defaultUrl = runnerUrl || `https://fabrica-runner-${safeTenant}.europe-west2.run.app`;
  
  const [currentUrl, setCurrentUrl] = useState(defaultUrl);
  const [viewportMode, setViewportMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [isLoading, setIsLoading] = useState(false);
  const [activeState, setActiveState] = useState<ContainerState>(containerState);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleRefresh = () => {
    setIsLoading(true);
    if (iframeRef.current) {
      iframeRef.current.src = currentUrl;
    }
    setTimeout(() => {
      setIsLoading(false);
    }, 1200);
  };

  const handleSimulateColdStart = () => {
    setActiveState('waking_up');
    setTimeout(() => {
      setActiveState('warm');
      handleRefresh();
    }, 1800);
  };

  const getIframeWidth = () => {
    switch (viewportMode) {
      case 'mobile': return '375px';
      case 'tablet': return '768px';
      case 'desktop': default: return '100%';
    }
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
        borderRadius: '0',
        border: 'none',
        overflow: 'hidden'
      }}
    >
      {/* Top Browser Toolbar */}
      <div style={{
        padding: '2px 8px',
        backgroundColor: 'var(--surface-alt)',
        borderBottom: '1px solid var(--border-soft)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '4px',
        flexWrap: 'nowrap',
        height: '28px',
        minHeight: '28px',
        maxHeight: '28px',
        boxSizing: 'border-box'
      }}>
        {/* Navigation & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
          <button
            onClick={handleRefresh}
            disabled={isLoading || activeState === 'waking_up'}
            title="Reload Preview"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-soft)',
              color: 'var(--text)',
              borderRadius: '3px',
              padding: '1px 4px',
              fontSize: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '2px'
            }}
          >
            <span style={{ display: 'inline-block', transform: isLoading ? 'rotate(360deg)' : 'none', transition: 'transform 0.5s', fontSize: '8px' }}>
              🔄
            </span>
          </button>

          {/* Viewport Mode Switcher */}
          <div style={{
            display: 'flex',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border-soft)',
            borderRadius: '4px',
            padding: '1px'
          }}>
            <button
              onClick={() => setViewportMode('desktop')}
              title="Desktop"
              style={{
                backgroundColor: viewportMode === 'desktop' ? 'var(--accent)' : 'transparent',
                color: viewportMode === 'desktop' ? 'var(--accent-contrast)' : 'var(--muted)',
                border: 'none',
                borderRadius: '2px',
                padding: '2px 6px',
                fontSize: '11px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              💻
            </button>
            <button
              onClick={() => setViewportMode('tablet')}
              title="Tablet"
              style={{
                backgroundColor: viewportMode === 'tablet' ? 'var(--accent)' : 'transparent',
                color: viewportMode === 'tablet' ? 'var(--accent-contrast)' : 'var(--muted)',
                border: 'none',
                borderRadius: '2px',
                padding: '2px 6px',
                fontSize: '11px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              📱
            </button>
            <button
              onClick={() => setViewportMode('mobile')}
              title="Mobile"
              style={{
                backgroundColor: viewportMode === 'mobile' ? 'var(--accent)' : 'transparent',
                color: viewportMode === 'mobile' ? 'var(--accent-contrast)' : 'var(--muted)',
                border: 'none',
                borderRadius: '2px',
                padding: '2px 6px',
                fontSize: '11px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              📲
            </button>
          </div>
        </div>

        {/* Address Bar */}
        <div style={{ flex: 1, minWidth: '80px', maxWidth: '280px', position: 'relative' }}>
          <input
            type="text"
            value={currentUrl}
            onChange={(e) => setCurrentUrl(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border-soft)',
              borderRadius: '3px',
              padding: '1px 22px 1px 5px',
              fontSize: '8px',
              fontFamily: 'var(--mono)',
              color: 'var(--text)',
              outline: 'none',
              height: '18px'
            }}
          />
          <span style={{ position: 'absolute', right: '5px', top: '50%', transform: 'translateY(-50%)', fontSize: '7px', color: 'var(--status-success)', fontWeight: 800 }}>
            🔒 SSL
          </span>
        </div>

        {/* External Link */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in New Tab"
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border-soft)',
              color: 'var(--text)',
              borderRadius: '3px',
              padding: '1px 5px',
              fontSize: '11px',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '18px'
            }}
          >
            ↗️
          </a>
        </div>
      </div>

      {/* Main iFrame Preview Container */}
      <div style={{
        flex: 1,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--surface-alt)',
        padding: viewportMode === 'desktop' ? '0' : '16px',
        overflow: 'auto'
      }}>
        {/* Cold Start Mask Overlay */}
        {activeState === 'waking_up' && (
          <div style={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            backgroundColor: 'var(--surface)',
            opacity: 0.95,
            backdropFilter: 'blur(4px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center'
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: '3px solid rgba(245, 158, 11, 0.2)',
              borderTopColor: 'var(--status-warn)',
              animation: 'spin 1s linear infinite',
              marginBottom: '12px'
            }} />
            <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text)', marginBottom: '4px' }}>
              ⚡ Spinning Up User Container...
            </div>
            <div style={{ fontSize: '9.5px', color: 'var(--muted)', fontFamily: 'var(--mono)', marginBottom: '12px' }}>
              (~1.8s cold start)
            </div>
            <div style={{
              width: '180px',
              height: '4px',
              backgroundColor: 'var(--border-soft)',
              borderRadius: '2px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                backgroundColor: 'var(--status-warn)',
                width: '75%',
                animation: 'pulse 1s infinite alternate'
              }} />
            </div>
          </div>
        )}

        {/* Viewport Frame Container */}
        <div style={{
          width: getIframeWidth(),
          height: '100%',
          maxHeight: viewportMode === 'desktop' ? '100%' : '800px',
          backgroundColor: '#ffffff',
          borderRadius: viewportMode === 'desktop' ? '0' : '10px',
          border: viewportMode === 'desktop' ? 'none' : '1px solid var(--border)',
          boxShadow: viewportMode === 'desktop' ? 'none' : '0 12px 28px rgba(0,0,0,0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.25s ease'
        }}>
          <iframe
            ref={iframeRef}
            src={currentUrl}
            title="Fabrica Live App Preview"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              backgroundColor: '#ffffff'
            }}
            onError={() => handleSimulateColdStart()}
          />
        </div>
      </div>
    </div>
  );
};

export default LiveAppPreview;
