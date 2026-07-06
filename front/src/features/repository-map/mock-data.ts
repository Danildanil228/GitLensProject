import type { GitBranchInfo, GitCommit, RepositoryInfo } from './types'

const files = (...paths: string[]) =>
  paths.map((path, index) => ({
    path,
    status: index === 0 ? ('modified' as const) : ('added' as const),
  }))

export const branchColors: Record<string, string> = {
  install: 'var(--chart-2)',
  main: 'var(--chart-1)',
  'feature/vertical-map': 'var(--chart-4)',
  'fix/git-parser': 'var(--chart-5)',
}

const branchPalette = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

export function getBranchColor(branch: string) {
  if (branchColors[branch]) return branchColors[branch]

  const colorIndex = [...branch].reduce((total, character) => total + character.charCodeAt(0), 0)
  return branchPalette[colorIndex % branchPalette.length]
}

export const mockCommits: GitCommit[] = [
  {
    hash: 'f84a2c9d51e3464b7188', shortHash: 'f84a2c9',
    message: 'Build vertical repository map',
    description: 'Render newest commits at the top and spread parent branches horizontally.',
    branch: 'install', parents: ['bb20a184f1c73eb09102'], tags: [],
    author: { name: 'Danil Silchenkov', initials: 'DS' }, date: '05 Jul 2026, 22:46', relativeDate: '8 minutes ago',
    additions: 428, deletions: 64,
    files: files('src/features/repository-map/layout.ts', 'src/App.tsx', 'src/App.css'),
  },
  {
    hash: 'bb20a184f1c73eb09102', shortHash: 'bb20a18',
    message: 'Merge fix/git-parser',
    description: 'Merge parser fixes into the current integration branch.',
    branch: 'install', parents: ['0f3ba526af9e43d2a114', '2a817dca4d9c742fce62'], tags: [],
    author: { name: 'Danil Silchenkov', initials: 'DS' }, date: '05 Jul 2026, 22:21', relativeDate: '33 minutes ago',
    additions: 96, deletions: 18,
    files: files('back/src/git/parser.ts', 'back/src/git/refs.ts'),
  },
  {
    hash: '0f3ba526af9e43d2a114', shortHash: '0f3ba52',
    message: 'Merge vertical graph prototype',
    description: 'Integrate the first zoomable map prototype.',
    branch: 'install', parents: ['27549b4cd1aa03f6410f', '78bca1d263ea44901dd1'], tags: ['v0.1.0'],
    author: { name: 'Danil Silchenkov', initials: 'DS' }, date: '05 Jul 2026, 21:58', relativeDate: '56 minutes ago',
    additions: 312, deletions: 41,
    files: files('src/features/repository-map/CommitNode.tsx', 'src/features/repository-map/layout.ts'),
  },
  {
    hash: '2a817dca4d9c742fce62', shortHash: '2a817dc',
    message: 'Handle remote branch refs',
    description: 'Normalize local and remote references before graph construction.',
    branch: 'fix/git-parser', parents: ['bc16e234fb95d25a3307'], tags: [],
    author: { name: 'Alex Kim', initials: 'AK' }, date: '05 Jul 2026, 21:31', relativeDate: '1 hour ago',
    additions: 63, deletions: 12,
    files: files('back/src/git/refs.ts', 'back/src/git/parser.test.ts'),
  },
  {
    hash: 'bc16e234fb95d25a3307', shortHash: 'bc16e23',
    message: 'Parse commit parents safely',
    description: 'Support initial commits and commits with multiple parents.',
    branch: 'fix/git-parser', parents: ['d719a7042aa2eff591ba'], tags: [],
    author: { name: 'Alex Kim', initials: 'AK' }, date: '05 Jul 2026, 20:54', relativeDate: '2 hours ago',
    additions: 118, deletions: 26,
    files: files('back/src/git/parser.ts'),
  },
  {
    hash: '78bca1d263ea44901dd1', shortHash: '78bca1d',
    message: 'Add viewport controls and minimap',
    description: 'Expose zoom, fit view and pannable minimap controls.',
    branch: 'feature/vertical-map', parents: ['4be186cd9dc095bbf346'], tags: [],
    author: { name: 'Mira Stone', initials: 'MS' }, date: '05 Jul 2026, 21:42', relativeDate: '1 hour ago',
    additions: 145, deletions: 18,
    files: files('src/features/repository-map/MapControls.tsx', 'src/App.css'),
  },
  {
    hash: '4be186cd9dc095bbf346', shortHash: '4be186c',
    message: 'Create top-to-bottom ELK layout',
    description: 'Calculate a layered vertical graph using commit-to-parent edges.',
    branch: 'feature/vertical-map', parents: ['7142dfe39a00252bcdd4'], tags: [],
    author: { name: 'Mira Stone', initials: 'MS' }, date: '05 Jul 2026, 20:47', relativeDate: '2 hours ago',
    additions: 184, deletions: 9,
    files: files('src/features/repository-map/layout.ts'),
  },
  {
    hash: '27549b4cd1aa03f6410f', shortHash: '27549b4',
    message: 'Install shadcn',
    description: 'Add the first reusable UI component and theme foundation.',
    branch: 'install', parents: ['7142dfe39a00252bcdd4'], tags: [],
    author: { name: 'Danil Silchenkov', initials: 'DS' }, date: '05 Jul 2026, 20:51', relativeDate: '2 hours ago',
    additions: 5300, deletions: 1135,
    files: files('components.json', 'src/components/ui/button.tsx', 'src/index.css'),
  },
  {
    hash: '7142dfe39a00252bcdd4', shortHash: '7142dfe',
    message: 'Add alias for shadcn',
    description: 'Configure the @ source alias for components and utilities.',
    branch: 'main', parents: ['d719a7042aa2eff591ba'], tags: [],
    author: { name: 'Danil Silchenkov', initials: 'DS' }, date: '05 Jul 2026, 20:31', relativeDate: '2 hours ago',
    additions: 18, deletions: 2,
    files: files('tsconfig.app.json', 'vite.config.ts'),
  },
  {
    hash: 'd719a7042aa2eff591ba', shortHash: 'd719a70',
    message: 'Install Tailwind CSS',
    description: 'Connect Tailwind CSS to the Vite build.',
    branch: 'main', parents: ['ed686664e91a34f22f5b'], tags: [],
    author: { name: 'Danil Silchenkov', initials: 'DS' }, date: '05 Jul 2026, 20:15', relativeDate: '3 hours ago',
    additions: 381, deletions: 162,
    files: files('package.json', 'src/index.css', 'vite.config.ts'),
  },
  {
    hash: 'ed686664e91a34f22f5b', shortHash: 'ed68666',
    message: 'Create Vite frontend',
    description: 'Initialize React, TypeScript and Vite.',
    branch: 'main', parents: ['0d10ef279b95ace814c0'], tags: [],
    author: { name: 'Danil Silchenkov', initials: 'DS' }, date: '05 Jul 2026, 19:48', relativeDate: '3 hours ago',
    additions: 2038, deletions: 0,
    files: files('src/App.tsx', 'src/main.tsx', 'package.json'),
  },
  {
    hash: '0d10ef279b95ace814c0', shortHash: '0d10ef2',
    message: 'Initial repository',
    description: 'Create the project repository.',
    branch: 'main', parents: [], tags: [],
    author: { name: 'Danil Silchenkov', initials: 'DS' }, date: '05 Jul 2026, 19:31', relativeDate: '3 hours ago',
    additions: 1, deletions: 0,
    files: files('README.md'),
  },
]

export const mockBranches: GitBranchInfo[] = [
  { name: 'install', headHash: mockCommits[0].hash, commits: 7, updated: 'now', isHead: true },
  { name: 'main', headHash: '7142dfe39a00252bcdd4', commits: 5, updated: '2h', isDefault: true },
  { name: 'feature/vertical-map', headHash: '78bca1d263ea44901dd1', commits: 2, updated: '1h' },
  { name: 'fix/git-parser', headHash: '2a817dca4d9c742fce62', commits: 2, updated: '1h' },
]

export const mockRepository: RepositoryInfo = {
  owner: 'danil',
  name: 'GitLensProject',
  fullName: 'danil/GitLensProject',
  description: 'Explore history from newest to oldest. Branches spread horizontally.',
  defaultBranch: 'main',
  htmlUrl: 'https://github.com/danil/GitLensProject',
  stars: 0,
  forks: 0,
  openIssues: 0,
}
