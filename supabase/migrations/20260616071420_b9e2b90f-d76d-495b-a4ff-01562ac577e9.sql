
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('super_admin','head_teacher','deputy_head','admin','accountant','teacher','class_teacher','parent','librarian','store_officer','transport_officer','nurse','security');
CREATE TYPE public.pupil_status AS ENUM ('active','transferred','suspended','graduated','withdrawn');
CREATE TYPE public.staff_status AS ENUM ('active','resigned','terminated','retired','suspended');
CREATE TYPE public.attendance_status AS ENUM ('present','absent','late','sick','excused');
CREATE TYPE public.invoice_status AS ENUM ('unpaid','partial','paid','cancelled');
CREATE TYPE public.payment_method AS ENUM ('cash','bank','mobile_money','card','cheque','online');

-- ============ UPDATED_AT HELPER ============
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles public.app_role[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles))
$$;

CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'head_teacher'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'head_teacher'));

-- ============ AUTO-PROFILE ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.email);
  -- First user becomes super_admin
  IF (SELECT COUNT(*) FROM auth.users) = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ SCHOOL SETTINGS ============
CREATE TABLE public.school_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name TEXT NOT NULL DEFAULT 'My Primary School',
  motto TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  current_academic_year_id UUID,
  current_term_id UUID,
  grading_scale JSONB NOT NULL DEFAULT '[{"min":90,"max":100,"grade":"A","label":"Excellent"},{"min":75,"max":89,"grade":"B","label":"Very Good"},{"min":60,"max":74,"grade":"C","label":"Good"},{"min":50,"max":59,"grade":"D","label":"Pass"},{"min":0,"max":49,"grade":"E","label":"Needs Improvement"}]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.school_settings (id) VALUES (1);
GRANT SELECT ON public.school_settings TO authenticated;
GRANT ALL ON public.school_settings TO service_role;
ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_read_all" ON public.school_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_admin_write" ON public.school_settings FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin']::public.app_role[]));

-- ============ ACADEMIC STRUCTURE ============
CREATE TABLE public.academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_years TO authenticated;
GRANT ALL ON public.academic_years TO service_role;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ay_read" ON public.academic_years FOR SELECT TO authenticated USING (true);
CREATE POLICY "ay_admin" ON public.academic_years FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin']::public.app_role[]));

CREATE TABLE public.terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID NOT NULL REFERENCES public.academic_years ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.terms TO authenticated;
GRANT ALL ON public.terms TO service_role;
ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "term_read" ON public.terms FOR SELECT TO authenticated USING (true);
CREATE POLICY "term_admin" ON public.terms FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin']::public.app_role[]));

CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  stream TEXT,
  level_order INT NOT NULL DEFAULT 0,
  class_teacher_id UUID,
  capacity INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(name, stream)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "class_read" ON public.classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "class_admin" ON public.classes FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin']::public.app_role[]));

CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subj_read" ON public.subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "subj_admin" ON public.subjects FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin']::public.app_role[]));

-- ============ STAFF ============
CREATE TABLE public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  staff_no TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  gender TEXT,
  dob DATE,
  email TEXT,
  phone TEXT,
  address TEXT,
  qualifications TEXT,
  employment_type TEXT,
  date_joined DATE,
  basic_salary NUMERIC(12,2) DEFAULT 0,
  bank_name TEXT,
  bank_account TEXT,
  next_of_kin TEXT,
  status public.staff_status NOT NULL DEFAULT 'active',
  is_teacher BOOLEAN NOT NULL DEFAULT false,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff TO authenticated;
GRANT ALL ON public.staff TO service_role;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_read" ON public.staff FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff_admin" ON public.staff FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin']::public.app_role[]));
CREATE TRIGGER trg_staff_updated BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.classes ADD CONSTRAINT classes_teacher_fk FOREIGN KEY (class_teacher_id) REFERENCES public.staff(id) ON DELETE SET NULL;

CREATE TABLE public.teacher_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.staff ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes ON DELETE CASCADE,
  UNIQUE(teacher_id, subject_id, class_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_subjects TO authenticated;
GRANT ALL ON public.teacher_subjects TO service_role;
ALTER TABLE public.teacher_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ts_read" ON public.teacher_subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "ts_admin" ON public.teacher_subjects FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin']::public.app_role[]));

-- ============ GUARDIANS / PARENTS ============
CREATE TABLE public.guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  relationship TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  occupation TEXT,
  national_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guardians TO authenticated;
GRANT ALL ON public.guardians TO service_role;
ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guardian_read_staff" ON public.guardians FOR SELECT TO authenticated USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin','accountant','teacher','class_teacher']::public.app_role[])
  OR user_id = auth.uid()
);
CREATE POLICY "guardian_admin" ON public.guardians FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin']::public.app_role[]));
CREATE TRIGGER trg_guardians_updated BEFORE UPDATE ON public.guardians FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ PUPILS ============
CREATE TABLE public.pupils (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_no TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  gender TEXT,
  dob DATE,
  class_id UUID REFERENCES public.classes ON DELETE SET NULL,
  previous_school TEXT,
  emergency_contact TEXT,
  medical_info TEXT,
  allergies TEXT,
  special_needs TEXT,
  photo_url TEXT,
  status public.pupil_status NOT NULL DEFAULT 'active',
  admitted_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pupils TO authenticated;
GRANT ALL ON public.pupils TO service_role;
ALTER TABLE public.pupils ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pupil_staff_read" ON public.pupils FOR SELECT TO authenticated USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin','accountant','teacher','class_teacher','nurse','librarian','transport_officer']::public.app_role[])
);
CREATE POLICY "pupil_admin" ON public.pupils FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin']::public.app_role[]));
CREATE TRIGGER trg_pupils_updated BEFORE UPDATE ON public.pupils FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.guardian_pupils (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id UUID NOT NULL REFERENCES public.guardians ON DELETE CASCADE,
  pupil_id UUID NOT NULL REFERENCES public.pupils ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(guardian_id, pupil_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guardian_pupils TO authenticated;
GRANT ALL ON public.guardian_pupils TO service_role;
ALTER TABLE public.guardian_pupils ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gp_read" ON public.guardian_pupils FOR SELECT TO authenticated USING (true);
CREATE POLICY "gp_admin" ON public.guardian_pupils FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin']::public.app_role[]));

-- Parent self-read pupils linked to them
CREATE POLICY "pupil_parent_read" ON public.pupils FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.guardian_pupils gp JOIN public.guardians g ON g.id = gp.guardian_id
          WHERE gp.pupil_id = pupils.id AND g.user_id = auth.uid())
);

-- ============ ATTENDANCE ============
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pupil_id UUID NOT NULL REFERENCES public.pupils ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes ON DELETE SET NULL,
  date DATE NOT NULL,
  status public.attendance_status NOT NULL DEFAULT 'present',
  notes TEXT,
  recorded_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pupil_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "att_staff_all" ON public.attendance FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin','teacher','class_teacher']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin','teacher','class_teacher']::public.app_role[]));
CREATE POLICY "att_parent_read" ON public.attendance FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.guardian_pupils gp JOIN public.guardians g ON g.id = gp.guardian_id
          WHERE gp.pupil_id = attendance.pupil_id AND g.user_id = auth.uid())
);

-- ============ FEES ============
CREATE TABLE public.fee_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  class_id UUID REFERENCES public.classes ON DELETE SET NULL,
  term_id UUID REFERENCES public.terms ON DELETE SET NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_items TO authenticated;
GRANT ALL ON public.fee_items TO service_role;
ALTER TABLE public.fee_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fee_item_read" ON public.fee_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "fee_item_admin" ON public.fee_items FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','accountant']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','accountant']::public.app_role[]));

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no TEXT UNIQUE NOT NULL,
  pupil_id UUID NOT NULL REFERENCES public.pupils ON DELETE CASCADE,
  term_id UUID REFERENCES public.terms ON DELETE SET NULL,
  description TEXT,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  status public.invoice_status NOT NULL DEFAULT 'unpaid',
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_staff" ON public.invoices FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','accountant']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','accountant']::public.app_role[]));
CREATE POLICY "inv_parent_read" ON public.invoices FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.guardian_pupils gp JOIN public.guardians g ON g.id = gp.guardian_id
          WHERE gp.pupil_id = invoices.pupil_id AND g.user_id = auth.uid())
);
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_no TEXT UNIQUE NOT NULL,
  invoice_id UUID REFERENCES public.invoices ON DELETE SET NULL,
  pupil_id UUID NOT NULL REFERENCES public.pupils ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  method public.payment_method NOT NULL DEFAULT 'cash',
  reference TEXT,
  paid_on DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_by UUID REFERENCES auth.users,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pay_staff" ON public.payments FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','accountant']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','admin','accountant']::public.app_role[]));
CREATE POLICY "pay_parent_read" ON public.payments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.guardian_pupils gp JOIN public.guardians g ON g.id = gp.guardian_id
          WHERE gp.pupil_id = payments.pupil_id AND g.user_id = auth.uid())
);

-- Update invoice on payment
CREATE OR REPLACE FUNCTION public.recalc_invoice() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_paid NUMERIC; v_total NUMERIC; v_inv UUID;
BEGIN
  v_inv := COALESCE(NEW.invoice_id, OLD.invoice_id);
  IF v_inv IS NULL THEN RETURN NEW; END IF;
  SELECT COALESCE(SUM(amount),0) INTO v_paid FROM public.payments WHERE invoice_id = v_inv;
  SELECT total INTO v_total FROM public.invoices WHERE id = v_inv;
  UPDATE public.invoices SET paid = v_paid,
    status = CASE WHEN v_paid <= 0 THEN 'unpaid'::public.invoice_status
                  WHEN v_paid < v_total THEN 'partial'::public.invoice_status
                  ELSE 'paid'::public.invoice_status END
    WHERE id = v_inv;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_payment_recalc AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.recalc_invoice();

-- ============ EXAMS / MARKS ============
CREATE TABLE public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  term_id UUID REFERENCES public.terms ON DELETE SET NULL,
  exam_date DATE,
  out_of NUMERIC(6,2) NOT NULL DEFAULT 100,
  weight NUMERIC(5,2) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exams TO authenticated;
GRANT ALL ON public.exams TO service_role;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exam_read" ON public.exams FOR SELECT TO authenticated USING (true);
CREATE POLICY "exam_admin" ON public.exams FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin','teacher','class_teacher']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin','teacher','class_teacher']::public.app_role[]));

CREATE TABLE public.marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams ON DELETE CASCADE,
  pupil_id UUID NOT NULL REFERENCES public.pupils ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects ON DELETE CASCADE,
  score NUMERIC(6,2) NOT NULL,
  comment TEXT,
  entered_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(exam_id, pupil_id, subject_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marks TO authenticated;
GRANT ALL ON public.marks TO service_role;
ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marks_staff" ON public.marks FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin','teacher','class_teacher']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin','teacher','class_teacher']::public.app_role[]));
CREATE POLICY "marks_parent_read" ON public.marks FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.guardian_pupils gp JOIN public.guardians g ON g.id = gp.guardian_id
          WHERE gp.pupil_id = marks.pupil_id AND g.user_id = auth.uid())
);
CREATE TRIGGER trg_marks_updated BEFORE UPDATE ON public.marks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ HOMEWORK ============
CREATE TABLE public.homework (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  class_id UUID REFERENCES public.classes ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects ON DELETE SET NULL,
  due_date DATE,
  assigned_by UUID REFERENCES auth.users,
  attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homework TO authenticated;
GRANT ALL ON public.homework TO service_role;
ALTER TABLE public.homework ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hw_read" ON public.homework FOR SELECT TO authenticated USING (true);
CREATE POLICY "hw_admin" ON public.homework FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin','teacher','class_teacher']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin','teacher','class_teacher']::public.app_role[]));

-- ============ TIMETABLE ============
CREATE TABLE public.timetable_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects ON DELETE SET NULL,
  teacher_id UUID REFERENCES public.staff ON DELETE SET NULL,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timetable_slots TO authenticated;
GRANT ALL ON public.timetable_slots TO service_role;
ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tt_read" ON public.timetable_slots FOR SELECT TO authenticated USING (true);
CREATE POLICY "tt_admin" ON public.timetable_slots FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin']::public.app_role[]));

-- ============ ANNOUNCEMENTS ============
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all',
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ann_read" ON public.announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "ann_admin" ON public.announcements FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','head_teacher','deputy_head','admin']::public.app_role[]));
