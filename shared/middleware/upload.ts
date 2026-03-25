import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import multer from 'multer';
import { Request } from 'express';

const publicDir      = path.join(process.cwd(), 'public');
const productMediaDir = path.join(publicDir, 'products/media');

if (!fs.existsSync(productMediaDir)) fs.mkdirSync(productMediaDir, { recursive: true });

const imageFileFilter = (
   req: Request,
   file: Express.Multer.File,
   cb: multer.FileFilterCallback,
) => {
   const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
   const allowed = /jpeg|jpg|png|webp/;
   if (allowed.test(ext) && allowed.test(file.mimetype.replace('image/', ''))) {
      return cb(null, true);
   }
   cb(new Error('Only image files are allowed (jpeg, jpg, png, webp)'));
};

const imageAndVideoFileFilter = (
   req: Request,
   file: Express.Multer.File,
   cb: multer.FileFilterCallback,
) => {
   const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
   const allowedImages = /jpeg|jpg|png|webp/;
   const allowedVideos = /mp4|mov|webm/;

   if (
      allowedImages.test(ext) ||
      allowedVideos.test(ext) ||
      file.mimetype.startsWith('image/') ||
      file.mimetype.startsWith('video/')
   ) {
      return cb(null, true);
   }
   cb(new Error('Only image and video files are allowed'));
};

/** Upload up to 10 product media files (images + videos) at once. Field name: "media" */
export const uploadProductMedia = multer({
   storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, productMediaDir),
      filename: (req: Request, file, cb) => {
         const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
         const ext = path.extname(file.originalname);
         cb(null, `product-${uniqueSuffix}${ext}`);
      },
   }),
   limits: { fileSize: 50 * 1024 * 1024 }, // 50MB (videos)
   fileFilter: imageAndVideoFileFilter,
}).array('media', 10);

/** Compress a single uploaded image to WebP 1080px, replaces req.file in place. */
export const optimizeImage = async (req: any, res: any, next: any): Promise<void> => {
   try {
      if (!req.file || !req.file.mimetype.startsWith('image/')) return next();

      const inputPath  = req.file.path;
      const outputPath = inputPath.replace(path.extname(inputPath), '.webp');

      await sharp(inputPath)
         .resize({ width: 1080, withoutEnlargement: true })
         .webp({ quality: 75 })
         .toFile(outputPath);

      await fsPromises.unlink(inputPath);

      req.file.path     = outputPath;
      req.file.filename = path.basename(outputPath);
      req.file.mimetype = 'image/webp';

      next();
   } catch (error) {
      if (req.file?.path) await fsPromises.unlink(req.file.path).catch(() => {});
      next(error);
   }
};

/** Compress all uploaded images in req.files array to WebP 1080px. */
export const optimizeImages = async (req: any, res: any, next: any): Promise<void> => {
   try {
      const files: Express.Multer.File[] = Array.isArray(req.files) ? req.files : [];
      if (!files.length) return next();

      await Promise.all(
         files.map(async (file, i) => {
            if (!file.mimetype.startsWith('image/')) return;

            const inputPath  = file.path;
            const outputPath = inputPath.replace(path.extname(inputPath), '.webp');

            await sharp(inputPath)
               .resize({ width: 1080, withoutEnlargement: true })
               .webp({ quality: 75 })
               .toFile(outputPath);

            await fsPromises.unlink(inputPath);

            files[i].path     = outputPath;
            files[i].filename = path.basename(outputPath);
            files[i].mimetype = 'image/webp';
         }),
      );

      next();
   } catch (error) {
      next(error);
   }
};
