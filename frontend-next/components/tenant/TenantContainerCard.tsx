'use client';

import React, { useState } from 'react';

interface TenantContainerCardProps {
  tenantId?: string;
  className?: string;
}

export const TenantContainerCard: React.FC<TenantContainerCardProps> = ({
  tenantId = 'usr-123',
  className = ''
}) => {
  const safeTenant = tenantId.toLowerCase().replace(/[^a-z0-9_\-]/g, '-');
  const serviceName = `fabrica-runner-${safeTenant}`;
  const bucketName = `gs://fabrica-tenant-${safeTenant}/`;

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const triggerAction = (message: string, duration = 2000) => {
    setIsProcessing(true);
    setStatusMessage(message);
    setTimeout(() => {
      setIsProcessing(false);
      setTimeout(() => setStatusMessage(null), 1500);
    }, duration);
  };

  return (
    <div
      className={className}
      style={{
        backgroundColor: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: '10px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        color: '#f8fafc'
      }}
    >
      {/* Card Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>⚡</span>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#f8fafc' }}>
              User Container Instance
            </div>
            <div style={{ fontSize: '9px', color: '#94a3b8' }}>
              Per-User Isolated Workspace Container
            </div>
          </div>
        </div>

        <span style={{
          fontSize: '9px',
          fontWeight: 800,
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          color: '#10b981',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          padding: '2px 8px',
          borderRadius: '12px'
        }}>
          ● Active
        </span>
      </div>

      {/* Diagnostics Details */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#090d16',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid #1e293b'
      }}>
        <div>
          <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, display: 'block' }}>CONTAINER STATUS</span>
          <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 800 }}>Active (1 Instance)</span>
        </div>

        <div>
          <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, display: 'block' }}>HARDWARE SPECIFICATION</span>
          <span style={{ fontSize: '10px', color: '#f8fafc', fontWeight: 800 }}>1 vCPU / 2.0 GiB RAM</span>
        </div>
      </div>

      {/* Status Feedback Banner */}
      {statusMessage && (
        <div style={{
          backgroundColor: 'rgba(59, 130, 246, 0.15)',
          border: '1px solid #3b82f6',
          color: '#60a5fa',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '10px',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>{isProcessing ? '⏳' : '✓'}</span>
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Action Buttons Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
        <button
          type="button"
          disabled={isProcessing}
          onClick={() => triggerAction('Pre-warming user container instance...')}
          style={{
            backgroundColor: '#3b82f6',
            border: 'none',
            color: '#ffffff',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '10px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <span>⚡</span>
          <span>Manual Pre-warm</span>
        </button>

        <button
          type="button"
          disabled={isProcessing}
          onClick={() => triggerAction('Rebooting container instance...')}
          style={{
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            color: '#f8fafc',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '10px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <span>🔄</span>
          <span>Restart Container</span>
        </button>

        <button
          type="button"
          disabled={isProcessing}
          onClick={() => triggerAction('Exporting workspace zip backup...')}
          style={{
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            color: '#8b5cf6',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '10px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <span>📥</span>
          <span>Export Workspace (.zip)</span>
        </button>

        <button
          type="button"
          disabled={isProcessing}
          onClick={() => triggerAction('Purging workspace storage...')}
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '10px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <span>🧹</span>
          <span>Purge GCS Workspace</span>
        </button>
      </div>
    </div>
  );
};

export default TenantContainerCard;
