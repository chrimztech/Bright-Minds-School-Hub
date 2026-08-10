
ALTER TABLE public.pupils
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS religion text,
  ADD COLUMN IF NOT EXISTS tribe text,
  ADD COLUMN IF NOT EXISTS home_language text,
  ADD COLUMN IF NOT EXISTS blood_group text,
  ADD COLUMN IF NOT EXISTS birth_cert_no text,
  ADD COLUMN IF NOT EXISTS nrc_no text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS town text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS transport_mode text,
  ADD COLUMN IF NOT EXISTS boarding_status text,
  ADD COLUMN IF NOT EXISTS house text,
  ADD COLUMN IF NOT EXISTS siblings_in_school text,
  ADD COLUMN IF NOT EXISTS referral_source text,
  ADD COLUMN IF NOT EXISTS notes text;
