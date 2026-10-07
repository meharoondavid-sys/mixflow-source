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
  handleGetClientShareUrl,
  handleDeleteProjectFile,
} from './src/server/projectFilesHandler.js';
import {
  handleGetClientPortalMe,
  handleGetClientPortalProjects,
  handleGetClientPortalProjectDetail,
  handleGetClientPortalFileDownloadUrl,
  handleCreateClientFileUploadUrl,
  handleConfirmClientFileUpload,
} from './src/server/clientPortalHandler.js';
import {
  handleListProjectVersions,
  handleRequestVersionUploadUrl,
  handleConfirmVersionUpload,
  handleGetVersionPlaybackUrl,
  handleListProjectFeedback,
  handleCreateProjectFeedback,
  handleUpdateFeedbackStatus,
} from './src/server/versionReviewHandler.js';
import {
  handleListProjectPayments,
  handleCreateProjectPayment,
} from './src/server/paymentsHandler.js';
import {
  handleListProjectDeliveries,
  handleCreateProjectDelivery,
  handleGetDeliveryDownloadUrl,
} from './src/server/finalDeliveryHandler.js';
import {
  handleListUserNotifications,
  handleMarkNotificationRead,
  handleMarkAllNotificationsRead,
} from './src/server/notificationsHandler.js';
import {
  handleCreateCollaboratorInvite,
  handleListCollaboratorInvites,
  handleRevokeCollaboratorInvite,
  handleAcceptCollaboratorInvite,
} from './src/server/collaboratorHandler.js';
import {
  handleCollaboratorProjectFiles,
  handleCollaboratorFileDownload,
  handleCollaboratorVersions,
  handleCollaboratorPlayback,
  handleCollaboratorRequestVersionUpload,
  handleCollaboratorConfirmVersion,
  handleCollaboratorListFeedback,
  handleCollaboratorCreateFeedback,
} from './src/server/collaboratorProjectHandler.js';

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();

  // Middleware
  app.use(express.json());

  // Step 16: project-scoped collaborator invites
  const collaboratorContext = (req: express.Request) => ({
    authHeader: req.headers.authorization,
    projectId: req.params.projectId,
    body: req.body,
    supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  });

  app.post('/api/projects/:projectId/collaborators/invites', async (req, res) => {
    try {
      const result = await handleCreateCollaboratorInvite(collaboratorContext(req));
      return res.status(result.status).json(result.body);
    } catch (err) {
      console.error('[MixFlow Server] Collaborator invite create error:', err);
      return res.status(500).json({ error: 'Failed to create collaborator invite.' });
    }
  });

  app.get('/api/projects/:projectId/collaborators/invites', async (req, res) => {
    try {
      const result = await handleListCollaboratorInvites(collaboratorContext(req));
      return res.status(result.status).json(result.body);
    } catch (err) {
      console.error('[MixFlow Server] Collaborator invite list error:', err);
      return res.status(500).json({ error: 'Failed to list collaborator invites.' });
    }
  });

  app.post('/api/projects/:projectId/collaborators/invites/revoke', async (req, res) => {
    try {
      const result = await handleRevokeCollaboratorInvite(collaboratorContext(req));
      return res.status(result.status).json(result.body);
    } catch (err) {
      console.error('[MixFlow Server] Collaborator invite revoke error:', err);
      return res.status(500).json({ error: 'Failed to revoke collaborator invite.' });
    }
  });

  app.post('/api/collaborators/project/files', async (req, res) => {
    try { const result = await handleCollaboratorProjectFiles({ body: req.body, projectId: req.body?.projectId, supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '', supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '', supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '' }); return res.status(result.status).json(result.body); }
    catch (err) { console.error('[MixFlow Server] Collaborator files error:', err); return res.status(500).json({ error: 'Failed to retrieve collaborator files.' }); }
  });

  app.post('/api/collaborators/project/file-download', async (req, res) => {
    try { const result = await handleCollaboratorFileDownload({ body: req.body, projectId: req.body?.projectId, supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '', supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '', supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '' }); return res.status(result.status).json(result.body); }
    catch (err) { console.error('[MixFlow Server] Collaborator file download error:', err); return res.status(500).json({ error: 'Failed to generate collaborator download URL.' }); }
  });

  app.post('/api/collaborators/project/versions', async (req, res) => {
    try { const result = await handleCollaboratorVersions({ body: req.body, projectId: req.body?.projectId, supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '', supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '', supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '' }); return res.status(result.status).json(result.body); }
    catch (err) { console.error('[MixFlow Server] Collaborator versions error:', err); return res.status(500).json({ error: 'Failed to retrieve collaborator versions.' }); }
  });

  app.post('/api/collaborators/project/playback', async (req, res) => {
    try { const result = await handleCollaboratorPlayback({ body: req.body, projectId: req.body?.projectId, supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '', supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '', supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '' }); return res.status(result.status).json(result.body); }
    catch (err) { console.error('[MixFlow Server] Collaborator playback error:', err); return res.status(500).json({ error: 'Failed to generate collaborator playback URL.' }); }
  });

  app.post('/api/collaborators/project/version-upload-url', async (req, res) => {
    try { const result = await handleCollaboratorRequestVersionUpload({ body: req.body, projectId: req.body?.projectId, supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '', supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '', supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '' }); return res.status(result.status).json(result.body); }
    catch (err) { console.error('[MixFlow Server] Collaborator version upload URL error:', err); return res.status(500).json({ error: 'Failed to generate collaborator upload URL.' }); }
  });

  app.post('/api/collaborators/project/version-confirm', async (req, res) => {
    try { const result = await handleCollaboratorConfirmVersion({ body: req.body, projectId: req.body?.projectId, supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '', supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '', supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '' }); return res.status(result.status).json(result.body); }
    catch (err) { console.error('[MixFlow Server] Collaborator version confirm error:', err); return res.status(500).json({ error: 'Failed to confirm collaborator version.' }); }
  });

  app.post('/api/collaborators/project/feedback', async (req, res) => {
    try { const result = req.body?.action === 'create' ? await handleCollaboratorCreateFeedback({ body: req.body, projectId: req.body?.projectId, supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '', supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '', supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '' }) : await handleCollaboratorListFeedback({ body: req.body, projectId: req.body?.projectId, supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '', supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '', supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '' }); return res.status(result.status).json(result.body); }
    catch (err) { console.error('[MixFlow Server] Collaborator feedback error:', err); return res.status(500).json({ error: 'Failed to process collaborator feedback.' }); }
  });

  app.post('/api/collaborators/invites/accept', async (req, res) => {
    try {
      const result = await handleAcceptCollaboratorInvite({
        authHeader: req.headers.authorization,
        body: req.body,
        supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
        supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
        supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      });
      return res.status(result.status).json(result.body);
    } catch (err) {
      console.error('[MixFlow Server] Collaborator invite accept error:', err);
      return res.status(500).json({ error: 'Failed to accept collaborator invite.' });
    }
  });

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

  // 5. Create a time-limited client share URL
  app.post('/api/projects/:projectId/files/:fileId/share-url', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      const result = await handleGetClientShareUrl({
        authHeader,
        projectId: req.params.projectId,
        fileId: req.params.fileId,
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceRoleKey,
      });
      return res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error('[MixFlow Server] Client share URL error:', err);
      return res.status(500).json({ error: 'Failed to create client share link.' });
    }
  });

  // 6. Delete File
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

  // ==========================================
  // Client Portal Foundation Endpoints (Step 10)
  // ==========================================

  // 1. GET /api/client-portal/me - Get Client Identity
  app.get('/api/client-portal/me', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      const result = await handleGetClientPortalMe({
        authHeader,
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceRoleKey,
      });

      return res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error('[MixFlow Server] Client portal me error:', err);
      return res.status(500).json({ error: 'Failed to fetch client profile.' });
    }
  });

  // 2. GET /api/client-portal/projects - List Client's Assigned Projects
  app.get('/api/client-portal/projects', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      const result = await handleGetClientPortalProjects({
        authHeader,
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceRoleKey,
      });

      return res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error('[MixFlow Server] Client portal projects error:', err);
      return res.status(500).json({ error: 'Failed to fetch client projects.' });
    }
  });

  // 3. GET /api/client-portal/projects/:projectId - Get Client Project Detail, Songs, & Files
  app.get('/api/client-portal/projects/:projectId', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      const result = await handleGetClientPortalProjectDetail({
        authHeader,
        projectId: req.params.projectId,
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceRoleKey,
      });

      return res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error('[MixFlow Server] Client portal project detail error:', err);
      return res.status(500).json({ error: 'Failed to fetch project details.' });
    }
  });

  // 4A. POST /api/client-portal/projects/:projectId/files/upload-url - Client uploads project file
  app.post('/api/client-portal/projects/:projectId/files/upload-url', async (req, res) => {
    try {
      const result = await handleCreateClientFileUploadUrl({
        authHeader: req.headers.authorization,
        projectId: req.params.projectId,
        body: req.body,
        supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
        supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
        supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      });
      return res.status(result.status).json(result.body);
    } catch (err) {
      console.error('[MixFlow Server] Client file upload URL error:', err);
      return res.status(500).json({ error: 'Failed to prepare client file upload.' });
    }
  });

  // 4B. POST /api/client-portal/projects/:projectId/files/confirm - Confirm client upload
  app.post('/api/client-portal/projects/:projectId/files/confirm', async (req, res) => {
    try {
      const result = await handleConfirmClientFileUpload({
        authHeader: req.headers.authorization,
        projectId: req.params.projectId,
        body: req.body,
        supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
        supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
        supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      });
      return res.status(result.status).json(result.body);
    } catch (err) {
      console.error('[MixFlow Server] Client file confirm error:', err);
      return res.status(500).json({ error: 'Failed to confirm client file upload.' });
    }
  });

  // 4. POST /api/client-portal/projects/:projectId/files/:fileId/download-url - Get Signed URL for Permitted File
  app.post('/api/client-portal/projects/:projectId/files/:fileId/download-url', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      const result = await handleGetClientPortalFileDownloadUrl({
        authHeader,
        projectId: req.params.projectId,
        fileId: req.params.fileId,
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceRoleKey,
      });

      return res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error('[MixFlow Server] Client portal download url error:', err);
      return res.status(500).json({ error: 'Failed to generate download URL.' });
    }
  });

  // ==========================================
  // Step 11: Audio Versions & Feedback Endpoints
  // ==========================================

  // 1. GET /api/projects/:projectId/versions
  app.get('/api/projects/:projectId/versions', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      const result = await handleListProjectVersions({
        authHeader,
        projectId: req.params.projectId,
        songId: typeof req.query.songId === 'string' ? req.query.songId : undefined,
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceRoleKey,
      });

      return res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error('[MixFlow Server] List versions error:', err);
      return res.status(500).json({ error: 'Failed to list versions.' });
    }
  });

  // 2. POST /api/projects/:projectId/versions/upload-url
  app.post('/api/projects/:projectId/versions/upload-url', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      const result = await handleRequestVersionUploadUrl({
        authHeader,
        projectId: req.params.projectId,
        body: req.body,
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceRoleKey,
      });

      return res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error('[MixFlow Server] Request version upload URL error:', err);
      return res.status(500).json({ error: 'Failed to request version upload URL.' });
    }
  });

  // 3. POST /api/projects/:projectId/versions/confirm
  app.post('/api/projects/:projectId/versions/confirm', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      const result = await handleConfirmVersionUpload({
        authHeader,
        projectId: req.params.projectId,
        body: req.body,
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceRoleKey,
      });

      return res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error('[MixFlow Server] Confirm version upload error:', err);
      return res.status(500).json({ error: 'Failed to confirm version upload.' });
    }
  });

  // 4. GET /api/projects/:projectId/versions/:versionId/playback-url
  app.get('/api/projects/:projectId/versions/:versionId/playback-url', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      const result = await handleGetVersionPlaybackUrl({
        authHeader,
        projectId: req.params.projectId,
        versionId: req.params.versionId,
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceRoleKey,
      });

      return res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error('[MixFlow Server] Get version playback URL error:', err);
      return res.status(500).json({ error: 'Failed to generate playback URL.' });
    }
  });

  // 5. GET /api/projects/:projectId/feedback
  app.get('/api/projects/:projectId/feedback', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      const result = await handleListProjectFeedback({
        authHeader,
        projectId: req.params.projectId,
        versionId: typeof req.query.versionId === 'string' ? req.query.versionId : undefined,
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceRoleKey,
      });

      return res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error('[MixFlow Server] List feedback error:', err);
      return res.status(500).json({ error: 'Failed to retrieve feedback.' });
    }
  });

  // 6. POST /api/projects/:projectId/feedback
  app.post('/api/projects/:projectId/feedback', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      const result = await handleCreateProjectFeedback({
        authHeader,
        projectId: req.params.projectId,
        body: req.body,
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceRoleKey,
      });

      return res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error('[MixFlow Server] Create feedback error:', err);
      return res.status(500).json({ error: 'Failed to create feedback.' });
    }
  });

  // 7. PATCH /api/projects/:projectId/feedback/:feedbackId/status
  app.patch('/api/projects/:projectId/feedback/:feedbackId/status', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      const result = await handleUpdateFeedbackStatus({
        authHeader,
        projectId: req.params.projectId,
        feedbackId: req.params.feedbackId,
        body: req.body,
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceRoleKey,
      });

      return res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error('[MixFlow Server] Update feedback status error:', err);
      return res.status(500).json({ error: 'Failed to update feedback status.' });
    }
  });

  // =========================================================================
  // Step 13: Payments & Billing Foundation Endpoints
  // =========================================================================

  // 1. List payments for a project (Org members & assigned client)
  app.get('/api/projects/:projectId/payments', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      const result = await handleListProjectPayments({
        authHeader,
        projectId: req.params.projectId,
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceRoleKey,
      });

      return res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error('[MixFlow Server] List project payments error:', err);
      return res.status(500).json({ error: 'Failed to fetch project payments.' });
    }
  });

  // 2. Record new project payment (Owner, Admin, Finance only)
  app.post('/api/projects/:projectId/payments', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      const result = await handleCreateProjectPayment({
        authHeader,
        projectId: req.params.projectId,
        body: req.body,
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceRoleKey,
      });

      return res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error('[MixFlow Server] Create project payment error:', err);
      return res.status(500).json({ error: 'Failed to record project payment.' });
    }
  });

  // 3. Prevent payment deletion: Return 405 Method Not Allowed
  app.delete('/api/projects/:projectId/payments*', (_req, res) => {
    return res.status(405).json({
      error: 'Method Not Allowed. Payment records are immutable financial history and cannot be deleted.',
    });
  });

  // =========================================================================
  // Step 14: Final Delivery Foundation Endpoints
  // =========================================================================

  // 1. List Final Deliveries for a Project (Studio staff & assigned client)
  app.get('/api/projects/:projectId/deliveries', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      const result = await handleListProjectDeliveries({
        authHeader,
        projectId: req.params.projectId,
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceRoleKey,
      });

      return res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error('[MixFlow Server] List project deliveries error:', err);
      return res.status(500).json({ error: 'Failed to fetch project deliveries.' });
    }
  });

  // 2. Create / Release Final Delivery (Owner, Admin, Engineer only)
  app.post('/api/projects/:projectId/deliveries', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      const result = await handleCreateProjectDelivery({
        authHeader,
        projectId: req.params.projectId,
        body: req.body,
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceRoleKey,
      });

      return res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error('[MixFlow Server] Create project delivery error:', err);
      return res.status(500).json({ error: 'Failed to release final deliverable.' });
    }
  });

  // 3. Generate Secure Download URL for Final Delivery (Studio staff & assigned client)
  app.post('/api/projects/:projectId/deliveries/:deliveryId/download-url', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      const result = await handleGetDeliveryDownloadUrl({
        authHeader,
        projectId: req.params.projectId,
        deliveryId: req.params.deliveryId,
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceRoleKey,
      });

      return res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error('[MixFlow Server] Delivery download URL error:', err);
      return res.status(500).json({ error: 'Failed to generate delivery download URL.' });
    }
  });

  // 4. Prevent delivery deletion: Return 405 Method Not Allowed
  app.delete('/api/projects/:projectId/deliveries*', (_req, res) => {
    return res.status(405).json({
      error: 'Method Not Allowed. Final deliverable records are immutable archival releases and cannot be deleted.',
    });
  });

  // =========================================================================
  // STEP 15: NOTIFICATIONS FOUNDATION ENDPOINTS
  // =========================================================================

  // 1. List Authenticated Caller's Notifications
  app.get('/api/notifications', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      const result = await handleListUserNotifications({
        authHeader,
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceRoleKey,
      });

      return res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error('[MixFlow Server] List notifications error:', err);
      return res.status(500).json({ error: 'Failed to retrieve notifications.' });
    }
  });

  // 2. Mark Single Notification as Read
  app.patch('/api/notifications/:id/read', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      const result = await handleMarkNotificationRead({
        authHeader,
        notificationId: req.params.id,
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceRoleKey,
      });

      return res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error('[MixFlow Server] Mark notification read error:', err);
      return res.status(500).json({ error: 'Failed to mark notification as read.' });
    }
  });

  // 3. Mark All Notifications as Read
  app.post('/api/notifications/read-all', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      const result = await handleMarkAllNotificationsRead({
        authHeader,
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceRoleKey,
      });

      return res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error('[MixFlow Server] Mark all notifications read error:', err);
      return res.status(500).json({ error: 'Failed to mark all notifications as read.' });
    }
  });

  // 4. Block Notification Deletion: Return 405 Method Not Allowed
  app.delete('/api/notifications*', (_req, res) => {
    return res.status(405).json({
      error: 'Method Not Allowed. Notifications are immutable activity records and cannot be deleted.',
    });
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
