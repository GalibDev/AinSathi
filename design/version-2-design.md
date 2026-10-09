# AinSathi — Version 2 design specification

Status: Figma design created and visually reviewed: https://www.figma.com/design/teMMTbWWtvdrPOlIZmd6mB?node-id=1-550
Delivered: 18 editable screen/form states with navigation prototype links, including two mobile screens. This is a design prototype using fictional records; forms do not persist real data. Additional loading/error states and Bangla screen translations remain implementation follow-ups.
All sample records are fictional. Language shown below is English; provide matching Bangla labels during implementation.

## Visual system

Desktop frames: 1440 × 1024. Mobile frames: 390 × 844.
Background #F5F6F8; sidebar #132D3A; primary #176B60; accent #C6A66B.
Text #172B36; secondary #667782; border #E3E8EC; white #FFFFFF.
Typography: Inter, with Noto Sans Bengali for Bangla. Body 16px, labels 14px, page headings 30px.
Spacing: 8px grid. Cards 16px radius, inputs 10px radius, controls at least 44px high.
Status chips combine text and color: Running, Closed, On hold. Keep case type separate from status.
Navigation: Dashboard, Cases, Clients, Hearing calendar, Documents, Payments, Settings.

## Frames to create

1. Dashboard: welcome/date, New case action, four metrics (today's hearings, active cases, upcoming hearings, outstanding fees), today's hearing table, upcoming tasks, recent activity. Metrics are clickable filters. Empty state offers Add first case.
2. Cases: searchable table, type/court/status filters, chamber serial, court case number, client, received date, next hearing, status. Separate serial and court number. Include pagination and empty search results.
3. New/edit case: client selector with create-client option; chamber serial; court case number; title; Civil/Criminal/Family/Land/Other; court; parties; received date; next hearing; notes. Closure section requires closed date and result only when status is Closed. Inline validation preserves entered values.
4. Case details: breadcrumb, title, status, Edit and Add hearing actions. Summary includes both case numbers, client contact, court, received date, next hearing and closure details. Tabs: Overview, Hearings, Documents, Payments. Show chronological hearing history with outcome and next action.
5. Hearing calendar: month/week/list switch, court filters, selected-day agenda. Add hearing panel includes case, hearing date, optional time, court, purpose, reminder preference. Unknown times appear as Time not set.
6. Clients: name/mobile search, contact list, client details and related cases. Each client may own multiple cases. Duplicate-mobile warning permits review before saving.
7. Documents: case-linked files with filename, type, upload date, uploader and search. Upload panel, progress, retry and preview states. Sample UI must not imply that uploads are already stored.
8. Payments: summary cards for agreed fees, received and outstanding. Table with case/client, agreed amount, paid amount and balance in BDT. Record payment panel captures amount, date, method and note. Payment history belongs to each case. Separate agreed fee changes from cash transactions.
9. Reminders: upcoming/in-app reminders, read state, reschedule and reminder preferences. External SMS/WhatsApp delivery is a later integration, not an assumed Version 2 capability.
10. Settings: chamber profile, Bangla/English preference, login/security settings, backup/export status. Actual backup completion must come from the backend.
11. Mobile dashboard: compact header, stacked hearing cards, New case action, bottom navigation (Home, Cases, Calendar, More). No horizontally compressed desktop table.
12. Mobile case detail: sticky case heading, next-hearing card, accessible tabs, contact action, hearing history and primary Add hearing button.

## Prototype flow

Dashboard → Cases → New case → Save → Case details.
Case details → Add hearing → Save → Hearing calendar.
Case details → Documents → Upload → Preview.
Case details → Payments → Record payment → Updated history.
Case details → Edit → Closed → Closed date/result → Save.
Dashboard hearing row → Case details.

## Components and states

Build reusable sidebar items, buttons, inputs, selects, date pickers, chips, metric cards, table rows, tabs, file cards, empty states and dialogs.
Include default, hover, focus, disabled, loading, success and error states where applicable.
Use visible labels, keyboard focus, text with status colors, readable contrast and clear save feedback.
Forms warn about unsaved changes. Destructive document deletion asks for confirmation. Case closing keeps its record and history.

## Figma organization

Pages: 00 Cover, 01 Foundations, 02 Components, 03 Desktop, 04 Mobile, 05 Prototype.
Use Auto Layout, semantic color variables, component variants and consistent frame naming.
Desktop content uses a 12-column grid; sidebar 232px; outer padding 32px; gutter 24px.
Frame names: V2 / Desktop / Dashboard, V2 / Desktop / Cases, etc.

## Illustrative dashboard content

Date: 9 October 2026. Today's hearings: 4. Active cases: 128. Upcoming 7 days: 12. Outstanding fees: BDT 85,000.
Sample case: chamber serial AS-2026-001; court number Civil 123/2026; title Rahim vs Karim; client Rahim Ahmed; received 12 September 2026; next hearing 11 October 2026; status Running.
