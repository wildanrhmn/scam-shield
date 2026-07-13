const NET_TIMEOUT = Number(process.env.REPO_TIMEOUT_MS ?? 8000);

export class RepoError extends Error {}

export interface RepoMeta {
  createdAt?: string;
  pushedAt?: string;
  stars?: number;
  fullName?: string;
}

export interface LoadedManifest {
  pkg: any;
  raw: string;
  source: string;
  meta: RepoMeta | null;
}

async function getText(url: string, headers?: Record<string, string>): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), NET_TIMEOUT);
  try {
    return await fetch(url, { headers: { "user-agent": "scaminja", ...(headers ?? {}) }, signal: ctrl.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// owner/repo (+ optional branch) from the common GitHub URL shapes.
function parseGitHub(url: string): { owner: string; repo: string; ref?: string } | null {
  const m = url.trim().match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/tree\/([\w.\-/]+))?(?:[?#].*)?$/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2], ref: m[3] };
}

function parsePkg(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    throw new RepoError("That package.json isn't valid JSON.");
  }
}

export async function loadManifest(input: { repoUrl?: string; packageJson?: string }): Promise<LoadedManifest> {
  if (input.packageJson && input.packageJson.trim()) {
    const raw = input.packageJson.trim();
    return { pkg: parsePkg(raw), raw, source: "pasted package.json", meta: null };
  }

  const gh = input.repoUrl ? parseGitHub(input.repoUrl) : null;
  if (!gh) throw new RepoError("Provide a GitHub repo URL (https://github.com/owner/repo) or paste a package.json.");

  const refs = [gh.ref, "main", "master", "HEAD"].filter(Boolean) as string[];
  let raw: string | null = null;
  for (const ref of refs) {
    const res = await getText(`https://raw.githubusercontent.com/${gh.owner}/${gh.repo}/${ref}/package.json`);
    if (res && res.ok) {
      raw = await res.text();
      break;
    }
  }
  if (raw === null) throw new RepoError(`Couldn't find a package.json in ${gh.owner}/${gh.repo} (private repo, non-Node project, or bad URL).`);

  let meta: RepoMeta | null = null;
  const metaRes = await getText(`https://api.github.com/repos/${gh.owner}/${gh.repo}`, { accept: "application/vnd.github+json" });
  if (metaRes && metaRes.ok) {
    const j: any = await metaRes.json().catch(() => null);
    if (j) meta = { createdAt: j.created_at, pushedAt: j.pushed_at, stars: j.stargazers_count, fullName: j.full_name };
  }

  return { pkg: parsePkg(raw), raw, source: `github.com/${gh.owner}/${gh.repo}`, meta };
}
