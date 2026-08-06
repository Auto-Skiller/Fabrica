'use client';

import React from 'react';
import LiveAppPreview, { ContainerState } from './LiveAppPreview';
import GcsFileExplorer, { GcsFileNode } from './GcsFileExplorer';

export type RightPanelTab = 'preview' | 'files';

export interface RightPanelProps {
  tenantId?: string;
  bucketName?: string;
  runnerUrl?: string;
  containerState?: ContainerState;
  onFileSelect?: (file: GcsFileNode) => void;
  className?: string;
  style?: React.CSSProperties;
  topComponent?: React.ReactNode;
  bottomComponent?: React.ReactNode;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  tenantId = 'usr-123',
  bucketName,
  runnerUrl,
  containerState = 'warm',
  onFileSelect,
  className = '',
  style,
  topComponent,
  bottomComponent
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
      {/* ================= TOP SECTION: FILES & CODE ================= */}
      <div style={{
        flex: '1 1 50%',
        minHeight: '100px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderBottom: '1px solid var(--border-soft)'
      }}>
        {topComponent || (
          <GcsFileExplorer
            tenantId={tenantId}
            bucketName={bucketName}
            onFileSelect={onFileSelect}
          />
        )}
      </div>

      {/* ================= BOTTOM SECTION: WORKSPACE SUBSYSTEM (7 SUB-SECTIONS) ================= */}
      <div style={{
        flex: '1 1 50%',
        minHeight: '100px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {bottomComponent || (
          <LiveAppPreview
            tenantId={tenantId}
            runnerUrl={runnerUrl}
            containerState={containerState}
          />
        )}
      </div>
    </div>
  );
};

export default RightPanel;
