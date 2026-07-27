'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { MissionsYaml, Mission, MissionClass, MissionTask, Priority } from '../../lib/types';

interface Props {
  missions: MissionsYaml;
  filteredMissions: any[];
}

// Graph node definition for D3
interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: 'mission' | 'task';
  category?: string;
  statusColor?: string;
  priority?: Priority;
  progressPercentage?: string;
  stateClass?: MissionClass;
  taskStatus?: string;
  original?: any;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  type: 'sequence' | 'dependency' | 'parent-child';
}

export default function MissionGraph({ missions, filteredMissions }: Props) {
  const [selectedMission, setSelectedMission] = useState<{ id: string; detail: Mission } | null>(null);
  const [resetKey, setResetKey] = useState<number>(0);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);

  const prevNodesHashRef = useRef<string>('');
  const prevLinksHashRef = useRef<string>('');
  const prevResetKeyRef = useRef<number>(0);

  const svgRef = useRef<SVGSVGElement | null>(null);

  const getMissionStatus = (m: any) => {
    const rawStatus = String(m.status || '').toLowerCase();
    if (['drafting', 'draft', 'drafted'].includes(rawStatus)) return 'drafting';
    if (rawStatus === 'planning') return 'planning';
    if (rawStatus === 'execution') return 'execution';
    if (['archive', 'done', 'completed'].includes(rawStatus)) return 'archive';

    const rawClass = String(m.state?.class || '').toLowerCase();
    if (rawClass === 'draft' || rawClass === 'drafting') return 'drafting';
    if (rawClass === 'planning') return 'planning';
    if (rawClass === 'execution') return 'execution';
    if (rawClass === 'done' || rawClass === 'archive') return 'archive';

    return 'drafting';
  };

  const safeFilteredMissions = Array.isArray(filteredMissions) ? filteredMissions : [];

  const mDraft = useMemo(() => safeFilteredMissions.filter(m => getMissionStatus(m) === 'drafting'), [safeFilteredMissions]);
  const mPlan = useMemo(() => safeFilteredMissions.filter(m => getMissionStatus(m) === 'planning'), [safeFilteredMissions]);
  const mExec = useMemo(() => safeFilteredMissions.filter(m => getMissionStatus(m) === 'execution'), [safeFilteredMissions]);
  const mArchive = useMemo(() => safeFilteredMissions.filter(m => getMissionStatus(m) === 'archive'), [safeFilteredMissions]);

  // Unpack missions across categories from filteredMissions
  const standardMissions = useMemo(() => 
    safeFilteredMissions.filter(m => m.category === 'standard' || m.category === 'Standard'),
    [safeFilteredMissions]
  );
  const brainstormingMissions = useMemo(() => 
    safeFilteredMissions.filter(m => m.category === 'brainstorming' || m.category === 'Brainstorming'),
    [safeFilteredMissions]
  );
  const deepResearchMissions = useMemo(() => 
    safeFilteredMissions.filter(m => m.category === 'deep_research' || m.category === 'Deep Research'),
    [safeFilteredMissions]
  );
  const analyticsMissions = useMemo(() => 
    safeFilteredMissions.filter(m => m.category === 'analytics' || m.category === 'Analytics'),
    [safeFilteredMissions]
  );
  const systemBuildMissions = useMemo(() => 
    safeFilteredMissions.filter(m => m.category === 'system_build' || m.category === 'System Build'),
    [safeFilteredMissions]
  );
  const systemBuildFromDataMissions = useMemo(() => 
    filteredMissions.filter(m => m.category === 'system_build_from_data' || m.category === 'System Build From Data'),
    [filteredMissions]
  );
  const systemOptimizationMissions = useMemo(() => 
    filteredMissions.filter(m => m.category === 'system_optimization' || m.category === 'System Optimization'),
    [filteredMissions]
  );
  const systemOptimizationFromDataMissions = useMemo(() => 
    filteredMissions.filter(m => m.category === 'system_optimization_from_data' || m.category === 'System Optimization From Data'),
    [filteredMissions]
  );
  const systemTestMissions = useMemo(() => 
    filteredMissions.filter(m => m.category === 'system_test' || m.category === 'System Test'),
    [filteredMissions]
  );
  const systemTestFromDataMissions = useMemo(() => 
    filteredMissions.filter(m => m.category === 'system_test_from_data' || m.category === 'System Test From Data'),
    [filteredMissions]
  );
  
  // Flatten all missions
  const allMissions = filteredMissions;

  // Colors based on Status / Progress
  const getStatusColor = (mClass: MissionClass) => {
    switch (mClass) {
      case 'DRAFT': return '#3b82f6'; // Blue
      case 'PLANNING': return '#f59e0b'; // Amber
      case 'EXECUTION': return '#14b8a6'; // Teal
      case 'DONE': return '#10b981'; // Green
      default: return '#64748b'; // Slate
    }
  };

  const getTaskStatusColor = (progress: string) => {
    switch (progress) {
      case 'completed': return '#10b981'; // Green
      case 'in-progress': return '#3b82f6'; // Blue
      case 'blocked': return '#ef4444'; // Red
      case 'not-started': return '#64748b'; // Muted slate
      default: return '#475569';
    }
  };

  const handleSelectMission = (mId: string, mDetail: Mission) => {
    setSelectedMission({ id: mId, detail: mDetail });
  };

  // Process and Filter Graph Nodes / Links
  const roadmapNodesAndLinks = useMemo(() => {
    const graphNodes: GraphNode[] = [];
    const graphLinks: GraphLink[] = [];

    // Feed nodes from flattened missions list
    allMissions.forEach((m) => {
      graphNodes.push({
        id: `mission-${m.id}`,
        label: m.id.replace(/_/g, ' '),
        type: 'mission',
        category: m.category,
        statusColor: getStatusColor(m.state?.class || m.stateClass || 'DRAFT'),
        priority: m.priority,
        progressPercentage: m.metrics?.progress_percentage || '0%',
        stateClass: m.state?.class || m.stateClass,
        original: m
      });
    });

    // Chain sequence links inside category
    const connectSequence = (list: typeof allMissions) => {
      for (let i = 0; i < list.length - 1; i++) {
        const sourceId = `mission-${list[i].id}`;
        const targetId = `mission-${list[i + 1].id}`;
        
        // Verify both endpoints exist in our filtered list
        const sourceExists = graphNodes.some(n => n.id === sourceId);
        const targetExists = graphNodes.some(n => n.id === targetId);

        if (sourceExists && targetExists) {
          graphLinks.push({
            id: `seq-${list[i].id}-${list[i + 1].id}`,
            source: sourceId,
            target: targetId,
            type: 'sequence'
          });
        }
      }
    };

    connectSequence(standardMissions);
    connectSequence(brainstormingMissions);
    connectSequence(deepResearchMissions);
    connectSequence(analyticsMissions);
    connectSequence(systemBuildMissions);
    connectSequence(systemBuildFromDataMissions);
    connectSequence(systemOptimizationMissions);
    connectSequence(systemOptimizationFromDataMissions);
    connectSequence(systemTestMissions);
    connectSequence(systemTestFromDataMissions);

    // Cross-category heuristic connections based on overlaps in objectives
    for (let i = 0; i < graphNodes.length; i++) {
      for (let j = i + 1; j < graphNodes.length; j++) {
        const n1 = graphNodes[i];
        const n2 = graphNodes[j];
        if (n1.category !== n2.category) {
          const m1 = n1.original;
          const m2 = n2.original;
          const words1 = m1.objective.toLowerCase().split(/\s+/).filter((w: string) => w.length > 5);
          const words2 = m2.objective.toLowerCase().split(/\s+/).filter((w: string) => w.length > 5);
          const common = words1.filter((w: string) => words2.includes(w));
          if (common.length > 0) {
            graphLinks.push({
              id: `cross-${m1.id}-${m2.id}`,
              source: n1.id,
              target: n2.id,
              type: 'dependency'
            });
          }
        }
      }
    }

    return { nodes: graphNodes, links: graphLinks };
  }, [
    allMissions,
    standardMissions,
    brainstormingMissions,
    deepResearchMissions,
    analyticsMissions,
    systemBuildMissions,
    systemBuildFromDataMissions,
    systemOptimizationMissions,
    systemOptimizationFromDataMissions,
    systemTestMissions,
    systemTestFromDataMissions
  ]);

  const taskNodesAndLinks = useMemo(() => {
    if (!selectedMission) return { nodes: [], links: [] };

    const graphNodes: GraphNode[] = [];
    const graphLinks: GraphLink[] = [];
    const mission = selectedMission.detail;
    
    // Parent Central Node
    graphNodes.push({
      id: `mission-${selectedMission.id}`,
      label: selectedMission.id.replace(/_/g, ' '),
      type: 'mission',
      category: 'Focus Mission',
      statusColor: getStatusColor(mission.state?.class || mission.stateClass || 'DRAFT'),
      priority: mission.priority,
      progressPercentage: mission.metrics?.progress_percentage || '0%',
      stateClass: mission.state?.class || mission.stateClass,
      original: mission
    });

    // Sub-tasks as nodes
    const tasks = Object.entries(mission.tasks || {});
    tasks.forEach(([taskKey, taskVal]) => {
      graphNodes.push({
        id: `task-${taskKey}`,
        label: taskVal.task,
        type: 'task',
        taskStatus: taskVal.progress,
        statusColor: getTaskStatusColor(taskVal.progress),
        priority: taskVal.priority_ref ? 'HIGH' : 'LOW',
        original: taskVal
      });

      // Connect task dependencies
      if (taskVal.depends_on && taskVal.depends_on.length > 0) {
        taskVal.depends_on.forEach((depKey) => {
          if (mission.tasks[depKey]) {
            graphLinks.push({
              id: `dep-${depKey}-${taskKey}`,
              source: `task-${depKey}`,
              target: `task-${taskKey}`,
              type: 'dependency'
            });
          }
        });
      } else {
        // Root task connects to parent center node
        graphLinks.push({
          id: `parent-${selectedMission.id}-${taskKey}`,
          source: `mission-${selectedMission.id}`,
          target: `task-${taskKey}`,
          type: 'parent-child'
        });
      }
    });

    return { nodes: graphNodes, links: graphLinks };
  }, [selectedMission]);

  const { nodes, links } = useMemo(() => {
    const graphNodes = [...roadmapNodesAndLinks.nodes];
    const graphLinks = [...roadmapNodesAndLinks.links];

    if (selectedMission) {
      // Filter out duplicate mission node
      const taskNodes = taskNodesAndLinks.nodes.filter(n => n.id !== `mission-${selectedMission.id}`);
      graphNodes.push(...taskNodes);
      graphLinks.push(...taskNodesAndLinks.links);
    }

    return { nodes: graphNodes, links: graphLinks };
  }, [roadmapNodesAndLinks, taskNodesAndLinks, selectedMission]);

  // Handle D3 Force Simulation render
  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const currentNodesHash = nodes.map(n => n.id).join(',');
    const currentLinksHash = links.map(l => l.id).join(',');
    const wasReset = prevResetKeyRef.current !== resetKey;
    const hasChanged = currentNodesHash !== prevNodesHashRef.current || currentLinksHash !== prevLinksHashRef.current;

    prevResetKeyRef.current = resetKey;

    if (!hasChanged && !wasReset) {
      return;
    }

    prevNodesHashRef.current = currentNodesHash;
    prevLinksHashRef.current = currentLinksHash;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous components

    const width = 600;
    const height = 330;

    // Add visual glowing filter
    const defs = svg.append('defs');
    
    // Pulse glow filter
    const glowFilter = defs.append('filter')
      .attr('id', 'neon-glow')
      .attr('x', '-20%')
      .attr('y', '-20%')
      .attr('width', '140%')
      .attr('height', '140%');
    
    glowFilter.append('feGaussianBlur')
      .attr('stdDeviation', '4')
      .attr('result', 'blur');
    
    glowFilter.append('feMerge')
      .selectAll('feMergeNode')
      .data(['blur', 'SourceGraphic'])
      .enter().append('feMergeNode')
      .attr('in', d => d);

    // Create Marker Arrowheads
    defs.selectAll('marker')
      .data(['seq', 'dep', 'parent'])
      .enter().append('marker')
      .attr('id', d => `arrow-${d}`)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', (d) => {
        return d === 'parent' ? 24 : 20;
      })
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L10,0L0,4')
      .attr('fill', d => {
        if (d === 'seq') return 'rgba(255, 255, 255, 0.2)';
        if (d === 'dep') return '#f59e0b'; // Amber warn color
        return 'rgba(255, 255, 255, 0.12)';
      });

    // Root Group with Zoom Support
    const mainGroup = svg.append('g').attr('class', 'main-group');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on('zoom', (event) => {
        mainGroup.attr('transform', event.transform);
      });

    svg.call(zoom);
    svg.call(zoom.transform, d3.zoomIdentity.translate(0, 0).scale(1.0));

    // Simulation forces initialization
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links)
        .id(d => d.id)
        .distance((d) => {
          if (d.type === 'sequence') return 120;
          if (d.type === 'parent-child') return 80;
          return 95;
        })
      )
      .force('charge', d3.forceManyBody().strength((d) => {
        return d.type === 'mission' ? -420 : -220;
      }))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d) => {
        return d.type === 'mission' ? 34 : 26;
      }));

    // Draw Links
    const link = mainGroup.append('g')
      .selectAll('path')
      .data(links)
      .enter().append('path')
      .attr('class', 'link-path')
      .attr('stroke', (d) => {
        if (d.type === 'sequence') return 'rgba(255, 255, 255, 0.15)';
        if (d.type === 'dependency') return 'rgba(245, 158, 11, 0.35)';
        return 'rgba(255, 255, 255, 0.08)';
      })
      .attr('stroke-width', d => d.type === 'dependency' ? 1.8 : 1.2)
      .attr('stroke-dasharray', d => d.type === 'parent-child' ? '3,3' : 'none')
      .attr('fill', 'none')
      .attr('marker-end', d => `url(#arrow-${d.type === 'sequence' ? 'seq' : d.type === 'dependency' ? 'dep' : 'parent'})`)
      .style('transition', 'stroke 0.2s ease, stroke-width 0.2s ease');

    // Create interactive Node group container
    const node = mainGroup.append('g')
      .selectAll('g')
      .data(nodes)
      .enter().append('g')
      .attr('class', 'node-group')
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        setHoveredNode(d);
        
        // Highlight current hovered node & connected nodes/links
        d3.select(event.currentTarget).select('.node-outer-bg')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 2.5)
          .style('filter', 'url(#neon-glow)');
        
        // Fade out non-adjacent paths for hyper-focus
        link.style('opacity', (l: any) => {
          return l.source.id === d.id || l.target.id === d.id ? 1.0 : 0.12;
        });
      })
      .on('mouseleave', (event, d) => {
        setHoveredNode(null);
        
        d3.select(event.currentTarget).select('.node-outer-bg')
          .attr('stroke', d.statusColor || 'var(--border-dim)')
          .attr('stroke-width', d.type === 'mission' ? 2 : 1.5)
          .style('filter', d.stateClass === 'EXECUTION' ? 'url(#neon-glow)' : 'none');

        // Restore overall opacities
        link.style('opacity', 1.0);
      })
      .on('click', (event, d) => {
        if (d.type === 'mission') {
          handleSelectMission(d.id.replace('mission-', ''), d.original);
        }
      });

    // Outer chip casing / ring
    node.append('circle')
      .attr('class', 'node-outer-bg')
      .attr('r', d => d.type === 'mission' ? 19 : 13)
      .attr('fill', d => d.type === 'mission' ? 'rgba(15, 23, 42, 0.9)' : 'rgba(30, 41, 59, 0.8)')
      .attr('stroke', d => {
        const isSelected = selectedMission && d.id === `mission-${selectedMission.id}`;
        return isSelected ? '#10b981' : (d.statusColor || 'var(--border-dim)');
      })
      .attr('stroke-width', d => {
        const isSelected = selectedMission && d.id === `mission-${selectedMission.id}`;
        return isSelected ? 3.5 : (d.type === 'mission' ? 2 : 1.5);
      })
      .style('filter', d => d.stateClass === 'EXECUTION' ? 'url(#neon-glow)' : 'none')
      .style('transition', 'all 0.25s ease');

    // Solid core dot matching status
    node.append('circle')
      .attr('r', d => d.type === 'mission' ? 6 : 4)
      .attr('fill', d => d.statusColor || 'var(--text-muted)')
      .style('opacity', 0.9);

    // Glow dot inside Execution status to represent processing loop
    node.filter(d => d.stateClass === 'EXECUTION')
      .append('circle')
      .attr('r', 10)
      .attr('fill', 'none')
      .attr('stroke', '#14b8a6')
      .attr('stroke-width', 1)
      .style('opacity', 0.6)
      .style('animation', 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite');

    // Priority Indicator Spark
    node.filter(d => d.priority === 'CRITICAL' || d.priority === 'HIGH')
      .append('circle')
      .attr('cx', 11)
      .attr('cy', -11)
      .attr('r', 3)
      .attr('fill', '#ef4444')
      .style('filter', 'drop-shadow(0 0 5px #ef4444)');

    // Text Label for node
    node.append('text')
      .attr('dy', d => d.type === 'mission' ? 33 : 25)
      .attr('text-anchor', 'middle')
      .attr('fill', d => d.type === 'mission' ? 'var(--text-primary)' : 'var(--text-secondary)')
      .style('font-size', d => d.type === 'mission' ? '8.5px' : '7.5px')
      .style('font-family', 'var(--font-family-sans)')
      .style('font-weight', d => d.type === 'mission' ? '700' : '600')
      .style('letter-spacing', '0.02em')
      .text(d => {
        if (d.label.length > 17) {
          return d.label.substring(0, 15) + '...';
        }
        return d.label;
      });

    // Drag-and-drop mechanics
    node.call(d3.drag<SVGGElement, GraphNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.2).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      })
    );

    // Simulation Tick Updates
    simulation.on('tick', () => {
      // Force bounding box constraint to prevent nodes getting cut off or exiting section edges
      nodes.forEach((d) => {
        const r = 55; // increased boundary padding radius for 100% visibility of node + text label
        if (d.x !== undefined && d.y !== undefined) {
          d.x = Math.max(r, Math.min(width - r, d.x));
          d.y = Math.max(r, Math.min(height - r, d.y));
        }
      });

      // Update Links paths with curved organic arcs
      link.attr('d', (d: any) => {
        const sx = d.source.x;
        const sy = d.source.y;
        const tx = d.target.x;
        const ty = d.target.y;
        
        const dx = tx - sx;
        const dy = ty - sy;
        const dr = Math.sqrt(dx * dx + dy * dy);
        
        if (d.type === 'dependency') {
          // Rounded sweep curves for dependencies
          return `M${sx},${sy}A${dr},${dr} 0 0,1 ${tx},${ty}`;
        }
        // Soft sag curve for sequencing to feel elegant
        const mx = (sx + tx) / 2;
        const my = (sy + ty) / 2 + (d.type === 'sequence' ? 12 : 0);
        return `M${sx},${sy} Q${mx},${my} ${tx},${ty}`;
      });

      // Transform group coordinate positions
      node.attr('transform', d => `translate(${d.x || 0}, ${d.y || 0})`);
    });

    // Zoom buttons setup inside SVG wrapper
    svg.select('.zoom-in').on('click', () => {
      svg.transition().duration(250).call(zoom.scaleBy, 1.3);
    });
    svg.select('.zoom-out').on('click', () => {
      svg.transition().duration(250).call(zoom.scaleBy, 0.7);
    });
    svg.select('.zoom-reset').on('click', () => {
      svg.transition().duration(250).call(zoom.transform, d3.zoomIdentity.translate(0, 0).scale(1.0));
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, links, resetKey]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    // Find connected nodes
    const connectedIds = new Set<string>();
    const selectedId = selectedMission ? `mission-${selectedMission.id}` : null;
    if (selectedId) {
      links.forEach((l) => {
        const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
        if (sId === selectedId) {
          connectedIds.add(tId);
        } else if (tId === selectedId) {
          connectedIds.add(sId);
        }
      });
    }

    // Update nodes styling
    svg.selectAll('.node-group').each(function(d: any) {
      const g = d3.select(this);
      const isSelected = selectedId && d.id === selectedId;
      const isConnected = selectedId && connectedIds.has(d.id);
      
      const outerBg = g.select('.node-outer-bg');

      if (selectedId) {
        if (isSelected) {
          outerBg
            .attr('stroke', '#a855f7') // Vibrant Purple for Selected Node
            .attr('stroke-width', 4)
            .style('opacity', 1);
          g.style('opacity', 1);
        } else if (isConnected) {
          outerBg
            .attr('stroke', '#06b6d4') // Bright Cyan for Connected Nodes
            .attr('stroke-width', 3)
            .style('opacity', 1);
          g.style('opacity', 1);
        } else {
          // Keep default colors and normal opacity
          outerBg
            .attr('stroke', d.statusColor || 'var(--border-dim)')
            .attr('stroke-width', d.type === 'mission' ? 2 : 1.5)
            .style('opacity', 1);
          g.style('opacity', 1);
        }
      } else {
        // Reset to default
        outerBg
          .attr('stroke', d.statusColor || 'var(--border-dim)')
          .attr('stroke-width', d.type === 'mission' ? 2 : 1.5)
          .style('opacity', 1);
        g.style('opacity', 1);
      }
    });

    // Update links styling
    svg.selectAll('.link-path').each(function(d: any) {
      const path = d3.select(this);
      const sId = typeof d.source === 'object' ? d.source.id : d.source;
      const tId = typeof d.target === 'object' ? d.target.id : d.target;
      
      const isRelated = selectedId && (sId === selectedId || tId === selectedId);

      if (selectedId) {
        if (isRelated) {
          path
            .attr('stroke', '#a855f7') // Highlight path
            .attr('stroke-width', 2.5)
            .attr('stroke-opacity', 1);
        } else {
          // Keep default color, width, and normal opacity instead of fading out
          path
            .attr('stroke', (d: any) => {
              if (d.type === 'sequence') return 'rgba(255, 255, 255, 0.15)';
              if (d.type === 'dependency') return 'rgba(245, 158, 11, 0.35)';
              return 'rgba(255, 255, 255, 0.08)';
            })
            .attr('stroke-width', (d: any) => d.type === 'dependency' ? 1.8 : 1.2)
            .attr('stroke-opacity', 1);
        }
      } else {
        // Reset to default
        path
          .attr('stroke', (d: any) => {
            if (d.type === 'sequence') return 'rgba(255, 255, 255, 0.15)';
            if (d.type === 'dependency') return 'rgba(245, 158, 11, 0.35)';
            return 'rgba(255, 255, 255, 0.08)';
          })
          .attr('stroke-width', (d: any) => d.type === 'dependency' ? 1.8 : 1.2)
          .attr('stroke-opacity', 1);
      }
    });
  }, [selectedMission, links]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%', overflowY: 'auto' }}>
      
      {/* Sleek top row with graph header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: '4px'
      }}>
        <div style={{
          fontSize: '9px',
          fontWeight: 800,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-family-mono)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em'
        }}>
          🗺️ Merged Roadmap & Tasks DAG
        </div>
      </div>

      {/* CORE UNIFIED VERTICAL LAYOUT */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        flex: 1,
        minHeight: '345px'
      }}>
        {/* NETWORK SIMULATOR GRAPH AREA */}
        <div style={{
          position: 'relative',
          background: 'rgba(0, 0, 0, 0.15)',
          border: '1px solid var(--border-soft)',
          borderRadius: 'var(--radius-md)',
          height: '420px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          
          {/* Top Floating Heads-Up Display Controls */}
          <div style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            right: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            pointerEvents: 'none',
            zIndex: 10
          }}>
            <div style={{
              fontSize: '7px',
              fontFamily: 'var(--font-family-mono)',
              color: 'var(--text-muted)',
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid var(--border-soft)',
              padding: '4px 8px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span>MODE:</span>
              <strong style={{ color: 'var(--text-secondary)' }}>
                ROADMAP & ACTIVE TASKS
              </strong>
            </div>

            {/* Tactical Zoom & Forces Controls */}
            <div style={{ display: 'flex', gap: '3px', pointerEvents: 'auto' }}>
              <button
                className="zoom-in"
                title="Zoom In"
                style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid var(--border-soft)',
                  color: 'var(--text-primary)',
                  fontSize: '9px',
                  width: '20px',
                  height: '20px',
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
                className="zoom-out"
                title="Zoom Out"
                style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid var(--border-soft)',
                  color: 'var(--text-primary)',
                  fontSize: '9px',
                  width: '20px',
                  height: '20px',
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
                className="zoom-reset"
                title="Fit Screen"
                style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid var(--border-soft)',
                  color: 'var(--text-primary)',
                  fontSize: '8px',
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ⌂
              </button>
              <button
                onClick={() => {
                  setResetKey(prev => prev + 1);
                }}
                title="Reset simulation forces"
                style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid var(--border-soft)',
                  color: 'var(--text-primary)',
                  fontSize: '7.5px',
                  fontFamily: 'var(--font-family-mono)',
                  padding: '0 8px',
                  height: '20px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
              >
                🔄 Reset Forces
              </button>
            </div>
          </div>

          {/* D3 SVG rendering Canvas */}
          <svg
            ref={svgRef}
            viewBox="0 0 600 330"
            width="100%"
            height="100%"
            style={{
              background: 'radial-gradient(circle at center, rgba(30,41,59,0.06) 0%, rgba(15,23,42,0) 80%)',
              flex: 1
            }}
          />

          {/* Color Palette Indicator (Bottom Left, just above bottom panel) */}
          <div style={{
            position: 'absolute',
            bottom: '54px',
            left: '8px',
            display: 'flex',
            gap: '8px',
            background: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(4px)',
            padding: '5px 10px',
            borderRadius: '4px',
            border: '1px solid var(--border-soft)',
            fontSize: '7.5px',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-family-mono)',
            pointerEvents: 'none',
            zIndex: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#3b82f6' }} />
              <span>📝 DRAFT ({mDraft.length})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#f59e0b' }} />
              <span>⚙️ PLANNING ({mPlan.length})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#14b8a6' }} />
              <span>⚡ EXECUTION ({mExec.length})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981' }} />
              <span>✓ DONE ({mArchive.length})</span>
            </div>
          </div>

          {/* Floating dynamic bottom HUD status details bar */}
          <div style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            right: '8px',
            background: 'rgba(15, 23, 42, 0.92)',
            border: '1px solid var(--border-soft)',
            borderRadius: '4px',
            padding: '6px 10px',
            fontSize: '8px',
            fontFamily: 'var(--font-family-mono)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: 'var(--text-muted)',
            zIndex: 10,
            pointerEvents: 'none'
          }}>
            {hoveredNode ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: hoveredNode.statusColor,
                    display: 'inline-block'
                  }} />
                  <strong style={{ color: 'var(--text-primary)' }}>{hoveredNode.label}</strong>
                  <span style={{ opacity: 0.65 }}>({hoveredNode.type.toUpperCase()})</span>
                </div>
                <div>
                  {hoveredNode.type === 'mission' ? (
                    <span>Progress: <b style={{ color: hoveredNode.statusColor }}>{hoveredNode.progressPercentage}</b></span>
                  ) : (
                    <span>Status: <b style={{ color: hoveredNode.statusColor }}>{hoveredNode.taskStatus}</b></span>
                  )}
                </div>
              </>
            ) : (
              <span>💡 Hover any node to focus routes. Drag to organize. Click node to inspect details.</span>
            )}
          </div>
        </div>

        {/* DETAILED INSPECTOR PANEL - ONLY RENDERS IF NODE IS SELECTED */}
        {selectedMission && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
            <div style={{
              fontFamily: 'var(--font-family-mono)',
              fontSize: '0.65rem',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <span>Mission Node Inspector</span>
              <button
                onClick={() => setSelectedMission(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '8px',
                  textTransform: 'uppercase'
                }}
              >
                Clear selection ✖
              </button>
            </div>

            <div style={{
              background: 'rgba(15, 23, 42, 0.4)',
              border: `1px solid ${getStatusColor(selectedMission.detail.state.class)}`,
              borderRadius: 'var(--radius-md)',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              overflowY: 'auto',
              maxHeight: '350px'
            }}>
              {/* Casing Metadata Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontFamily: 'var(--font-family-mono)',
                  fontSize: '0.65rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--text-secondary)',
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}>{(selectedMission.detail.model || 'standard').toUpperCase()} ENGINE</span>
                <span style={{
                  fontFamily: 'var(--font-family-mono)',
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  color: selectedMission.detail.priority === 'CRITICAL' ? 'var(--status-critical)' : 'var(--text-secondary)'
                }}>⚡ {selectedMission.detail.priority} PRIORITY</span>
              </div>
              
              {/* Node Title */}
              <div>
                <h5 style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: '1.3', margin: '0 0 4px 0' }}>
                  {selectedMission.id.replace(/_/g, ' ')}
                </h5>
                <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '7.5px',
                    color: '#fff',
                    background: getStatusColor(selectedMission.detail.state.class),
                    padding: '1px 5px',
                    borderRadius: '3px',
                    fontWeight: 'bold',
                    fontFamily: 'var(--font-family-mono)'
                  }}>{selectedMission.detail.state.class}</span>
                  <span style={{ fontSize: '7.5px', color: 'var(--text-muted)' }}>Progress percentage: <b>{selectedMission.detail.metrics?.progress_percentage || '0%'}</b></span>
                </div>
              </div>
              
              {/* Objective Description */}
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.45', margin: 0, background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-soft)' }}>
                <b>OBJECTIVE:</b> {selectedMission.detail.objective}
              </p>

              {/* Goals list */}
              <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: '10px' }}>
                <span style={{
                  fontFamily: 'var(--font-family-mono)',
                  fontSize: '0.68rem',
                  color: 'var(--text-muted)',
                  display: 'block',
                  marginBottom: '6px'
                }}>GOALS REGISTERED ({Object.keys(selectedMission.detail.goals || {}).length})</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {Object.entries(selectedMission.detail.goals || {}).map(([gKey, goal]) => (
                    <div key={gKey} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '0.75rem' }}>
                      <span style={{ color: goal.status ? '#10b981' : 'var(--text-muted)', marginTop: '1px' }}>
                        {goal.status ? '●' : '○'}
                      </span>
                      <span style={{ color: goal.status ? 'var(--text-primary)' : 'var(--text-secondary)', lineHeight: '1.3' }}>
                        {goal.goal}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tasks list */}
              <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: '10px' }}>
                <span style={{
                  fontFamily: 'var(--font-family-mono)',
                  fontSize: '0.68rem',
                  color: 'var(--text-muted)',
                  display: 'block',
                  marginBottom: '6px'
                }}>TASKS EXECUTION TIMELINE ({Object.keys(selectedMission.detail.tasks || {}).length})</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {Object.entries(selectedMission.detail.tasks || {}).map(([tKey, task]) => (
                    <div key={tKey} style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      background: 'rgba(255,255,255,0.01)',
                      border: '1px solid var(--border-soft)',
                      borderRadius: '4px',
                      padding: '5px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-primary)', fontSize: '0.74rem', fontWeight: 600 }}>
                          {task.task}
                        </span>
                        <span style={{
                          fontSize: '7px',
                          color: '#fff',
                          background: getTaskStatusColor(task.progress),
                          padding: '1px 4px',
                          borderRadius: '2px',
                          fontFamily: 'var(--font-family-mono)'
                        }}>{(task.progress || 'not-started').toUpperCase()}</span>
                      </div>
                      {task.depends_on && task.depends_on.length > 0 && (
                        <div style={{ fontSize: '7px', color: 'var(--text-muted)', fontFamily: 'var(--font-family-mono)' }}>
                          Depends on: <b>{task.depends_on.join(', ')}</b>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
