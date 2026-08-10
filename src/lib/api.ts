const BASE_URL = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/$/, "");

function getToken(): string | null {
  return localStorage.getItem("bm_token");
}

export function setToken(token: string) {
  localStorage.setItem("bm_token", token);
}

export function clearToken() {
  localStorage.removeItem("bm_token");
  localStorage.removeItem("bm_user");
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem("bm_user");
  return raw ? JSON.parse(raw) : null;
}

export function setStoredUser(user: AuthUser) {
  localStorage.setItem("bm_user", JSON.stringify(user));
}

export interface AuthUser {
  userId: string;
  email: string;
  fullName: string;
  roles: string[];
  token: string;
  mustChangePassword?: boolean;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  const token = getToken();
  const url = new URL(BASE_URL + path, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? "Request failed");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

const get = <T>(path: string, params?: Record<string, string | number | boolean | undefined>) =>
  request<T>("GET", path, undefined, params);
const post = <T>(path: string, body?: unknown) => request<T>("POST", path, body);
const put = <T>(path: string, body?: unknown) => request<T>("PUT", path, body);
const patch = <T>(path: string, body?: unknown) => request<T>("PATCH", path, body);
const del = (path: string) => request<void>("DELETE", path);

// Auth
export const api = {
  auth: {
    login: (email: string, password: string) =>
      post<AuthUser & { token: string }>("/auth/login", { email, password }),
    register: (data: { email: string; password: string; fullName: string; roles?: string[] }) =>
      post<AuthUser & { token: string }>("/auth/register", data),
    changePassword: (password: string) =>
      post<void>("/auth/change-password", { password }),
  },

  dashboard: {
    get: () => get<DashboardData>("/dashboard"),
  },

  pupils: {
    list: (q?: string, page = 0, size = 50) => get<PageResponse<Pupil>>("/pupils", { q, page, size }),
    all: () => get<Pupil[]>("/pupils/all"),
    byClass: (classId: string) => get<Pupil[]>(`/pupils/class/${classId}`),
    get: (id: string) => get<Pupil>(`/pupils/${id}`),
    create: (data: Partial<Pupil>) => post<Pupil>("/pupils", data),
    update: (id: string, data: Partial<Pupil>) => put<Pupil>(`/pupils/${id}`, data),
    delete: (id: string) => del(`/pupils/${id}`),
  },

  staff: {
    list: (q?: string, page = 0, size = 50) => get<PageResponse<Staff>>("/staff", { q, page, size }),
    all: () => get<Staff[]>("/staff/all"),
    teachers: () => get<Staff[]>("/staff/teachers"),
    me: () => get<Staff | null>("/staff/me"),
    get: (id: string) => get<Staff>(`/staff/${id}`),
    create: (data: Partial<Staff>) => post<Staff>("/staff", data),
    update: (id: string, data: Partial<Staff>) => put<Staff>(`/staff/${id}`, data),
    delete: (id: string) => del(`/staff/${id}`),
  },

  classes: {
    list: () => get<SchoolClass[]>("/classes"),
    myClasses: () => get<SchoolClass[]>("/classes/my"),
    get: (id: string) => get<SchoolClass>(`/classes/${id}`),
    create: (data: Partial<SchoolClass>) => post<SchoolClass>("/classes", data),
    update: (id: string, data: Partial<SchoolClass>) => put<SchoolClass>(`/classes/${id}`, data),
    delete: (id: string) => del(`/classes/${id}`),
  },

  subjects: {
    list: () => get<Subject[]>("/subjects"),
    create: (data: { name: string; code?: string }) => post<Subject>("/subjects", data),
    update: (id: string, data: { name: string; code?: string }) => put<Subject>(`/subjects/${id}`, data),
    delete: (id: string) => del(`/subjects/${id}`),
  },

  academicYears: {
    list: () => get<AcademicYear[]>("/academic-years"),
    create: (data: Partial<AcademicYear>) => post<AcademicYear>("/academic-years", data),
    delete: (id: string) => del(`/academic-years/${id}`),
    terms: {
      list: (yearId: string) => get<Term[]>(`/academic-years/${yearId}/terms`),
      all: () => get<Term[]>("/academic-years/terms"),
      create: (yearId: string, data: Partial<Term>) => post<Term>(`/academic-years/${yearId}/terms`, data),
      delete: (id: string) => del(`/academic-years/terms/${id}`),
    },
  },

  attendance: {
    list: (date: string, classId?: string) => get<Attendance[]>("/attendance", { date, classId }),
    byPupil: (pupilId: string, from: string, to: string) =>
      get<Attendance[]>(`/attendance/pupil/${pupilId}`, { from, to }),
    create: (data: Partial<Attendance>) => post<Attendance>("/attendance", data),
    bulkCreate: (data: Partial<Attendance>[]) => post<Attendance[]>("/attendance/bulk", data),
    update: (id: string, data: Partial<Attendance>) => put<Attendance>(`/attendance/${id}`, data),
  },

  exams: {
    list: (termId?: string) => get<Exam[]>("/exams", { termId }),
    get: (id: string) => get<Exam>(`/exams/${id}`),
    create: (data: Partial<Exam>) => post<Exam>("/exams", data),
    update: (id: string, data: Partial<Exam>) => put<Exam>(`/exams/${id}`, data),
    delete: (id: string) => del(`/exams/${id}`),
    marks: {
      list: (examId: string) => get<Mark[]>(`/exams/${examId}/marks`),
      save: (examId: string, data: { pupilId: string; subjectId: string; score: number; comment?: string }) =>
        post<Mark>(`/exams/${examId}/marks`, data),
    },
  },

  fees: {
    items: {
      list: () => get<FeeItem[]>("/fees/items"),
      create: (data: Partial<FeeItem>) => post<FeeItem>("/fees/items", data),
      update: (id: string, data: Partial<FeeItem>) => put<FeeItem>(`/fees/items/${id}`, data),
      delete: (id: string) => del(`/fees/items/${id}`),
    },
    invoices: {
      list: (pupilId?: string, termId?: string) => get<Invoice[]>("/fees/invoices", { pupilId, termId }),
      get: (id: string) => get<Invoice>(`/fees/invoices/${id}`),
      create: (data: Partial<Invoice>) => post<Invoice>("/fees/invoices", data),
      bulkCreate: (data: Partial<Invoice>[]) => post<Invoice[]>("/fees/invoices/bulk", data),
    },
    payments: {
      list: (pupilId?: string, invoiceId?: string) => get<Payment[]>("/fees/payments", { pupilId, invoiceId }),
      create: (data: Partial<Payment>) => post<Payment>("/fees/payments", data),
    },
  },

  announcements: {
    list: () => get<Announcement[]>("/announcements"),
    create: (data: { title: string; body: string; audience?: string }) => post<Announcement>("/announcements", data),
    update: (id: string, data: Partial<Announcement>) => put<Announcement>(`/announcements/${id}`, data),
    delete: (id: string) => del(`/announcements/${id}`),
  },

  events: {
    list: () => get<CalendarEvent[]>("/events"),
    create: (data: Partial<CalendarEvent>) => post<CalendarEvent>("/events", data),
    update: (id: string, data: Partial<CalendarEvent>) => put<CalendarEvent>(`/events/${id}`, data),
    delete: (id: string) => del(`/events/${id}`),
  },

  homework: {
    list: (classId?: string) => get<Homework[]>("/homework", { classId }),
    create: (data: Partial<Homework>) => post<Homework>("/homework", data),
    update: (id: string, data: Partial<Homework>) => put<Homework>(`/homework/${id}`, data),
    delete: (id: string) => del(`/homework/${id}`),
  },

  admissions: {
    list: (status?: string) => get<Admission[]>("/admissions", { status }),
    get: (id: string) => get<Admission>(`/admissions/${id}`),
    create: (data: Partial<Admission>) => post<Admission>("/admissions", data),
    update: (id: string, data: Partial<Admission>) => put<Admission>(`/admissions/${id}`, data),
    updateStatus: (id: string, status: string) =>
      patch<Admission>(`/admissions/${id}/status?status=${status}`),
    delete: (id: string) => del(`/admissions/${id}`),
  },

  guardians: {
    list: () => get<Guardian[]>("/guardians"),
    byPupil: (pupilId: string) => get<Guardian[]>(`/guardians/pupil/${pupilId}`),
    get: (id: string) => get<Guardian>(`/guardians/${id}`),
    me: () => get<Guardian | null>("/guardians/me"),
    dashboard: () => get<ParentDashboard | null>("/guardians/me/dashboard"),
    myPupils: () => get<Pupil[]>("/guardians/me/pupils"),
    myInvoices: () => get<Invoice[]>("/guardians/me/invoices"),
    myAttendance: (from: string, to: string) => get<Attendance[]>("/guardians/me/attendance", { from, to }),
    myMarks: (examId: string) => get<Mark[]>("/guardians/me/marks", { examId }),
    childAttendance: (pupilId: string, from: string, to: string) =>
      get<Attendance[]>(`/guardians/me/pupils/${pupilId}/attendance`, { from, to }),
    childReportCards: (pupilId: string) =>
      get<ParentReportCard[]>(`/guardians/me/pupils/${pupilId}/report-cards`),
    create: (data: Partial<Guardian>) => post<Guardian>("/guardians", data),
    update: (id: string, data: Partial<Guardian>) => put<Guardian>(`/guardians/${id}`, data),
    delete: (id: string) => del(`/guardians/${id}`),
    link: (guardianId: string, pupilId: string, isPrimary = false) =>
      post(`/guardians/${guardianId}/pupils/${pupilId}?isPrimary=${isPrimary}`),
    unlink: (guardianId: string, pupilId: string) =>
      del(`/guardians/${guardianId}/pupils/${pupilId}`),
    provisionAccount: (guardianId: string, temporaryPassword: string) =>
      post<Guardian>(`/guardians/${guardianId}/account`, { temporaryPassword }),
  },

  promotions: {
    create: (data: PromotionRequest) => post<PromotionResult>("/promotions", data),
    history: (pupilId: string) => get<PromotionRecord[]>(`/promotions/history/${pupilId}`),
  },

  health: {
    list: (pupilId?: string) => get<HealthRecord[]>("/health", { pupilId }),
    create: (data: Partial<HealthRecord>) => post<HealthRecord>("/health", data),
    update: (id: string, data: Partial<HealthRecord>) => put<HealthRecord>(`/health/${id}`, data),
    delete: (id: string) => del(`/health/${id}`),
  },

  discipline: {
    list: (pupilId?: string) => get<DisciplineRecord[]>("/discipline", { pupilId }),
    create: (data: Partial<DisciplineRecord>) => post<DisciplineRecord>("/discipline", data),
    delete: (id: string) => del(`/discipline/${id}`),
  },

  library: {
    books: {
      list: (q?: string) => get<LibraryBook[]>("/library/books", { q }),
      get: (id: string) => get<LibraryBook>(`/library/books/${id}`),
      create: (data: Partial<LibraryBook>) => post<LibraryBook>("/library/books", data),
      update: (id: string, data: Partial<LibraryBook>) => put<LibraryBook>(`/library/books/${id}`, data),
      delete: (id: string) => del(`/library/books/${id}`),
    },
    loans: {
      list: (status?: string) => get<LibraryLoan[]>("/library/loans", { status }),
      create: (data: Partial<LibraryLoan>) => post<LibraryLoan>("/library/loans", data),
      return: (id: string) => patch<LibraryLoan>(`/library/loans/${id}/return`),
    },
  },

  inventory: {
    items: {
      list: () => get<InventoryItem[]>("/inventory/items"),
      lowStock: () => get<InventoryItem[]>("/inventory/items/low-stock"),
      create: (data: Partial<InventoryItem>) => post<InventoryItem>("/inventory/items", data),
      update: (id: string, data: Partial<InventoryItem>) => put<InventoryItem>(`/inventory/items/${id}`, data),
      delete: (id: string) => del(`/inventory/items/${id}`),
    },
    transactions: {
      list: () => get<InventoryTxn[]>("/inventory/transactions"),
      create: (data: Partial<InventoryTxn>) => post<InventoryTxn>("/inventory/transactions", data),
    },
  },

  transport: {
    vehicles: {
      list: () => get<Vehicle[]>("/transport/vehicles"),
      create: (data: Partial<Vehicle>) => post<Vehicle>("/transport/vehicles", data),
      delete: (id: string) => del(`/transport/vehicles/${id}`),
    },
    routes: {
      list: () => get<TransportRoute[]>("/transport/routes"),
      create: (data: Partial<TransportRoute>) => post<TransportRoute>("/transport/routes", data),
      delete: (id: string) => del(`/transport/routes/${id}`),
    },
    assignments: {
      list: (routeId?: string) => get<TransportAssignment[]>("/transport/assignments", { routeId }),
      create: (data: { pupilId: string; routeId: string; pickupPoint?: string }) =>
        post<TransportAssignment>("/transport/assignments", data),
      delete: (id: string) => del(`/transport/assignments/${id}`),
    },
  },

  canteen: {
    menu: {
      list: () => get<CanteenMenuItem[]>("/canteen/menu"),
      create: (data: Partial<CanteenMenuItem>) => post<CanteenMenuItem>("/canteen/menu", data),
      update: (id: string, data: Partial<CanteenMenuItem>) => put<CanteenMenuItem>(`/canteen/menu/${id}`, data),
      delete: (id: string) => del(`/canteen/menu/${id}`),
    },
    plans: {
      list: () => get<CanteenMealPlan[]>("/canteen/plans"),
      create: (data: Partial<CanteenMealPlan>) => post<CanteenMealPlan>("/canteen/plans", data),
      delete: (id: string) => del(`/canteen/plans/${id}`),
    },
    sales: {
      list: (date?: string) => get<CanteenSale[]>("/canteen/sales", { date }),
      create: (data: Partial<CanteenSale>) => post<CanteenSale>("/canteen/sales", data),
      delete: (id: string) => del(`/canteen/sales/${id}`),
    },
    subscriptions: {
      list: (pupilId?: string) => get<CanteenSubscription[]>("/canteen/subscriptions", { pupilId }),
      create: (data: { pupilId: string; planId: string; termId?: string }) =>
        post<CanteenSubscription>("/canteen/subscriptions", data),
      cancel: (id: string) => patch<CanteenSubscription>(`/canteen/subscriptions/${id}/cancel`),
    },
  },

  leave: {
    list: (staffId?: string, status?: string) => get<LeaveRequest[]>("/leave", { staffId, status }),
    create: (data: Partial<LeaveRequest>) => post<LeaveRequest>("/leave", data),
    approve: (id: string) => patch<LeaveRequest>(`/leave/${id}/approve`),
    reject: (id: string) => patch<LeaveRequest>(`/leave/${id}/reject`),
    delete: (id: string) => del(`/leave/${id}`),
  },

  payroll: {
    periods: {
      list: () => get<PayrollPeriod[]>("/payroll/periods"),
      create: (data: Partial<PayrollPeriod>) => post<PayrollPeriod>("/payroll/periods", data),
      approve: (id: string) => patch<PayrollPeriod>(`/payroll/periods/${id}/approve`),
      markPaid: (id: string) => patch<PayrollPeriod>(`/payroll/periods/${id}/mark-paid`),
    },
    payslips: {
      list: (periodId?: string, staffId?: string) =>
        get<Payslip[]>("/payroll/payslips", { periodId, staffId }),
      create: (data: Partial<Payslip>) => post<Payslip>("/payroll/payslips", data),
    },
  },

  procurement: {
    suppliers: {
      list: () => get<Supplier[]>("/procurement/suppliers"),
      create: (data: Partial<Supplier>) => post<Supplier>("/procurement/suppliers", data),
      update: (id: string, data: Partial<Supplier>) => put<Supplier>(`/procurement/suppliers/${id}`, data),
      delete: (id: string) => del(`/procurement/suppliers/${id}`),
    },
    orders: {
      list: () => get<PurchaseOrder[]>("/procurement/orders"),
      create: (data: Partial<PurchaseOrder>) => post<PurchaseOrder>("/procurement/orders", data),
      updateStatus: (id: string, status: string) =>
        patch<PurchaseOrder>(`/procurement/orders/${id}/status?status=${status}`),
      delete: (id: string) => del(`/procurement/orders/${id}`),
    },
  },

  accounts: {
    expenses: {
      list: (from?: string, to?: string) => get<Expense[]>("/accounts/expenses", { from, to }),
      create: (data: Partial<Expense>) => post<Expense>("/accounts/expenses", data),
      update: (id: string, data: Partial<Expense>) => put<Expense>(`/accounts/expenses/${id}`, data),
      delete: (id: string) => del(`/accounts/expenses/${id}`),
    },
  },

  communication: {
    messages: {
      list: () => get<Message[]>("/communication"),
      send: (data: { body: string; subject?: string; channel?: string; audience?: string; classId?: string }) =>
        post<Message>("/communication", data),
    },
  },

  timetable: {
    list: (classId?: string) => get<TimetableSlot[]>("/timetable", { classId }),
    create: (data: Partial<TimetableSlot>) => post<TimetableSlot>("/timetable", data),
    delete: (id: string) => del(`/timetable/${id}`),
  },

  settings: {
    get: () => get<SchoolSettings>("/settings"),
    update: (data: Partial<SchoolSettings>) => put<SchoolSettings>("/settings", data),
  },

  users: {
    list: () => get<AppUser[]>("/admin/users"),
    create: (data: { email: string; password: string; fullName: string; roles: string[] }) =>
      post<AppUser>("/admin/users", data),
    delete: (id: string) => del(`/admin/users/${id}`),
    resetPassword: (id: string, password: string) =>
      post(`/admin/users/${id}/reset-password`, { password }),
    updateRoles: (id: string, roles: string[]) =>
      put<AppUser>(`/admin/users/${id}/roles`, { roles }),
  },

  documents: {
    list: () => get<SchoolDocument[]>("/documents"),
    create: (data: Partial<SchoolDocument>) => post<SchoolDocument>("/documents", data),
    delete: (id: string) => del(`/documents/${id}`),
  },

  reports: {
    get: () => get<ReportData>("/reports/summary"),
  },

  admin: {
    backup: () => get<Record<string, unknown>>("/admin/backup"),
  },

  roles: {
    list: () => get<SystemRole[]>("/admin/roles"),
    create: (data: { name: string; description?: string }) => post<SystemRole>("/admin/roles", data),
    update: (id: string, data: { description?: string }) => put<SystemRole>(`/admin/roles/${id}`, data),
    delete: (id: string) => del(`/admin/roles/${id}`),
    setPermissions: (id: string, permissionIds: string[]) => put<SystemRole>(`/admin/roles/${id}/permissions`, permissionIds),
    permissions: {
      list: () => get<SystemPermission[]>("/admin/roles/permissions"),
      create: (data: { name: string; description?: string; module?: string }) => post<SystemPermission>("/admin/roles/permissions", data),
      delete: (id: string) => del(`/admin/roles/permissions/${id}`),
    },
  },

  audit: {
    list: (page = 0, size = 50, entity?: string) =>
      get<PageResponse<AuditLogEntry>>("/admin/audit", { page, size, entity }),
  },

  ptc: {
    sessions: {
      list: () => get<PtcSession[]>("/ptc/sessions"),
      create: (data: Partial<PtcSession> & { termId?: string }) => post<PtcSession>("/ptc/sessions", data),
      update: (id: string, data: Partial<PtcSession> & { termId?: string }) => put<PtcSession>(`/ptc/sessions/${id}`, data),
      delete: (id: string) => del(`/ptc/sessions/${id}`),
    },
    meetings: {
      list: (sessionId?: string) => get<PtcMeeting[]>("/ptc/meetings", sessionId ? { sessionId } : {}),
      my: () => get<PtcMeeting[]>("/ptc/meetings/my"),
      me: () => get<PtcMeeting[]>("/ptc/meetings/me"),
      create: (data: {
        sessionId?: string; staffId: string; guardianId: string; pupilId?: string;
        meetingDate: string; startTime: string; endTime?: string; venue?: string; agenda?: string;
      }) => post<PtcMeeting>("/ptc/meetings", data),
      update: (id: string, data: {
        status?: string; teacherNotes?: string; adminNotes?: string;
        agenda?: string; venue?: string; meetingDate?: string; startTime?: string; endTime?: string;
      }) => put<PtcMeeting>(`/ptc/meetings/${id}`, data),
      delete: (id: string) => del(`/ptc/meetings/${id}`),
    },
  },
};

// ─── Types ───────────────────────────────────────────────────────
export interface PageResponse<T> { content: T[]; page: number; size: number; totalElements: number; totalPages: number; }
export interface DashboardData { totalPupils: number; activeStaff: number; totalClasses: number; presentToday: number; collectedThisMonth: number; recentAnnouncements: { id: string; title: string; createdAt: string }[]; }
export interface Pupil { id: string; admissionNo: string; fullName: string; gender?: string; dob?: string; status: string; schoolClass?: SchoolClass; classId?: string; address?: string; phone?: string; photoUrl?: string; bloodGroup?: string; allergies?: string; medicalInfo?: string; }
export interface Staff { id: string; staffNo: string; fullName: string; gender?: string; email?: string; phone?: string; isTeacher: boolean; status: string; basicSalary?: number; photoUrl?: string; employmentType?: string; }
export interface SchoolClass { id: string; name: string; stream?: string; levelOrder: number; capacity?: number; classTeacher?: Staff; classTeacherId?: string; }
export interface Subject { id: string; name: string; code?: string; }
export interface AcademicYear { id: string; name: string; startDate: string; endDate: string; isCurrent: boolean; }
export interface Term { id: string; name: string; startDate: string; endDate: string; isCurrent: boolean; academicYear?: AcademicYear; }
export interface Attendance { id: string; pupil: Pupil; pupilId?: string; date: string; status: string; classId?: string; notes?: string; }
export type AssessmentType = "MID_TERM" | "END_OF_TERM" | "MOCK" | "OPENER" | "OTHER";
export interface Exam { id: string; name: string; termId?: string; assessmentType?: AssessmentType; examDate?: string; outOf: number; weight: number; }
export interface Mark { id: string; pupil: Pupil; exam: Exam; subject: Subject; score: number; comment?: string; }
export interface FeeItem { id: string; name: string; category: string; amount: number; classId?: string; termId?: string; isRecurring: boolean; schoolClass?: SchoolClass; term?: Term; }
export interface Invoice { id: string; invoiceNo: string; pupil: Pupil; pupilId?: string; total: number; paid: number; status: string; dueDate?: string; description?: string; createdAt?: string; termId?: string; }
export interface Payment { id: string; receiptNo: string; pupil?: Pupil; pupilId?: string; invoice?: Invoice; invoiceId?: string; amount: number; method: string; paidOn: string; reference?: string; }
export interface Announcement { id: string; title: string; body: string; audience: string; createdAt: string; }
export interface CalendarEvent { id: string; title: string; description?: string; startsAt: string; endsAt?: string; location?: string; audience: string; }
export interface Homework { id: string; title: string; description?: string; schoolClass?: SchoolClass; classId?: string; subject?: Subject; subjectId?: string; dueDate?: string; attachmentUrl?: string; }
export interface Admission { id: string; applicationNo?: string; fullName: string; gender?: string; dob?: string; status: string; parentName?: string; parentPhone?: string; parentEmail?: string; previousSchool?: string; targetClassId?: string; targetClass?: SchoolClass; notes?: string; interviewDate?: string; regFeePaid?: boolean; }
export interface Guardian { id: string; fullName: string; relationship?: string; phone?: string; email?: string; userId?: string; temporaryPassword?: string; }
export interface ParentTeacher { id: string; staffNo: string; fullName: string; email?: string; phone?: string; }
export interface ParentClassInfo { id: string; name: string; stream?: string; levelOrder: number; classTeacher?: ParentTeacher; }
export interface AttendanceSummary { from: string; to: string; total: number; present: number; absent: number; late: number; sick: number; excused: number; percentage: number; }
export interface PerformanceSummary { examId: string; examName: string; termName?: string; academicYearName?: string; averagePercentage: number; grade: string; }
export interface ParentChildSummary { id: string; admissionNo: string; fullName: string; gender?: string; dateOfBirth?: string; status: string; schoolClass?: ParentClassInfo; attendance: AttendanceSummary; latestPerformance?: PerformanceSummary; reportCardCount: number; }
export interface ParentDashboard { guardian: Guardian; children: ParentChildSummary[]; }
export interface ParentSubjectResult { subjectId: string; subjectName: string; score: number; outOf: number; percentage: number; grade: string; comment?: string; }
export interface ParentReportCard { pupilId: string; pupilName: string; admissionNo: string; examId: string; examName: string; assessmentType?: string; examDate?: string; termId?: string; termName?: string; academicYearId?: string; academicYearName?: string; schoolClass?: ParentClassInfo; subjects: ParentSubjectResult[]; totalScore: number; totalOutOf: number; averagePercentage: number; overallGrade: string; attendance: AttendanceSummary; }
export interface PromotionRequest { pupilIds: string[]; targetClassId: string; academicYearId?: string; promotedOn?: string; notes?: string; }
export interface PromotionRecord { id: string; pupilId: string; pupilName: string; fromClassId: string; fromClassName: string; toClassId: string; toClassName: string; academicYearId?: string; academicYearName?: string; promotedOn: string; notes?: string; }
export interface PromotionResult { promotedCount: number; promotions: PromotionRecord[]; }
export interface HealthRecord { id: string; pupil: Pupil; visitDate: string; complaint?: string; diagnosis?: string; treatment?: string; medication?: string; attendedBy?: string; notes?: string; }
export interface DisciplineRecord { id: string; pupil: Pupil; kind: string; description: string; actionTaken?: string; occurredOn: string; points?: number; }
export interface LibraryBook { id: string; title: string; author?: string; isbn?: string; category?: string; shelf?: string; copiesTotal: number; copiesAvailable: number; }
export interface LibraryLoan { id: string; book: LibraryBook; pupil?: Pupil; borrowedOn: string; dueOn: string; returnedOn?: string; status: string; }
export interface InventoryItem { id: string; name: string; category?: string; sku?: string; unit?: string; location?: string; quantity: number; reorderLevel?: number; unitCost?: number; }
export interface InventoryTxn { id: string; item: InventoryItem; direction: string; quantity: number; reason?: string; occurredOn: string; }
export interface Vehicle { id: string; regNo: string; model?: string; capacity?: number; driverName?: string; driverPhone?: string; notes?: string; }
export interface TransportRoute { id: string; name: string; pickupPoints?: string; vehicle?: Vehicle; fee?: number; }
export interface TransportAssignment { id: string; pupil: Pupil; route: TransportRoute; pickupPoint?: string; active: boolean; }
export interface CanteenMenuItem { id: string; name: string; description?: string; category: string; price: number; isAvailable: boolean; }
export interface CanteenMealPlan { id: string; name: string; description?: string; mealsPerDay: number; pricePerTerm: number; isActive: boolean; }
export interface CanteenSale { id: string; itemId?: string; itemName: string; pupil?: Pupil; pupilId?: string; quantity: number; unitPrice: number; total: number; paymentMethod?: string; servedOn: string; notes?: string; }
export interface CanteenSubscription { id: string; pupil: Pupil; plan: CanteenMealPlan; status: string; startDate: string; endDate?: string; }
export interface LeaveRequest { id: string; staff: Staff; leaveType: string; startDate: string; endDate: string; reason?: string; status: string; }
export interface PayrollPeriod { id: string; periodLabel: string; periodStart: string; periodEnd: string; status: string; }
export interface Payslip { id: string; staff: Staff; period: PayrollPeriod; basic: number; allowances: number; deductions: number; tax: number; netPay: number; }
export interface Supplier { id: string; name: string; contactPerson?: string; phone?: string; email?: string; address?: string; taxNo?: string; notes?: string; }
export interface PurchaseOrder { id: string; poNo?: string; supplier?: Supplier; orderDate: string; status: string; total: number; }
export interface Expense { id: string; category: string; amount: number; payee?: string; description?: string; paymentMethod?: string; refNo?: string; spentOn: string; }
export interface Message { id: string; body: string; subject?: string; channel: string; audience?: string; sentAt: string; recipientCount?: number; }
export interface TimetableSlot { id: string; schoolClass: SchoolClass; classId?: string; subject?: Subject; subjectId?: string; teacher?: Staff; teacherId?: string; dayOfWeek: number; startTime: string; endTime: string; room?: string; }
export interface SchoolSettings { id: number; name: string; motto?: string; address?: string; phone?: string; email?: string; website?: string; currency: string; logoUrl?: string; city?: string; province?: string; country?: string; postalCode?: string; poBox?: string; district?: string; plotNumber?: string; latitude?: number; longitude?: number; mapUrl?: string; establishedYear?: number; registrationNo?: string; tpin?: string; headTeacher?: string; deputyHead?: string; }
export interface AppUser { id: string; email: string; fullName?: string; roles: string[]; createdAt: string; mustChangePassword?: boolean; }
export interface SchoolDocument { id: string; title: string; category?: string; description?: string; url: string; createdAt: string; }
export interface ReportData { totalPupils: number; totalStaff: number; totalClasses: number; feesCollected: number; feesBilled: number; totalExpenses: number; libraryBooks: number; activeLoans: number; attendancePresent: number; totalAdmissions: number; totalVehicles: number; clinicVisits: number; }
export interface SystemRole { id: string; name: string; description?: string; isSystem: boolean; permissions: SystemPermission[]; createdAt: string; }
export interface SystemPermission { id: string; name: string; description?: string; module: string; createdAt?: string; }
export interface AuditLogEntry { id: string; action: string; entity?: string; entityId?: string; details?: string; userId?: string; createdAt: string; }
export interface PtcSession { id: string; title: string; sessionDate: string; venue?: string; description?: string; startTime?: string; endTime?: string; term?: Term; createdAt: string; }
export interface PtcMeeting { id: string; session?: PtcSession; staff: Staff; guardian: Guardian; pupil?: Pupil; meetingDate: string; startTime: string; endTime?: string; venue?: string; status: string; agenda?: string; teacherNotes?: string; adminNotes?: string; createdAt: string; }
