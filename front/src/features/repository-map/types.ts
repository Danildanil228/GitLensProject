import type { Node } from '@xyflow/react'

export type ChangedFile = {
  path: string
  status: 'added' | 'modified' | 'deleted'
}

export type GitCommit = {
  hash: string
  shortHash: string
  message: string
  description: string
  branch: string
  parents: string[]
  tags: string[]
  author: {
    name: string
    initials: string
  }
  date: string
  timestamp?: string
  relativeDate: string
  additions: number
  deletions: number
  files: ChangedFile[]
}

export type CommitNodeData = Record<string, unknown> & {
  commit: GitCommit
}

export type CommitGraphNode = Node<CommitNodeData, 'commit'>

export type GitBranchInfo = {
  name: string
  headHash: string
  commits: number
  updated: string
  isHead?: boolean
  isDefault?: boolean
  protected?: boolean
}

export type RepositoryInfo = {
  owner: string
  name: string
  fullName: string
  description: string
  defaultBranch: string
  htmlUrl: string
  stars: number
  forks: number
  openIssues: number
  importedAt?: string
}

export type ImportedRepository = {
  repository: RepositoryInfo
  branches: GitBranchInfo[]
  commits: GitCommit[]
}

export type RepositoryLayout = {
  nodes: CommitGraphNode[]
  edges: import('@xyflow/react').Edge[]
}
