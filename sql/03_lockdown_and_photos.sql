-- RUN AFTER 01_existing_schema.sql AND 02_existing_admin.sql.
-- Block public direct inserts. Public requests must go through the secure Edge Function.
DROP POLICY IF EXISTS "Public creates orders" ON public.orders;
REVOKE INSERT ON public.orders FROM anon, authenticated;
-- Preserve read/update for registered CRM admins using the existing RLS policies.
REVOKE ALL ON public.orders FROM anon;
GRANT SELECT, UPDATE ON public.orders TO authenticated;

-- Storage bucket is private. Only Edge Function's service role uploads customer photos.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('order-photos', 'order-photos', false, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public=false, file_size_limit=5242880,
  allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp'];

DROP POLICY IF EXISTS "CRM admins read order photos" ON storage.objects;
CREATE POLICY "CRM admins read order photos" ON storage.objects FOR SELECT
TO authenticated USING (bucket_id='order-photos' AND (SELECT public.is_crm_admin()));
-- Edge Function uses service role and bypasses these table / storage RLS checks.
