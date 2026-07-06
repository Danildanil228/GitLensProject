import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  GitBranch,
  GitPullRequestArrow,
  Link2,
  LoaderCircle,
  LockKeyhole,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  GitHubImportError,
  importGitHubRepository,
  parseGitHubRepository,
} from './github'
import type { ImportedRepository } from '@/features/repository-map/types'

type RepositoryImportDialogProps = {
  open: boolean
  onClose: () => void
  onImport: (repository: ImportedRepository) => void
}

export function RepositoryImportDialog({ open, onClose, onImport }: RepositoryImportDialogProps) {
  const [repositoryUrl, setRepositoryUrl] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const abortController = useRef<AbortController | null>(null)

  useEffect(() => () => abortController.current?.abort(), [])

  if (!open) return null

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const coordinates = parseGitHubRepository(repositoryUrl)

    if (!coordinates) {
      setError('Paste a GitHub link like https://github.com/owner/repository')
      return
    }

    abortController.current?.abort()
    abortController.current = new AbortController()
    setError('')
    setIsLoading(true)

    try {
      const repository = await importGitHubRepository(coordinates, abortController.current.signal)
      onImport(repository)
      setRepositoryUrl('')
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return
      setError(reason instanceof GitHubImportError ? reason.message : 'Could not analyze this repository. Try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="import-overlay" role="presentation">
      <section className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <div className="import-dialog__header">
          <div className="import-mark" aria-hidden="true"><GitBranch size={22} /></div>
          <Button
            className="import-close"
            variant="ghost"
            size="icon-sm"
            type="button"
            onClick={onClose}
            aria-label="Close repository import"
            disabled={isLoading}
          >
            <X size={17} />
          </Button>
        </div>

        <div className="import-dialog__intro">
          <span className="eyebrow">New analysis</span>
          <h2 id="import-title">Map a GitHub repository</h2>
          <p>Paste a public repository link. Git Atlas will read its branches and recent commit history, then build the map.</p>
        </div>

        <form className="repository-form" onSubmit={handleSubmit}>
          <label htmlFor="repository-url">Repository URL</label>
          <div className={`repository-url-field ${error ? 'has-error' : ''}`}>
            <Link2 size={17} />
            <input
              id="repository-url"
              value={repositoryUrl}
              onChange={(event) => {
                setRepositoryUrl(event.target.value)
                if (error) setError('')
              }}
              placeholder="https://github.com/owner/repository"
              autoComplete="url"
              autoFocus
              disabled={isLoading}
              aria-describedby={error ? 'repository-error' : 'repository-hint'}
              aria-invalid={Boolean(error)}
            />
          </div>
          {error ? (
            <p className="repository-form__error" id="repository-error" role="alert">{error}</p>
          ) : (
            <p className="repository-form__hint" id="repository-hint">GitHub HTTPS, SSH and owner/repository formats are supported.</p>
          )}

          <Button className="repository-submit" size="sm" type="submit" disabled={isLoading || !repositoryUrl.trim()}>
            {isLoading ? (
              <><LoaderCircle className="is-spinning" size={16} /> Reading repository…</>
            ) : (
              <>Analyze repository <ArrowRight size={16} /></>
            )}
          </Button>
        </form>

        <div className="import-capabilities">
          <div><GitPullRequestArrow size={16} /><span><strong>Real Git history</strong>Up to 5 branches and 80 commits</span></div>
          <div><CheckCircle2 size={16} /><span><strong>No setup required</strong>Public repositories open immediately</span></div>
        </div>

        <div className="import-privacy">
          <LockKeyhole size={14} />
          <span>Only public repositories are supported in this version. Private repository access will use a secure backend connection.</span>
        </div>
      </section>
    </div>
  )
}
