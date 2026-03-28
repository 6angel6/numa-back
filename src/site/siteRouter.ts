import { Router } from 'express';
import { requireAuth, requirePermission } from '../../shared/middleware/auth';
import { uploadSiteImage, optimizeImage } from '../../shared/middleware/upload';
import { Permission } from '../admin/dto/permissionDto';

import { getPage } from './controller/sitePublicController';
import {
   listPages,
   getPageCms,
   createPage,
   updatePage,
   publishPage,
   deletePage,
   listSections,
   createSection,
   updateSection,
   deleteSection,
   reorderSections,
   uploadImage,
} from './controller/siteCmsController';

const router = Router();

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC
// ══════════════════════════════════════════════════════════════════════════════

// GET /sites/:store/:slug  — published page with visible sections (Redis-cached)
router.get('/:store/:slug', getPage);

// ══════════════════════════════════════════════════════════════════════════════
// CMS (admin-protected)
// ══════════════════════════════════════════════════════════════════════════════

router.use('/cms', requireAuth);

// ── Pages ─────────────────────────────────────────────────────────────────────
router.get(
   '/cms/:store/pages',
   requirePermission(Permission.SITE_MANAGE),
   listPages,
);
router.get(
   '/cms/:store/pages/:slug',
   requirePermission(Permission.SITE_MANAGE),
   getPageCms,
);
router.post(
   '/cms/:store/pages',
   requirePermission(Permission.SITE_MANAGE),
   createPage,
);
router.patch(
   '/cms/:store/pages/:id',
   requirePermission(Permission.SITE_MANAGE),
   updatePage,
);
router.patch(
   '/cms/:store/pages/:id/publish',
   requirePermission(Permission.SITE_MANAGE),
   publishPage,
);
// id + slug both needed: delete by id, invalidate cache by slug
router.delete(
   '/cms/:store/pages/:id/:slug',
   requirePermission(Permission.SITE_MANAGE),
   deletePage,
);

// ── Sections ──────────────────────────────────────────────────────────────────
// list: only pageId needed
router.get(
   '/cms/:store/pages/:pageId/sections',
   requirePermission(Permission.SITE_MANAGE),
   listSections,
);
// create + reorder: pageId (for section FK) + slug (for cache key)
router.post(
   '/cms/:store/pages/:pageId/:slug/sections',
   requirePermission(Permission.SITE_MANAGE),
   createSection,
);
router.patch(
   '/cms/:store/pages/:pageId/:slug/sections/reorder',
   requirePermission(Permission.SITE_MANAGE),
   reorderSections,
);
// update + delete: section id + page slug (for cache key)
router.put(
   '/cms/:store/pages/:slug/sections/:id',
   requirePermission(Permission.SITE_MANAGE),
   updateSection,
);
router.delete(
   '/cms/:store/pages/:slug/sections/:id',
   requirePermission(Permission.SITE_MANAGE),
   deleteSection,
);

// ── Image upload ──────────────────────────────────────────────────────────────
// POST /sites/cms/:store/upload  — returns { url }
router.post(
   '/cms/:store/upload',
   requirePermission(Permission.SITE_MANAGE),
   uploadSiteImage,
   optimizeImage,
   uploadImage,
);

export default router;
