import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { handleInviteTeamMember } from './src/server/inviteHandler.js';
import { handleAcceptInvitation } from './src/server/acceptInviteHandler.js';
import { handleRevokeInvitation } from './src/server/revokeInviteHandler.js';
import {
  handleListProjectFiles,
  handleCreateSignedUploadUrl,
  handleConfirmFileUpload,
  handleGetSignedDownloadUrl,
  handleDeleteProjectFile,
} from './src/server/projectFilesHandler.js';

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();

  // Middleware
  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'MixFlow API' });
  });

  // Secure Organization Invitation Endpoint (Step 6B)
  app.post('/api/invite-team-member', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const supabaseUrl =
        process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const supabaseAnonKey =
        process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
      const supabaseServiceRoleKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      const result = await handleInviteTeamMember({
        authHeader,
        body: req.body,
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceRoleKey,
      });

      return res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error('[MixFlow Server] Unhandled invitation error:', err);
      return res.status(500).json({
        error: 'An unexpected internal error occurred while processing the invitation.',
      });
    }
  });

  // Secure Organization Invitation Acceptance Endpoint (Step 6C)
  const acceptInviteHandler = async (req: express.Request, res: express.Response) => {
    try {
      const authHeader = req.headers.authorization;
      const supabaseUrl =
        process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const supabaseAnonKey =
        process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
      const supabaseServiceRoleKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      const result = await handleAcceptInvitation({
        authHeader,
        body: req.body,
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceRoleKey,
      });

      return res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error('[MixFlow Server] Unhandled invitation acceptance error:', err);
      return res.status(500).json({
        error: 'An unexpected internal error occurred while accepting the invitation.',
      });
    }
  };

  app.post('/api/accept-invitation', acceptInviteHandler);
  app.post('/api/organization-invitations/accept', acceptInviteHandler);

  // Secure Organization Invitation Revoke Endpoint (Step 6D)
  app.post('/api/revoke-invitation', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const supabaseUrl =
        process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const supabaseAnonKey =
        process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
      const supabaseServiceRoleKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      const result = await handleRevokeInvitation({
        authHeader,
        body: req.body,
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceRoleKey,
      });

      return res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error('[MixFlow Server] Unhandled invitation revoke error:', err);
      return res.status(500).json({
        error: 'An unexpected internal error occurred while revoking the invitation.',
      });
    }
  });

  // Project Files Endpoints (Step 9: Project File Management)
  // 1. List Files
  app.get('/api/projects/:projectId/files', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      const result = await handleListProjectFiles({
        authHeader,
        projectId: req.params.projectId,
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceRoleKey,
      });

      return res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error('[MixFlow Server] Unhandled list files error:', err);
      return res.status(500).json({ error: 'Failed to list project files.' });
    }
  });

  // 2. Request Signed Upload URL
  app.post('/api/projects/:projectId/files/upload-url', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      const result = await handleCreateSignedUploadUrl({
        authHeader,
        projectId: req.params.projectId,
        body: req.body,
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceRoleKey,
      });

      return res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error('[MixFlow Server] Unhandled upload url error:', err);
      return res.status(500).json({ error: 'Failed to generate upload URL.' });
    }
  });

  // 3. Confirm File Upload
  app.post('/api/projects/:projectId/files/confirm', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      const result = await handleConfirmFileUpload({
        authHeader,
        projectId: req.params.projectId,
        body: req.body,
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceRoleKey,
      });

      return res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error('[MixFlow Server] Unhandled confirm upload error:', err);
      return res.status(500).json({ error: 'Failed to confirm file upload.' });
    }
  });

  // 4. Get Signed Download URL
  app.post('/api/projects/:projectId/files/:fileId/download-url', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      const result = await handleGetSignedDownloadUrl({
        authHeader,
        projectId: req.params.projectId,
        fileId: req.params.fileId,
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceRoleKey,
      });

      return res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error('[MixFlow Server] Unhandled download url error:', err);
      return res.status(500).json({ error: 'Failed to generate download URL.' });
    }
  });

  // 5. Delete File
  app.delete('/api/projects/:projectId/files/:fileId', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      const result = await handleDeleteProjectFile({
        authHeader,
        projectId: req.params.projectId,
        fileId: req.params.fileId,
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceRoleKey,
      });

      return res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error('[MixFlow Server] Unhandled delete file error:', err);
      return res.status(500).json({ error: 'Failed to delete file.' });
    }
  });

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Development mode: Mount Vite dev server middlewares
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: Serve static assets from dist
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  // Parse command line arguments for port and host (supports flags passed by container)
  const portArgIndex = process.argv.indexOf('--port');
  const port =
    portArgIndex !== -1 && process.argv[portArgIndex + 1]
      ? parseInt(process.argv[portArgIndex + 1], 10)
      : parseInt(process.env.PORT || '3000', 10);

  const hostArgIndex = process.argv.indexOf('--host');
  const host =
    hostArgIndex !== -1 && process.argv[hostArgIndex + 1]
      ? process.argv[hostArgIndex + 1]
      : '0.0.0.0';

  app.listen(port, host, () => {
    console.log(`[MixFlow] Server running at http://${host}:${port} (${isProduction ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('[MixFlow] Failed to start server:', err);
  process.exit(1);
});
