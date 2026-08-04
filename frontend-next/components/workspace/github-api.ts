import { workspaceApi } from './api';

export interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
  type: 'file' | 'dir';
}

/**
 * Lists the contents of a GitHub repository path
 */
export async function fetchGitHubContents(
  owner: string,
  repo: string,
  path: string = '',
  branch: string = 'main',
  token?: string
): Promise<GitHubFile[]> {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json'
  };
  if (token?.trim()) {
    headers['Authorization'] = `token ${token.trim()}`;
  }

  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}?ref=${branch}`;
  
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to fetch GitHub contents: ${response.statusText}. ${errorBody}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [data];
}

/**
 * Downloads a single file's content from a GitHub repository
 */
export async function downloadGitHubFile(downloadUrl: string, token?: string): Promise<string> {
  const headers: HeadersInit = {};
  if (token?.trim()) {
    headers['Authorization'] = `token ${token.trim()}`;
  }

  const response = await fetch(downloadUrl, { headers });
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }

  return await response.text();
}

/**
 * Exports (commits) a system component file to a GitHub repository.
 * If the file exists, it retrieves the existing SHA first to perform an update.
 */
export async function exportToGitHub(params: {
  owner: string;
  repo: string;
  path: string;
  branch: string;
  token: string;
  content: string;
  commitMessage: string;
}): Promise<{ sha: string; commitUrl: string }> {
  const { owner, repo, path, branch, token, content, commitMessage } = params;
  
  if (!token?.trim()) {
    throw new Error('GitHub Personal Access Token (PAT) is required for exporting files.');
  }

  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
    Authorization: `token ${token.trim()}`,
    'Content-Type': 'application/json'
  };

  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const fileUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}`;

  // 1. Check if the file already exists to get its SHA (required for file updates in GitHub REST API)
  let existingSha: string | undefined = undefined;
  try {
    const checkRes = await fetch(`${fileUrl}?ref=${branch}`, { headers });
    if (checkRes.ok) {
      const fileMeta = await checkRes.json();
      if (!Array.isArray(fileMeta) && fileMeta.sha) {
        existingSha = fileMeta.sha;
      }
    }
  } catch (err) {
    console.log('File does not exist or fetch failed, proceeding with create:', err);
  }

  // 2. Encode content to base64 safely (handling UTF-8)
  const base64Content = btoa(
    encodeURIComponent(content).replace(/%([0-9A-F]{2})/g, (_, p1) => 
      String.fromCharCode(parseInt(p1, 16))
    )
  );

  // 3. Put content (create or update file)
  const putBody = {
    message: commitMessage || `Update ${cleanPath} from Fabrica SaaS Dashboard`,
    content: base64Content,
    branch,
    sha: existingSha // will be undefined for a new file
  };

  const putResponse = await fetch(fileUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify(putBody)
  });

  if (!putResponse.ok) {
    const errText = await putResponse.text();
    throw new Error(`GitHub Commit Error: ${putResponse.statusText} - ${errText}`);
  }

  const resData = await putResponse.json();
  return {
    sha: resData.content.sha,
    commitUrl: resData.commit.html_url
  };
}

/**
 * Imports a GitHub file into workspace using POST /api/workspace/create
 */
export async function importGitHubFileToWorkspace(downloadUrl: string, fileName: string, targetCategory: string = 'Discovery & Scoping', token?: string): Promise<{ ok: boolean; path: string }> {
  const content = await downloadGitHubFile(downloadUrl, token);
  const relativePath = `workspace/${targetCategory}/${fileName}`;

  const res = await workspaceApi.createWorkspaceItem({
    path: relativePath,
    content,
    type: 'imported',
    level: { maturity: 'draft', readability: 'high' },
    description: `GitHub imported file: ${fileName}`,
    when_to_use: `Referenced as imported source file from GitHub for ${fileName}`,
    triggers: [fileName, 'github_import'],
    isImport: true
  });

  return { ok: res.ok, path: res.path };
}
