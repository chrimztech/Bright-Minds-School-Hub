
ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS province TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Zambia',
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS po_box TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS map_url TEXT,
  ADD COLUMN IF NOT EXISTS plot_number TEXT,
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS established_year INT,
  ADD COLUMN IF NOT EXISTS registration_no TEXT,
  ADD COLUMN IF NOT EXISTS tpin TEXT,
  ADD COLUMN IF NOT EXISTS head_teacher TEXT,
  ADD COLUMN IF NOT EXISTS deputy_head TEXT;

ALTER TABLE public.school_settings ALTER COLUMN currency SET DEFAULT 'ZMW';
UPDATE public.school_settings SET currency = 'ZMW' WHERE currency = 'USD' OR currency IS NULL;

CREATE TABLE IF NOT EXISTS public.canteen_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Meal',
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_available BOOLEAN NOT NULL DEFAULT true,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.canteen_menu_items TO authenticated;
GRANT ALL ON public.canteen_menu_items TO service_role;
ALTER TABLE public.canteen_menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read menu" ON public.canteen_menu_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage menu" ON public.canteen_menu_items FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','accountant']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','accountant']::app_role[]));

CREATE TABLE IF NOT EXISTS public.canteen_meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price_per_term NUMERIC(12,2) NOT NULL DEFAULT 0,
  meals_per_day INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.canteen_meal_plans TO authenticated;
GRANT ALL ON public.canteen_meal_plans TO service_role;
ALTER TABLE public.canteen_meal_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read plans" ON public.canteen_meal_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage plans" ON public.canteen_meal_plans FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','accountant']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','accountant']::app_role[]));

CREATE TABLE IF NOT EXISTS public.canteen_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pupil_id UUID NOT NULL REFERENCES public.pupils(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.canteen_meal_plans(id) ON DELETE RESTRICT,
  term_id UUID REFERENCES public.terms(id) ON DELETE SET NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.canteen_subscriptions TO authenticated;
GRANT ALL ON public.canteen_subscriptions TO service_role;
ALTER TABLE public.canteen_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read subs" ON public.canteen_subscriptions FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage subs" ON public.canteen_subscriptions FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','accountant']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','accountant']::app_role[]));

CREATE TABLE IF NOT EXISTS public.canteen_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pupil_id UUID REFERENCES public.pupils(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  item_id UUID REFERENCES public.canteen_menu_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'Cash',
  served_on DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.canteen_sales TO authenticated;
GRANT ALL ON public.canteen_sales TO service_role;
ALTER TABLE public.canteen_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read sales" ON public.canteen_sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff manage sales" ON public.canteen_sales FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','accountant','teacher','class_teacher']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','accountant','teacher','class_teacher']::app_role[]));

CREATE TRIGGER trg_menu_upd BEFORE UPDATE ON public.canteen_menu_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_plans_upd BEFORE UPDATE ON public.canteen_meal_plans FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_subs_upd BEFORE UPDATE ON public.canteen_subscriptions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
