# Route Map

## All Routes

```mermaid
graph TD
    subgraph PUBLIC["(public) — No auth required"]
        LANDING["/<br/>Landing page with Sign In"]
        LOGIN["/login<br/>Sign-in / sign-up form"]
        JOIN["/join?s=token<br/>Pre-member self-registration"]
    end

    subgraph MEMBER["(member) — Authenticated users"]
        DASHBOARD["/dashboard<br/>Greeting, events feed, claim prompt<br/>pre-members: ቅድመ አባል QR"]
        CLAIM["/claim<br/>Link member or pre-member (FYP) ID"]
        PROFILE["/profile<br/>Account settings + member info"]
        SONGBOOK["/songbook<br/>Song list with search & filter"]
        SONG_DETAIL["/songbook/[id]<br/>Song lyrics & details"]
        ATTENDANCE["/attendance<br/>Personal attendance history"]
        DONATE["/donate<br/>Submit donation + receipt upload"]
    end

    subgraph ADMIN["(admin) — dept_head / admin / super_admin"]
        ADMIN_HOME["/admin<br/>Navigation cards"]
        ADMIN_USERS["/admin/users<br/>Manage roles (super_admin only)"]
        ADMIN_ATTENDANCE["/admin/attendance<br/>Event list + create/edit"]
        ADMIN_CHECKIN["/admin/attendance/[eventId]<br/>Member List + Quick Check-in"]
        ADMIN_DONATIONS["/admin/donations<br/>Verify/reject donations"]
        ADMIN_PRE["/admin/pre-members<br/>Pre-members by status (admins)"]
        ADMIN_PRE_NEW["/admin/pre-members/new<br/>Register a walk-in"]
        ADMIN_PRE_ID["/admin/pre-members/[id]<br/>Approve, edit, withdraw, QR, history"]
        ADMIN_PRE_PROMOTE["/admin/pre-members/[id]/promote<br/>Pick member row, compare, promote"]
        ADMIN_PRE_SESSIONS["/admin/pre-members/sessions<br/>Open/close registration sessions"]
        ADMIN_PRE_SESSION["/admin/pre-members/sessions/[id]<br/>Full-screen QR + live count"]
    end

    LANDING -->|authenticated| DASHBOARD
    DASHBOARD -->|if not linked| CLAIM
    PROFILE -->|if not linked| CLAIM
    ADMIN_HOME --> ADMIN_ATTENDANCE
    ADMIN_HOME --> ADMIN_DONATIONS
    ADMIN_HOME --> ADMIN_USERS
    ADMIN_ATTENDANCE --> ADMIN_CHECKIN
    ADMIN_HOME --> ADMIN_PRE
    ADMIN_PRE --> ADMIN_PRE_NEW
    ADMIN_PRE --> ADMIN_PRE_ID
    ADMIN_PRE_ID --> ADMIN_PRE_PROMOTE
    ADMIN_PRE --> ADMIN_PRE_SESSIONS
    ADMIN_PRE_SESSIONS --> ADMIN_PRE_SESSION
    ADMIN_PRE_SESSION -.->|QR| JOIN

    style PUBLIC fill:#f0fdf4,stroke:#16a34a
    style MEMBER fill:#eff6ff,stroke:#2563eb
    style ADMIN fill:#fef2f2,stroke:#dc2626
```

## Route Details

| Route | Auth | Roles | Layout | Status |
|-------|------|-------|--------|--------|
| `/` | Public | Any (authenticated → /dashboard) | Root | Working (landing page) |
| `/login` | Public | Any (authenticated → /dashboard) | Root > Public | Working |
| `/join?s=<token>` | Public | Anyone, while the session is open | Root > Public | Pre-member self-registration (Turnstile, rate limits) |
| `/dashboard` | Protected | All authenticated | Root > Member | Working (greeting, events, claim, links) |
| `/claim` | Protected | All authenticated | Root > Member | Working (member ID claim) |
| `/profile` | Protected | All authenticated | Root > Member | Working (name, role, member info) |
| `/songbook` | Protected | All authenticated | Root > Member | Working (search, filter, cards) |
| `/songbook/[id]` | Protected | All authenticated | Root > Member | Working (lyrics) |
| `/attendance` | Protected | Linked members, active pre-members, staff | Root > Member | Working (own history; events of the user's audience) |
| `/notices` | Protected | Linked members, active pre-members, staff | Root > Member | Working (notices of the user's audience) |
| `/donate` | Protected | Linked members and staff (pre-members are sent to /dashboard) | Root > Member | Working (form + receipt + history) |
| `/admin` | Protected | dept_head, admin, super_admin | Root > Admin | Working (nav cards) |
| `/admin/users` | Protected | super_admin only | Root > Admin | Working (role/dept management) |
| `/admin/attendance` | Protected | dept_head, admin, super_admin | Root > Admin | Working (events + create/edit) |
| `/admin/attendance/[eventId]` | Protected | dept_head, admin, super_admin | Root > Admin | Working (check-in tabs) |
| `/admin/donations` | Protected | admin, super_admin, Budget dept head | Root > Admin | Working (verify/reject) |
| `/admin/pre-members` | Protected | admin, super_admin | Root > Admin | Tabs by status, search |
| `/admin/pre-members/new` | Protected | admin, super_admin | Root > Admin | Admin registration (approve on the spot) |
| `/admin/pre-members/[id]` | Protected | admin, super_admin | Root > Admin | Details, duplicates, actions, QR, history |
| `/admin/pre-members/[id]/promote` | Protected | admin, super_admin | Root > Admin | Suggested matches, SSU ID search, side-by-side compare |
| `/admin/pre-members/sessions` | Protected | admin, super_admin | Root > Admin | Open, close, past sessions with counts |
| `/admin/pre-members/sessions/[id]` | Protected | admin, super_admin | Root > Admin | Full-screen QR for a TV or tablet, live count |

## Layout Hierarchy

```mermaid
graph TD
    ROOT_LAYOUT["RootLayout<br/>html lang='am', Apple PWA meta<br/>Toaster, theme #1e3a5f"]

    ROOT_LAYOUT --> PUBLIC_LAYOUT["PublicLayout<br/>min-h-screen wrapper<br/>No header, no BottomNav"]
    ROOT_LAYOUT --> MEMBER_LAYOUT["MemberLayout (async server)<br/>Fetches profile → UserMenu + BottomNav<br/>Members: Profile tab | Admins: Admin tab"]
    ROOT_LAYOUT --> ADMIN_LAYOUT["AdminLayout (async server)<br/>Fetches profile, redirects members<br/>Role badge in header + UserMenu + BottomNav"]

    PUBLIC_LAYOUT --> P0["/"]
    PUBLIC_LAYOUT --> P1["/login"]

    MEMBER_LAYOUT --> M1["/dashboard"]
    MEMBER_LAYOUT --> M2["/claim"]
    MEMBER_LAYOUT --> M3["/profile"]
    MEMBER_LAYOUT --> M4["/songbook"]
    MEMBER_LAYOUT --> M5["/songbook/[id]"]
    MEMBER_LAYOUT --> M6["/attendance"]
    MEMBER_LAYOUT --> M7["/donate"]

    ADMIN_LAYOUT --> A1["/admin"]
    ADMIN_LAYOUT --> A2["/admin/users"]
    ADMIN_LAYOUT --> A3["/admin/attendance"]
    ADMIN_LAYOUT --> A4["/admin/attendance/[eventId]"]
    ADMIN_LAYOUT --> A5["/admin/donations"]

    style ROOT_LAYOUT fill:#1e40af,color:#fff
    style PUBLIC_LAYOUT fill:#16a34a,color:#fff
    style MEMBER_LAYOUT fill:#2563eb,color:#fff
    style ADMIN_LAYOUT fill:#dc2626,color:#fff
```

## BottomNav Links

```mermaid
graph LR
    subgraph MEMBER_NAV["Member BottomNav"]
        N1["🏠 Home<br/>/dashboard"]
        N2["🎵 Songbook<br/>/songbook"]
        N3["📋 Attendance<br/>/attendance"]
        N4["❤️ Donate<br/>/donate"]
        N5["👤 Profile<br/>/profile"]
    end

    subgraph ADMIN_NAV["Admin BottomNav (replaces Profile)"]
        N6["🛡️ Admin<br/>/admin"]
    end

    MEMBER_NAV -.->|"role = dept_head | admin | super_admin"| ADMIN_NAV

    style MEMBER_NAV fill:#eff6ff,stroke:#2563eb
    style ADMIN_NAV fill:#fef2f2,stroke:#dc2626
```

## Header UserMenu

```mermaid
graph TD
    TRIGGER["👤 [display_name] ▾"] --> MENU["DropdownMenu"]
    MENU --> PROF["Profile → /profile"]
    MENU --> SEP["—————"]
    MENU --> LOGOUT["🚪 Sign out"]

    style TRIGGER fill:#f8fafc,stroke:#64748b
    style MENU fill:#fff,stroke:#e2e8f0
```
