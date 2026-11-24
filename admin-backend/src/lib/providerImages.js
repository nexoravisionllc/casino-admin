/**
 * Remembered provider images (table ProviderImages), so a provider the sync
 * deletes and later re-adds gets its image back. Pass a transaction's query.
 */

/** Record the image an admin set for a provider; null forgets it. */
export function rememberProviderImage(query, company, providerId, imageUrl) {
  return imageUrl
    ? query(
      `INSERT INTO ProviderImages (company, provider_id, image_url, updated_at) VALUES (:company, :providerId, :imageUrl, :now)
       ON DUPLICATE KEY UPDATE image_url = VALUES(image_url), updated_at = VALUES(updated_at)`,
      { company, providerId, imageUrl, now: new Date() })
    : query('DELETE FROM ProviderImages WHERE company = :company AND provider_id = :providerId', { company, providerId });
}
