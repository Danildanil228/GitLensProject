import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  type Edge,
  type EdgeMouseHandler,
  type Node,
  type NodeMouseHandler,
  type OnMove,
  type ReactFlowInstance,
  useEdgesState,
  useNodesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Braces,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  FileCode2,
  GitBranch,
  GitMerge,
  PanelLeftClose,
  PanelRightClose,
  Search,
} from 'lucide-react'
import './App.css'
import { Button } from '@/components/ui/button'
import { CommitNode } from '@/features/repository-map/CommitNode'
import { RepositoryImportDialog } from '@/features/repository-import/RepositoryImportDialog'
import { layoutRepository } from '@/features/repository-map/layout'
import {
  getBranchColor,
  mockBranches,
  mockCommits,
  mockRepository,
} from '@/features/repository-map/mock-data'
import type {
  CommitGraphNode,
  GitBranchInfo,
  GitCommit,
  ImportedRepository,
  RepositoryInfo,
} from '@/features/repository-map/types'

const nodeTypes = { commit: CommitNode }
type ZoomMode = 'overview' | 'standard' | 'detail'

function createMapScaleStyle(zoom: number, contentMode: ZoomMode) {
  const baseZoom = 0.72
  const visualScale = zoom <= baseZoom
    ? 1
    : Math.min(1.6, 1 + (zoom - baseZoom) * 0.48)
  const contentScale = 1 + (visualScale - 1) * 0.45
  const detailHeightScale = contentMode === 'detail' ? 1.25 : 1
  const screenPx = (screenPixels: number, scale = 1) =>
    `${(screenPixels * scale / zoom).toFixed(3)}px`

  return {
    '--map-zoom': zoom,
    '--map-visual-scale': visualScale,
    '--node-width': screenPx(220, visualScale),
    '--node-height': screenPx(120 * detailHeightScale, visualScale),
    '--node-border-width': screenPx(1, visualScale),
    '--node-accent-width': screenPx(3, visualScale),
    '--node-handle-size': screenPx(7, visualScale),
    '--node-handle-border': screenPx(2, visualScale),
    '--node-focus-ring': screenPx(3, visualScale),
    '--node-title-size': screenPx(15, contentScale),
    '--node-branch-size': screenPx(11, contentScale),
    '--node-meta-size': screenPx(10, contentScale),
    '--node-detail-size': screenPx(10, contentScale),
    '--node-gap': screenPx(8, contentScale),
    '--node-icon-size': screenPx(12, contentScale),
    '--node-badge-padding-y': screenPx(3, contentScale),
    '--node-badge-padding-x': screenPx(7, contentScale),
    '--node-space-3': screenPx(4, contentScale),
    '--node-space-5': screenPx(7, contentScale),
    '--node-space-6': screenPx(8, contentScale),
    '--node-space-8': screenPx(11, contentScale),
    '--node-detail-height': screenPx(78, contentScale),
    '--node-footer-height': screenPx(22, contentScale),
    '--node-padding-y': screenPx(14, contentScale),
    '--node-padding-x': screenPx(17, contentScale),
    '--edge-primary-width': `${(2.4 * visualScale).toFixed(2)}px`,
    '--edge-merge-width': `${(2 * visualScale).toFixed(2)}px`,
  } as React.CSSProperties
}

function applyMapScale(element: HTMLDivElement | null, zoom: number, contentMode: ZoomMode) {
  if (!element) return

  const scale = createMapScaleStyle(zoom, contentMode) as Record<string, string | number>
  for (const [property, value] of Object.entries(scale)) {
    element.style.setProperty(property, String(value))
  }
}

function getZoomMode(currentMode: ZoomMode, zoom: number): ZoomMode {
  if (currentMode === 'overview') {
    if (zoom >= 1.12) return 'detail'
    if (zoom >= 0.62) return 'standard'
    return currentMode
  }

  if (currentMode === 'detail') {
    if (zoom <= 0.54) return 'overview'
    if (zoom <= 1.02) return 'standard'
    return currentMode
  }

  if (zoom <= 0.54) return 'overview'
  if (zoom >= 1.12) return 'detail'
  return currentMode
}

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState<CommitGraphNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [repository, setRepository] = useState<RepositoryInfo>(mockRepository)
  const [commits, setCommits] = useState<GitCommit[]>(mockCommits)
  const [branches, setBranches] = useState<GitBranchInfo[]>(mockBranches)
  const [selectedHash, setSelectedHash] = useState(mockCommits[0].hash)
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [isLayoutReady, setIsLayoutReady] = useState(false)
  const [contentMode, setContentMode] = useState<ZoomMode>('standard')
  const [isImportOpen, setIsImportOpen] = useState(true)
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance<CommitGraphNode, Edge> | null>(null)
  const edgeNavigation = useRef<{
    edgeId: string
    endpoint: 'source' | 'target'
  } | null>(null)
  const focusedRepository = useRef('')
  const mapViewportRef = useRef<HTMLDivElement | null>(null)
  const mapZoomRef = useRef(0.72)
  const appliedZoomRef = useRef(0.72)
  const contentModeRef = useRef<ZoomMode>('standard')
  const moveFrameRef = useRef<number | null>(null)
  const pendingZoomRef = useRef(0.72)

  const setMapViewportRef = useCallback((element: HTMLDivElement | null) => {
    mapViewportRef.current = element
    applyMapScale(element, mapZoomRef.current, contentModeRef.current)
  }, [])

  const selectedCommit = useMemo(
    () => commits.find((commit) => commit.hash === selectedHash) ?? commits[0],
    [commits, selectedHash],
  )

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    void layoutRepository(commits, controller.signal)
      .then((layout) => {
        if (cancelled) return
        setNodes(layout.nodes)
        setEdges(layout.edges)
        setIsLayoutReady(true)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.error('Could not calculate repository layout', error)
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [commits, setEdges, setNodes])

  useEffect(() => () => {
    if (moveFrameRef.current !== null) window.cancelAnimationFrame(moveFrameRef.current)
  }, [])

  useEffect(() => {
    if (!isLayoutReady || !flowInstance || nodes.length === 0) return

    const repositoryKey = repository.importedAt ?? repository.fullName
    if (focusedRepository.current === repositoryKey) return
    focusedRepository.current = repositoryKey
    const newestNode = nodes.find((node) => node.id === commits[0]?.hash) ?? nodes[0]

    const focusTimer = window.setTimeout(() => {
      void flowInstance.setCenter(newestNode.position.x, newestNode.position.y + 220, {
        zoom: 0.72,
        duration: 650,
      })
    }, 80)

    return () => window.clearTimeout(focusTimer)
  }, [commits, flowInstance, isLayoutReady, nodes, repository.fullName, repository.importedAt])

  const handleRepositoryImport = useCallback((imported: ImportedRepository) => {
    setRepository(imported.repository)
    setCommits(imported.commits)
    setBranches(imported.branches)
    setSelectedHash(imported.commits[0].hash)
    setNodes([])
    setEdges([])
    setIsLayoutReady(false)
    mapZoomRef.current = 0.72
    appliedZoomRef.current = 0.72
    pendingZoomRef.current = 0.72
    contentModeRef.current = 'standard'
    setContentMode('standard')
    applyMapScale(mapViewportRef.current, 0.72, 'standard')
    setIsImportOpen(false)
    edgeNavigation.current = null
  }, [setEdges, setNodes])

  const focusCommit = useCallback((commitHash: string) => {
    const node = nodes.find((candidate) => candidate.id === commitHash)
    if (!node) return

    setNodes((currentNodes) => currentNodes.map((currentNode) => {
      const shouldBeSelected = currentNode.id === commitHash
      if (Boolean(currentNode.selected) === shouldBeSelected) return currentNode
      return { ...currentNode, selected: shouldBeSelected }
    }))
    setSelectedHash(commitHash)
    setRightOpen(true)
    contentModeRef.current = 'detail'
    setContentMode('detail')
    applyMapScale(mapViewportRef.current, mapZoomRef.current, 'detail')
    void flowInstance?.setCenter(node.position.x, node.position.y, {
      zoom: Math.max(mapZoomRef.current, 1.24),
      duration: 650,
    })
  }, [flowInstance, nodes, setNodes])

  const handleMove: OnMove = useCallback((_, viewport) => {
    mapZoomRef.current = viewport.zoom
    pendingZoomRef.current = viewport.zoom
    if (moveFrameRef.current !== null) return

    moveFrameRef.current = window.requestAnimationFrame(() => {
      moveFrameRef.current = null
      const zoom = pendingZoomRef.current
      const nextMode = getZoomMode(contentModeRef.current, zoom)
      const modeChanged = nextMode !== contentModeRef.current

      if (modeChanged) {
        contentModeRef.current = nextMode
        setContentMode(nextMode)
      }

      if (modeChanged || Math.abs(appliedZoomRef.current - zoom) >= 0.004) {
        appliedZoomRef.current = zoom
        applyMapScale(mapViewportRef.current, zoom, nextMode)
      }
    })
  }, [])

  const onNodeClick: NodeMouseHandler<Node> = useCallback((_, node) => {
    edgeNavigation.current = null
    focusCommit(node.id)
  }, [focusCommit])

  const onEdgeClick: EdgeMouseHandler<Edge> = useCallback((_, edge) => {
    const previous = edgeNavigation.current
    const endpoint = previous?.edgeId === edge.id && previous.endpoint === 'source'
      ? 'target'
      : 'source'

    edgeNavigation.current = { edgeId: edge.id, endpoint }
    focusCommit(edge[endpoint])
  }, [focusCommit])

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">
          <GitBranch size={20} strokeWidth={2.4} />
        </div>
        <div className="brand-copy">
          <strong>Git Atlas</strong>
          <span>Repository intelligence</span>
        </div>
        <div className="topbar-divider" />
        <Button className="repository-switcher" variant="outline" size="sm" type="button" onClick={() => setIsImportOpen(true)}>
          <Braces size={15} />
          <span>{repository.fullName}</span>
          <ChevronRight size={14} />
        </Button>

        <div className="topbar-spacer" />

        <label className="global-search">
          <Search size={15} />
          <input aria-label="Search repository" placeholder="Search commits, branches…" />
          <kbd>Ctrl K</kbd>
        </label>
        <Button className="primary-action" size="sm" type="button" onClick={() => setIsImportOpen(true)}>
          + Open repository
        </Button>
      </header>

      <section className="workspace">
        {leftOpen ? (
          <BranchesPanel
            branches={branches}
            onCollapse={() => setLeftOpen(false)}
            onSelect={focusCommit}
            selectedHash={selectedHash}
          />
        ) : (
          <Button
            className="collapsed-panel-button collapsed-panel-button--left"
            variant="outline"
            size="icon-sm"
            type="button"
            onClick={() => setLeftOpen(true)}
            aria-label="Open branches panel"
          >
            <PanelLeftClose size={17} />
          </Button>
        )}

        <section className="map-column">
          <RepositorySummary repository={repository} branches={branches} commits={commits} />
          <div
            ref={setMapViewportRef}
            className={`map-viewport map-viewport--${contentMode}`}
          >
            {!isLayoutReady && <div className="map-loading">Calculating vertical history…</div>}
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              nodeOrigin={[0.5, 0.5]}
              onInit={setFlowInstance}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              onEdgeClick={onEdgeClick}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable
              panOnDrag
              zoomOnScroll
              zoomOnPinch
              zoomOnDoubleClick={false}
              onMove={handleMove}
              onlyRenderVisibleElements
              minZoom={0.5}
              maxZoom={2.5}
              defaultViewport={{ x: 90, y: 28, zoom: 0.72 }}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="var(--border)" />
              <MiniMap
                pannable
                zoomable
                nodeColor={(node) => getBranchColor((node as CommitGraphNode).data.commit.branch)}
                nodeStrokeColor="var(--border)"
                maskColor="color-mix(in oklch, var(--background) 78%, transparent)"
              />
              <Controls showInteractive={false} position="bottom-right" />
              <Panel position="top-left" className="map-instructions">
                <span className="live-dot" />
                Vertical history
                <span>Drag to move · Wheel to zoom</span>
              </Panel>
              <Panel position="top-right" className="map-legend">
                <span><i className="legend-line legend-line--main" />main</span>
                <span><i className="legend-line legend-line--feature" />feature</span>
                <span><i className="legend-line legend-line--fix" />fix</span>
              </Panel>
            </ReactFlow>
          </div>
        </section>

        {rightOpen ? (
          selectedCommit && <CommitDetails commit={selectedCommit} onCollapse={() => setRightOpen(false)} />
        ) : (
          <Button
            className="collapsed-panel-button collapsed-panel-button--right"
            variant="outline"
            size="icon-sm"
            type="button"
            onClick={() => setRightOpen(true)}
            aria-label="Open commit details"
          >
            <PanelRightClose size={17} />
          </Button>
        )}
      </section>

      <footer className="statusbar">
        <span><CircleDot size={12} /> Analysis complete</span>
        <span>{commits.length} commits · {branches.length} branches · {new Set(commits.flatMap((commit) => commit.tags)).size} tags</span>
        <span>Layout: vertical · ELK layered</span>
      </footer>
      <RepositoryImportDialog
        open={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImport={handleRepositoryImport}
      />
    </main>
  )
}

function RepositorySummary({
  repository,
  branches,
  commits,
}: {
  repository: RepositoryInfo
  branches: GitBranchInfo[]
  commits: GitCommit[]
}) {
  const tagCount = new Set(commits.flatMap((commit) => commit.tags)).size
  const authorCount = new Set(commits.map((commit) => commit.author.name)).size

  return (
    <div className="repository-summary">
      <div>
        <div className="eyebrow">Repository map</div>
        <h1>{repository.name}</h1>
        <p>{repository.description}</p>
      </div>
      <div className="repository-metrics">
        <Metric value={String(branches.length)} label="branches" tone="cyan" />
        <Metric value={String(commits.length)} label="commits" />
        <Metric value={String(tagCount)} label="tags" tone="violet" />
        <Metric value={String(authorCount)} label="authors" tone="orange" />
      </div>
    </div>
  )
}

function Metric({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <div className={`metric ${tone ? `metric--${tone}` : ''}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

function BranchesPanel({
  branches,
  onCollapse,
  onSelect,
  selectedHash,
}: {
  branches: GitBranchInfo[]
  onCollapse: () => void
  onSelect: (hash: string) => void
  selectedHash: string
}) {
  return (
    <aside className="side-panel branches-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Navigation</span>
          <h2>Branches</h2>
        </div>
        <Button className="icon-button" variant="ghost" size="icon-xs" type="button" onClick={onCollapse} aria-label="Collapse branches">
          <ChevronLeft size={16} />
        </Button>
      </div>
      <label className="panel-search">
        <Search size={14} />
        <input aria-label="Find branch" placeholder="Find a branch" />
      </label>
      <div className="filter-tabs" aria-label="Branch filters">
        <button className="is-active" type="button">All</button>
        <button type="button">Active</button>
        <button type="button">Stale</button>
      </div>
      <div className="branch-list">
        {branches.map((branch) => {
          const isSelected = branch.headHash === selectedHash
          return (
            <button
              className={`branch-row ${isSelected ? 'is-selected' : ''}`}
              key={branch.name}
              type="button"
              onClick={() => onSelect(branch.headHash)}
              disabled={branch.commits === 0}
              title={branch.commits === 0 ? 'This branch is outside the current import limit' : undefined}
            >
              <span className="branch-color" style={{ background: getBranchColor(branch.name) }} />
              <span className="branch-copy">
                <strong>{branch.name}</strong>
                <small>{branch.commits} loaded · {branch.updated}</small>
              </span>
              {branch.isDefault && <span className="branch-badge">default</span>}
              {branch.isHead && <span className="branch-badge branch-badge--head">HEAD</span>}
            </button>
          )
        })}
      </div>
      <div className="branch-health">
        <div><GitMerge size={14} /> Branch health</div>
        <strong>{branches.length} branches discovered</strong>
        <span>{Math.min(branches.length, 5)} histories loaded into the map</span>
      </div>
    </aside>
  )
}

function CommitDetails({ commit, onCollapse }: { commit: GitCommit; onCollapse: () => void }) {
  return (
    <aside className="side-panel details-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Selected node</span>
          <h2>Commit details</h2>
        </div>
        <Button className="icon-button" variant="ghost" size="icon-xs" type="button" onClick={onCollapse} aria-label="Collapse details">
          <ChevronRight size={16} />
        </Button>
      </div>

      <div className="commit-hero">
        <div className="commit-hero__meta">
          <span className="branch-chip" style={{ '--branch-color': getBranchColor(commit.branch) } as React.CSSProperties}>
            {commit.branch}
          </span>
          <code>{commit.shortHash}</code>
        </div>
        <h3>{commit.message}</h3>
        <p>{commit.description}</p>
      </div>

      <div className="author-row">
        <span className="avatar">{commit.author.initials}</span>
        <div>
          <strong>{commit.author.name}</strong>
          <span>{commit.relativeDate}</span>
        </div>
      </div>

      <dl className="metadata-list">
        <div><dt>Full SHA</dt><dd><code>{commit.hash}</code></dd></div>
        <div><dt>Parents</dt><dd>{commit.parents.length || 'Initial commit'}</dd></div>
        <div><dt>Committed</dt><dd>{commit.date}</dd></div>
        <div><dt>Signature</dt><dd className="warning-text">Unverified</dd></div>
      </dl>

      <section className="changes-section">
        <div className="section-title">
          <h3>Changes</h3>
          <span>{commit.files.length} files</span>
        </div>
        {commit.files.length > 0 ? (
          <>
            <div className="change-stats">
              <span className="additions">+{commit.additions}</span>
              <span className="deletions">−{commit.deletions}</span>
            </div>
            <div className="file-list">
              {commit.files.map((file) => (
                <div className="file-row" key={file.path}>
                  <FileCode2 size={14} />
                  <span>{file.path}</span>
                  <small>{file.status}</small>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="changes-unavailable">File-level changes are not loaded in the repository overview.</p>
        )}
      </section>
      <Button className="diff-button" size="sm" type="button">Open full diff</Button>
    </aside>
  )
}

export default App
