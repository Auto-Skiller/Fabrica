'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface RawDataNode {
  id: string;
  name: string;
  type: 'data';
  status: string;
  original: any;
}

interface SystemNode {
  id: string;
  name: string;
  type: 'system';
  status: string;
  original: any;
}

type GraphNode = (RawDataNode | SystemNode) & d3.SimulationNodeDatum;

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  isCustom?: boolean;
}

interface DependencyGraphProps {
  rawDataList: any[];
  systemComponents: any[];
}

export default function DependencyGraph({ rawDataList, systemComponents }: DependencyGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [customLinks, setCustomLinks] = useState<Omit<GraphLink, 'index' | 'x' | 'y' | 'vx' | 'vy'>[]>([]);
  const [resetKey, setResetKey] = useState<number>(0);
  
  const prevNodesHashRef = useRef<string>('');
  const prevLinksHashRef = useRef<string>('');
  const prevResetKeyRef = useRef<number>(0);
  
  // Link builder modal state
  const [linkSourceId, setLinkSourceId] = useState<string>('');
  const [linkTargetId, setLinkTargetId] = useState<string>('');
  const zoomRef = useRef<any>(null);

  // Persist custom links locally
  useEffect(() => {
    const stored = localStorage.getItem('custom_system_links');
    if (stored) {
      try {
        setCustomLinks(JSON.parse(stored));
      } catch (e) {
        console.error('Error parsing custom links', e);
      }
    }
  }, []);

  // Save custom links
  const saveCustomLinks = (newLinks: typeof customLinks) => {
    setCustomLinks(newLinks);
    localStorage.setItem('custom_system_links', JSON.stringify(newLinks));
  };

  // Process data and systems into Graph structure
  const safeRawDataList = Array.isArray(rawDataList) ? rawDataList : [];
  const safeSystemComponents = Array.isArray(systemComponents) ? systemComponents : [];

  const nodes: GraphNode[] = [
    ...safeRawDataList.map((rd) => ({
      id: `data-${rd.id}`,
      name: rd.name || 'Data Asset',
      type: 'data' as const,
      status: rd.metadata?.status || 'new',
      original: rd,
    })),
    ...safeSystemComponents.map((sc) => ({
      id: `system-${sc.id}`,
      name: sc.name || 'System Component',
      type: 'system' as const,
      status: sc.status || 'new',
      original: sc,
    })),
  ];

  // Derive dynamic implicit links (heuristic connections)
  const implicitLinks: Omit<GraphLink, 'index' | 'x' | 'y' | 'vx' | 'vy'>[] = [];
  
  // 1. Data sources connecting to relevant systems based on keywords or default chain
  nodes.forEach((node) => {
    if (node.type === 'data') {
      const dataNameLower = node.name.toLowerCase();
      let matched = false;
      
      nodes.forEach((sys) => {
        if (sys.type === 'system') {
          const sysNameLower = sys.name.toLowerCase();
          const sysRoleLower = (sys.original?.role || '').toLowerCase();
          
          // Match by name or content keywords
          if (
            dataNameLower.includes(sysNameLower) || 
            sysNameLower.includes(dataNameLower) ||
            sysRoleLower.includes(dataNameLower.split('.')[0])
          ) {
            implicitLinks.push({
              id: `${node.id}-${sys.id}`,
              source: node.id,
              target: sys.id,
            });
            matched = true;
          }
        }
      });

      // Default fallback: link to the first system if no matches
      if (!matched && safeSystemComponents.length > 0) {
        implicitLinks.push({
          id: `${node.id}-system-${safeSystemComponents[0].id}`,
          source: node.id,
          target: `system-${safeSystemComponents[0].id}`,
        });
      }
    }
  });

  // 2. Systems connecting to other systems based on status flow sequence or name similarities
  // e.g. system A -> system B
  const systems = nodes.filter((n) => n.type === 'system');
  for (let i = 0; i < systems.length - 1; i++) {
    // Sequence chain connection so the graph doesn't drift apart
    implicitLinks.push({
      id: `${systems[i].id}-${systems[i + 1].id}`,
      source: systems[i].id,
      target: systems[i + 1].id,
    });
  }

  // Combine implicit links and custom links, avoiding duplicates
  const allLinks: Omit<GraphLink, 'index' | 'x' | 'y' | 'vx' | 'vy'>[] = [...implicitLinks];
  customLinks.forEach((cl) => {
    // Safety check that node exists in current view
    const sourceExists = nodes.some(n => n.id === cl.source);
    const targetExists = nodes.some(n => n.id === cl.target);
    if (sourceExists && targetExists) {
      if (!allLinks.some((l) => l.source === cl.source && l.target === cl.target)) {
        allLinks.push({ ...cl, isCustom: true });
      }
    }
  });

  // Add a new link
  const handleAddLink = () => {
    if (!linkSourceId || !linkTargetId || linkSourceId === linkTargetId) return;
    const linkId = `${linkSourceId}-${linkTargetId}`;
    if (customLinks.some((cl) => cl.source === linkSourceId && cl.target === linkTargetId)) return;

    const newLinks = [...customLinks, { id: linkId, source: linkSourceId, target: linkTargetId, isCustom: true }];
    saveCustomLinks(newLinks);
    setLinkSourceId('');
    setLinkTargetId('');
  };

  // Clear custom links
  const handleClearCustomLinks = () => {
    saveCustomLinks([]);
  };

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const currentNodesHash = nodes.map((n) => n.id).join(',');
    const currentLinksHash = allLinks.map((l) => l.id).join(',');
    const wasReset = prevResetKeyRef.current !== resetKey;
    const hasChanged = currentNodesHash !== prevNodesHashRef.current || currentLinksHash !== prevLinksHashRef.current;

    prevResetKeyRef.current = resetKey;

    if (!hasChanged && !wasReset) {
      return;
    }

    prevNodesHashRef.current = currentNodesHash;
    prevLinksHashRef.current = currentLinksHash;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = containerRef.current.clientWidth || 300;
    const height = 320;

    // Set SVG attributes
    svg
      .attr('width', '100%')
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);

    // Define marker arrowhead definitions for directed links
    const defs = svg.append('defs');
    
    // Normal arrow
    defs.append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 18) // Distance from node center
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4 L10,0 L0,4')
      .attr('fill', 'var(--muted)');

    // Custom link arrow
    defs.append('marker')
      .attr('id', 'arrow-custom')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 18)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4 L10,0 L0,4')
      .attr('fill', 'var(--accent)');

    // Deep copy of nodes and links for d3 simulation mutation
    const simNodes = JSON.parse(JSON.stringify(nodes)) as GraphNode[];
    const simLinks = JSON.parse(JSON.stringify(allLinks)) as GraphLink[];

    // Create a simulation
    const simulation = d3.forceSimulation<GraphNode>(simNodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(simLinks)
        .id((d) => d.id)
        .distance(70)
      )
      .force('charge', d3.forceManyBody().strength(-140))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(24));

    // Root Group with Zoom Support
    const mainGroup = svg.append('g').attr('class', 'main-group');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on('zoom', (event) => {
        mainGroup.attr('transform', event.transform);
      });

    svg.call(zoom);
    zoomRef.current = zoom;
    svg.call(zoom.transform, d3.zoomIdentity.translate(0, 0).scale(1.0));

    // Render grid background lines
    const gridSpacing = 20;
    const gridGroup = mainGroup.append('g').attr('class', 'grid').style('opacity', 0.15);
    for (let x = 0; x < width; x += gridSpacing) {
      gridGroup.append('line')
        .attr('x1', x)
        .attr('y1', 0)
        .attr('x2', x)
        .attr('y2', height)
        .attr('stroke', 'var(--border-soft)')
        .attr('stroke-width', 0.5);
    }
    for (let y = 0; y < height; y += gridSpacing) {
      gridGroup.append('line')
        .attr('x1', 0)
        .attr('y1', y)
        .attr('x2', width)
        .attr('y2', y)
        .attr('stroke', 'var(--border-soft)')
        .attr('stroke-width', 0.5);
    }

    // Render links
    const linkGroup = mainGroup.append('g').attr('class', 'links');
    const link = linkGroup
      .selectAll('path')
      .data(simLinks)
      .enter()
      .append('path')
      .attr('class', 'link-path')
      .attr('stroke', (d) => d.isCustom ? 'var(--accent)' : 'var(--border-soft)')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', (d) => d.isCustom ? 1.5 : 1)
      .attr('fill', 'none')
      .attr('marker-end', (d) => d.isCustom ? 'url(#arrow-custom)' : 'url(#arrow)')
      .style('stroke-dasharray', (d) => d.isCustom ? '4,3' : 'none');

    // Flowing data packet indicators on paths
    const flowPackets = mainGroup.append('g').attr('class', 'flow-packets');
    const packet = flowPackets
      .selectAll('circle')
      .data(simLinks)
      .enter()
      .append('circle')
      .attr('r', 2)
      .attr('fill', (d) => d.isCustom ? 'var(--accent)' : '#10b981')
      .style('opacity', 0.8);

    // Render nodes
    const nodeGroup = mainGroup.append('g').attr('class', 'nodes');
    const node = nodeGroup
      .selectAll('g')
      .data(simNodes)
      .enter()
      .append('g')
      .attr('class', 'node-item')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        setSelectedNode(d);
      })
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended)
      );

    // Node glowing halo
    node.append('circle')
      .attr('class', 'node-outer-circle')
      .attr('r', 12)
      .attr('fill', (d) => d.type === 'data' ? 'rgba(59,130,246,0.1)' : 'rgba(204,122,74,0.1)')
      .attr('stroke', (d) => d.type === 'data' ? '#3b82f6' : 'var(--accent)')
      .attr('stroke-width', 1.5)
      .style('filter', 'drop-shadow(0px 0px 4px rgba(204,122,74,0.3))');

    // Status ring (outer thin circle representing pipeline status)
    node.append('circle')
      .attr('r', 15)
      .attr('fill', 'none')
      .attr('stroke', (d) => {
        const s = d.status;
        if (s === 'processed' || s === 'enhanced') return '#10b981';
        if (s === 'in_process') return '#3b82f6';
        return '#f59e0b';
      })
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,2');

    // Center emoji or letter label
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '.3em')
      .attr('font-size', '10px')
      .text((d) => d.type === 'data' ? '📄' : '⚙️');

    // Label name text
    node.append('text')
      .attr('dx', 0)
      .attr('dy', 26)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--text)')
      .attr('font-size', '6.5px')
      .attr('font-weight', '700')
      .attr('font-family', 'var(--mono)')
      .text((d) => d.name.length > 12 ? d.name.substring(0, 10) + '..' : d.name);

    // Selection highlight layer
    if (selectedNode) {
      node.filter((d) => d.id === selectedNode.id)
        .select('circle')
        .attr('stroke-width', 3)
        .attr('stroke', '#10b981');
    }

    // Update positions on tick
    simulation.on('tick', () => {
      // Bounding box constraint to prevent nodes getting cut off or exiting section edges
      simNodes.forEach((d: any) => {
        const r = 24; // boundary padding radius for 100% visibility of node + text label
        d.x = Math.max(r, Math.min(width - r, d.x));
        d.y = Math.max(r, Math.min(height - r, d.y));
      });

      // Draw smooth paths with curved curves or straight lines
      link.attr('d', (d: any) => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dr = Math.sqrt(dx * dx + dy * dy) * 1.5; // Curvature factor
        return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
      });

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);

      // Animate flowing packets along path
      packet.each(function (this: SVGCircleElement, d: any) {
        const path = link.filter((ld: any) => ld.id === d.id).node() as SVGPathElement;
        if (path) {
          const totalLength = path.getTotalLength();
          const speed = d.isCustom ? 0.0004 : 0.0002;
          const offset = (Date.now() * speed) % 1;
          const point = path.getPointAtLength(offset * totalLength);
          d3.select(this)
            .attr('cx', point.x)
            .attr('cy', point.y);
        }
      });
    });

    // Keep tick loops running for flow packets
    const timer = d3.timer(() => {
      packet.each(function (this: SVGCircleElement, d: any) {
        const path = link.filter((ld: any) => ld.id === d.id).node() as SVGPathElement;
        if (path) {
          const totalLength = path.getTotalLength();
          const speed = d.isCustom ? 0.001 : 0.0005;
          const offset = (Date.now() * speed) % 1;
          const point = path.getPointAtLength(offset * totalLength);
          d3.select(this)
            .attr('cx', point.x)
            .attr('cy', point.y);
        }
      });
    });

    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return () => {
      simulation.stop();
      timer.stop();
    };
  }, [rawDataList, systemComponents, customLinks, resetKey]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    
    // Find connected nodes
    const connectedIds = new Set<string>();
    if (selectedNode) {
      allLinks.forEach((l) => {
        const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
        if (sId === selectedNode.id) {
          connectedIds.add(tId);
        } else if (tId === selectedNode.id) {
          connectedIds.add(sId);
        }
      });
    }

    // Update nodes styling
    svg.selectAll('.node-item').each(function (d: any) {
      const g = d3.select(this);
      const isSelected = selectedNode && d.id === selectedNode.id;
      const isConnected = selectedNode && connectedIds.has(d.id);
      
      const outerBg = g.select('.node-outer-circle');
      
      if (selectedNode) {
        if (isSelected) {
          outerBg
            .attr('stroke', '#a855f7') // Vibrant Purple for Selected Node
            .attr('stroke-width', 3.5)
            .style('opacity', 1);
          g.style('opacity', 1);
        } else if (isConnected) {
          outerBg
            .attr('stroke', '#06b6d4') // Bright Cyan for Connected Nodes
            .attr('stroke-width', 2.5)
            .style('opacity', 1);
          g.style('opacity', 1);
        } else {
          // Keep default colors and normal opacity
          outerBg
            .attr('stroke', d.type === 'data' ? '#3b82f6' : 'var(--accent)')
            .attr('stroke-width', 1.5)
            .style('opacity', 1);
          g.style('opacity', 1);
        }
      } else {
        // Reset to default
        outerBg
          .attr('stroke', d.type === 'data' ? '#3b82f6' : 'var(--accent)')
          .attr('stroke-width', 1.5)
          .style('opacity', 1);
        g.style('opacity', 1);
      }
    });

    // Update links styling
    svg.selectAll('.link-path').each(function (d: any) {
      const path = d3.select(this);
      const sId = typeof d.source === 'object' ? d.source.id : d.source;
      const tId = typeof d.target === 'object' ? d.target.id : d.target;
      
      const isRelated = selectedNode && (sId === selectedNode.id || tId === selectedNode.id);

      if (selectedNode) {
        if (isRelated) {
          path
            .attr('stroke', '#a855f7') // Highlight path
            .attr('stroke-dasharray', 'none') // Ensure high visibility
            .attr('stroke-width', 2.5)
            .attr('stroke-opacity', 1);
        } else {
          // Keep default color, width, and normal opacity instead of fading out
          path
            .attr('stroke', d.isCustom ? 'var(--accent)' : 'var(--border-soft)')
            .attr('stroke-width', d.isCustom ? 1.5 : 1)
            .attr('stroke-opacity', 0.6)
            .style('stroke-dasharray', d.isCustom ? '4,3' : 'none');
        }
      } else {
        // Reset to default
        path
          .attr('stroke', d.isCustom ? 'var(--accent)' : 'var(--border-soft)')
          .attr('stroke-width', d.isCustom ? 1.5 : 1)
          .attr('stroke-opacity', 0.6)
          .style('stroke-dasharray', d.isCustom ? '4,3' : 'none');
      }
    });
  }, [selectedNode, allLinks]);

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      
      {/* Network Container */}
      <div style={{
        position: 'relative',
        background: 'var(--surface)',
        border: '1px solid var(--border-soft)',
        borderRadius: '8px',
        overflow: 'hidden',
        height: '320px'
      }}>
        <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />
        
        {/* Helper overlay key */}
        <div style={{
          position: 'absolute',
          bottom: '8px',
          left: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          padding: '4px 6px',
          borderRadius: '4px',
          fontSize: '6px',
          fontFamily: 'var(--mono)',
          color: 'var(--muted)',
          pointerEvents: 'none'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#3b82f6' }} />
            <span>📄 Data Node</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent)' }} />
            <span>⚙️ System Node</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ width: '5px', height: '1px', background: 'var(--accent)' }} />
            <span>⚡ Custom Dependency Link</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ width: '5px', height: '1px', background: 'var(--border-soft)' }} />
            <span>Flowing Packets (Input Process)</span>
          </div>
        </div>

        {/* Floating Top Right Controls (Hint & Reset button) */}
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <div style={{
            fontSize: '7px',
            fontFamily: 'var(--sans)',
            color: 'var(--muted)',
            background: 'rgba(0,0,0,0.4)',
            padding: '3px 6px',
            borderRadius: '4px',
            pointerEvents: 'none'
          }}>
            💡 Drag nodes to re-organize
          </div>

          {/* Tactical Zoom Controls */}
          <div style={{ display: 'flex', gap: '3px', pointerEvents: 'auto' }}>
            <button
              onClick={() => {
                if (svgRef.current && zoomRef.current) {
                  d3.select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, 1.3);
                }
              }}
              title="Zoom In"
              style={{
                background: 'rgba(0,0,0,0.6)',
                border: '1px solid var(--border-soft)',
                color: 'var(--text)',
                fontSize: '9px',
                width: '18px',
                height: '18px',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ＋
            </button>
            <button
              onClick={() => {
                if (svgRef.current && zoomRef.current) {
                  d3.select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, 0.7);
                }
              }}
              title="Zoom Out"
              style={{
                background: 'rgba(0,0,0,0.6)',
                border: '1px solid var(--border-soft)',
                color: 'var(--text)',
                fontSize: '9px',
                width: '18px',
                height: '18px',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              －
            </button>
            <button
              onClick={() => {
                if (svgRef.current && zoomRef.current) {
                  d3.select(svgRef.current).transition().duration(250).call(zoomRef.current.transform, d3.zoomIdentity.translate(0, 0).scale(1.0));
                }
              }}
              title="Fit Screen"
              style={{
                background: 'rgba(0,0,0,0.6)',
                border: '1px solid var(--border-soft)',
                color: 'var(--text)',
                fontSize: '8px',
                width: '18px',
                height: '18px',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ⌂
            </button>
          </div>

          <button
            onClick={() => {
              setResetKey(prev => prev + 1);
              setSelectedNode(null);
            }}
            title="Reset simulation forces & center all nodes"
            style={{
              background: 'rgba(0,0,0,0.6)',
              border: '1px solid var(--border-soft)',
              color: 'var(--text)',
              fontSize: '8px',
              fontFamily: 'var(--sans)',
              padding: '2px 6px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              transition: 'all 0.2s ease',
            }}
          >
            🔄 Reset Layout
          </button>
        </div>
      </div>

      {/* Selected Node Details Box */}
      {selectedNode ? (
        <div style={{
          background: 'var(--surface-alt)',
          border: '1px solid var(--border-soft)',
          borderRadius: '6px',
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{
                fontSize: '6px',
                fontWeight: 900,
                textTransform: 'uppercase',
                background: selectedNode.type === 'data' ? 'rgba(59,130,246,0.1)' : 'rgba(204,122,74,0.1)',
                color: selectedNode.type === 'data' ? '#3b82f6' : 'var(--accent)',
                padding: '1px 3px',
                borderRadius: '2px',
                fontFamily: 'var(--mono)'
              }}>
                {selectedNode.type} Component
              </span>
              <h4 style={{ margin: '2px 0 0', fontSize: '10px', fontWeight: 800, color: 'var(--text)' }}>
                {selectedNode.name}
              </h4>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '8px', cursor: 'pointer' }}
            >
              ✕ Close
            </button>
          </div>

          <p style={{ margin: 0, fontSize: '8px', color: 'var(--muted)', lineHeight: '1.2' }}>
            {selectedNode.type === 'system' 
              ? `Role: ${selectedNode.original?.role || 'System Component Integration'}` 
              : `Content: ${selectedNode.original?.content ? selectedNode.original.content.substring(0, 60) + '...' : 'Empty File'}`}
          </p>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px', borderTop: '1px solid var(--border-soft)', paddingTop: '4px' }}>
            <span style={{ fontSize: '7px', color: 'var(--muted)', fontFamily: 'var(--sans)' }}>
              Status: <b style={{ textTransform: 'uppercase', color: selectedNode.status === 'processed' || selectedNode.status === 'enhanced' ? '#10b981' : '#f59e0b' }}>{selectedNode.status}</b>
            </span>
            <span style={{ fontSize: '7px', color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
              ID: {selectedNode.id}
            </span>
          </div>
        </div>
      ) : (
        <div style={{
          padding: '8px',
          border: '1px dashed var(--border-soft)',
          borderRadius: '6px',
          textAlign: 'center',
          fontSize: '8px',
          color: 'var(--muted)'
        }}>
          Click on any system or data node to inspect properties and connections.
        </div>
      )}

      {/* Manual Link Builder Panel */}
      <div style={{
        background: 'var(--surface-alt)',
        border: '1px solid var(--border-soft)',
        borderRadius: '6px',
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}>
        <span style={{ fontSize: '7.5px', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--sans)' }}>
          ⛓️ Custom Dependency Link Builder
        </span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <select
            value={linkSourceId}
            onChange={(e) => setLinkSourceId(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--surface)',
              border: '1px solid var(--border-soft)',
              borderRadius: '4px',
              fontSize: '8px',
              color: 'var(--text)',
              padding: '2px 4px',
              outline: 'none'
            }}
          >
            <option value="">-- Choose Source Node --</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.type === 'data' ? '📄' : '⚙️'} {n.name} ({n.type})
              </option>
            ))}
          </select>

          <div style={{ display: 'flex', justifyContent: 'center', fontSize: '8px', color: 'var(--muted)', margin: '-2px 0' }}>↓</div>

          <select
            value={linkTargetId}
            onChange={(e) => setLinkTargetId(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--surface)',
              border: '1px solid var(--border-soft)',
              borderRadius: '4px',
              fontSize: '8px',
              color: 'var(--text)',
              padding: '2px 4px',
              outline: 'none'
            }}
          >
            <option value="">-- Choose Target Node --</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.type === 'data' ? '📄' : '⚙️'} {n.name} ({n.type})
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px' }}>
          {customLinks.length > 0 && (
            <button
              onClick={handleClearCustomLinks}
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#ef4444',
                fontSize: '7.5px',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
            >
              🗑️ Clear Custom Links
            </button>
          )}
          <button
            onClick={handleAddLink}
            disabled={!linkSourceId || !linkTargetId || linkSourceId === linkTargetId}
            style={{
              marginLeft: 'auto',
              background: 'var(--accent)',
              border: 'none',
              color: '#fff',
              fontSize: '7.5px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '3px',
              cursor: 'pointer',
              opacity: (!linkSourceId || !linkTargetId || linkSourceId === linkTargetId) ? 0.5 : 1
            }}
          >
            ➕ Insert Link
          </button>
        </div>
      </div>

    </div>
  );
}
