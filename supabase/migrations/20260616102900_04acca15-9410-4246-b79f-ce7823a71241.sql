
-- ============ ENUMS ============
DO $$ BEGIN CREATE TYPE public.admission_status AS ENUM ('applied','reviewing','interviewed','admitted','rejected','waitlisted','enrolled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.leave_status AS ENUM ('pending','approved','rejected','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.po_status AS ENUM ('draft','sent','received','cancelled','paid'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.inv_direction AS ENUM ('in','out','adjust','damage','lost'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.loan_status AS ENUM ('borrowed','returned','overdue','lost'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.event_audience AS ENUM ('all','staff','parents','pupils','class'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payroll_status AS ENUM ('draft','approved','paid'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.discipline_kind AS ENUM ('incident','merit','demerit','reward','warning'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Helper to safely create RLS policies
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ============ ADMISSIONS ============
CREATE TABLE public.admissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_no TEXT UNIQUE,
  full_name TEXT NOT NULL,
  gender TEXT, dob DATE,
  previous_school TEXT,
  parent_name TEXT, parent_phone TEXT, parent_email TEXT,
  target_class_id UUID REFERENCES public.classes(id),
  status public.admission_status NOT NULL DEFAULT 'applied',
  notes TEXT,
  reg_fee_paid NUMERIC(12,2) DEFAULT 0,
  interview_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admissions TO authenticated;
GRANT ALL ON public.admissions TO service_role;
ALTER TABLE public.admissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read admissions" ON public.admissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage admissions" ON public.admissions FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin']::public.app_role[]));
CREATE TRIGGER t_admissions_updated BEFORE UPDATE ON public.admissions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ EVENTS (calendar) ============
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL, description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  location TEXT,
  audience public.event_audience NOT NULL DEFAULT 'all',
  class_id UUID REFERENCES public.classes(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read events" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage events" ON public.events FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin','teacher','class_teacher']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin','teacher','class_teacher']::public.app_role[]));
CREATE TRIGGER t_events_updated BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ LEAVE REQUESTS ============
CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL,
  start_date DATE NOT NULL, end_date DATE NOT NULL,
  reason TEXT,
  status public.leave_status NOT NULL DEFAULT 'pending',
  approver_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read leave" ON public.leave_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage leave" ON public.leave_requests FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin']::public.app_role[]));
CREATE TRIGGER t_leave_updated BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ EXPENSES ============
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_no TEXT,
  spent_on DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL,
  payee TEXT,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin read expenses" ON public.expenses FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','accountant']::public.app_role[]));
CREATE POLICY "fin manage expenses" ON public.expenses FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','accountant']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','accountant']::public.app_role[]));
CREATE TRIGGER t_expenses_updated BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ SUPPLIERS + PURCHASE ORDERS ============
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, contact_person TEXT, phone TEXT, email TEXT, address TEXT,
  tax_no TEXT, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage suppliers" ON public.suppliers FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','accountant']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','accountant']::public.app_role[]));
CREATE TRIGGER t_suppliers_updated BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_no TEXT UNIQUE,
  supplier_id UUID REFERENCES public.suppliers(id),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status public.po_status NOT NULL DEFAULT 'draft',
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read po" ON public.purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage po" ON public.purchase_orders FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','accountant']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','accountant']::public.app_role[]));
CREATE TRIGGER t_po_updated BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ INVENTORY ============
CREATE TABLE public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT, name TEXT NOT NULL, category TEXT,
  unit TEXT DEFAULT 'pcs',
  quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  reorder_level NUMERIC(12,2) DEFAULT 0,
  unit_cost NUMERIC(12,2) DEFAULT 0,
  supplier_id UUID REFERENCES public.suppliers(id),
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read inv" ON public.inventory_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "store manage inv" ON public.inventory_items FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','store_officer','accountant']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','store_officer','accountant']::public.app_role[]));
CREATE TRIGGER t_inv_updated BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.inventory_txns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  direction public.inv_direction NOT NULL,
  quantity NUMERIC(12,2) NOT NULL,
  reason TEXT, reference TEXT,
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_txns TO authenticated;
GRANT ALL ON public.inventory_txns TO service_role;
ALTER TABLE public.inventory_txns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read invtx" ON public.inventory_txns FOR SELECT TO authenticated USING (true);
CREATE POLICY "store manage invtx" ON public.inventory_txns FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','store_officer','accountant']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','store_officer','accountant']::public.app_role[]));

-- auto adjust stock
CREATE OR REPLACE FUNCTION public.apply_inv_txn() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.direction IN ('in') THEN
    UPDATE public.inventory_items SET quantity = quantity + NEW.quantity WHERE id = NEW.item_id;
  ELSIF NEW.direction IN ('out','damage','lost') THEN
    UPDATE public.inventory_items SET quantity = quantity - NEW.quantity WHERE id = NEW.item_id;
  ELSIF NEW.direction = 'adjust' THEN
    UPDATE public.inventory_items SET quantity = NEW.quantity WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER t_invtx_apply AFTER INSERT ON public.inventory_txns FOR EACH ROW EXECUTE FUNCTION public.apply_inv_txn();

-- ============ LIBRARY ============
CREATE TABLE public.library_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  isbn TEXT, title TEXT NOT NULL, author TEXT, category TEXT,
  shelf TEXT, copies_total INT NOT NULL DEFAULT 1, copies_available INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_books TO authenticated;
GRANT ALL ON public.library_books TO service_role;
ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read books" ON public.library_books FOR SELECT TO authenticated USING (true);
CREATE POLICY "lib manage books" ON public.library_books FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','librarian']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','librarian']::public.app_role[]));
CREATE TRIGGER t_books_updated BEFORE UPDATE ON public.library_books FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.library_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  pupil_id UUID REFERENCES public.pupils(id),
  staff_id UUID REFERENCES public.staff(id),
  borrowed_on DATE NOT NULL DEFAULT CURRENT_DATE,
  due_on DATE NOT NULL,
  returned_on DATE,
  status public.loan_status NOT NULL DEFAULT 'borrowed',
  fine NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_loans TO authenticated;
GRANT ALL ON public.library_loans TO service_role;
ALTER TABLE public.library_loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read loans" ON public.library_loans FOR SELECT TO authenticated USING (true);
CREATE POLICY "lib manage loans" ON public.library_loans FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','librarian']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','librarian']::public.app_role[]));
CREATE TRIGGER t_loans_updated BEFORE UPDATE ON public.library_loans FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.adjust_book_copies() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'borrowed' THEN
    UPDATE public.library_books SET copies_available = GREATEST(copies_available - 1, 0) WHERE id = NEW.book_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'borrowed' AND NEW.status IN ('returned','lost') THEN
    UPDATE public.library_books SET copies_available = copies_available + 1 WHERE id = NEW.book_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER t_loans_adjust AFTER INSERT OR UPDATE ON public.library_loans FOR EACH ROW EXECUTE FUNCTION public.adjust_book_copies();

-- ============ TRANSPORT ============
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reg_no TEXT NOT NULL UNIQUE, model TEXT, capacity INT, driver_name TEXT, driver_phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read vehicles" ON public.vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY "tx manage vehicles" ON public.vehicles FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','transport_officer']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','transport_officer']::public.app_role[]));
CREATE TRIGGER t_vehicles_updated BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.transport_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, pickup_points TEXT, fee NUMERIC(12,2) DEFAULT 0,
  vehicle_id UUID REFERENCES public.vehicles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_routes TO authenticated;
GRANT ALL ON public.transport_routes TO service_role;
ALTER TABLE public.transport_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read routes" ON public.transport_routes FOR SELECT TO authenticated USING (true);
CREATE POLICY "tx manage routes" ON public.transport_routes FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','transport_officer']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','transport_officer']::public.app_role[]));
CREATE TRIGGER t_routes_updated BEFORE UPDATE ON public.transport_routes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.transport_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pupil_id UUID NOT NULL REFERENCES public.pupils(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES public.transport_routes(id) ON DELETE CASCADE,
  pickup_point TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pupil_id, route_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_assignments TO authenticated;
GRANT ALL ON public.transport_assignments TO service_role;
ALTER TABLE public.transport_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read txassign" ON public.transport_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "tx manage txassign" ON public.transport_assignments FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','transport_officer']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','transport_officer']::public.app_role[]));

-- ============ HEALTH RECORDS ============
CREATE TABLE public.health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pupil_id UUID NOT NULL REFERENCES public.pupils(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  complaint TEXT, diagnosis TEXT, treatment TEXT, medication TEXT,
  notes TEXT, attended_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_records TO authenticated;
GRANT ALL ON public.health_records TO service_role;
ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health read" ON public.health_records FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin','nurse','class_teacher']::public.app_role[]));
CREATE POLICY "health manage" ON public.health_records FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','nurse']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','nurse']::public.app_role[]));
CREATE TRIGGER t_health_updated BEFORE UPDATE ON public.health_records FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ DISCIPLINE ============
CREATE TABLE public.discipline_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pupil_id UUID NOT NULL REFERENCES public.pupils(id) ON DELETE CASCADE,
  kind public.discipline_kind NOT NULL DEFAULT 'incident',
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  action_taken TEXT, points INT DEFAULT 0,
  reported_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discipline_records TO authenticated;
GRANT ALL ON public.discipline_records TO service_role;
ALTER TABLE public.discipline_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read discipline" ON public.discipline_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "teacher manage discipline" ON public.discipline_records FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin','teacher','class_teacher']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin','teacher','class_teacher']::public.app_role[]));
CREATE TRIGGER t_disc_updated BEFORE UPDATE ON public.discipline_records FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ MESSAGES (log) ============
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL DEFAULT 'email', -- email/sms/whatsapp/in_app
  subject TEXT, body TEXT NOT NULL,
  audience TEXT, -- all_parents/class/staff/individual
  class_id UUID REFERENCES public.classes(id),
  recipient_count INT DEFAULT 0,
  sent_by UUID REFERENCES auth.users(id),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read msgs" ON public.messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff manage msgs" ON public.messages FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin','teacher','class_teacher']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin','teacher','class_teacher']::public.app_role[]));

-- ============ DOCUMENTS ============
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL, category TEXT, description TEXT,
  url TEXT NOT NULL,
  pupil_id UUID REFERENCES public.pupils(id),
  staff_id UUID REFERENCES public.staff(id),
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read docs" ON public.documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage docs" ON public.documents FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin']::public.app_role[]));

-- ============ PAYROLL ============
CREATE TABLE public.payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_label TEXT NOT NULL, -- e.g. 'Jun 2026'
  period_start DATE NOT NULL, period_end DATE NOT NULL,
  status public.payroll_status NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (period_label)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_periods TO authenticated;
GRANT ALL ON public.payroll_periods TO service_role;
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin read periods" ON public.payroll_periods FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','accountant']::public.app_role[]));
CREATE POLICY "fin manage periods" ON public.payroll_periods FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','accountant']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','accountant']::public.app_role[]));
CREATE TRIGGER t_periods_updated BEFORE UPDATE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  basic NUMERIC(12,2) NOT NULL DEFAULT 0,
  allowances NUMERIC(12,2) NOT NULL DEFAULT 0,
  deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (period_id, staff_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payslips TO authenticated;
GRANT ALL ON public.payslips TO service_role;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin read payslips" ON public.payslips FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','accountant']::public.app_role[]));
CREATE POLICY "fin manage payslips" ON public.payslips FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','accountant']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','accountant']::public.app_role[]));
CREATE TRIGGER t_payslips_updated BEFORE UPDATE ON public.payslips FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ AUDIT LOGS ============
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL, -- e.g. 'pupil.create','payment.delete'
  entity TEXT,
  entity_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read audit" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin']::public.app_role[]));
CREATE POLICY "auth insert audit" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
