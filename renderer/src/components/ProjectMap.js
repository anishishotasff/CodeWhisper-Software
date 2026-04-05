import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';

// Color per language group
const GROUP_COLOR = {
  js:     '#f7df1e',
  ts:     '#3178c6',
  py:     '#3572a5',
  go:     '#00add8',
  rs:     '#dea584',
  style:  '#e44d9b',
  java:   '#b07219',
  ruby:   '#cc342d',
  php:    '#4f5d95',
  cs:     '#178600',
  cpp:    '#f34b7d',
  swift:  '#fa7343',
  vue:    '#41b883',
  svelte: '#ff3e00',
  html:   '#e34c26',
  shell:  '#89e051',
  other:  '#858585',
};

const GROUP_LABEL = {
  js:     'JavaScript',
  ts:     'TypeScript',
  py:     'Python',
  go:     'Go',
  rs:     'Rust',
  style:  'CSS/SCSS',
  java:   'Java/Kotlin',
  ruby:   'Ruby',
  php:    'PHP',
  cs:     'C#',
  cpp:    'C/C++',
  swift:  'Swift',
  vue:    'Vue',
  svelte: 'Svelte',
  html:   'HTML',
  shell:  'Shell',
  other:  'Other',
};

// Safe color helper — never returns null
function safeColor(group) {
  return GROUP_COLOR[group] || GROUP_COLOR.other;
}

export default function ProjectMap({ projectPath, onClose, onSelectFile }) {
  const svgRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [tooltip, setTooltip] = useState(null); // { x, y, node }
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState('all'); // group filter
  const simulationRef = useRef(null);

  // ── Load graph data ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!projectPath) return;
    setLoading(true);
    setError(null);
    window.electronAPI.buildGraph(projectPath)
      .then(data => {
        setGraphData(data);
        setStats({
          files: data.nodes.length,
          links: data.links.length,
          groups: [...new Set(data.nodes.map(n => n.group))],
        });
        setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [projectPath]);

  // ── Build D3 graph ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!graphData || loading) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const container = svgRef.current.parentElement;
    const W = container.clientWidth || 900;
    const H = container.clientHeight || 600;

    // Filter nodes by group
    const visibleNodes = filter === 'all'
      ? graphData.nodes
      : graphData.nodes.filter(n => n.group === filter);
    const visibleIds = new Set(visibleNodes.map(n => n.id));
    const visibleLinks = graphData.links.filter(
      l => visibleIds.has(l.source.id || l.source) && visibleIds.has(l.target.id || l.target)
    );

    // Clone to avoid mutating original
    const nodes = visibleNodes.map(d => ({ ...d }));
    const links = visibleLinks.map(d => ({ ...d }));

    // ── SVG setup ──
    svg.attr('width', W).attr('height', H);

    // Zoom + pan
    const g = svg.append('g');
    svg.call(
      d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => g.attr('transform', event.transform))
    );

    // Arrow marker for directed edges
    svg.append('defs').append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -4 8 8')
      .attr('refX', 18)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L8,0L0,4')
      .attr('fill', '#555');

    // ── Force simulation ──
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(d => {
        // Closer for same-group files
        return d.source.group === d.target.group ? 80 : 130;
      }).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-220))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide().radius(22))
      .force('x', d3.forceX(W / 2).strength(0.04))
      .force('y', d3.forceY(H / 2).strength(0.04));

    simulationRef.current = simulation;

    // ── Edges ──
    const link = g.append('g').attr('class', 'links')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#3e3e42')
      .attr('stroke-width', 1.2)
      .attr('stroke-opacity', 0.6)
      .attr('marker-end', 'url(#arrow)');

    // ── Node groups ──
    const node = g.append('g').attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(
        d3.drag()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null; d.fy = null;
          })
      );

    // Node circle
    node.append('circle')
      .attr('r', d => {
        const degree = links.filter(l =>
          (l.source.id || l.source) === d.id || (l.target.id || l.target) === d.id
        ).length;
        return Math.max(8, Math.min(20, 8 + degree * 2));
      })
      .attr('fill', d => safeColor(d.group))
      .attr('fill-opacity', 0.85)
      .attr('stroke', d => {
        const c = d3.color(safeColor(d.group));
        return c ? c.brighter(0.6).toString() : '#fff';
      })
      .attr('stroke-width', 1.5);

    // Node label
    node.append('text')
      .text(d => d.label.length > 16 ? d.label.slice(0, 14) + '…' : d.label)
      .attr('x', 0)
      .attr('y', d => {
        const degree = links.filter(l =>
          (l.source.id || l.source) === d.id || (l.target.id || l.target) === d.id
        ).length;
        return Math.max(8, Math.min(20, 8 + degree * 2)) + 12;
      })
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#c8c8c8')
      .attr('pointer-events', 'none');

    // ── Hover tooltip ──
    node
      .on('mouseenter', (event, d) => {
        // Highlight connected nodes
        const connected = new Set([d.id]);
        links.forEach(l => {
          const s = l.source.id || l.source;
          const t = l.target.id || l.target;
          if (s === d.id) connected.add(t);
          if (t === d.id) connected.add(s);
        });
        node.select('circle')
          .attr('fill-opacity', n => connected.has(n.id) ? 1 : 0.15)
          .attr('stroke-width', n => n.id === d.id ? 3 : 1.5);
        link
          .attr('stroke-opacity', l => {
            const s = l.source.id || l.source;
            const t = l.target.id || l.target;
            return (s === d.id || t === d.id) ? 1 : 0.05;
          })
          .attr('stroke', l => {
            const s = l.source.id || l.source;
            const t = l.target.id || l.target;
            return (s === d.id || t === d.id) ? safeColor(d.group) : '#3e3e42';
          })
          .attr('stroke-width', l => {
            const s = l.source.id || l.source;
            const t = l.target.id || l.target;
            return (s === d.id || t === d.id) ? 2 : 1.2;
          });

        const rect = svgRef.current.getBoundingClientRect();
        setTooltip({
          x: event.clientX - rect.left + 12,
          y: event.clientY - rect.top - 10,
          node: d,
          connections: connected.size - 1,
        });
      })
      .on('mousemove', (event) => {
        const rect = svgRef.current.getBoundingClientRect();
        setTooltip(prev => prev ? { ...prev, x: event.clientX - rect.left + 12, y: event.clientY - rect.top - 10 } : null);
      })
      .on('mouseleave', () => {
        node.select('circle').attr('fill-opacity', 0.85).attr('stroke-width', 1.5);
        link.attr('stroke-opacity', 0.6).attr('stroke', '#3e3e42').attr('stroke-width', 1.2);
        setTooltip(null);
      })
      .on('click', (event, d) => {
        event.stopPropagation();
        if (onSelectFile) onSelectFile({ path: d.id, name: d.label, type: 'file', ext: d.ext });
      })
      .on('dblclick', (event, d) => {
        // Pin node in place on double-click
        event.stopPropagation();
        if (d.fx !== null) { d.fx = null; d.fy = null; }
        else { d.fx = d.x; d.fy = d.y; }
      });

    // ── Tick ──
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    return () => simulation.stop();
  }, [graphData, loading, filter, onSelectFile]);

  const handleRestart = useCallback(() => {
    if (simulationRef.current) {
      simulationRef.current.alpha(0.8).restart();
    }
  }, []);

  const groups = graphData ? [...new Set(graphData.nodes.map(n => n.group))] : [];

  return (
    <div className="map-overlay">
      <div className="map-modal">
        {/* Header */}
        <div className="map-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="map-title">🗺 Project Map</span>
            {stats && (
              <span className="map-stats">
                {stats.files} files · {stats.links} connections
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Group filter pills */}
            <div className="map-filters">
              <button
                className={`map-filter-btn ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >All</button>
              {groups.map(g => (
                <button
                  key={g}
                  className={`map-filter-btn ${filter === g ? 'active' : ''}`}
                  style={{ '--group-color': safeColor(g) }}
                  onClick={() => setFilter(f => f === g ? 'all' : g)}
                >
                  <span className="map-filter-dot" style={{ background: safeColor(g) }} />
                  {GROUP_LABEL[g] || g}
                </button>
              ))}
            </div>

            <button className="btn btn-secondary" style={{ fontSize: 11, padding: '3px 8px' }} onClick={handleRestart} title="Re-run simulation">
              ↺ Shake
            </button>
            <button className="btn btn-icon" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Legend */}
        <div className="map-legend">
          <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>
            Scroll to zoom · Drag to pan · Drag nodes · Click node to open file · Double-click to pin
          </span>
          <div style={{ display: 'flex', gap: 12, marginLeft: 'auto' }}>
            {groups.map(g => (
              <span key={g} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: safeColor(g), display: 'inline-block' }} />
                {GROUP_LABEL[g] || g}
              </span>
            ))}
          </div>
        </div>

        {/* Graph area */}
        <div className="map-canvas" style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
          {loading && (
            <div className="map-loading">
              <span className="spinner" style={{ width: 24, height: 24, borderWidth: 3, borderTopColor: 'var(--accent)', borderColor: 'rgba(0,122,204,0.2)' }} />
              <span>Building dependency graph...</span>
            </div>
          )}

          {error && (
            <div className="map-loading" style={{ color: 'var(--error)' }}>
              ⚠️ {error}
            </div>
          )}

          {!loading && !error && graphData?.nodes.length === 0 && (
            <div className="map-loading" style={{ color: 'var(--text-muted)' }}>
              No code files found in this project.
            </div>
          )}

          <svg ref={svgRef} style={{ width: '100%', height: '100%', background: 'var(--bg-primary)' }} />

          {/* Tooltip */}
          {tooltip && (
            <div
              className="map-tooltip"
              style={{ left: tooltip.x, top: tooltip.y }}
            >
              <div className="map-tooltip-title">
                <span style={{ color: safeColor(tooltip.node.group) }}>●</span>
                {tooltip.node.label}
              </div>
              <div className="map-tooltip-row">
                <span>Path:</span> <span>{tooltip.node.rel}</span>
              </div>
              <div className="map-tooltip-row">
                <span>Type:</span> <span>{GROUP_LABEL[tooltip.node.group] || tooltip.node.group}</span>
              </div>
              <div className="map-tooltip-row">
                <span>Connections:</span> <span>{tooltip.connections}</span>
              </div>
              {tooltip.node.size > 0 && (
                <div className="map-tooltip-row">
                  <span>Size:</span> <span>{(tooltip.node.size / 1024).toFixed(1)} KB</span>
                </div>
              )}
              {tooltip.node.functions?.length > 0 && (
                <div className="map-tooltip-fns">
                  <span>Exports:</span>
                  <div>{tooltip.node.functions.join(', ')}</div>
                </div>
              )}
              <div style={{ marginTop: 6, fontSize: 9, color: 'var(--text-dim)' }}>Click to open · Dbl-click to pin</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
