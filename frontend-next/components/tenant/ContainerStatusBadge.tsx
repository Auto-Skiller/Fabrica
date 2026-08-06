'use client';

import React, { useState } from 'react';
import { ContainerState } from '../workspace/LiveAppPreview';

interface ContainerStatusBadgeProps {
  tenantId?: string;
  containerState?: ContainerState;
  onWarmup?: () => void;
  onRestart?: () => void;
  className?: string;
}

export const ContainerStatusBadge: React.FC<ContainerStatusBadgeProps> = ({
  tenantId = 'usr-123',
  containerState = 'warm',
  onWarmup,
  onRestart,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 40, left: 10 });
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const safeTenant = tenantId.toLowerCase().replace(/[^a-z0-9_\-]/g, '-');
  const serviceName = `fabrica-runner-${safeTenant}`;
  const bucketName = `gs://fabrica-tenant-${safeTenant}/`;

  const togglePopover = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPopoverPos({
        top: rect.bottom + 6,
        left: Math.min(rect.left, window.innerWidth - 330)
      });
    }
    setIsOpen(!isOpen);
  };

  const getStatusColor = () => {
    switch (containerState) {
      case 'warm': return '#10b981';
      case 'waking_up': return '#f59e0b';
      case 'idle': default: return '#94a3b8';
    }
  };

  const getStatusBg = () => {
    switch (containerState) {
      case 'warm': return 'rgba(16, 185, 129, 0.12)';
      case 'waking_up': return 'rgba(245, 158, 11, 0.12)';
      case 'idle': default: return 'rgba(148, 163, 184, 0.12)';
    }
  };

  const getStatusLabel = () => {
    switch (containerState) {
      case 'warm': return 'Active (1 Inst)';
      case 'waking_up': return 'Waking Up...';
      case 'idle': default: return 'Idle ($0/mo)';
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} className={className}>
      {/* Clickable Header Badge */}
      <button
        ref={buttonRef}
        type="button"
        onClick={togglePopover}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          backgroundColor: getStatusBg(),
          border: `1px solid ${getStatusColor()}`,
          borderRadius: '10px',
          padding: '1px 5px',
          fontSize: '7.5px',
          fontWeight: 800,
          color: getStatusColor(),
          cursor: 'pointer',
          outline: 'none',
          transition: 'all 0.15s ease'
        }}
      >
        <span style={{
          display: 'inline-block',
          width: '5px',
          height: '5px',
          borderRadius: '50%',
          backgroundColor: getStatusColor(),
          boxShadow: `0 0 4px ${getStatusColor()}`
        }} />
        <span>{getStatusLabel()}</span>
        <span style={{ fontSize: '7px', opacity: 0.7 }}>▼</span>
      </button>

      {/* Diagnostics Popover Modal */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          top: `${popoverPos.top}px`,
          left: `${Math.max(8, popoverPos.left)}px`,
          zIndex: 999999,
          width: '320px',
          backgroundColor: 'var(--surface-alt)',
          border: '1px solid var(--border-soft)',
          borderRadius: '8px',
          padding: '14px',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {/* Popover Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-soft)', paddingBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px' }}>☁️</span>
              <span style={{ fontSize: '11px', fontWeight: 900, color: 'var(--text-bright)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                User Container Diagnostics
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '12px', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>

          {/* Diagnostics Key Values */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--muted)' }}>Service Name:</span>
              <code style={{ color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{serviceName}</code>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--muted)' }}>GCP Region:</span>
              <span style={{ color: 'var(--text)', fontWeight: 700 }}>europe-west2</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--muted)' }}>Scaling Mode:</span>
              <span style={{ color: 'var(--status-success)', fontWeight: 800 }}>min: 0 (Scale to Zero)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--muted)' }}>Dedicated Bucket:</span>
              <code style={{ color: 'var(--accent)', fontFamily: 'var(--mono)', fontSize: '9px' }}>{bucketName}</code>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--muted)' }}>Mount Path:</span>
              <code style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>/mnt/workspace</code>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--muted)' }}>Compute Spec:</span>
              <span style={{ color: 'var(--text)', fontWeight: 700 }}>1 vCPU / 2 GiB RAM</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: '10px', display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={() => {
                if (onWarmup) onWarmup();
                setIsOpen(false);
              }}
              style={{
                flex: 1,
                backgroundColor: 'var(--accent)',
                border: 'none',
                borderRadius: '4px',
                color: 'var(--accent-contrast)',
                fontSize: '10px',
                fontWeight: 800,
                padding: '6px',
                cursor: 'pointer'
              }}
            >
              ⚡ Pre-warm Instance
            </button>
            <button
              type="button"
              onClick={() => {
                if (onRestart) onRestart();
                setIsOpen(false);
              }}
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border-soft)',
                borderRadius: '4px',
                color: 'var(--text)',
                fontSize: '10px',
                fontWeight: 700,
                padding: '6px 10px',
                cursor: 'pointer'
              }}
            >
              🔄 Reboot
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContainerStatusBadge;
