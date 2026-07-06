import ELK from 'elkjs/lib/elk-api.js'
import elkWorkerUrl from 'elkjs/lib/elk-worker.min.js?url'
import { MarkerType, Position, type Edge } from '@xyflow/react'
import { getBranchColor } from './mock-data'
import type { CommitGraphNode, GitCommit, RepositoryLayout } from './types'

type LayoutPosition = {
  id: string
  x: number
  y: number
}

function calculateLayout(commits: GitCommit[], signal?: AbortSignal): Promise<LayoutPosition[]> {
  return new Promise((resolve, reject) => {
    const elk = new ELK({ workerFactory: () => new Worker(elkWorkerUrl) })
    const commitHashes = new Set(commits.map((commit) => commit.hash))
    const layoutEdges = commits.flatMap((commit) =>
      commit.parents
        .filter((parentHash) => commitHashes.has(parentHash))
        .map((parentHash) => ({
          id: `${commit.hash}-${parentHash}`,
          sources: [commit.hash],
          targets: [parentHash],
        })),
    )

    const cleanup = () => {
      signal?.removeEventListener('abort', handleAbort)
      elk.terminateWorker()
    }
    const handleAbort = () => {
      cleanup()
      reject(new DOMException('Layout calculation cancelled', 'AbortError'))
    }

    if (signal?.aborted) {
      handleAbort()
      return
    }

    signal?.addEventListener('abort', handleAbort, { once: true })
    void elk.layout({
      id: 'repository-history',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN',
        'elk.edgeRouting': 'SPLINES',
        'elk.spacing.nodeNode': '153',
        'elk.layered.spacing.nodeNodeBetweenLayers': '139',
        'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
        'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
        'elk.padding': '[top=58,left=58,bottom=58,right=58]',
      },
      children: commits.map((commit) => ({
        id: commit.hash,
        width: 306,
        height: 167,
      })),
      edges: layoutEdges,
    }).then((layout) => {
      cleanup()
      resolve((layout.children ?? []).map((child) => ({
        id: child.id,
        x: (child.x ?? 0) + 306 / 2,
        y: (child.y ?? 0) + 167 / 2,
      })))
    }).catch((error: unknown) => {
      cleanup()
      reject(error)
    })
  })
}

export async function layoutRepository(
  commits: GitCommit[],
  signal?: AbortSignal,
): Promise<RepositoryLayout> {
  const commitByHash = new Map(commits.map((commit) => [commit.hash, commit]))
  const graphEdges = commits.flatMap((commit) =>
    commit.parents
      .filter((parentHash) => commitByHash.has(parentHash))
      .map((parentHash, parentIndex) => ({
        id: `${commit.hash}-${parentHash}`,
        source: commit.hash,
        target: parentHash,
        parentIndex,
      })),
  )
  const positions = await calculateLayout(commits, signal)

  const nodes: CommitGraphNode[] = positions.map((position) => ({
    id: position.id,
    type: 'commit',
    position: { x: position.x, y: position.y },
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
    data: { commit: commitByHash.get(position.id)! },
  }))

  const edges: Edge[] = graphEdges.map(({ id, source, target, parentIndex }) => {
    const sourceCommit = commitByHash.get(source)!
    const color = parentIndex === 0 ? getBranchColor(sourceCommit.branch) : 'var(--chart-5)'

    return {
      id,
      source,
      target,
      type: 'smoothstep',
      className: parentIndex === 0 ? 'edge--primary' : 'edge--merge',
      interactionWidth: 18,
      markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color },
      style: {
        stroke: color,
        opacity: parentIndex === 0 ? 0.82 : 0.72,
      },
    }
  })

  return { nodes, edges }
}
