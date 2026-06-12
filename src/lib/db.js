// ── Shared DB helpers used across views ────────────────────────────────────
import { supabase } from './supabase';

export async function uploadImage(file, prefix) {
  const ext = file.name.split('.').pop();
  const path = `${prefix}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true });
  if (error) { console.error('Upload error:', error); return null; }
  const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path);
  return publicUrl;
}

export async function createNotification(userId, type, title, message, extras = {}) {
  if (!userId) return;
  await supabase.from('notifications').insert({ user_id: userId, type, title, message, ...extras });
}

export async function notifyUsers(userIds, type, title, message, extras = {}) {
  const unique = [...new Set(userIds.filter(Boolean))];
  for (const uid of unique) {
    await createNotification(uid, type, title, message, extras);
  }
}

export async function getBrandsFromDB() {
  const { data } = await supabase.from('brands').select('*').eq('is_active', true).order('sort_order');
  return data || [];
}
