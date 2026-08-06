'use client';

import React from 'react';
import LiveAppPreview, { ContainerState } from './LiveAppPreview';
import GcsFileExplorer, { GcsFileNode } from './GcsFileExplorer';

export type RightPanelTab = 'preview' | 'files';

interface RightPanelProps {
  tenantId?: string;
  bucketName?: string;
  runnerUrl?: string;
  containerState?: ContainerState;
  onFileSelect?: (file: GcsFileNode) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  tenantId = 'usr-123',
  bucketName,
  runnerUrl,
  containerState = 'warm',
  onFileSelect,
  className = '',
  style
}) => {
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
        overflow: 'hidden',
        boxShadow: 'none',
        ...style
      }}
    >
      {/* ================= TOP SECTION: LIVE APP PREVIEW ================= */}
      <div style={{
        flex: '1 1 55%',
        minHeight: '100px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderBottom: '1px solid var(--border-soft)'
      }}>
        <LiveAppPreview
          tenantId={tenantId}
          runnerUrl={runnerUrl}
          containerState={containerState}
        />
      </div>

      {/* ================= BOTTOM SECTION: FILES & CODE ================= */}
      <div style={{
        flex: '1 1 45%',
        minHeight: '100px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <GcsFileExplorer
          tenantId={tenantId}
          bucketName={bucketName}
          onFileSelect={onFileSelect}
        />
      </div>
    </div>
  );
};

export default RightPanel;
