import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { FileCode2, GitMerge, Tag } from 'lucide-react'
import { getBranchColor } from './mock-data'
import type { CommitGraphNode } from './types'

export const CommitNode = memo(function CommitNode({ data, selected }: NodeProps<CommitGraphNode>) {
  const { commit } = data
  const branchColor = getBranchColor(commit.branch)

  return (
    <article
      className={`commit-node ${selected ? 'is-selected' : ''}`}
      style={{ '--branch-color': branchColor } as React.CSSProperties}
    >
      <Handle className="commit-handle" type="target" position={Position.Top} isConnectable={false} />
      <div className="commit-node__surface">
        <div className="commit-node__header">
          <span className="commit-node__branch">{commit.branch}</span>
          <code>{commit.shortHash}</code>
        </div>
        <h3>{commit.message}</h3>
        <div className="commit-node__details" aria-hidden="true">
          <p>{commit.description}</p>
          <div className="commit-node__stats">
            <span className="commit-node__author">{commit.author.name}</span>
            <span><FileCode2 size={10} /> {commit.files.length} files</span>
            <span className="commit-node__additions">+{commit.additions}</span>
            <span className="commit-node__deletions">−{commit.deletions}</span>
          </div>
        </div>
        <div className="commit-node__footer">
          <span>{commit.author.initials} · {commit.relativeDate}</span>
          <span className="commit-node__badges">
            {commit.parents.length > 1 && <i className="node-badge node-badge--merge"><GitMerge size={9} /> merge</i>}
            {commit.tags.map((tag) => <i className="node-badge" key={tag}><Tag size={9} /> {tag}</i>)}
          </span>
        </div>
      </div>
      <Handle className="commit-handle" type="source" position={Position.Bottom} isConnectable={false} />
    </article>
  )
})
