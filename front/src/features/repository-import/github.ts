import type {
  GitBranchInfo,
  GitCommit,
  ImportedRepository,
} from '@/features/repository-map/types'

const GITHUB_API_VERSION = '2026-03-10'
const MAX_BRANCHES = 5
const COMMITS_PER_BRANCH = 40
const MAX_COMMITS = 80

type GitHubRepository = {
  name: string
  full_name: string
  description: string | null
  default_branch: string
  html_url: string
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  owner: { login: string }
}

type GitHubBranch = {
  name: string
  protected: boolean
  commit: { sha: string }
}

type GitHubCommit = {
  sha: string
  parents: Array<{ sha: string }>
  author: { login: string } | null
  commit: {
    message: string
    author: { name: string; date: string } | null
    committer: { name: string; date: string } | null
  }
}

export type RepositoryCoordinates = {
  owner: string
  repo: string
}

export class GitHubImportError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'GitHubImportError'
    this.status = status
  }
}

export function parseGitHubRepository(value: string): RepositoryCoordinates | null {
  const input = value.trim().replace(/\/+$/, '')
  if (!input) return null

  const sshMatch = input.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i)
  if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] }

  const shortMatch = input.match(/^([^/:\s]+)\/([^/\s]+?)(?:\.git)?$/)
  if (shortMatch) return { owner: shortMatch[1], repo: shortMatch[2] }

  const normalized = /^https?:\/\//i.test(input) ? input : `https://${input}`

  try {
    const url = new URL(normalized)
    if (url.hostname.toLowerCase() !== 'github.com') return null

    const [owner, rawRepository, ...rest] = url.pathname.split('/').filter(Boolean)
    if (!owner || !rawRepository || rest.length > 0) return null

    const repo = rawRepository.replace(/\.git$/i, '')
    return owner && repo ? { owner, repo } : null
  } catch {
    return null
  }
}

async function githubRequest<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    signal,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
    },
  })

  if (!response.ok) {
    if (response.status === 404) {
      throw new GitHubImportError('Repository not found. Check the link or make sure the repository is public.', 404)
    }

    if (response.status === 403 || response.status === 429) {
      throw new GitHubImportError('GitHub API limit reached. Wait a few minutes and try again.', response.status)
    }

    throw new GitHubImportError(`GitHub could not load this repository (${response.status}).`, response.status)
  }

  return response.json() as Promise<T>
}

function relativeDate(date: string) {
  const seconds = Math.round((new Date(date).getTime() - Date.now()) / 1000)
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const ranges: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ]

  for (const [unit, size] of ranges) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit)
  }

  return formatter.format(seconds, 'second')
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?'
}

function toCommit(item: GitHubCommit, branch: string): GitCommit {
  const [message, ...description] = item.commit.message.split('\n').map((line) => line.trim())
  const author = item.commit.author ?? item.commit.committer
  const authorName = author?.name ?? item.author?.login ?? 'Unknown author'
  const date = author?.date ?? new Date().toISOString()

  return {
    hash: item.sha,
    shortHash: item.sha.slice(0, 7),
    message: message || 'Untitled commit',
    description: description.filter(Boolean).join(' ') || 'No additional commit description.',
    branch,
    parents: item.parents.map((parent) => parent.sha),
    tags: [],
    author: { name: authorName, initials: initials(authorName) },
    date: new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date)),
    timestamp: date,
    relativeDate: relativeDate(date),
    additions: 0,
    deletions: 0,
    files: [],
  }
}

export async function importGitHubRepository(
  coordinates: RepositoryCoordinates,
  signal?: AbortSignal,
): Promise<ImportedRepository> {
  const root = `/repos/${encodeURIComponent(coordinates.owner)}/${encodeURIComponent(coordinates.repo)}`
  const [repository, allBranches] = await Promise.all([
    githubRequest<GitHubRepository>(root, signal),
    githubRequest<GitHubBranch[]>(`${root}/branches?per_page=100`, signal),
  ])

  const orderedBranches = [...allBranches].sort((left, right) => {
    if (left.name === repository.default_branch) return -1
    if (right.name === repository.default_branch) return 1
    return left.name.localeCompare(right.name)
  })
  const loadedBranches = orderedBranches.slice(0, MAX_BRANCHES)
  const histories = await Promise.all(loadedBranches.map(async (branch) => ({
    branch,
    commits: await githubRequest<GitHubCommit[]>(
      `${root}/commits?sha=${encodeURIComponent(branch.name)}&per_page=${COMMITS_PER_BRANCH}`,
      signal,
    ),
  })))

  const commitMap = new Map<string, GitCommit>()
  for (const history of histories) {
    for (const commit of history.commits) {
      if (commitMap.size >= MAX_COMMITS) break
      if (!commitMap.has(commit.sha)) commitMap.set(commit.sha, toCommit(commit, history.branch.name))
    }
  }

  const commits = [...commitMap.values()].sort((left, right) =>
    new Date(right.timestamp ?? right.date).getTime() - new Date(left.timestamp ?? left.date).getTime(),
  )

  if (commits.length === 0) throw new GitHubImportError('This repository does not contain any commits.')

  const commitLookup = new Map(commits.map((commit) => [commit.hash, commit]))
  const branches: GitBranchInfo[] = allBranches.map((branch) => {
    const history = histories.find((item) => item.branch.name === branch.name)
    const headCommit = commitLookup.get(branch.commit.sha)
    return {
      name: branch.name,
      headHash: branch.commit.sha,
      commits: history?.commits.length ?? 0,
      updated: headCommit?.relativeDate ?? 'not loaded',
      isDefault: branch.name === repository.default_branch,
      protected: branch.protected,
    }
  })

  return {
    repository: {
      owner: repository.owner.login,
      name: repository.name,
      fullName: repository.full_name,
      description: repository.description ?? 'No repository description provided.',
      defaultBranch: repository.default_branch,
      htmlUrl: repository.html_url,
      stars: repository.stargazers_count,
      forks: repository.forks_count,
      openIssues: repository.open_issues_count,
      importedAt: new Date().toISOString(),
    },
    branches,
    commits,
  }
}
