# Bright Minds School Hub Developer Teaching Manual

An instructor and beginner developer guide to the frontend and backend

Prepared 23 October 2026

## 1 How to use this manual

This system manages school administration, teaching, finance, parent access, and day to day operations. The frontend folder is named Bright Minds School Hub, the Java package uses Bright Minds, and several visible screens identify the school as Chaz Crestview Academy. These names refer to different layers of the same checked out application.

Start with this teaching guide, then use the companion searchable HTML manual to inspect individual files. Each file entry explains its responsibility, dependencies, code structure, and relevant data operations. Expand its source listing to see the numbered implementation. The reference covers application source, configuration, migrations, tests, and supporting files in both projects. Dependency installations, Git internals, compiled output, caches, local agent state, uploaded school documents, environment values, logs, and database backup contents are treated as infrastructure or data rather than application source.

The frontend root is `F:/Mr Chazanga/Bright Minds School Hub`. The backend root is `F:/Mr Chazanga/bright-minds-backend`. Paths in the reference are relative to the labelled project. The reference captures the working files, including existing uncommitted changes. Source listings are a teaching snapshot; reopen the live file before making a change.

Teach one complete feature before touring every screen. Pupil registration is a good starting point: it introduces a form, an API request, validation, a controller, a service, repositories, database relationships, and a refreshed list. Continue with authentication, then attendance, assessments, and payments. Read small UI wrappers last, once the learner understands why they are reused.

## 2 The system as a whole

The browser runs React components written in TypeScript. TanStack Router selects a screen from the URL. TanStack Query loads and caches server data. `src/lib/api.ts` builds HTTP requests. Vite supplies the development server and build pipeline. Tailwind CSS and reusable components control presentation.

The business backend is a separate Java Spring Boot application. HTTP requests reach controllers, which either call services or use repositories directly. Spring Data JPA and Hibernate map Java entities to PostgreSQL tables. Flyway applies numbered SQL migrations. Spring Security authenticates requests using signed JWT bearer tokens and checks permissions. Local disk holds uploaded files and scheduled backup archives.

There is also a server entry in the frontend project. `src/server.ts` and `src/start.ts` handle TanStack Start server rendering and error responses. They are not replacements for the Spring school API. The authenticated layout explicitly sets `ssr: false`, so those screens rely on browser state and browser API calls.

The normal development request path is:

```text
Browser screen
  -> api.pupils.create(payload)
  -> POST /api/pupils with JSON and a bearer token
  -> Vite development proxy forwards to localhost:8081
  -> Spring Security and JwtFilter
  -> PupilController.create
  -> PupilService.create
  -> PupilRepository and related repositories
  -> PostgreSQL
  -> JSON response
  -> mutation success callback
  -> query invalidation and updated screen
```

The `/api` prefix is Spring's servlet context path. Controller mappings such as `/pupils` sit underneath that prefix. Do not add `/api` to every Java mapping. The frontend API base is `VITE_API_URL` when provided, otherwise `/api`. Vite's proxy is development configuration; the production host must also route API traffic correctly or provide the intended API URL at build time.

The `supabase/` directory contains a separate SQL migration history built around Supabase authentication and row level security. The checked frontend API client uses HTTP fetch calls to the Spring API; the package manifest does not declare the Supabase JavaScript SDK. Treat the Supabase SQL as an alternative or historical implementation in this checkout. Do not combine it blindly with the Spring Flyway schema: user identity tables, enum values, and security mechanisms differ.

## 3 Beginner vocabulary through this project

| Term | Meaning in this system |
| --- | --- |
| Component | A function such as `PageHeader` that returns React UI. |
| JSX | HTML like syntax inside `.tsx` files; braces insert JavaScript expressions. |
| Props | Values a parent component passes to a child, such as a title or callback. |
| State | Values React remembers between renders, such as a selected class or open dialog. |
| Hook | A function such as `useState`, `useQuery`, or `useAuth` used by a component. |
| Query | A request for server data, normally a GET request. |
| Mutation | A create, update, delete, or business action that changes server state. |
| API | The HTTP contract between browser and Java application. |
| DTO | An object describing a request or response instead of a database row. |
| Entity | A Java object mapped to a database table. |
| Repository | A Spring interface that supplies persistence operations and queries. |
| Service | A Java class coordinating business rules and multiple persistence steps. |
| Dependency injection | Spring constructs objects and supplies their dependencies. |
| Transaction | A boundary that can commit related database changes together or roll them back. |
| Migration | A versioned SQL file changing schema or reference data. |
| Authentication | Establishing who is making the request. |
| Authorization | Deciding whether that user may perform this action on this record. |
| Cache | Previously loaded data reused temporarily by TanStack Query. |
| Invalidation | Marking cached data stale so it can be fetched again. |
| Serialization | Converting Java objects into JSON, or reading JSON into Java objects. |
| UUID | A long unique identifier, used in URLs and relationships. |

`const` declares a binding that will not be reassigned; it does not make an object immutable. `let` permits reassignment. `async` functions return promises; `await` waits for completion inside an async function. `map` transforms array entries, `filter` chooses entries, and `reduce` accumulates a result. `?.` handles an absent intermediate value. `??` supplies a default for null or undefined. `...` spreads object fields or array elements.

TypeScript interfaces describe expected shapes during development. `Partial<Pupil>` makes fields optional for a TypeScript caller, but it does not automatically make the Java request valid. `as any` suppresses useful compiler checking. A successful type check cannot prove a backend returns the shape declared in `api.ts`.

In Java, `Optional<T>` expresses that a lookup may find no object. `orElseThrow` turns a missing record into an exception. `List<T>` is an ordered collection. `Set<T>` removes duplicates. Streams transform and filter collections, much like JavaScript arrays. `BigDecimal` represents decimal amounts in finance; compare amounts with `compareTo`, not object equality or binary floating point arithmetic.

## 4 Repository map and reading order

The frontend's `src/routes` contains screens and layouts. `_authenticated/route.tsx` wraps signed in screens. `__root.tsx` wraps the application as a whole. `src/routeTree.gen.ts` is generated routing glue and should not be edited by hand. A pathless layout name beginning with `_` does not become a visible URL segment. Dynamic parameter names use `$`, for example `pupils_.$pupilId.tsx`; the trailing underscore separates the detail route from automatic nesting under the pupil list screen.

`src/components` contains shared application UI. `src/components/ui` contains lower level controls such as buttons, dialogs, selects, cards, and tables. `src/hooks` contains reusable React behaviour. `src/lib` holds the API client, authentication context, grading, exports, formatting, and error helpers. `src/styles.css` defines shared design tokens, utilities, animation, responsive rules, and print behaviour. `public/logo.png` is served as `/logo.png`.

The backend Java package is `com.brightminds.school`. Its `config` directory wires infrastructure, `security` handles JWT identity, `controller` exposes HTTP endpoints, `service` coordinates business rules, `repository` declares persistence queries, `entity` maps database rows, and `dto` defines transfer objects. Enum files constrain state values. `src/main/resources/application.yml` supplies runtime configuration. `src/main/resources/db/migration` contains Flyway versions V1 through V35 in this snapshot. `src/test/java` contains the two service unit tests.

Several modules intentionally place business code in controllers. Teach the actual location of the code: not every controller delegates to a matching service. For example, `PupilController` delegates to `PupilService`, while much of fee handling lives in `FeeController` itself.

Recommended first reading sequence: `package.json`, `vite.config.ts`, `src/router.tsx`, `src/routes/__root.tsx`, `src/lib/api.ts`, `src/lib/auth.tsx`, the authenticated layout, the pupil route, `pom.xml`, `application.yml`, `SecurityConfig`, `PupilController`, `PupilRequest`, `PupilService`, `Pupil`, and `PupilRepository`.

Use this map during a lesson to find the other half of a feature. Route names below are filenames under `src/routes/_authenticated`, unless a public route is explicitly identified. Controllers are under the backend Java `controller` package. A controller may use several additional repositories and supporting services beyond the principal records listed here.

| Screen or feature | Frontend route | Backend entry and principal records |
| --- | --- | --- |
| Public school website | Public `index.tsx` | PublicController; SchoolSetting and Inquiry. |
| Login and password recovery | Public `auth.tsx`, `forgot-password.tsx`, `reset-password.tsx`, `change-password.tsx` | AuthController and PublicController; AuthService, PasswordResetService and AppUser. |
| Welcome dashboard | `dashboard.tsx` | SettingsController and AnnouncementController; SchoolSetting and Announcement. DashboardController provides a separate statistical endpoint. |
| Academic calendar setup | `academic-years.tsx` | AcademicYearController; AcademicYear and Term. |
| Applicants | `admissions.tsx` | AdmissionController; Admission and Pupil through PupilService. |
| Pupils and profiles | `pupils.tsx`, `pupils_.$pupilId.tsx` | PupilController and PupilService; Pupil, SchoolClass and PupilEnrollment, plus profile supporting endpoints. |
| Parents and profiles | `guardians.tsx`, `guardians_.$guardianId.tsx` | GuardianController and GuardianAccountService; Guardian, GuardianPupil and AppUser. |
| Staff and profiles | `staff.tsx`, `staff_.$staffId.tsx` | StaffController, StaffService and StaffAccountService; Staff and AppUser, plus payroll/leave endpoints. |
| Classes | `classes.tsx` | ClassController; SchoolClass and Staff. PupilController handles roster membership updates. |
| Subjects | `subjects.tsx` | SubjectController; Subject. |
| Attendance | `attendance.tsx` | AttendanceController; Attendance, Pupil and SchoolClass. |
| Timetables | `timetable.tsx` | TimetableController; TimetableSlot, SchoolClass, Subject and Staff. |
| Homework | `homework.tsx` | HomeworkController; Homework with class/subject and attachment URL. |
| Exams and scores | `exams.tsx`, `marks.tsx` | ExamController; Exam, Mark, Pupil, Subject and Term. |
| Report cards and analysis | `report-cards.tsx` | ExamController, ReportCardController and attendance/supporting endpoints; Mark and ReportCardRemark. Staff analysis is largely calculated in the route. |
| Promotions | `promotions.tsx` | PromotionController and PromotionService; PupilPromotion, PupilEnrollment and Pupil. |
| Fee configuration and collection | `fees.tsx` | FeeController, InvoiceBalanceService and FeeAutoBillingService; FeeItem, Invoice and Payment. |
| Online collections | PayOnlineDialog from pupil/parent screens | FeeController or GuardianController, LencoService and LencoWebhookController; GatewayTransaction, Payment and Invoice. |
| Accounts | `accounts.tsx` | AccountsController for Expense; FeeController, CanteenController and AdmissionController supply income sources. |
| Payroll | `payroll.tsx` | PayrollController; PayrollPeriod, Payslip, Staff and Expense. |
| Procurement | `procurement.tsx` | ProcurementController; Supplier, PurchaseOrder, PurchaseOrderItem, InventoryItem and InventoryTxn. |
| Inventory | `inventory.tsx` | InventoryController; InventoryItem and InventoryTxn. |
| Library | `library.tsx` | LibraryController; LibraryBook and LibraryLoan. |
| Transport | `transport.tsx` | TransportController and FeeAutoBillingService; Vehicle, TransportRoute, TransportPickupPoint, TransportAssignment and fee invoices. |
| Canteen | `canteen.tsx` | CanteenController; CanteenMenuItem, CanteenMealPlan, CanteenSale and CanteenSubscription. |
| Uniform | `uniform.tsx` | UniformController; UNIFORM FeeItem rows and Invoice. |
| Clinic | `health.tsx` | HealthController; HealthRecord and Pupil. |
| Behaviour | `discipline.tsx` | DisciplineController; DisciplineRecord and Pupil. |
| Staff leave | `leave.tsx` | LeaveController; LeaveRequest and Staff. |
| Parent teacher meetings | `meetings.tsx` | PtcController; PtcSession and PtcMeeting with Staff, Guardian and optional Pupil. |
| Parent workspace | `portal.tsx` | GuardianController and ParentPortalService plus supporting homework/announcement reads; linked child DTOs and invoice/payment records. |
| Calendar events | `calendar.tsx` | EventController; Event. |
| Notices | `announcements.tsx` | AnnouncementController; Announcement. |
| Communication records | `communication.tsx` | CommunicationController; Message. |
| Website inbox | `inquiries.tsx` | InquiryController; Inquiry. PublicController creates incoming records. |
| Document catalog | `documents.tsx` | DocumentController for Document metadata; FileUploadController for stored content. |
| Summary reports | `reports.tsx` | ReportController; aggregates multiple repositories into ReportSummary. |
| Users and permission grants | `users.tsx` | UserManagementController and RoleController; AppUser, UserRole, Role and Permission. |
| Audit history | `audit.tsx` | AuditController and AuditService; AuditLog. |
| Backup and restore | `backup.tsx` | BackupController and BackupService; database dump, selected JSON tables and disk uploads. |
| School identity and content | `settings.tsx` and editors in `dashboard.tsx` | SettingsController; SchoolSetting. PublicController supplies a smaller anonymous response. |

## 5 Running a teaching environment

Use a separate teaching database and sample identities. The application contains real writes, billing, email, payment initiation, and a restore endpoint. A classroom walkthrough should use controlled sample records. This manual does not execute those business actions.

The frontend manifest exposes `dev`, `build`, `build:dev`, `preview`, `type-check`, `lint`, and `format` scripts. Existing dependencies can be checked with the package manager already used by the project. Both `bun.lock` and `package-lock.json` exist, so agree on one installation workflow for the team; do not regenerate both casually.

```powershell
# Terminal one in the frontend folder
npm run dev

# Useful frontend development checks
npm run type-check
npm run lint
npm run build

# Terminal two in the backend folder
mvn spring-boot:run

# Backend unit tests
mvn test
```

The Maven project requests Java 17 and Spring Boot 3.5.3. Java 17 or a compatible later JDK and Maven must be available. PostgreSQL must contain the chosen database and permit the configured user to connect. Flyway runs when the backend starts. The backend's default HTTP port is 8081 and its context path is `/api`. Use the URL printed by Vite for the frontend; it can choose a different port when its preferred one is occupied.

Read actual configuration expressions, not only comments. In `application.yml`, the datasource comment mentions port 5433, but the current `DB_URL` fallback expression uses 5432. Set and verify the correct `DB_URL` in the process environment. The backup service parses that JDBC URL too, so an incorrect value affects both normal persistence and backups.

The backend has an `.env` file, but no dotenv loader or explicit Spring `.env` import is declared in the inspected Maven and application configuration. Do not assume a plain `.env` file is automatically loaded by Spring. Supply environment variables through the actual launcher or development environment. Vite, by contrast, reads its supported environment files for frontend configuration. A `VITE_` value is public browser configuration, so it must not contain a secret.

Important runtime variables include `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `PORT`, `JWT_SECRET`, `JWT_EXPIRATION_MS`, `FRONTEND_URL`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, `BOOTSTRAP_ADMIN_NAME`, `UPLOADS_DIR`, `CORS_ALLOWED_ORIGINS`, SMTP credentials, backup tool paths and directory settings, and Lenco credentials. The per-file reference also lists variable names found in local environment files without publishing their values.

The initial administrator is created by `DataInitializer` only when the user table is empty. Changing bootstrap settings does not reset an existing account. `FRONTEND_URL` determines password reset email links. Uploads and backup paths are relative to the backend's working directory unless configured as absolute paths. `pg_dump` and `psql` are external executables needed by backup and restore.

## 6 How a React screen works

Open `subjects.tsx` before a large page. Its route declaration connects a URL to the `Subjects` component. The component reads permissions, creates dialog and form state, fetches subjects with `useQuery`, and defines create and delete mutations. JSX maps the query result to rows and renders controls. A successful mutation invalidates the `subjects` query and updates feedback and dialog state.

```tsx
const { data = [] } = useQuery({
  queryKey: ["subjects"],
  queryFn: () => api.subjects.list(),
});
```

`data = []` supplies an array while no response is available; it does not prove there are no subjects. Loading, permission errors, server errors, and a genuinely empty list are different situations. Many current pages read only `data`. `router.tsx` adds a global query error handler that displays a 403 permission toast and suppresses duplicate toasts for two seconds.

A query key identifies a cached result. If a request depends on a class ID, date, term, or page number, include that dependency in its key. An `enabled` condition delays a dependent request until the required selection exists. For example, attendance should not request pupils for an empty class ID.

`useMutation` defines a write operation. Calling `mutate` starts it. `isPending` can disable buttons. `onSuccess` can invalidate relevant query keys, close a dialog, and clear a form. `onError` displays feedback. Invalidation affects matching query key prefixes, not every logically related record in the system. `['marks']`, `['rc-marks', ...]`, and `['school-settings-print']` are distinct keys even when they eventually read related server data.

React state and server data have separate jobs. A form's `f` object is a local draft. Updating it with `setF({ ...f, name: value })` changes the screen without saving a database row. The mutation submits that draft. The server response becomes persistent data. Closing a dialog does not itself save anything.

`useEffect` synchronizes with something outside rendering: loading stored login data, choosing default selections after a query resolves, registering an event listener, or responding to payment status. Cleanup functions remove observers, timers, and listeners. `useMemo` caches a computed value based on dependencies; it is useful for filtered rows or statistics, but is not a database cache. Refs retain a DOM element or mutable value without causing a render.

Shared controls accept props and callbacks. `ImageUploadField` uploads a selected file, then calls `onChange(url)` so its parent can put the URL in a draft. The subsequent form save associates that URL with a pupil, staff member, or setting. Removing an attachment from a draft clears the reference; it does not delete the uploaded disk file.

## 7 How the API client works

`src/lib/api.ts` is the browser to backend contract. Its first section manages the `bm_token` and `bm_user` local storage entries. Its generic `request<T>` helper builds an absolute URL from the base and current origin, adds defined query parameters, adds the bearer token when present, serializes a supplied body as JSON, and calls `fetch`.

For an unsuccessful response, the helper tries to read a JSON message, creates an Error, adds the HTTP status, and throws it. Query and mutation handlers receive that error. For a successful response, the helper reads text first and parses JSON only if text exists. This supports successful endpoints that return no body, including 204 responses and some 200 void responses.

`get`, `post`, `put`, `patch`, and `del` are convenience wrappers. The exported `api` object groups calls by school module. For example, `api.pupils.list` accepts a search value and zero based page settings, whereas `api.pupils.all` returns an unpaginated array. These are different response shapes. The interfaces later in the file describe the expected entities, nested objects, dashboard results, portal report cards, permissions, and gateway transactions.

Uploads use `FormData` with a field named `file`. The browser must set the multipart boundary, so that helper deliberately does not send the JSON Content-Type header. Backup downloads similarly need raw blobs and filenames rather than normal JSON parsing. Restore uploads use multipart form data. Follow the special implementations in the admin API section when adding another binary endpoint.

The API type parameter is a development promise, not runtime validation. Inspect an actual response or the Java entity/DTO when diagnosing a mismatch. For example, the Exam entity stores a nested term and also declares a `@JsonProperty("termId")` getter so the frontend can read a flat termId. Read explicit JSON getters as well as declared fields. `Partial<Entity>` request typing also does not describe all request-only fields such as class IDs and temporary passwords precisely.

## 8 Authentication permissions and record ownership

The login page collects an identifier and password. `AuthProvider.login` calls `/auth/login`, stores the returned token and user, and updates React context. The backend allows email or phone lookup through `CustomUserDetailsService`. Spring's authentication manager verifies a BCrypt password hash. `AuthService` creates a JWT whose subject is the email and returns roles, permissions, identity information, and the must-change-password flag.

The token is signed with HS256. `JwtUtil` reads the signing key from configuration and decodes it as Base64. The default configured expiration is 24 hours. The JWT is signed, not encrypted. Each protected request sends `Authorization: Bearer ...`. `JwtFilter` verifies the token and reloads user details before placing authentication in Spring's security context. Missing or invalid tokens proceed without authenticated identity and protected routes are denied by the security configuration.

`SecurityConfig` enables method security, uses stateless sessions, configures CORS, and permits selected public endpoints. Registration requires SUPER_ADMIN in `AuthController`; it is not a public signup endpoint. Public branding, landing content, inquiries, password recovery, the gateway webhook, and GET uploads have explicit public handling. A route being publicly permitted does not mean a separate implementation exists for every example path: for example, the health permit rule does not itself create a health endpoint.

Role names such as TEACHER or ACCOUNTANT group users. Permission names such as `pupils:edit` grant actions. `PermissionService` is registered as `perm`, which is why controller annotations use expressions such as `@perm.has('pupils:edit')`. SUPER_ADMIN has an unconditional bypass in that service. The login response includes resolved permissions so the frontend can hide inappropriate navigation and buttons.

Method-level `@PreAuthorize` declarations take precedence over class-level declarations for that method. Read the effective method rule rather than assuming every declaration is cumulatively required. This matters for read-only admission access and distinct financial reversal permissions.

`hasPermission` in the frontend accepts one permission or an array where any matching entry suffices. `hasAny` checks roles instead. Some older pages still gate buttons with hardcoded role groups. Custom permissions may therefore authorize an API action while the page hides its button, or display a button for a role whose permission was revoked. The backend check remains authoritative.

`ClassScopeService` adds record scope for teacher roles: administrators are unrestricted; teacher roles are limited to classes where their linked staff record is the class teacher. A null scope means unrestricted, while an empty set means no allowed classes. Do not confuse those values. This is based on the class teacher relationship, not arbitrary timetable or teacher-subject assignment. Scope checks are separate from action permissions.

Parent access uses a third question: is this child linked to this guardian? `ParentPortalService` resolves the current guardian through account ID or email, then checks `guardian_pupils` before serving child records. Parent payment endpoints check the invoice's pupil against that relationship. Hiding the pupil selector would not be sufficient authorization.

The authenticated layout redirects users who are missing, parent-only users on disallowed sections, and users required to change a temporary password. `clearMustChangePassword` updates stored state after a successful change to avoid a redirect loop. These are browser behaviour rules. The inspected JWT filter and global security chain do not enforce the must-change-password flag on every business API action. Local storage is also editable and readable by browser scripts, so its user object is not proof of authorization.

Login and recovery are rate limited in memory by client address plus identifier. Buckets are not shared across backend processes and reset on restart. The client IP helper trusts the first X-Forwarded-For value, so its meaning depends on trusted proxy configuration. Password reset generates a random token with a one hour expiry, stores it, and clears it after use. Failed mail delivery logs a reset link in the current implementation; treat those logs as sensitive.

## 9 Reading Spring backend code

`BrightMindsApplication` starts component discovery and scheduled jobs. Spring constructs controller, service, configuration, and repository objects. Lombok's `@RequiredArgsConstructor` generates a constructor for final dependencies, avoiding hand written constructor code. `@Getter`, `@Setter`, `@Builder`, and constructor annotations generate repetitive entity and DTO methods during compilation. Missing handwritten getters do not mean getters are absent.

`@RestController` returns response bodies, usually JSON. `@RequestMapping` sets a base path. `@GetMapping`, `@PostMapping`, `@PutMapping`, `@PatchMapping`, and `@DeleteMapping` connect HTTP methods and paths to Java methods. `@PathVariable` reads an ID from a path, `@RequestParam` reads a URL query parameter, and `@RequestBody` deserializes JSON. `@AuthenticationPrincipal` supplies the signed in identity. `@ResponseStatus` chooses a response status, for example 201 Created or 204 No Content.

`@Valid` invokes validation annotations on a request DTO. It does not invent validation absent from that DTO. Several compact request classes have few constraints, so do not assume every amount, score, date range, or relationship is fully validated server-side. UI restrictions improve usability but direct API callers can bypass them.

Repositories extend `JpaRepository<Entity, UUID>` and inherit find, save, delete, count, and paging methods. Spring derives queries from names: `findBySchoolClassId` follows a nested relationship, `OrderByPaidOnDesc` sorts newest payment dates first, `Between` describes a range, and `In` matches a collection. `@Query` declares JPQL using Java entity/property names unless marked native SQL. `JOIN FETCH` loads related objects with the query to reduce later lazy loading.

`@Transactional` on a public service method gives related database steps a transaction when called through Spring's proxy. Read-only transactions communicate reading intent. Do not assume the same protection for a controller method that calls several repositories without a transaction. Calling another annotated method on `this` also does not cross Spring's normal proxy boundary. These distinctions are important in payments, bulk operations, stock changes, and restore code.

`GlobalExceptionHandler` translates missing entities to 404, argument errors and validation to 400, invalid credentials to 401, access denial to 403, integrity conflicts to 409, and unhandled exceptions to 500. It also preserves explicit ResponseStatusException statuses. Security-filter failures can occur before MVC advice. The current generic 500 message includes exception text, so it is not guaranteed to hide internal details.

`JacksonConfig` handles blank optional LocalDate strings and forces loading of Hibernate lazy associations during serialization. This helps controllers that return entities directly, while potentially issuing extra database queries. Entity serialization is convenient but couples API shapes to persistence and can expose fields unless carefully controlled. DTOs give a more explicit boundary.

## 10 Database relationships and migration history

An entity's `@Table` gives its table name. `@Id` identifies the primary key. `@GeneratedValue` generates an identifier. `@Column` names a column and may declare nullability or uniqueness. `@ManyToOne` and `@JoinColumn` describe references to other rows. `@OneToMany` describes a collection relationship. Fetch settings affect when related rows load. Cascades and orphan removal affect related persistence operations and should be read before deleting or replacing a collection.

The academic spine is academic year → terms → exams → marks. A mark relates an exam, pupil, and subject. A pupil has a current school class. A class can reference a class teacher from staff. `pupil_enrollments` preserves periods of class membership, while `pupil_promotions` records moves and the user who performed them. A guardian can relate to several pupils and a pupil can relate to several guardians through `guardian_pupils`.

The financial spine is fee item → invoice → payment. A fee item describes a charge category and amount. An invoice is an amount billed to a pupil, optionally for a term and fee item. A payment may reference an invoice; confirmed payments change its paid amount. `gateway_transactions` represents an external payment attempt and is distinct from a payment receipt. Uniform sales reuse fee items and invoices rather than creating another financial ledger.

Operations have their own relationships: library books and loans, suppliers and purchase orders with line items, inventory items and transactions, vehicles and routes with priced pickup points and pupil assignments, meal plans and subscriptions, payroll periods and payslips, and PTC sessions with individual meetings. Read each entity's fields in the reference to see the actual optional and required links.

Flyway versions run in numerical order, not filename alphabetical order. V1 establishes the initial schema; V2 adds dynamic roles and permissions. Later versions add parent linking and enrollment history, payment claim status, invoice fee item links, signatures, late fees, enforcement grants, pickup point pricing, purchase order items, editable public content, inquiries, password reset, uniform catalog entries, restore permissions, term-level remarks, and gateway transaction tracking.

V34 is particularly instructive. It adds a term key to report remarks, backfills it from exams, merges colliding remarks, deletes unresolvable rows, removes the old exam key, and creates the new pupil-and-term unique index. Schema changes can transform or remove existing data; adding a property to an entity alone does not explain how historical rows should migrate.

`application.yml` enables Flyway and also sets Hibernate `ddl-auto: update`. Therefore schema can be affected by both mechanisms. A maintainable future change should have an explicit migration and corresponding entity/API changes. Do not edit a migration already applied to a shared database; add a subsequent version. Use a disposable database to test migrations and verify data conversion results.

## 11 Worked example pupil registration and admission

Open the pupil screen, its form helpers, and `PupilService` together. The screen collects a draft and loads supporting classes, guardians, and transport information. Creating a pupil can be followed by guardian creation/linking and a transport assignment. Those follow-up requests are separate browser requests. If one fails, an earlier successful pupil creation is not automatically rolled back.

For the pupil request itself, `api.pupils.create` sends JSON to POST `/api/pupils`. `PupilController.create` requires `pupils:create`, validates the DTO, and checks class scope. `PupilService.create` trims the admission number or generates `PUP-year-random` when it is blank, checks duplicates, resolves the class, maps request fields, and saves the pupil. If the pupil has a class, it creates enrollment history and bills eligible recurring class fees within that service transaction.

`PupilRepository` checks identifiers and queries class membership. Database uniqueness is still needed because two concurrent requests can both pass an application-level existence check. The response returns the saved pupil with nested data. The route invalidates its relevant list and closes or resets its form.

Updating a pupil can change more than the name. The service detects a class change, closes the current enrollment, opens a new enrollment, and bills recurring fees for the new class. Its mapper preserves many optional values when a request field is null, but it sets the school class to null when classId is absent. Request semantics are field-specific; a `Partial<Pupil>` type does not guarantee a safe patch.

Admissions are applications before pupil registration. The admission controller records parent contact details, application status, and registration fee information. Its enroll action creates a `PupilRequest`, delegates pupil creation, links the resulting pupil back to the application, and sets ENROLLED. It rejects an application already linked to a pupil. It does not automatically create a full guardian account merely because parent contact fields exist on the application.

The pupil bulk import parses CSV in the browser and submits rows as individual creations. Teach the difference between text parsing, validation, preview, and persistence. Partial success is possible. A CSV extension does not make a file an Excel workbook, and quoted fields require more care than splitting every line on commas.

## 12 Worked example attendance

The daily attendance screen chooses a class and date, loads pupils, and loads existing attendance. Local state records edits keyed by pupil ID. Saving submits a list to `/attendance/bulk`. The controller validates requested class scope, then calls its upsert helper for each row.

Upsert means update an existing record or insert a new one. Here the lookup key is pupil plus date. An existing row keeps its identity while its status and notes change. The database also has a unique pupil/date index. Status values are PRESENT, ABSENT, LATE, SICK, and EXCUSED. The monthly register loads a date range and pivots rows into pupil-by-day cells, with counts and a printable view.

Class scope checking and validating pupil membership are different checks. The upsert reads the requested pupil and requested class independently; do not describe this as a complete proof that the pupil belongs to that class. Bulk saving also maps individual saves without an explicit outer transaction in the inspected controller. If the fifth record fails, earlier records may already have been saved.

Calendar dates should remain dates. The route's local date helpers avoid deriving the school day from a UTC ISO conversion. Elsewhere, some screens still use `toISOString().slice(0, 10)`, which can differ from the local date near midnight. The parent attendance summary calculates `(present + late) / recorded rows`, rather than dividing by all scheduled school days. The report card UI also contains present-only percentages, so compare formulas before treating every displayed attendance percentage as equivalent.

## 13 Worked example assessments and report cards

The exams screen creates an assessment linked to a term, with a date, maximum score, weight, and assessment type. The marks screen selects term, exam, class, and subject, then keeps score/comment drafts by pupil ID. Saving loops through pupils and sends one request per nonblank score. A zero score and an absent score are distinct: zero is entered data; a blank value is skipped.

`ExamController.addMark` resolves the exam, pupil, and subject; checks class scope; finds a mark by pupil/exam/subject; and updates or inserts it. Backend score range validation is not explicitly enforced in that method. A single learner action saving a class is multiple requests and can partially succeed.

Term report cards pivot four assessment types into subject rows: TEST_1, TEST_2, MID_TERM, and END_OF_TERM. For each available assessment, percentage is `score / outOf * 100`. A subject average uses available assessment percentages; missing assessments are not automatically zero. The term average averages the subject averages. The report-card pivot does not use the exam weight field to compute this term average.

For example, Mathematics scores of 18/20 and 30/50 become 90 and 60 percent. Their mean is 75 percent, not 48/70. If English's subject average is 65, the mean across those two subjects is 70. Use this example to teach why averaging raw scores, percentages, and weighted percentages can produce different answers.

`report-cards.tsx` contains staff-side pivoting, rankings, class analysis, school analysis, CSV exports, remarks editing, and print layouts. `ParentPortalService` implements a parallel server-side report-card calculation for parents. Changes to report logic must consider both implementations. Remarks are keyed by pupil and term. Teachers can change class teacher remarks; unrestricted users can also set head teacher remarks in the current controller logic.

The backend parent report grades by thresholds A ≥90, B ≥75, C ≥60, D ≥50, otherwise E. The frontend `grading.ts` searches inclusive integer min/max bands. That leaves fractional gaps such as 89.5 not matching the B maximum 89 or the A minimum 90; it falls back to the last band. This is an observed implementation edge case, not an intended grading policy. Test boundaries and decimal percentages when teaching or changing grading.

Parent report class information attempts to use enrollment history at the term's end date. Ranking still queries marks using pupils' current class in `MarkRepository.findByTermIdAndClassId`. Historical class display and historical ranking are therefore not guaranteed to use the same cohort after promotions. Rankings also assign sequential positions; no explicit tie ranking rule is implemented there.

The current exam update method changes name, date, maximum score, and weight, but does not apply incoming termId or assessmentType even though the frontend edit form submits them. The Java Exam entity separately exposes a computed flat termId JSON property alongside its nested term, which supports the frontend's read shape. Use this as a contract-reading exercise before assuming every visible editor persists all its fields.

## 14 Worked example billing payments and accounts

Fee items describe charges. Invoices represent bills and begin unpaid with a paid amount of zero. `FeeAutoBillingService` creates invoices for recurring class fees and checks for an existing pupil/fee-item invoice to avoid ordinary repeat billing. Transport assignments choose a pickup point fee when supplied, otherwise the route fee, and may create a transport fee item and invoice for the current term.

`InvoiceBalanceService.adjust` adds a delta to paid, clamps the result at zero, and derives UNPAID, PARTIAL, or PAID by comparing paid against total. A total of 100 with a confirmed payment of 40 becomes paid 40 and PARTIAL. Confirming another 60 produces paid 100 and PAID. Reversing 40 should reduce paid to 60 and return PARTIAL. A payment without an invoice has no invoice balance to adjust.

Staff-created manual payments are recorded as CONFIRMED. The backend also supports a parent-submitted claim as PENDING, which does not immediately credit the invoice. Staff confirmation credits it; rejection records a reason without treating it as income. The current parent page uses online payment methods rather than invoking every claim method available in the API client. An API capability and a visible screen action are different things.

Ordinary collection and correction have separate permissions. `fees:collect` handles collection/confirmation, while `fees:reverse` protects edits and deletion. The controller adjusts invoice balances when confirmed payment amounts change or are removed and logs correction actions. Read status guards carefully before describing a confirmation endpoint as repeat-safe. A sequence of repository writes is not automatically one transaction merely because each repository operation is transactional.

Online mobile money begins in `PayOnlineDialog`. The user supplies amount, phone, and network. The dialog calls its injected initiate function and polls a reference every three seconds, stopping on success/failure or after four minutes. Closing the browser or reaching this timeout is not proof that a collection failed, and polling does not continue indefinitely in a closed browser.

`LencoService.initiate` validates network, nonblank phone, and positive amount, calls the provider, and saves a PENDING gateway transaction. `checkStatus` asks the provider for authoritative status. Success creates a CONFIRMED Payment, adjusts the invoice, and stores the payment ID on the gateway record. The webhook verifies an HMAC SHA512 signature on the raw request body and then calls the same status check. An invalid signature produces no payment update.

The service has a paymentId guard intended to prevent duplicate conversion, but there is no explicit surrounding transaction or locking in the inspected gateway status/conversion flow. Simultaneous polling and webhook requests or a failure between saves can leave inconsistencies. Teach this as the difference between an ordinary repeat guard and concurrency-safe idempotency. The UI also caps amount at outstanding balance while the service only validates positivity; server enforcement must be read separately.

Late fees run through `FeeController` at its configured daily 01:00 cron and can also be triggered by an action. The current amount is 35. It finds overdue unpaid/partial invoices without the flag, creates a separate late fee invoice, and marks the original. The new invoice has a due date and no special flag excluding it from future sweeps, so the inspected selection can also pick up unpaid late-fee invoices on later days. This behaviour deserves a business decision before assuming it is the intended penalty policy.

Accounts combines confirmed fee payments, canteen sales, and admission registration fees for income displays, and expenses for outgoings. An invoice is billed income, not collected cash. Uniform sales create invoices and reach collected income through payments. The uniform summary uses invoice totals, so its sales totals are not identical to cash received. Payroll marking a period paid creates a Salaries expense; generating a payslip alone does not.

## 15 Worked example inventory procurement and other operations

Inventory records quantities and movement transactions. IN increases quantity; OUT reduces it and clamps at zero; the current ADJUST branch also adds a supplied quantity rather than setting an absolute count. Read that branch before using the word adjustment in a lesson. Recording a transaction both changes the item and saves a movement record.

Procurement creates purchase orders and optional line items. Each line references an inventory item, quantity, and unit cost. The controller calculates the total when lines exist. Receiving an order rejects cancelled or already received orders, increments stock for each line, writes IN transactions, and stamps receivedAt. The receive method is transactional. Merely setting a status to RECEIVED is blocked in favour of the receive action that updates inventory too.

Library borrowing checks availability, decrements available copies, and saves a loan. Returning sets its status and date and increments copies. The inspected return method does not reject an already returned loan; repeating it can increase available copies more than once. Editing total copies also does not automatically reconcile available copies. Search results and unfiltered book lists have different response shapes in the controller, so API callers must account for that.

Canteen separates menu catalog, meal plans, subscriptions, and individual sales. Sale total is computed as unit price times quantity. The existence of a meal subscription does not mean it automatically creates the same fee invoices as transport. Uniform catalog entries are FeeItems with category UNIFORM; selling creates an invoice and does not decrement an inventory stock record.

PTC meetings separate a session event from a specific staff/guardian/pupil appointment. The frontend offers administrative, teacher, and parent views. The backend update endpoint requires `ptc:manage` even though teacher UI can expose a note action, so compare the account's effective permissions before assuming a visible action succeeds.

Homework, discipline, health, documents, calendar, and leave use the same query/form/mutation ideas with module-specific fields. Teacher scope is enforced in selected controllers. Documents store metadata and a URL; the actual bytes live in uploads. Calendar entries and announcement audiences are separate concepts from school classes and user permissions.

Communication currently saves a Message with channel, audience, optional class, recipient label, and sent timestamp. Its controller does not call an SMS or email delivery provider. Do not teach its saved Sent label as proof that a real message was delivered. Public inquiries and password recovery, separately, do call JavaMailSender and can attempt email delivery.

## 16 Files exports printing errors and backups

`FileUploadController` accepts allowed content types, generates a UUID filename, writes bytes into the configured upload directory, and returns `/api/uploads/filename`. Its serve action normalizes the path, checks that it stays inside the upload directory, and sends a public cacheable resource. GET uploads are public in SecurityConfig; the document management permission does not itself protect a known upload URL. Content type allowlisting is based on the supplied multipart type, not a complete file-content security scan.

`AttachmentPreview` shows images, embeds PDFs, and provides links for other files. `ImageUploadField` is a narrower UI around the same upload API. `PrintableDoc` provides a browser portal overlay, school settings query, and document header. `ReceiptPrint` uses it for receipts. Report cards, class registers, invoices, and payslips build their own print content using these shared ideas and CSS rules.

`downloadCsv` quotes cells, doubles embedded double quotes, creates a Blob, triggers a download, and releases the temporary object URL. The button label Download Excel CSV means a CSV readable by Excel, not a native `.xlsx` file. Export formatting and neutralizing spreadsheet formula input are separate concerns; the current helper does the former and does not add formula neutralization.

There are several error layers. API failures become rejected promises. Router query errors add a permission toast. Route errors render the root error component. TanStack Start middleware and the server entry provide an HTML fallback for severe server rendering failures. `error-capture.ts` stores one recent error briefly to help diagnose a swallowed SSR error; it is not durable centralized monitoring. `reportLovableError` calls an optional browser event bridge when present, but its existence does not guarantee every caught error is reported.

Backups have different completeness levels. The JSON endpoint exports a selected set of tables; CSV export flattens that result. Neither includes every table and uploaded binary. The SQL endpoint runs `pg_dump`. The full ZIP includes `database.sql` plus files under `uploads/`. Scheduled snapshots run at the configured 02:00 cron and retain the configured newest count, 14 by default. Cron timezone follows the backend scheduler environment because no explicit zone is specified.

Restore saves a pre-restore snapshot, reads the uploaded ZIP, copies upload entries, and runs `psql` with stop-on-error. It replaces database content and can overwrite existing upload paths. It is not an application-level transaction spanning database and filesystem. A ZIP error or SQL failure can occur after files have been copied. The response asks for a backend restart. Teach restore on an isolated teaching environment, and verify database, uploads, permissions, and login afterwards.

## 17 How to explain each kind of file

For a route, identify the URL, route component, supporting components, local state, queries, mutations, permissions, conditional rendering, and export/print behaviour. For every query ask what its key depends on. For every mutation ask which caches become stale and what a partial failure leaves behind.

For an API function, identify the HTTP verb, URL, body, query parameters, response type, and matching backend method. The reference includes an API operation catalog extracted from the TypeScript object so nested methods such as `fees.invoices.bulkCreate` are individually visible.

For a controller method, identify the effective security rule, request bindings, validation, lookups, calculations, side effects, status code, and error cases. For a service method, identify the business invariant and transaction boundary. For a repository, distinguish inherited CRUD, derived method-name queries, and explicit JPQL. Empty repository interfaces still have inherited CRUD behaviour.

For an entity or DTO, explain each field's type and purpose, its optionality/defaults, its database column or relationship, and any serialization annotations. The reference extracts declared fields and retains annotations beside the full source. Use entity fields to explain storage, and DTO fields to explain the request/response contract. They are not interchangeable.

For a UI primitive, explain its user interaction and exported pieces. A Dialog combines trigger, content, title, description, and close behaviour. A Select combines trigger, value, content, and items. `asChild` composes behaviour onto a supplied element; refs support focus and measurement; `cn` merges conditional Tailwind classes. These files are reusable infrastructure, not school business modules.

For SQL, read statements in order. CREATE defines objects; ALTER changes them; INSERT/UPDATE/DELETE affect data; indexes support lookup or uniqueness; constraints protect relationships; triggers execute database behaviour; policies in the Supabase scripts control row visibility/write access. A permission seed inserts data used by application authorization; it does not create a Java controller by itself.

For configuration and lockfiles, explain who reads the file and at what stage. `package.json` declares scripts and allowed dependency versions; lockfiles resolve versions and integrity metadata; `tsconfig.json` controls compiler interpretation; ESLint and Prettier guide source consistency; `components.json` configures UI generation conventions; Maven's POM defines Java dependencies and packaging. Generated output should be recreated through tooling rather than edited manually.

## 18 Teaching schedule and exercises

| Session | Focus | Practical result |
| --- | --- | --- |
| 1 | Vocabulary, architecture, folders, local configuration | Draw the request path and locate both projects. |
| 2 | React state, props, queries, mutations | Explain the subject screen and its create flow. |
| 3 | API client, Spring controller, service, entity, repository | Trace pupil creation and enrollment side effects. |
| 4 | JWT, permissions, teacher scope, parent ownership | Explain why a hidden button is not an API access rule. |
| 5 | Attendance, exams, marks, averages | Calculate a report card by hand and compare code paths. |
| 6 | Invoices, payments, claims, gateway attempts | Explain pending versus confirmed money with sample data. |
| 7 | Inventory, procurement, library, payroll | Identify operations updating more than one record. |
| 8 | Migrations, errors, tests, exports, backups | Diagnose a controlled failure and review a small change. |

Ask the learner to explain a 403: find the failing HTTP request, inspect the effective controller permission, compare assigned role permissions, check whether class or parent ownership scope applies, and compare the frontend gate. Answer: changing a sidebar item cannot grant server access; fixing a missing grant also may require a new login to refresh the stored frontend permission list.

Ask them to compute a 100 invoice with confirmed payments 30 and 20 and a pending claim 25. Answer: invoice paid is 50 and outstanding is 50 until the claim is confirmed. After confirmation paid is 75 and outstanding is 25. A pending gateway attempt is also not confirmed income.

Ask them to find why a screen stays stale after a successful write. Answer: compare the mutation invalidation prefix with every affected query key, including differently named detail, portal, dashboard, and print queries. A server save and a browser cache refresh are separate operations.

Ask them to explain why a previous term's rank could change after promotion. Answer: enrollment history helps display the historical class, but the parent ranking query uses current pupil class membership. A historical cohort query would need an appropriate enrollment/date relationship.

Ask them to add a harmless optional supplier reference field as a practice change in a branch. Expected layers: migration, entity, request mapping, API interface, form state, input, display, and relevant validation. Have them explain how blank and omitted values should behave. The exercise is a proposed learning task, not a change performed by this manual.

Ask them to review repeated library returns or simultaneous gateway status checks. Expected answer: a boolean/status guard and a unique relationship help ordinary retries, while transactions, locking, or database constraints are needed to protect concurrency and partial failures. The learner should show the current implementation before proposing a fix.

## 19 Debugging and making changes

Start from evidence. In the browser, identify the request path, verb, request payload, response status, and response body. Match it to `api.ts`, then the Java mapping. Check backend logs and repository/schema only after identifying which operation failed. A blank table may mean no records, a disabled query, a failed request, a permission denial, a response-shape mismatch, or filtering that removed all rows.

| Symptom | Files and questions to inspect |
| --- | --- |
| API 404 | API base, Vite proxy, `/api` context path, controller mapping, record existence. |
| API 400 | DTO validation, enum spelling, blank dates, malformed JSON, required relationship IDs. |
| API 401 or 403 | Token, expiry, security filter, permission rule, record scope, frontend cached identity. |
| API 409 | Unique indexes, foreign keys, duplicate identifiers, referenced rows. |
| API 500 | Backend exception and generic handler; do not infer success from UI defaults. |
| CORS failure | Actual frontend origin and CorsConfig; compare same-origin proxy with direct API mode. |
| Backend cannot connect | DB_URL and credentials supplied to the process; verify the actual PostgreSQL port. |
| Save succeeds but display is unchanged | Query keys/invalidation, field mapper, JSON shape, omitted update fields. |
| Reset email link points to wrong host | FRONTEND_URL in the running backend process. |
| Backup fails | JDBC URL parsing, pg_dump/psql installation, executable paths, filesystem permissions. |
| Upload displays a broken image | Returned URL, API routing, uploaded disk file, public resource response. |

Use the existing checking commands as checks, not guarantees. The two service tests focus on generated identifiers. The staff test currently does not mock the additional StaffAccountService used by StaffService.create, so that test's arrangement can fail before its assertion. Neither test is an end-to-end test of permissions, transaction rollback, billing, or the browser. This documentation task does not claim those tests passed.

A reviewable feature change has a coherent contract: database migration, Java entity/request/response changes, controller/service behaviour, frontend API types, UI input/display, permission handling, cache refresh, and meaningful validation. A type assertion may silence a compiler complaint without fixing a contract. A success toast may report a completed request without proving every related screen is refreshed.

Before teaching a rule as guaranteed, ask where it is enforced. A button disable condition is usability. A request DTO validation is input checking. A permission annotation is action authorization. A scope/ownership lookup is record authorization. A database constraint is a final integrity rule. A transaction protects a defined unit of database work. Each layer answers a different question.

## 20 File reference navigation

Open `Bright-Minds-Developer-Manual.html` beside this guide. Search by filename, symbol, API name, or topic. Use the category filter for routes, components, controllers, services, entities, repositories, DTOs, migrations, tests, and configuration. Each file includes its size, source line count, a content fingerprint, explanation, related files, and available structural details. Source listings are expandable so the teaching text remains readable.

The reference's method walkthroughs and structural tables are derived from the captured source. They identify exact declarations and call sites; they do not execute methods or prove business correctness. Use the worked examples above to understand the relationships and use the expanded source when a branch, default, or annotation changes the meaning. Environment values, user uploads, binary backups, and log content are deliberately omitted from the teaching snapshot.
