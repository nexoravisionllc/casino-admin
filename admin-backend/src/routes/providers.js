import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { db } from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { bodyOf, isBlank, longParam } from '../lib/http.js';
import { rememberProviderImage } from '../lib/providerImages.js';
import { PROVIDER_COLUMNS, toProviderRow } from '../lib/rows.js';

export const router = express.Router();
router.use(requireAuth);
router.param('uid', longParam);

const ALLOWED_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
const MAX_REQUEST_BYTES = 5_000_000;
export const PROVIDER_UPLOAD_DIR = path.join(config.wwwroot, 'uploads', 'providers');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_REQUEST_BYTES } });

const getProvider = async (uid) =>
  (await db.query(`SELECT ${PROVIDER_COLUMNS} FROM Providers WHERE uid = :uid`, { uid }))[0];

// Also remembered per (company, provider_id), so the image survives the sync
// deleting and re-adding the provider.
const setImageUrl = (provider, imageUrl) => db.transaction(async ({ query }) => {
  await query('UPDATE Providers SET image_url = :imageUrl WHERE uid = :uid', { imageUrl, uid: provider.uid });
  await rememberProviderImage(query, provider.company, provider.provider_id, imageUrl);
});

/** All providers. */
router.get('/', async (req, res) => {
  const rows = await db.query(`SELECT ${PROVIDER_COLUMNS} FROM Providers ORDER BY company, provider_id`);
  res.json(rows.map(toProviderRow));
});

/** Set a provider's image to a URL. */
router.put('/:uid/image', async (req, res) => {
  const raw = bodyOf(req).str('imageUrl');
  const imageUrl = isBlank(raw) ? null : raw.trim();

  const provider = await getProvider(req.params.uid);
  if (!provider) return res.status(404).json({ message: 'Provider not found.' });

  await setImageUrl(provider, imageUrl);
  res.json(toProviderRow({ ...provider, image_url: imageUrl }));
});

/** Upload an image file; stores it and saves the URL to image_url. */
router.post(
  '/:uid/image/upload',
  (req, res, next) => {
    if (Number(req.get('content-length') ?? 0) > MAX_REQUEST_BYTES) return res.status(413).end();
    next();
  },
  upload.any(),
  async (req, res) => {
    const provider = await getProvider(req.params.uid);
    if (!provider) return res.status(404).json({ message: 'Provider not found.' });

    const file = (req.files ?? []).find((f) => f.fieldname.toLowerCase() === 'file');
    if (!file || file.size === 0) return res.status(400).json({ message: 'No file uploaded.' });

    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) return res.status(400).json({ message: 'Unsupported image type.' });

    await fs.mkdir(PROVIDER_UPLOAD_DIR, { recursive: true });
    const fileName = `${req.params.uid}_${crypto.randomUUID().replaceAll('-', '')}${ext}`;
    await fs.writeFile(path.join(PROVIDER_UPLOAD_DIR, fileName), file.buffer);

    // Public URL served from wwwroot (see the static middleware in app.js).
    const base = config.publicBaseUrl ?? `${req.protocol}://${req.host}`;
    const url = `${base}/uploads/providers/${fileName}`;
    await setImageUrl(provider, url);
    res.json(toProviderRow({ ...provider, image_url: url }));
  });
