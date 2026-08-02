import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import {
  readUserFile,
  writeUserFile,
  moveUserFile,
  deleteUserFile,
  getWorkspaceMap,
  syncWorkspaceJson,
  clearWorkspacePending,
  flagWorkspaceAction,
  listWorkspaceItemsFromJson,
  createWorkspaceItem
} from '../../core/workspace.js';

const router = Router();

// GET /api/workspace/files — List workspace files from workspace.json index with path sanitization
router.get('/files', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || 'default_user';
  const subDir = (req.query.path as string) || '';
  try {
    const files = listWorkspaceItemsFromJson(tenantId, subDir);
    res.json({ ok: true, files });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// POST /api/workspace/create — Create/Import workspace item
router.post('/create', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || 'default_user';
  const { path: filePath, content, type, level, description, when_to_use, triggers, isImport, flagged_as_action } = req.body || {};
  if (!filePath) {
    res.status(400).json({ ok: false, error: 'Path is required.' });
    return;
  }
  try {
    const result = createWorkspaceItem(tenantId, {
      path: filePath,
      content: content || '',
      type,
      level,
      description,
      when_to_use,
      triggers,
      isImport: Boolean(isImport),
      flagged_as_action: Boolean(flagged_as_action)
    });
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// GET /api/workspace/file/read — Read file contents
router.get('/file/read', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || 'default_user';
  const filePath = req.query.path as string;
  if (!filePath) {
    res.status(400).json({ ok: false, error: 'File path is required.' });
    return;
  }
  try {
    const fileData = readUserFile(tenantId, filePath);
    res.json({ ok: true, ...fileData });
  } catch (err: any) {
    res.status(404).json({ ok: false, error: err.message });
  }
});

// POST /api/workspace/file/write — Write file contents
router.post('/file/write', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || 'default_user';
  const { path: filePath, content, isImport } = req.body || {};
  if (!filePath || content === undefined) {
    res.status(400).json({ ok: false, error: 'Path and content are required.' });
    return;
  }
  try {
    const result = writeUserFile(tenantId, filePath, content, Boolean(isImport));
    syncWorkspaceJson(tenantId);
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// POST /api/workspace/clear-pending — Clear pending workspace import/item
router.post('/clear-pending', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || 'default_user';
  const { path: itemPath } = req.body || {};
  if (!itemPath) {
    res.status(400).json({ ok: false, error: 'Path/ID is required.' });
    return;
  }
  clearWorkspacePending(tenantId, itemPath);
  res.json({ ok: true });
});

// POST /api/workspace/flag-action — Flag an item (file/folder) as action item
router.post('/flag-action', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || 'default_user';
  const { path: itemPath, item } = req.body || {};
  if (!itemPath && !item) {
    res.status(400).json({ ok: false, error: 'itemPath or item is required.' });
    return;
  }
  flagWorkspaceAction(tenantId, item || itemPath);
  res.json({ ok: true });
});

// POST /api/workspace/file/move — Move file or directory
router.post('/file/move', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || 'default_user';
  const { src, dest } = req.body || {};
  if (!src || !dest) {
    res.status(400).json({ ok: false, error: 'src and dest paths are required.' });
    return;
  }
  try {
    const result = moveUserFile(tenantId, src, dest);
    syncWorkspaceJson(tenantId);
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// POST /api/workspace/file/delete — Delete file or directory
router.post('/file/delete', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || 'default_user';
  const { path: filePath } = req.body || {};
  if (!filePath) {
    res.status(400).json({ ok: false, error: 'Path is required.' });
    return;
  }
  try {
    const deleted = deleteUserFile(tenantId, filePath);
    syncWorkspaceJson(tenantId);
    res.json({ ok: deleted });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// GET /api/workspace/map — Get single workspace.json map
router.get('/map', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || 'default_user';
  const map = getWorkspaceMap(tenantId);
  res.json({ ok: true, map });
});

export default router;
