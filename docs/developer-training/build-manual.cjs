/* Rebuild the offline teaching reference from the two neighbouring projects.
   No application code is executed and no database or external service is contacted. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const frontend = path.resolve(__dirname, '../..');
const backend = path.resolve(frontend, '../bright-minds-backend');
const ts = require(path.join(frontend, 'node_modules/typescript'));
const notes = JSON.parse(fs.readFileSync(path.join(__dirname, 'file-notes.json'), 'utf8'));
const ignored = new Set(['.git', 'node_modules', 'target', '.output', '.tanstack', '.wrangler', '.claude', '.kilo', 'docs', 'output']);
const esc = s => String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const squash = s => s.replace(/\s+/g, ' ').trim();
const words = s => s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').toLowerCase();
const uniq = a => [...new Set(a)];
const code = s => '<code>' + esc(s) + '</code>';
const para = s => '<p>' + esc(s) + '</p>';
const list = a => a.length ? '<ul>' + a.map(s => '<li>' + s + '</li>').join('') + '</ul>' : '';
function table(headers, rows) {
  if (!rows.length) return '';
  return '<div class="table-wrap"><table><thead><tr>' + headers.map(s => '<th scope="col">' + esc(s) + '</th>').join('') + '</tr></thead><tbody>' + rows.map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
}
function walk(root, side, rel = '') {
  let result = [];
  for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const name = path.posix.join(rel, entry.name);
    if (entry.isDirectory()) result.push(...walk(root, side, name));
    else {
      const absolute = path.join(root, name);
      const stat = fs.statSync(absolute);
      const dataOnly = /^(uploads|backups)\//.test(name) || /\.(png|jpg|jpeg|gif|pdf|docx?|zip|log)$/i.test(name) || name === '.env' || name === 'examid.txt';
      const lock = /^(package-lock\.json|bun\.lock)$/.test(name);
      const text = dataOnly ? null : fs.readFileSync(absolute, 'utf8');
      const envNames = name === '.env' ? fs.readFileSync(absolute, 'utf8').split(/\r?\n/).map(l => l.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1]).filter(Boolean) : [];
      result.push({ side, rel: name, absolute, bytes: stat.size, text, lock, dataOnly, envNames });
    }
  }
  return result;
}
const files = [...walk(frontend, 'frontend'), ...walk(backend, 'backend')];
for (const [i, f] of files.entries()) {
  f.id = 'file-' + i;
  f.name = path.posix.basename(f.rel);
  f.lines = f.text === null ? null : f.text.split(/\r?\n/).length;
  f.category = category(f);
  // The digest is metadata for locating the working-file snapshot, never an env/data digest.
  f.sha256 = f.text === null ? null : crypto.createHash('sha256').update(f.text).digest('hex');
  if (f.text !== null && !f.lock) f.text = safeSource(f);
}
function category(f) {
  if (/^(uploads|backups)\//.test(f.rel) || /\.log$/.test(f.rel)) return 'Runtime data';
  if (f.name === '.env') return 'Environment';
  if (/migrations?\//.test(f.rel)) return f.side === 'frontend' ? 'Historical SQL' : 'Migrations';
  if (/src\/test\//.test(f.rel)) return 'Tests';
  if (/\/controller\//.test(f.rel)) return 'Controllers';
  if (/\/service\//.test(f.rel)) return 'Services';
  if (/\/repository\//.test(f.rel)) return 'Repositories';
  if (/\/dto\//.test(f.rel)) return 'DTOs';
  if (/\/entity\/enums\//.test(f.rel)) return 'Enums';
  if (/\/entity\//.test(f.rel)) return 'Entities';
  if (/\/security\//.test(f.rel)) return 'Security';
  if (/src\/components\/ui\//.test(f.rel)) return 'UI primitives';
  if (/src\/components\//.test(f.rel)) return 'Components';
  if (/src\/hooks\//.test(f.rel)) return 'Hooks';
  if (/src\/routes\//.test(f.rel)) return 'Routes';
  if (/src\/lib\//.test(f.rel)) return 'Libraries';
  if (f.name === 'routeTree.gen.ts') return 'Generated';
  if (/^\.github\//.test(f.rel)) return 'Tooling';
  if (f.name === 'logo.png') return 'Assets';
  return 'Configuration and startup';
}
function linkFile(f, label = f.rel) { return '<a href="#' + f.id + '">' + esc(label) + '</a>'; }
function resolveLocal(f, specifier) {
  const base = specifier.startsWith('@/') ? specifier.slice(2) : specifier.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(f.rel), specifier)) : null;
  if (base === null) return null;
  const rel = specifier.startsWith('@/') ? 'src/' + base : base;
  return files.find(x => x.side === f.side && [rel, rel + '.ts', rel + '.tsx', rel + '/index.ts', rel + '/index.tsx'].includes(x.rel));
}
const entityMeaning = {
  AcademicYear: 'An academic year with date boundaries and a current flag, grouping terms and enrollment history.', Admission: 'A pre-enrollment application with parent contacts, registration payment details, status, and optional enrolled pupil link.', Announcement: 'A published notice with title, body, audience and timestamps.', AppUser: 'A login identity containing credentials, reset state and role links; it is separate from a staff or guardian profile.', Attendance: 'One pupil/date attendance observation with optional class, status and notes.', AuditLog: 'An explicitly recorded application action and contextual user/entity information.', CanteenMealPlan: 'A reusable meal package with term pricing and meals per day.', CanteenMenuItem: 'A purchasable menu item with price and availability.', CanteenSale: 'A recorded canteen sale with quantities, unit price, total and optional pupil/item association.', CanteenSubscription: 'A pupil meal-plan assignment over a date range and optionally a term.', DisciplineRecord: 'A pupil disciplinary or positive behaviour observation.', Document: 'School document metadata referencing uploaded content by URL.', Event: 'A calendar event with timing, location and audience.', Exam: 'An assessment definition with term, type, date, outOf and weight; marks link to it.', Expense: 'An outgoing amount classified by category, payee, method, reference and date.', FeeItem: 'A charge definition with category, amount, optional class/term, recurring flag and due date.', GatewayTransaction: 'An external collection attempt that may later become a confirmed Payment.', Guardian: 'A parent/guardian contact profile, optionally connected to an AppUser.', GuardianPupil: 'The association linking a guardian to a pupil and optionally identifying a primary guardian.', HealthRecord: 'A recorded school clinic encounter for a pupil.', Homework: 'A class assignment with subject, due date, description and attachment URL.', Inquiry: 'A visitor contact message received through the public school website.', InventoryItem: 'An item catalog entry with quantity, reorder point, cost and optional supplier.', InventoryTxn: 'A movement record explaining an inventory quantity change.', Invoice: 'A pupil bill with total, credited paid amount, payment status, term and optional fee item.', LeaveRequest: 'A staff leave request with date range, reason, type and approval status.', LibraryBook: 'A book catalog entry with total and available copy counts.', LibraryLoan: 'A borrowing event connecting a book to a pupil or staff member with due/return status.', Mark: 'A score and optional comment for one pupil, subject and exam.', Message: 'A communication record; storing it alone does not establish external delivery.', Payment: 'A payment or claim with status, amount, receipt, method and optional invoice/guardian relationship.', PayrollPeriod: 'A payroll run/date interval with draft/approved/paid status.', Payslip: 'A staff member pay calculation within a payroll period.', Permission: 'A named action grouped by module for dynamic authorization.', PtcMeeting: 'An individual parent/teacher appointment with participants, times and notes.', PtcSession: 'An event grouping parent/teacher appointments.', Pupil: 'The pupil profile and current class; enrollment history is a separate entity.', PupilEnrollment: 'A historical interval of pupil class membership.', PupilPromotion: 'A recorded class progression with source/destination, date/year and actor.', PurchaseOrder: 'A procurement order with supplier, amount, status and received timestamp.', PurchaseOrderItem: 'One inventory item/quantity/unit-cost line within a purchase order.', ReportCardRemark: 'Class teacher and head teacher remarks keyed by pupil and term.', Role: 'A dynamic named role holding permission associations.', SchoolClass: 'A grade/stream with level order, capacity and optional class teacher.', SchoolSetting: 'The singleton school identity, contact, branding and configurable content settings row.', Staff: 'An employee profile with employment/pay information and optional login link.', Subject: 'A teaching subject referenced by exams, marks, homework and timetables.', Supplier: 'A procurement contact referenced by items and purchase orders.', TeacherSubject: 'A teacher/subject/class association; it is distinct from the class-teacher scope lookup.', Term: 'A dated academic period belonging to an academic year.', TimetableSlot: 'A scheduled class/subject/teacher period for a weekday/time/room.', TransportAssignment: 'A pupil route assignment with optional priced pickup point.', TransportPickupPoint: 'A priced location within a transport route.', TransportRoute: 'A named transport route with vehicle, fallback fee and pickup information.', UserRole: 'A link between an AppUser and a role name; Role holds the permissions for that name.', Vehicle: 'A transport vehicle and driver contact/capacity record.'
};
const uiMeaning = {
  accordion: 'Expandable sections with triggers and collapsible content.', 'alert-dialog': 'A modal confirmation interaction requiring an explicit response.', alert: 'An inline alert presentation with title and description.', 'aspect-ratio': 'A wrapper maintaining a specified width-to-height ratio.', avatar: 'Profile image with fallback content.', badge: 'A compact status/category label with style variants.', breadcrumb: 'A navigational trail of links, separators, and current page.', button: 'A styled action/link surface using variants, sizes, and optional Slot composition.', calendar: 'A styled day-picker calendar. Check wrapper props and custom navigation against the installed day-picker API.', card: 'A visual content group with header, title, description, content and footer.', carousel: 'Embla-based scrolling slides, navigation controls and carousel state.', chart: 'Recharts-related configuration, styling, tooltips and legends. Business data is supplied by the caller.', checkbox: 'A selectable boolean control and check indicator.', collapsible: 'A trigger/content visibility primitive.', command: 'A searchable command list, groups and selectable items.', 'context-menu': 'A menu opened by context interaction with nested/check/radio options.', dialog: 'A modal overlay with trigger, content, title, description and close pieces.', drawer: 'A Vaul drawer interaction with trigger/content/header/footer wrappers.', 'dropdown-menu': 'A trigger-driven action menu with item/group/submenu primitives.', form: 'React Hook Form context wrappers linking field IDs, labels, descriptions, controls and error messages.', 'hover-card': 'A preview panel shown by hover/focus of its trigger.', 'input-otp': 'One-time-code input slots and separators; this primitive does not implement an authentication flow.', input: 'A styled native input forwarding normal input props/ref.', label: 'A styled field label composable with form controls.', menubar: 'A menu bar with grouped triggers and menu content.', 'navigation-menu': 'A navigation menu with viewport/indicator and composable links.', pagination: 'Low-level pagination links and ellipsis; application data paging is in use-pagination/PaginationBar.', popover: 'A floating anchored content panel.', progress: 'A styled progress track and indicator driven by a numeric value.', 'radio-group': 'Mutually exclusive options and selection indicator.', resizable: 'Resizable panels, panel group and handle wrappers.', 'scroll-area': 'A styled scroll viewport, scrollbars and corner.', select: 'A composed single-select with trigger, value, content, options and scroll controls. The local wrapper forwards option values unchanged to Radix; it does not convert empty-string choices into a sentinel. Inspect the underlying primitive when diagnosing an option-value failure.', separator: 'A horizontal or vertical visual/semantic divider.', sheet: 'A dialog-based edge panel with side variants.', sidebar: 'A general sidebar component system with provider state, responsive sheet behaviour, keyboard shortcut and layout primitives. The school AppSidebar uses its own layout rather than necessarily consuming this full system.', skeleton: 'A placeholder surface for loading presentation.', slider: 'A ranged numeric control with track/range/thumb.', sonner: 'The Sonner toast renderer with theme-sensitive props and styling.', switch: 'An on/off control with thumb and checked state.', table: 'Styled native table elements and scroll container.', tabs: 'A selected-tab list, triggers and associated content panels.', textarea: 'A styled multiline native input.', 'toggle-group': 'A group of toggle controls sharing variant/size context.', toggle: 'A pressable state button with variants and sizes.', tooltip: 'Short contextual information anchored to a trigger.'
};
function summary(f) {
  const n = notes[f.side][f.rel] ?? (f.side === 'backend' ? notes.backend[f.name] : undefined);
  if (n) return n;
  if (f.category === 'Entities') return entityMeaning[f.name.replace('.java', '')] || 'A persistent domain entity; use its field map and relationship annotations below to understand its stored shape.';
  if (f.category === 'Repositories') {
    const target = f.text.match(/JpaRepository\s*<\s*(\w+)/)?.[1];
    return 'Persistence interface for ' + (target || f.name.replace('Repository.java', '')) + '. Spring supplies inherited CRUD and paging methods at runtime. Additional declarations below are derived queries or explicit JPQL; the interface itself does not contain controller permission checks.';
  }
  if (f.category === 'DTOs') return 'HTTP transfer contract ' + f.name.replace('.java', '') + '. Fields and nested classes define the JSON request or response; validation annotations apply where callers invoke validation. It is not automatically a database table. Compare the matching frontend types and endpoint bindings.';
  if (f.category === 'Enums') return 'Allowed Java state values for ' + words(f.name.replace('.java', '')) + '. These constants constrain mapped states and appear in API payloads or persisted values. Read @Enumerated/@JdbcTypeCode on the consuming entity to distinguish VARCHAR from native PostgreSQL enum storage.';
  if (f.category === 'UI primitives') return (uiMeaning[f.name.replace('.tsx', '')] || 'Reusable UI control.') + ' This file provides local styling/composition around a library or native element. It has no direct school database responsibility. Exported symbols and local state/effects below describe its exact building blocks.';
  if (f.category === 'Migrations') return 'Flyway migration ' + f.name.split('__')[0] + ' for ' + f.name.replace(/^V\d+__/, '').replace('.sql', '').replaceAll('_', ' ') + '. Runs after earlier numeric versions; statements below identify schema/data changes. Inspect backfill, constraint and permission statements together before applying to existing data.';
  if (f.category === 'Historical SQL') return 'Separate Supabase schema migration using public/auth objects, role policies and/or grants. Read in timestamp order within that Supabase history. The inspected frontend uses the Spring HTTP API; do not apply this script to the Spring Flyway schema as if it were the next backend version.';
  if (f.category === 'Environment') return 'Local environment configuration. Values are omitted; only variable names are catalogued. Frontend VITE_ settings are public build configuration. Backend variables must reach the actual Java process; a plain .env file is not automatically imported by the inspected Spring configuration.';
  if (/^uploads\//.test(f.rel)) return 'Runtime uploaded content served by FileUploadController. This is user data, not an application source module. The training manual records file type/size only and does not copy its contents.';
  if (/^backups\//.test(f.rel)) return 'Runtime database/upload snapshot archive. Generated by BackupService, potentially containing sensitive school data. The training manual records metadata only; restore is a business operation rather than part of reading source.';
  if (/\.log$/.test(f.name)) return 'Local development log. Runtime diagnostics can include sensitive information; contents are not copied into the manual. Generated logs are not hand-maintained application source.';
  if (f.name === 'logo.png') return 'Static raster school logo served by the frontend at /logo.png and used as a branding/print fallback. Image bytes do not contain executable application logic.';
  if (f.lock) return 'Resolved frontend dependency graph and integrity metadata for ' + (f.name === 'bun.lock' ? 'Bun' : 'npm') + '. Generated by dependency installation. package.json describes dependency ranges; this file pins resolutions. Individual transitive package records are data, not application functions, and are not expanded into source listings.';
  if (f.category === 'Tooling') return 'Java upgrade tooling support under .github/modernize. This is developer automation/bookkeeping rather than a school API module. Read the script/ignore rules below for its exact input/output behaviour; it is not a GitHub Actions workflow merely because it lives under .github.';
  if (f.name === '.gitignore') return 'Git ignore patterns controlling which generated/local files are excluded from normal tracking. Ignore rules do not erase files, protect already tracked secrets, or change runtime behaviour.';
  if (f.name === '.prettierrc') return 'Formatter conventions for line width, semicolons, quoting and trailing commas. Read by Prettier; does not execute school business logic.';
  if (f.name === '.prettierignore') return 'Patterns excluding generated/build/dependency files from formatting. Keeps generated route and lock data from routine formatting churn.';
  if (/\.vscode\//.test(f.rel)) return 'Editor workspace preferences for local Java development. They affect editor tooling, not application HTTP permissions or database schema.';
  return 'Supporting project file. Its exact configuration/source is listed below; it is included in coverage even when it has no functions or database operations.';
}
function safeSource(f) {
  if (f.text === null || f.lock || f.name === 'examid.txt') return null;
  return f.text
    .replace(/(\$\{(?:DB_PASSWORD|JWT_SECRET|BOOTSTRAP_ADMIN_PASSWORD):)[^}\n]*(\})/g, '$1[REDACTED_DEFAULT]$2')
    .replace(/(app\.bootstrap-admin\.password:)[^}\n]*(\})/g, '$1[REDACTED_DEFAULT]$2');
}
function maskJava(s) {
  // Preserve offsets/newlines while masking comments and string/character literals.
  return s.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"""[\s\S]*?"""|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, m => m.replace(/[^\n]/g, ' '));
}
function closePair(s, start, open, close) {
  let d = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === open) d++;
    else if (s[i] === close && --d === 0) return i;
  }
  return -1;
}
function lineAt(s, n) { return s.slice(0, n).split('\n').length; }
function javaAnnotations(s) {
  const masked = maskJava(s), out = [];
  const rx = /@([A-Za-z_]\w*(?:\.Default)?)/g;
  for (const m of masked.matchAll(rx)) {
    let end = m.index + m[0].length;
    let op = end;
    while (/\s/.test(masked[op] ?? '') && op < masked.length) op++;
    if (masked[op] === '(') {
      const cp = closePair(masked, op, '(', ')');
      if (cp >= 0) end = cp + 1;
    }
    out.push({ name: m[1], source: squash(s.slice(m.index, end)) });
  }
  return out;
}
function javaMethods(f) {
  const s = f.text, mask = maskJava(s), result = [];
  const rx = /\b(?:public|private|protected)\s+(?:(?:static|final|synchronized|abstract)\s+)*(?:[\w$.<>?\[\],]+\s+)+([A-Za-z_]\w*)\s*\(/g;
  const extra = /^\s*(?:void|List<[^>]+>|Optional<[^>]+>|Page<[^>]+>|boolean|long|BigDecimal|[A-Z]\w*)\s+(\w+)\s*\(/gm;
  const matches = [...mask.matchAll(rx), ...mask.matchAll(extra)].sort((a, b) => a.index - b.index);
  const positions = new Set();
  for (const m of matches) {
    if (/\b(class|interface|record|enum)\b/.test(m[0])) continue;
    const name = m[1], op = mask.indexOf('(', m.index + m[0].lastIndexOf(name));
    if (positions.has(op)) continue;
    positions.add(op);
    const cp = closePair(mask, op, '(', ')');
    if (cp < 0) continue;
    const after = mask.slice(cp + 1).match(/^\s*(?:throws\s+[\w., ]+\s*)?([;{])/);
    if (!after) continue;
    const bs = cp + 1 + after.index + after[0].length - 1;
    const end = after[1] === '{' ? closePair(mask, bs, '{', '}') + 1 : bs + 1;
    if (end <= bs) continue;
    const boundary = Math.max(mask.lastIndexOf('}', m.index - 1), mask.lastIndexOf(';', m.index - 1), mask.lastIndexOf('{', m.index - 1));
    const prefix = s.slice(boundary + 1, m.index);
    const annotations = javaAnnotations(prefix).filter(x => /^(PreAuthorize|GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping|ResponseStatus|Transactional|Scheduled|Query|Test|Bean)$/.test(x.name)).map(x => x.source);
    result.push({ name, start: m.index, end, bodyStart: bs + 1, line: lineAt(s, m.index), endLine: lineAt(s, end), signature: squash(s.slice(m.index, cp + 1)), annotations, source: s.slice(m.index, end), body: after[1] === '{' ? s.slice(bs + 1, end - 1) : '' });
  }
  return result;
}
function annotationHelp(a) {
  const bindingRules = {
    RequestParam: 'Binds a URL query/form parameter to the method argument.',
    PathVariable: 'Binds a named URL path segment to the method argument.',
    RequestBody: 'Reads the HTTP request body and deserializes it into the declared type.',
    RequestHeader: 'Reads a named HTTP request header.',
    AuthenticationPrincipal: 'Supplies the current authenticated principal.',
    ResponseStatus: 'Selects the HTTP response status for this handler.',
    Valid: 'Runs declared Bean Validation constraints on the supplied object.',
    Validated: 'Requests validation support for this argument/component.',
    RestControllerAdvice: 'Registers shared MVC exception handling.',
    ExceptionHandler: 'Maps an exception type to an error-response method.',
    Bean: 'Exposes the returned object as a Spring-managed dependency.',
    Override: 'Checks that the method implements/overrides a parent contract.',
    Data: 'Lombok generates common accessors and object methods.',
    Tag: 'Groups endpoints in generated OpenAPI documentation.',
    Operation: 'Documents an HTTP operation in OpenAPI.',
    DateTimeFormat: 'Specifies how incoming date/time text is parsed.'
  };
  if (bindingRules[a]) return bindingRules[a];
  const rules = {
    Entity: 'Maps this class to database rows.', Table: 'Selects the database table and optional table constraints.', Id: 'Identifies the primary key.', GeneratedValue: 'Generates new identifiers.', Column: 'Configures a database column, nullability, length or uniqueness.', ManyToOne: 'References one related row from many possible owner rows.', OneToMany: 'Exposes a collection of related rows; inspect cascade/orphan settings.', ManyToMany: 'Associates rows through a join table.', JoinColumn: 'Names the relationship foreign key column.', JoinTable: 'Names and configures an association table.', Enumerated: 'Persists enum values using the configured representation.', JdbcTypeCode: 'Selects a Hibernate/JDBC storage type such as a named PostgreSQL enum.', Builder: 'Lombok generates a builder API; Builder.Default preserves an initializer when building.', Getter: 'Lombok generates getters.', Setter: 'Lombok generates setters.', NoArgsConstructor: 'Lombok generates an empty constructor used by frameworks.', AllArgsConstructor: 'Lombok generates a constructor accepting fields.', RequiredArgsConstructor: 'Lombok generates dependency injection constructor parameters for final fields.', CreationTimestamp: 'Hibernate supplies the creation time.', UpdateTimestamp: 'Hibernate refreshes the update time.', JsonIgnore: 'Excludes a property from normal JSON serialization.', JsonProperty: 'Controls the JSON property name or explicit accessor.', JsonIgnoreProperties: 'Ignores the listed JSON properties.', NotBlank: 'Rejects null, empty or whitespace-only text when validation runs.', NotNull: 'Requires a non-null value when validation runs.', Size: 'Constrains text/collection length when validation runs.', Email: 'Checks email format when validation runs.', Positive: 'Requires a positive numeric value when validation runs.', PositiveOrZero: 'Requires a nonnegative numeric value when validation runs.', DecimalMin: 'Sets a minimum decimal value when validation runs.', Service: 'Registers business/persistence coordination with Spring.', Component: 'Registers a discoverable Spring bean.', Configuration: 'Declares Spring configuration.', ConfigurationProperties: 'Binds a property prefix to this object.', Value: 'Injects a runtime property value.', RestController: 'Exposes methods as HTTP response handlers.', RequestMapping: 'Sets controller or method URL mapping.', PreAuthorize: 'Checks the declared authorization expression before invoking the method.', Transactional: 'Declares a transaction boundary when called through Spring interception.', Scheduled: 'Runs a method on a configured interval or cron.', Query: 'Supplies explicit repository query text.', Modifying: 'Marks a repository query as modifying data.', Param: 'Names a repository query parameter.', EnableScheduling: 'Enables scheduled task discovery.', SpringBootApplication: 'Starts Spring Boot configuration/component discovery.', ExtendWith: 'Registers the test extension such as Mockito.', Mock: 'Creates a test double.', InjectMocks: 'Constructs/injects the object under test using available doubles.', Test: 'Declares a test method.', Slf4j: 'Lombok generates a logger.'
  };
  const root = a.split('.')[0];
  if (/^(Get|Post|Put|Patch|Delete)Mapping$/.test(root)) return 'Maps an HTTP ' + root.replace('Mapping', '').toUpperCase() + ' request to a method.';
  return rules[root] || 'Framework annotation; inspect its parameters at the source location to see the exact mapping or constraint.';
}
function fieldMeaning(name, type) {
  if (/Repository\b/.test(type)) return 'Injected persistence dependency used for the reads/writes listed in this file. Spring provides its implementation.';
  if (/Service\b|PasswordEncoder\b|AuthenticationManager\b|JavaMailSender\b|JwtUtil\b/.test(type)) return 'Injected collaborator used to perform ' + words(name) + ' operations. Follow its linked file for business/security/integration behaviour.';
  const exact = { id: 'Primary identity of this object/row.', userId: 'Optional linked login account identifier; not the same identity as the staff/guardian row.', fullName: 'Person display name.', admissionNo: 'Human-facing pupil admission identifier, distinct from UUID id.', staffNo: 'Human-facing staff identifier, distinct from UUID id.', passwordHash: 'BCrypt credential representation; never a UI display field.', resetToken: 'Temporary password recovery credential.', mustChangePassword: 'Flags a temporary credential requiring a chosen replacement.', resetTokenExpiresAt: 'Expiry instant for the recovery token.', paid: 'Credited confirmed amount on an invoice.', total: 'Total bill/order/sale amount in this context.', amount: 'Decimal monetary amount; meaning depends on the containing record.', schoolClass: 'Related class object; requests often carry a classId instead.', classTeacher: 'Staff profile assigned as this class teacher.', classId: 'Identifier used to resolve a class relationship.', termId: 'Identifier of the relevant academic term.', term: 'Related academic term object.', academicYear: 'Related academic year object.', pupil: 'Related pupil object.', pupilId: 'Identifier used to resolve or select a pupil.', subject: 'Related teaching subject.', subjectId: 'Identifier used to resolve a subject.', invoice: 'Related pupil invoice; a payment may have no invoice.', invoiceId: 'Identifier used to select an invoice.', feeItem: 'Charge definition underlying this invoice.', outOf: 'Maximum raw assessment score used to convert scores to percentages.', score: 'Raw earned assessment score.', weight: 'Assessment weight; current term-pivot averaging does not automatically use this field.', status: 'Current workflow state; see the enum or string default and action methods.', roles: 'Assigned role links/names; dynamic role permissions are resolved separately.', permissions: 'Action grants associated with a role or returned for UI gating.', createdAt: 'Creation timestamp.', updatedAt: 'Most recent update timestamp.', startedOn: 'Start date of the recorded interval.', endedOn: 'End date of the recorded interval; null can mean active enrollment.', levelOrder: 'Configured progression order used by promotion logic.', photoUrl: 'URL referencing uploaded image bytes.', signatureUrl: 'URL referencing an uploaded signature image.', temporaryPassword: 'Request-only bootstrap credential that the backend hashes.', reference: 'External or human-facing reconciliation reference.', paymentId: 'Confirmed payment link used as an ordinary conversion duplicate guard.', receivedAt: 'Stamp used to prevent ordinary repeat purchase-order receiving.', lateFeeApplied: 'Marks an original invoice after issuing its late-fee invoice.', quantity: 'Count or movement quantity; read direction/action semantics.', isCurrent: 'Selects the current academic year/term.', gradingScale: 'Serialized grade configuration; verify which consumers actually use it.' };
  if (exact[name]) return exact[name];
  if (entityMeaning[type]) return 'Related ' + words(type) + ' object. ' + entityMeaning[type];
  if (/^List</.test(type)) return 'Collection of ' + words(type.slice(5, -1)) + ' values or related rows; inspect relationship annotations.';
  if (/Url$/.test(name)) return words(name) + ' reference; the bytes/resource are stored separately.';
  if (/Id$/.test(name)) return 'Identifier for ' + words(name.slice(0, -2)) + '; inspect lookup and relationship validation.';
  if (/LocalDate/.test(type)) return 'Calendar date for ' + words(name) + ', without a time-of-day or timezone.';
  if (/Instant|LocalDateTime|LocalTime/.test(type)) return 'Time value for ' + words(name) + '; serialization and timezone interpretation depend on the declared type.';
  if (/boolean|Boolean/.test(type)) return 'Flag controlling ' + words(name.replace(/^is(?=[A-Z])/, '')) + '; see its default and consuming conditions.';
  if (/BigDecimal|double|int|Integer|long/.test(type)) return 'Numeric ' + words(name) + '; inspect default, calculation and constraints in its containing operation.';
  return 'Stores ' + words(name) + ' for the containing record. Its use and optionality are defined by annotations and consumers below.';
}
function statementHelp(text, language) {
  const t = squash(text);
  if (/^(return\s+)?(?:\(?\s*)?</.test(t) || /^return\s*\(\s*</.test(t)) return 'Render the UI tree. JSX expressions read draft/query values; callbacks trigger edits or mutations. Inspect conditional branches and mapped rows in the source listing.';
  if (/useQuery\s*\(/.test(t)) return 'Declare a cached server read. queryKey separates cached results; enabled gates readiness; queryFn supplies the request.';
  if (/useMutation\s*\(/.test(t)) return 'Declare a write/action and its success/error callbacks. mutate invokes it; it does not run merely because it is declared.';
  if (/useState(?:<[^>]*>)?\s*\(/.test(t)) return 'Create a local draft/control value and setter. This state change alone does not persist a database row.';
  if (/useEffect\s*\(/.test(t)) return 'Synchronize effects after render; dependency values determine reruns and returned cleanup releases listeners/timers.';
  if (/useMemo\s*\(/.test(t)) return 'Compute a derived value from declared dependencies; this is a render optimization, not a server save.';
  if (/useRef(?:<[^>]*>)?\s*\(/.test(t)) return 'Retain a DOM reference or mutable value without triggering a render.';
  if (/invalidateQueries/.test(t)) return 'Mark matching query caches stale after a write. Other differently named caches are not automatically refreshed.';
  if (/^if\b|^switch\b/.test(t)) return 'Branch on a condition. Read the included guard and alternate path before assuming the success path always runs.';
  if (/^(for|while|do)\b/.test(t)) return 'Repeat work for multiple values. Individual HTTP requests/repository calls need a separate transaction strategy for all-or-nothing behaviour.';
  if (/^try\b/.test(t)) return 'Run work with explicit error handling and optional cleanup. Compare which failures are propagated versus reported/ignored.';
  if (/throw\s+new/.test(t)) return 'Reject the operation with an exception; the exception type determines its translated response.';
  if (/\.assertInScope|requireLinkedChild|assertPupilInScope/.test(t)) return 'Authorize access to the selected record/class, independently of the general action permission.';
  if (/\.save(?:AndFlush|All)?\s*\(/.test(t)) return 'Persist an entity or collection. Atomicity with other writes depends on the enclosing transaction, not just this save call.';
  if (/\.delete\w*\s*\(/.test(t)) return 'Remove stored data or a relationship. Foreign keys/cascades and authorization determine consequences.';
  if (/\.(?:find|count|exists|sum)\w*\s*\(/.test(t)) return 'Read or aggregate stored records. Empty/null/Optional handling defines the missing-data path.';
  if (/\.set\w+\s*\(/.test(t) && language === 'java') return 'Assign entity/DTO values in memory. Persistence occurs through save or managed-entity transaction behaviour.';
  if (/api\./.test(t)) return 'Call the typed browser API. Inspect its HTTP contract and awaited result; follow-up requests can fail separately.';
  if (/^return\b/.test(t)) return language === 'java' ? 'Return the result to the caller. A controller return is normally serialized as JSON unless it explicitly returns a raw response.' : 'Return the result to this function caller. Components can return React elements; hooks and helpers can return data, references or callbacks.';
  if (/^const\b|^let\b|^var\b/.test(t)) return 'Prepare a local binding or derived helper used by later logic. Read the expression to distinguish data, state, and callback definitions.';
  if (/audit\w*\.log|log\.(info|warn|error|debug)/.test(t)) return 'Record an audit or diagnostic event. Diagnostics and persistent audit rows have different storage and audiences.';
  if (/build\s*\(|builder\s*\(/.test(t)) return 'Construct an entity/DTO value. Builder defaults and explicitly supplied fields determine its initial state.';
  return language === 'java' ? 'Perform the next orchestration/computation step. Follow its inputs, assignments and calls in execution order.' : 'Evaluate the next declaration/computation or callback. Values feed later rendering, queries, or event handlers.';
}
function tsAnalysis(f) {
  const sf = ts.createSourceFile(f.rel, f.text, ts.ScriptTarget.Latest, true, f.rel.endsWith('tsx') ? ts.ScriptKind.TSX : f.rel.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS);
  const funcs = [], interfaces = [], state = [], queries = [], mutations = [], effects = [], exported = [], apiOps = [];
  function visit(n) {
    const start = n.getStart(sf), line = sf.getLineAndCharacterOfPosition(start).line + 1;
    if (ts.isFunctionDeclaration(n) && n.name) funcs.push({ name: n.name.text, line, node: n });
    if (ts.isVariableDeclaration(n) && n.initializer) {
      if (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer)) funcs.push({ name: n.name.getText(sf), line, node: n.initializer });
      else if (ts.isCallExpression(n.initializer) && /(?:forwardRef|memo|useCallback)$/.test(n.initializer.expression.getText(sf))) {
        const callback = n.initializer.arguments.find(a => ts.isArrowFunction(a) || ts.isFunctionExpression(a));
        if (callback) funcs.push({ name: n.name.getText(sf), line, node: callback });
      }
    }
    if (ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n)) interfaces.push({ name: n.name.text, line, node: n });
    if (ts.isExportDeclaration(n) && n.exportClause) exported.push(n.exportClause.getText(sf));
    if (n.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) && n.name) exported.push(n.name.getText(sf));
    if (ts.isVariableStatement(n) && n.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) exported.push(...n.declarationList.declarations.map(d => d.name.getText(sf)));
    if (ts.isCallExpression(n)) {
      const callee = n.expression.getText(sf), simple = callee.split('.').pop();
      if (['useState', 'useQuery', 'useQueries', 'useMutation', 'useEffect', 'useMemo', 'useRef'].includes(simple)) {
        const parent = ts.isVariableDeclaration(n.parent) ? n.parent.name.getText(sf) : '(effect/inline)';
        if (simple === 'useState') state.push({ line, name: parent, initial: n.arguments[0]?.getText(sf) ?? 'undefined' });
        if (simple === 'useEffect') effects.push({ line, dependencies: n.arguments[1]?.getText(sf) ?? 'No dependency array', source: n.getText(sf) });
        if (simple === 'useQuery' || simple === 'useQueries' || simple === 'useMutation') {
          const arg = n.arguments[0];
          const props = arg && ts.isObjectLiteralExpression(arg) ? Object.fromEntries(arg.properties.filter(ts.isPropertyAssignment).map(p => [p.name.getText(sf), p.initializer.getText(sf)])) : {};
          if (simple === 'useQueries') props.queryFn = 'Multiple query definitions: ' + (props.queries ?? arg?.getText(sf) ?? 'inspect source');
          (simple === 'useQuery' || simple === 'useQueries' ? queries : mutations).push({ line, name: parent, props });
        }
      }
    }
    ts.forEachChild(n, visit);
  }
  visit(sf);
  function scanApi(obj, prefix) {
    for (const p of obj.properties) {
      if (!ts.isPropertyAssignment(p)) continue;
      const name = prefix + '.' + p.name.getText(sf);
      if (ts.isObjectLiteralExpression(p.initializer)) scanApi(p.initializer, name);
      else apiOps.push({ name, line: sf.getLineAndCharacterOfPosition(p.getStart(sf)).line + 1, source: p.initializer.getText(sf) });
    }
  }
  if (f.rel === 'src/lib/api.ts') for (const st of sf.statements) if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) if (d.name.getText(sf) === 'api' && ts.isObjectLiteralExpression(d.initializer)) scanApi(d.initializer, 'api');
  return { sf, funcs, interfaces, state, queries, mutations, effects, exported: uniq(exported), apiOps };
}
function tsReference(f) {
  const a = tsAnalysis(f), sf = a.sf;
  f.symbols = uniq([...a.funcs.map(x => x.name), ...a.interfaces.map(x => x.name)]);
  let h = '';
  const imports = sf.statements.filter(ts.isImportDeclaration).map(n => n.moduleSpecifier.text);
  const local = uniq(imports.map(i => resolveLocal(f, i)).filter(Boolean));
  if (local.length) h += '<h4>Local dependencies</h4>' + list(local.map(x => linkFile(x)));
  const external = uniq(imports.filter(i => !i.startsWith('.') && !i.startsWith('@/')));
  if (external.length) h += '<p><strong>External libraries</strong> ' + external.map(code).join(', ') + '.</p>';
  if (a.exported.length) h += '<p><strong>Exported building blocks</strong> ' + a.exported.map(code).join(', ') + '.</p>';
  const route = f.text.match(/createFileRoute\(\s*["']([^"']+)/)?.[1];
  if (route) h += '<p><strong>Route declaration</strong> ' + code(route) + '. The pathless layout identifier is omitted from the browser URL; generated route registration resolves the final route.</p>';
  if (a.state.length) h += '<h4>Local state</h4>' + table(['Declaration', 'Initial value', 'Meaning'], a.state.map(x => [code(x.name) + ' <small>L' + x.line + '</small>', code(x.initial), esc('Draft/control state for ' + words(x.name.replace(/^\[/, '').split(',')[0]) + '. Its setter rerenders this component; persistence requires a mutation/action.')]));
  if (a.queries.length) h += '<h4>Server reads and cache identity</h4>' + table(['Line', 'Query key', 'Request and readiness'], a.queries.map(x => [String(x.line), code(x.props.queryKey ?? '(supplied options)'), code(x.props.queryFn ?? '(supplied options)') + '<br><strong>Enabled</strong> ' + code(x.props.enabled ?? 'default') + (x.props.staleTime ? '<br><strong>Stale time</strong> ' + code(x.props.staleTime) : '') + (x.props.refetchInterval ? '<br><strong>Polling</strong> ' + code(x.props.refetchInterval) : '')]));
  if (a.mutations.length) h += '<h4>Writes and cache refresh</h4>' + table(['Line', 'Mutation', 'Success and failure behaviour'], a.mutations.map(x => [String(x.line), code(x.props.mutationFn ?? '(supplied options)'), '<strong>Success</strong> ' + code(x.props.onSuccess ?? 'No local success handler') + '<br><strong>Error</strong> ' + code(x.props.onError ?? 'No local error handler')]));
  if (a.effects.length) h += '<h4>Effects and synchronization</h4>' + list(a.effects.map(x => '<strong>L' + x.line + '</strong> dependencies ' + code(x.dependencies) + '. ' + esc(statementHelp(x.source, 'ts'))));
  const perms = uniq([...f.text.matchAll(/["']([a-z_]+:[a-z_]+)["']/g)].map(x => x[1]));
  if (perms.length) h += '<p><strong>Permission names present</strong> ' + perms.map(code).join(', ') + '. Compare the expressions at their call sites with the backend authorization rule.</p>';
  if (a.apiOps.length) h += '<h4>Every grouped API operation</h4>' + table(['Operation and line', 'Exact client implementation', 'How to read it'], a.apiOps.map(x => {
    const call = x.source.match(/\b(get|post|put|patch|del)(?:<[^\n]*?>)?\s*\(/)?.[1];
    return [code(x.name) + ' L' + x.line, code(x.source), esc(call ? ({ get: 'GET reads data; parameters after the path become URL query values.', post: 'POST creates a record or runs an action; supplied data becomes JSON.', put: 'PUT submits an update; actual replace/patch semantics are defined by the Java mapper.', patch: 'PATCH performs a targeted update or action.', del: 'DELETE removes a record; linked data and reversal rules are defined server-side.' })[call] : 'Special binary, multipart, or custom request handling. Follow its fetch/response body below.')];
  }));
  if (a.interfaces.length) {
    h += '<h4>Types and field contracts</h4>';
    for (const x of a.interfaces) {
      const members = ts.isInterfaceDeclaration(x.node) ? x.node.members : ts.isTypeLiteralNode(x.node.type) ? x.node.type.members : null;
      if (members) h += '<h5>' + esc(x.name) + ' <small>L' + x.line + '</small></h5>' + table(['Field', 'Type and optionality', 'Meaning'], members.map(m => [code(m.name?.getText(sf) ?? m.getText(sf)), code((m.questionToken ? 'optional ' : '') + (m.type?.getText(sf) ?? m.getText(sf))), esc(fieldMeaning(m.name?.getText(sf) ?? 'member', m.type?.getText(sf) ?? 'unknown'))]));
      else h += '<p>' + code(x.name) + ' L' + x.line + ': ' + code(x.node.getText(sf)) + '</p>';
    }
  }
  if (a.funcs.length) {
    h += '<h4>Function walkthroughs</h4>';
    for (const x of a.funcs) {
      const body = x.node.body;
      const statements = body && ts.isBlock(body) ? body.statements : body ? [body] : [];
      h += '<details class="symbol"><summary>' + esc(x.name) + ' <small>L' + x.line + ' to L' + (sf.getLineAndCharacterOfPosition(x.node.end).line + 1) + '</small></summary>';
      h += '<p><strong>Inputs</strong> ' + code(x.node.parameters.map(p => p.getText(sf)).join(', ') || 'No explicit parameters') + '.</p>';
      h += table(['Line', 'Execution step', 'Explanation'], statements.map(st => {
        const text = st.getText(sf); const jsx = /return\s*\(?\s*</.test(text);
        return [String(sf.getLineAndCharacterOfPosition(st.getStart(sf)).line + 1), code(jsx ? text.slice(0, 180) + (text.length > 180 ? ' ... [full JSX in source listing]' : '') : text.slice(0, 700) + (text.length > 700 ? ' ... [continued in source]' : '')), esc(statementHelp(text, 'ts'))];
      }));
      h += '</details>';
    }
  }
  return h;
}
function javaReference(f) {
  const s = f.text, methods = javaMethods(f), mask = maskJava(s);
  f.symbols = methods.map(m => m.name);
  let h = '';
  const imports = [...s.matchAll(/^import\s+(com\.brightminds\.school\.[\w.]+);/gm)].map(m => m[1]);
  const related = uniq(imports.map(i => files.find(x => x.side === 'backend' && x.rel.endsWith('/' + i.split('.').pop() + '.java'))).filter(Boolean));
  if (related.length) h += '<h4>Local dependencies</h4>' + list(related.map(x => linkFile(x, x.name)));
  const annotations = uniq(javaAnnotations(s).map(x => x.name));
  h += '<h4>Annotations used in this file</h4>' + table(['Annotation', 'Purpose'], annotations.map(a => [code('@' + a), esc(annotationHelp(a))]));
  const clsIndex = mask.search(/\b(?:class|interface|enum|record)\s+\w+/), clsPrefix = s.slice(0, clsIndex);
  const basePath = clsPrefix.match(/@RequestMapping\s*\(\s*"([^"]*)"/)?.[1] ?? '';
  const classSecurity = clsPrefix.match(/@PreAuthorize\s*\(\s*"([^"]*)"/)?.[1];
  if (f.category === 'Controllers') h += '<p><strong>Controller base URL</strong> ' + code('/api' + basePath) + '. <strong>Class rule</strong> ' + code(classSecurity ?? 'Authenticated by global security; inspect method-specific rules') + '. A method-level PreAuthorize replaces a class-level rule for that method.</p>';
  const ranges = methods.map(m => [m.start, m.end]);
  const fieldRx = /\b(private|public|protected)\s+((?:(?:static|final|volatile|transient)\s+)*(?!class\b|interface\b|enum\b|record\b|static\b|final\b)[A-Za-z_$][\w.$]*(?:\s*<[^;=()]+>)?(?:\[\])?)\s+([^;]+);/g;
  const fields = [];
  for (const m of s.matchAll(fieldRx)) {
    if (ranges.some(([a,b]) => m.index >= a && m.index < b)) continue;
    if (/\bclass\b|\binterface\b|\benum\b/.test(m[2])) continue;
    const before = s.slice(Math.max(mask.lastIndexOf(';', m.index-1), mask.lastIndexOf('}', m.index-1), mask.lastIndexOf('{', m.index-1))+1, m.index);
    const declarators = m[3], dm = maskJava(declarators); let begin=0, depth=0;
    const chunks=[];
    for(let i=0;i<dm.length;i++){if('([{<'.includes(dm[i]))depth++;else if(')]}>'.includes(dm[i]))depth--;else if(dm[i]===','&&depth===0){chunks.push(declarators.slice(begin,i));begin=i+1;}}
    chunks.push(declarators.slice(begin));
    for(const chunk of chunks){const d=chunk.trim().match(/^([A-Za-z_]\w*)\s*(?:=([\s\S]*))?$/);if(d)fields.push({name:d[1],type:squash(m[2]),line:lineAt(s,m.index),init:d[2]?squash(d[2]):'',annotations:javaAnnotations(before).map(x=>x.source).join(' ')});}
  }
  for(const r of s.matchAll(/\brecord\s+(\w+)\s*\(([^)]*)\)/g))for(const part of r[2].split(',')){const d=part.trim().match(/^([\w.<>?\[\]]+)\s+(\w+)$/);if(d)fields.push({name:r[1]+'.'+d[2],type:d[1],line:lineAt(s,r.index),init:'',annotations:'Record component: constructor input and immutable accessor.'});}
  if (fields.length) h += '<h4>Declared fields and dependencies</h4>' + table(['Field and line', 'Type and default', 'Role and mapping'], fields.map(x => [code(x.name) + ' L' + x.line, code(x.type) + (x.init ? '<br>Default ' + code(x.init) : ''), esc(fieldMeaning(x.name, x.type.replace(/^(final|static)\s+/, ''))) + (x.annotations ? '<br>' + code(squash(x.annotations)) : '')]));
  if (f.category === 'Enums') {
    const body = s.slice(s.indexOf('{') + 1, s.lastIndexOf('}')).split(';')[0];
    const constants = uniq([...maskJava(body).matchAll(/\b[A-Z][A-Z0-9_]*\b/g)].map(x => x[0]));
    h += '<h4>Allowed constants</h4>' + table(['Value', 'Readable meaning'], constants.map(x => [code(x), esc(words(x))]));
  }
  if (methods.length) {
    h += '<h4>Every declared method</h4>';
    for (const m of methods) {
      const security = m.annotations.find(a => a.startsWith('@PreAuthorize'))?.match(/"([^"]*)"/)?.[1] ?? classSecurity;
      const mapping = m.annotations.find(a => /^@(Get|Post|Put|Patch|Delete)Mapping/.test(a));
      h += '<details class="symbol" open><summary>' + esc(m.name) + ' <small>L' + m.line + ' to L' + m.endLine + '</small></summary>';
      h += '<p>' + code(m.signature) + '</p>';
      if (mapping) {
        const verb = mapping.match(/^@(\w+)Mapping/)[1].toUpperCase();
        const sub = mapping.match(/"([^"]*)"/)?.[1] ?? '';
        h += '<p><strong>HTTP</strong> ' + code(verb + ' /api' + basePath + sub) + '. <strong>Effective rule</strong> ' + code(security ?? 'Authenticated globally or explicitly public in SecurityConfig; no local permission expression') + '.</p>';
      }
      if (m.annotations.length) h += '<p><strong>Method annotations</strong> ' + m.annotations.map(code).join(' ') + '.</p>';
      if (f.category === 'Repositories') {
        const queryPrefix = s.slice(Math.max(s.lastIndexOf(';', m.start-1), s.lastIndexOf('{', m.start-1))+1,m.start);
        h += para('Query behaviour: ' + repositoryMeaning(m.name) + ' Inherited CRUD remains available even when not redeclared here.');
        if (queryPrefix.includes('@Query')) h += '<pre>' + esc(queryPrefix.trim()) + '</pre>';
      } else {
        const calls = uniq([...m.body.matchAll(/\b([a-z]\w*)\.(\w+)\s*\(/g)].map(x => x[1] + '.' + x[2]));
        if (calls.length) h += '<p><strong>Calls and collaborators</strong> ' + calls.map(code).join(', ') + '.</p>';
        const checks = m.body.split('\n').map((l, i) => ({l:l.trim(), line:lineAt(s,m.bodyStart)+i})).filter(x=>/^if\s*\(|^for\s*\(|^while\s*\(|throw new|\.save(?:AndFlush|All)?\(|\.delete\w*\(|\.adjust\(|\.log\(|return\b|\.set\w+\(/.test(x.l));
        if (checks.length) h += table(['Line', 'Observed step or branch', 'How to read it'], checks.map(x => [String(x.line), code(x.l), esc(statementHelp(x.l, 'java'))]));
        else if (m.body.trim()) h += para(statementHelp(m.body, 'java'));
      }
      h += '</details>';
    }
  }
  return h;
}
function repositoryMeaning(name) {
  if (name === 'search') return 'Runs the explicit search query with its supplied paging/filter parameters.';
  if (name.startsWith('find')) return 'Selects records using ' + words(name.replace(/^find/, 'find ')).replace(/ order by /, '; ordered by ') + '. Read nested property segments, In/Between/IsNull operators and sorting suffixes together.';
  if (name.startsWith('exists')) return 'Returns whether a matching record exists using ' + words(name.slice(6)) + '. This ordinary check alone does not serialize concurrent writers.';
  if (name.startsWith('count')) return 'Counts matching records using ' + words(name.slice(5)) + '.';
  if (name.startsWith('sum')) return 'Aggregates numeric values according to the explicit query and parameters.';
  if (name.startsWith('delete')) return 'Deletes the matching relationship/record using ' + words(name.slice(6)) + '; check transaction/cascade requirements.';
  return 'Uses the declared signature and any @Query text to select or change records.';
}
function splitSql(s) {
  // Mask literals/comments and dollar blocks so internal semicolons do not split a statement.
  const masked = s.replace(/--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|\$([A-Za-z_]\w*)?\$[\s\S]*?\$(?:[A-Za-z_]\w*)?\$/g, m=>m.replace(/[^\n]/g,' '));
  let start=0, out=[];
  for (let i=0;i<masked.length;i++) if(masked[i]===';') { const t=s.slice(start,i+1); if(t.replace(/--[^\n]*/g,'').trim())out.push({line:lineAt(s,start),source:t}); start=i+1; }
  if(s.slice(start).replace(/--[^\n]*/g,'').trim())out.push({line:lineAt(s,start),source:s.slice(start)});
  return out;
}
function sqlReference(f) {
  const statements=splitSql(f.text);
  const comments=f.text.split('\n').filter(l=>/^\s*--/.test(l)).map(l=>l.replace(/^\s*--\s?/, '')).filter(l=>l.trim()&&!/^[=\- ]+$/.test(l));
  let h='';
  if(comments.length)h+='<h4>Intent recorded in the migration</h4>'+para(comments.join(' '));
  h+='<h4>Statements in execution order</h4>'+table(['Step and starting line','Operation','Explanation'],statements.map((st,i)=>{
    const raw=st.source.replace(/--[^\n]*|\/\*[\s\S]*?\*\//g,'').trim();
    const head=squash(raw).slice(0,240);
    let meaning=/^CREATE\s+(?:OR REPLACE\s+)?TABLE/i.test(raw)?'Defines a table, its fields, defaults, keys and relationship constraints. Existing data is not automatically backfilled unless later statements do so.':/^ALTER TABLE/i.test(raw)?'Changes an existing table or column. Read type conversions, nullability and foreign-key actions with the relevant entity mapping.':/^CREATE\s+(?:UNIQUE\s+)?INDEX/i.test(raw)?'Creates a lookup index or a uniqueness rule. UNIQUE and any WHERE clause determine which duplicate data is prohibited.':/^INSERT/i.test(raw)?'Seeds or backfills data. For role_permissions, this changes grants available to PermissionService; conflict handling controls safe reapplication.':/^UPDATE/i.test(raw)?'Transforms existing rows. The WHERE clause and joins decide which history or configuration changes.':/^DELETE/i.test(raw)?'Removes matching rows, often as cleanup/deduplication before a new constraint. Review affected history before migration.':/^CREATE\s+(?:OR REPLACE\s+)?FUNCTION/i.test(raw)?'Defines a stored helper function. Arguments, SECURITY DEFINER, search_path and body affect behaviour and privilege.':/^CREATE POLICY/i.test(raw)?'Defines a Supabase/PostgreSQL row security policy: command, roles, USING and WITH CHECK control access. This is separate from Spring method security.':/^CREATE TRIGGER/i.test(raw)?'Registers automatic database behaviour on specified row events.':/^GRANT/i.test(raw)?'Grants database privileges to a database role, separate from application role records.':/^CREATE TYPE/i.test(raw)?'Creates a PostgreSQL enum type and its allowed values. Match entity JDBC enum mapping.':'Runs the SQL command shown. Read transaction/block boundaries and full source for its exact scope.';
    return [String(i+1)+' / L'+st.line,code(head)+(raw.length>240?' <small>continued in source</small>':''),esc(meaning)];
  }));
  return h;
}
function configReference(f) {
  let h='';
  if (f.rel === 'src/styles.css') {
    const props = [...f.text.matchAll(/^\s*(--[\w-]+)\s*:\s*([^;]+);/gm)];
    h += '<h4>Design tokens and values</h4>' + table(['Token', 'Declared value', 'Purpose'], props.map(m => [code(m[1]), code(m[2].trim()), esc('Shared ' + m[1].slice(2).replaceAll('-', ' ') + ' setting. Its enclosing :root, dark, or theme block determines when it applies.')]));
    const blocks = [...f.text.matchAll(/([^{}]+)\{/g)].map(m => ({ selector: squash(m[1].replace(/\/\*[\s\S]*?\*\//g, '')), line: lineAt(f.text, m.index) })).filter(x => x.selector && !x.selector.includes(';'));
    h += '<h4>Style blocks in source order</h4>' + table(['Starting line', 'Selector or rule', 'How to read it'], blocks.map(x => [String(x.line), code(x.selector), esc(x.selector.startsWith('@media') ? 'Conditional rules for viewport, print or preference. Nested selectors apply only in that condition.' : x.selector.startsWith('@keyframes') ? 'Animation sequence defining intermediate visual states; consumers select it through an animation declaration.' : x.selector.startsWith('@') ? 'Tailwind/CSS directive or theme rule; inspect nested declarations and consumers.' : 'Applies declarations to matching elements/classes/states. Read the enclosing media/theme rule and cascade order before changing it.')]));
  }
  if(f.envNames.length)h+='<h4>Variable names only</h4>'+list(f.envNames.map(code));
  if(f.name==='package.json'){
    const p=JSON.parse(f.text);
    h+='<h4>Developer commands</h4>'+table(['Script','Command','Purpose'],Object.entries(p.scripts).map(([k,v])=>[code(k),code(v),esc(({dev:'Start the Vite development server.',build:'Create production bundles/server output.','build:dev':'Build using development mode.',preview:'Preview the built frontend.', 'type-check':'TypeScript checks without generated JavaScript.',lint:'Check source rules and formatting.',format:'Rewrite source formatting; this command changes files.'})[k]||'Run the configured command.')]));
    h+='<h4>Direct dependencies</h4>'+table(['Package','Declared range','Group'],[...Object.entries(p.dependencies).map(([k,v])=>[code(k),code(v),'Runtime/build integration']),...Object.entries(p.devDependencies).map(([k,v])=>[code(k),code(v),'Development tooling'])]);
  }
  if(f.name==='pom.xml')h+='<h4>Maven dependencies</h4>'+table(['Artifact','Purpose'],[...f.text.matchAll(/<dependency>\s*<groupId>([^<]+)<\/groupId>\s*<artifactId>([^<]+)<\/artifactId>[\s\S]*?<\/dependency>/g)].map(m=>[code(m[1]+':'+m[2]),esc(/test/.test(m[2])?'Testing infrastructure.':/jpa/.test(m[2])?'Entity persistence and repositories.':/security/.test(m[2])?'Authentication and authorization.':/flyway/.test(m[2])?'Ordered database migration execution.':/postgresql/.test(m[2])?'PostgreSQL database connectivity.':/mail/.test(m[2])?'SMTP email integration.':/validation|validator/.test(m[2])?'Request Bean Validation support.':/jjwt/.test(m[2])?'JWT creation/parsing runtime.':/lombok/.test(m[2])?'Compile-time boilerplate generation.':/springdoc/.test(m[2])?'OpenAPI documentation endpoints/UI.':/jackson/.test(m[2])?'JSON integration for Hibernate entities.':'Spring web/application dependency.') ]));
  if(f.name==='application.yml'){
    const vars=uniq([...f.text.matchAll(/\$\{([A-Z_]+)(?::[^}]*)?\}/g)].map(m=>m[1]));
    h+='<h4>Environment overrides referenced</h4>'+list(vars.map(code));
    h+=para('Read the property hierarchy in the redacted source: spring.datasource is persistence; spring.jackson is JSON; spring.jpa and spring.flyway control schema/persistence; spring.servlet is upload request size; spring.mail is SMTP; server sets port/context; app groups school runtime integrations. A property being declared does not prove every consumer uses it (for example the upload response path is constructed directly).');
  }
  if(f.lock)h+=para('This lockfile contains '+f.lines+' lines and '+f.bytes.toLocaleString()+' bytes of generated dependency resolution data. Its checksum in the header identifies the captured version. Do not teach individual transitive metadata entries as school business logic.');
  return h;
}
function sourceListing(f) {
  const text=safeSource(f);
  if(text===null)return '<p class="muted">Source/content not reproduced for this data, secret, binary, scratch, or generated lock-data file.</p>';
  const lines=text.replace(/\r\n/g,'\n').split('\n');
  return '<details class="source"><summary>Expand numbered source snapshot '+lines.length+' lines</summary><pre class="source-code">'+lines.map((l,i)=>'<span class="source-line"><span class="ln" aria-hidden="true">'+(i+1)+'</span>'+esc(l)+'\n</span>').join('')+'</pre></details>';
}
function markdown(md) {
  const blocks=[];
  md=md.replace(/```([^\n]*)\n([\s\S]*?)```/g,(_,lang,txt)=>{blocks.push('<pre class="example" data-language="'+esc(lang)+'">'+esc(txt.trimEnd())+'</pre>');return '\n@@BLOCK'+(blocks.length-1)+'@@\n';});
  const inline=s=>esc(s).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
  const lines=md.split(/\r?\n/),out=[];let p=[];
  const flush=()=>{if(p.length){out.push('<p>'+inline(p.join(' '))+'</p>');p=[];}};
  for(let i=0;i<lines.length;i++){
    const l=lines[i];
    if(l.startsWith('|')){flush();let rows=[];while(i<lines.length&&lines[i].startsWith('|')){rows.push(lines[i].slice(1,-1).split('|').map(x=>x.trim()));i++;}i--;const header=rows.shift();if(rows[0]?.every(x=>/^[: -]+$/.test(x)))rows.shift();out.push(table(header,rows.map(r=>r.map(inline))));continue;}
    const heading=l.match(/^(#{1,6})\s+(.*)/);
    if(heading){flush();const level=heading[1].length;const id='chapter-'+heading[2].toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,'');out.push('<h'+level+' id="'+id+'">'+inline(heading[2])+'</h'+level+'>');continue;}
    const b=l.match(/^@@BLOCK(\d+)@@$/);if(b){flush();out.push(blocks[Number(b[1])]);continue;}
    if(!l.trim())flush();else p.push(l);
  }
  flush();return out.join('\n');
}
const chapters=fs.readFileSync(path.join(__dirname,'teaching-guide.md'),'utf8');
const chapterLinks=[...chapters.matchAll(/^## (.+)$/gm)].map(m=>({title:m[1],id:'chapter-'+m[1].toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,'')}));
const manualSections=[];
for(const f of files){
  let details='';
  if(f.text!==null&&!f.lock){
    if(/\.(ts|tsx|js)$/.test(f.rel))details=tsReference(f);
    else if(/\.java$/.test(f.rel))details=javaReference(f);
    else if(/\.sql$/.test(f.rel))details=sqlReference(f);
  }
  details+=configReference(f);
  const description=summary(f);
  f.summary=description;
  manualSections.push('<article class="file" id="'+f.id+'" data-side="'+f.side+'" data-category="'+esc(f.category)+'"><p class="eyebrow">'+esc(f.side)+' / '+esc(f.category)+'</p><h3>'+esc(f.rel)+'</h3><p class="metadata">'+f.bytes.toLocaleString()+' bytes'+(f.lines!==null?' · '+f.lines.toLocaleString()+' source lines':' · metadata only')+(f.sha256?' · SHA256 '+f.sha256.slice(0,16):'')+'</p>'+para(description)+details+sourceListing(f)+'<p class="back"><a href="#file-reference">Back to file search</a></p></article>');
}
const groups=uniq(files.map(f=>f.category)).sort();
const counts=groups.map(g=>[esc(g),String(files.filter(f=>f.category===g).length)]);
const catalog=files.map(f=>'<li data-file="'+f.id+'">'+linkFile(f,f.side+' / '+f.rel)+'</li>').join('');
const stats={totalFiles:files.length,frontendFiles:files.filter(f=>f.side==='frontend').length,backendFiles:files.filter(f=>f.side==='backend').length,sourceLines:files.reduce((a,f)=>a+(f.lines??0),0),categories:Object.fromEntries(counts),chapters:chapterLinks.length};
const html='<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bright Minds School Hub Developer Teaching Manual</title><style>'+String.raw`
:root{color-scheme:light;--ink:#17212c;--muted:#516171;--line:#d4dde4;--brand:#165879;--bg:#f4f7f9}*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:24px}body{margin:0;color:var(--ink);background:var(--bg);font:16px/1.68 system-ui,-apple-system,"Segoe UI",sans-serif}a{color:#125678;text-underline-offset:3px;overflow-wrap:anywhere}a:hover{color:#062f47}nav{position:fixed;inset:0 auto 0 0;width:280px;overflow:auto;padding:28px 24px;background:#fff;border-right:1px solid var(--line)}nav .title{font-size:18px;font-weight:750;line-height:1.35}nav ol{padding-left:0;list-style:none}nav li{margin:9px 0;font-size:13px;line-height:1.5}main{margin-left:280px;padding:42px 4vw 100px;max-width:1600px}.paper{background:white;padding:42px clamp(20px,4vw,64px);border:1px solid var(--line);border-radius:8px}h1,h2,h3,h4,h5{color:#101820;line-height:1.25;overflow-wrap:anywhere}h1{font-size:38px;max-width:900px;margin:0 0 24px;letter-spacing:-1px}h2{font-size:28px;margin:58px 0 20px;padding-top:12px}h3{font-size:23px;margin:8px 0 10px}h4{font-size:18px;margin:28px 0 12px}h5{font-size:16px;margin:24px 0 10px}p{max-width:100ch;margin:16px 0}p,td,li{overflow-wrap:anywhere}.eyebrow{color:var(--brand);text-transform:uppercase;font-size:11px;letter-spacing:1.7px;font-weight:750;margin:0}.metadata,.muted,small{color:var(--muted)}.metadata{font-size:12px;font-family:ui-monospace,Consolas,monospace}.table-wrap{overflow:auto;margin:20px 0 28px}table{border-collapse:collapse;width:100%;font-size:13px;line-height:1.6}th,td{border:1px solid var(--line);padding:11px 13px;vertical-align:top;text-align:left;min-width:80px}th{background:#e9eff3;color:#10222f;font-weight:700}tr:nth-child(even) td{background:#fafcfd}code{font:12px/1.6 ui-monospace,Consolas,monospace;background:#eef2f5;padding:1px 4px;border-radius:3px;white-space:pre-wrap;overflow-wrap:anywhere}pre{background:#f3f6f8;border:1px solid var(--line);border-radius:5px;padding:18px;font:12px/1.65 ui-monospace,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}.example{font-size:13px}.file{padding:34px 0;border-top:2px solid #b7c9d5;content-visibility:auto;contain-intrinsic-size:auto 1600px}.file[hidden]{display:none}.symbol{margin:12px 0;border-bottom:1px solid var(--line);padding-bottom:12px}.symbol summary{font-size:15px;font-weight:700;cursor:pointer;padding:10px 0}.symbol summary small{font-weight:400;margin-left:12px}.source summary{cursor:pointer;font-weight:700;color:var(--brand);padding:12px 0}.source-code{max-height:680px;overflow:auto;white-space:pre;padding:16px 10px;font-size:11px;line-height:1.7}.source-line{display:block;min-height:1.7em}.ln{display:inline-block;width:48px;color:#6d7d88;text-align:right;margin-right:18px;user-select:none}.back{font-size:12px}.tools{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}input,select,button{font:inherit;padding:10px 12px;border:1px solid #aebdc7;border-radius:5px;background:white;color:var(--ink)}input{flex:1;min-width:210px}button{cursor:pointer;font-size:13px;font-weight:650}button:hover{background:#edf3f6}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid #79b7da;outline-offset:3px}.catalog{max-height:350px;overflow:auto;border:1px solid var(--line);padding:16px 24px 16px 40px;background:#fafcfd;font:12px/1.8 ui-monospace,Consolas,monospace}.catalog li[hidden]{display:none}.stats{color:var(--muted);font-size:13px}.flow{display:flex;align-items:stretch;gap:9px;flex-wrap:wrap;margin:24px 0}.flow span{flex:1;min-width:130px;padding:14px;border:1px solid var(--line);font-size:13px;background:#f6f9fb;border-radius:4px}.flow b{display:block}.flow i{align-self:center;font-style:normal;color:#688091}.nav-toggle{display:none}.print-note{font-size:12px;color:var(--muted)}@media(max-width:1050px){nav{position:static;width:auto;border-right:0;border-bottom:1px solid var(--line);max-height:340px}nav ol{columns:2}main{margin-left:0;padding:24px}.paper{padding:28px 24px}h1{font-size:32px}}@media(max-width:600px){main{padding:12px}.paper{padding:22px 16px}nav{padding:20px}nav ol{columns:1}h1{font-size:28px}h2{font-size:24px}h3{font-size:19px}th,td{padding:8px}input,select{width:100%}.flow i{display:none}}@media print{@page{size:A4;margin:18mm}body{background:white;font:10pt/1.55 Arial,sans-serif}nav,.tools,.catalog,.back,.print-note{display:none}main{margin:0;padding:0;max-width:none}.paper{padding:0;border:0}h1{font-size:26pt}h2{font-size:19pt;break-before:auto;margin-top:28pt}h3{font-size:15pt}h4{font-size:12pt}h1,h2,h3,h4,h5,summary{break-after:avoid}table{font-size:8pt}thead{display:table-header-group}tr{break-inside:avoid}th,td{padding:6pt;border:0.5pt solid #b5bcc2}pre{font-size:8pt;white-space:pre-wrap;overflow-wrap:anywhere}.file{content-visibility:visible;contain-intrinsic-size:none;break-before:page}.source{display:none}.symbol{break-inside:auto}.symbol:not([open])> :not(summary){display:none}a{text-decoration:none;color:black}code{font-size:8pt}.flow{break-inside:avoid}.ln{width:30px}.file[hidden]{display:none}}
`+'</style></head><body><nav aria-label="Manual contents"><div class="title">Bright Minds School Hub<br>Developer teaching manual</div><p class="stats">23 October 2026<br>'+stats.totalFiles+' catalogued files<br>Frontend and Java backend</p><ol>'+chapterLinks.map(x=>'<li><a href="#'+x.id+'">'+esc(x.title)+'</a></li>').join('')+'<li><a href="#file-reference">Complete file reference</a></li><li><a href="#coverage">Coverage and exclusions</a></li></ol></nav><main><div class="paper">'+markdown(chapters)+'<section id="architecture-diagram"><h2>Request path at a glance</h2><div class="flow"><span><b>React screen</b>State and user actions</span><i>→</i><span><b>API client</b>JSON and bearer token</span><i>→</i><span><b>Spring Security</b>Identity and action rules</span><i>→</i><span><b>Controller and service</b>Scope and business rules</span><i>→</i><span><b>Repository and database</b>Persist and query rows</span></div><p>Results return to the query or mutation. Cache invalidation refreshes the relevant screen; separate HTTP actions are separate units of work.</p></section><section id="file-reference"><h2>Complete file reference</h2><p>Search finds filenames, explanations, symbols, query keys, fields, endpoint code and source text. It filters the reference entries and index; the teaching chapters remain visible. Source is collapsed by default. Open function walkthroughs for execution detail. Browser Find searches currently expanded content.</p><div class="tools"><input id="search" type="search" aria-label="Search file reference" placeholder="Search filename symbol endpoint or topic"><select id="side" aria-label="Filter project"><option value="">Both projects</option><option value="frontend">Frontend</option><option value="backend">Backend</option></select><select id="category" aria-label="Filter file category"><option value="">All categories</option>'+groups.map(g=>'<option>'+esc(g)+'</option>').join('')+'</select><button type="button" id="clear">Clear filters</button><button type="button" id="expand">Expand function steps</button><button type="button" id="collapse">Collapse function steps</button><button type="button" id="print">Print current selection</button></div><p id="results" role="status" class="stats">'+files.length+' files shown</p><p class="print-note">Printing includes the guide and currently filtered file explanations. Numbered source snapshots are excluded from print to keep the manual manageable. Use your browser Save as PDF option if needed.</p><ul class="catalog" aria-label="File index">'+catalog+'</ul>'+manualSections.join('\n')+'</section><section id="coverage"><h2>Coverage and exclusions</h2><p>'+stats.frontendFiles+' frontend entries and '+stats.backendFiles+' backend entries were catalogued from the working folders. This includes source, migrations, startup/configuration, tooling and runtime-data metadata. Full source is included for readable application/configuration files with secret defaults redacted. Environment values, scratch identifiers, logs, uploaded contents, backup contents, binary assets and lockfile records are not reproduced.</p>'+table(['Category','Files'],counts)+'<p>Folder-level exclusions: .git is version-control internals; node_modules is installed third-party code; target and .output are generated builds; .tanstack and .wrangler are tooling caches/state; .claude and .kilo are local assistant state; docs is this generated documentation. Their recursive generated contents are not application source requiring per-file lessons. Runtime uploads and backup files are individually listed as metadata. Shared parent .github files and permission_audit_raw.txt are outside the two project roots.</p><p>Method/field tables are structural reading aids; exact source remains authoritative. This manual documents code behaviour without running school mutations, payment calls, email, migrations or restore. No claim of application test success is made.</p></section></div></main><script>'+String.raw`
const entries=Array.from(document.querySelectorAll('article.file'));const indexEntries=Array.from(document.querySelectorAll('.catalog li'));const search=document.querySelector('#search');const side=document.querySelector('#side');const category=document.querySelector('#category');const results=document.querySelector('#results');const haystack=entries.map(e=>e.textContent.toLowerCase());let filterTimer;
function filter(){const q=search.value.trim().toLowerCase();const terms=q.split(/\s+/).filter(Boolean);let shown=0;entries.forEach((e,i)=>{const yes=(!side.value||e.dataset.side===side.value)&&(!category.value||e.dataset.category===category.value)&&terms.every(t=>haystack[i].includes(t));e.hidden=!yes;indexEntries[i].hidden=!yes;if(yes)shown++;});results.textContent=shown+' of '+entries.length+' files shown';}
search.addEventListener('input',()=>{clearTimeout(filterTimer);filterTimer=setTimeout(filter,160)});side.addEventListener('change',filter);category.addEventListener('change',filter);document.querySelector('#clear').addEventListener('click',()=>{search.value='';side.value='';category.value='';filter()});document.querySelector('#expand').addEventListener('click',()=>entries.filter(e=>!e.hidden).forEach(e=>e.querySelectorAll('details.symbol').forEach(d=>d.open=true)));document.querySelector('#collapse').addEventListener('click',()=>entries.filter(e=>!e.hidden).forEach(e=>e.querySelectorAll('details.symbol').forEach(d=>d.open=false)));document.querySelector('#print').addEventListener('click',()=>{filter();entries.filter(e=>!e.hidden).forEach(e=>e.querySelectorAll('details.symbol').forEach(d=>d.open=true));window.print()});document.querySelectorAll('a[href^="#file-"]').forEach(a=>a.addEventListener('click',()=>{const target=document.getElementById(a.hash.slice(1));if(target&&target.hidden){search.value='';side.value='';category.value='';filter()}}));
`+'</script></body></html>';
fs.writeFileSync(path.join(__dirname,'Bright-Minds-Developer-Manual.html'),html);
const manifest=files.map(f=>({project:f.side,path:f.rel,category:f.category,bytes:f.bytes,lines:f.lines,sha256:f.sha256,contentIncluded:safeSource(f)!==null,envNames:f.envNames,symbols:f.symbols??[],summary:f.summary}));
fs.writeFileSync(path.join(__dirname,'coverage-manifest.json'),JSON.stringify({prepared:'2026-10-23',stats,files:manifest},null,2));
fs.writeFileSync(path.join(__dirname,'coverage.csv'),'Project,Path,Category,Source lines,Content included\n'+manifest.map(f=>[f.project,f.path,f.category,f.lines??'',f.contentIncluded].map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n'));
console.log(JSON.stringify({...stats,htmlBytes:Buffer.byteLength(html),output:path.join(__dirname,'Bright-Minds-Developer-Manual.html')},null,2));
