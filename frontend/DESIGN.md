# D-POMS Design Guide

This document describes the current UI direction for agents and developers working on this project.

## Product Direction

D-POMS is an operational frontend application for importing, collecting, processing, and presenting pollution-related data from factories across Thailand.

Design implication:

- Treat the product as an operational system, not a marketing website.
- Prioritize readability, clear status communication, efficient workflows, and high-density data presentation.
- UI choices should support repeated daily use by administrators, reviewers, factories, and related internal users.

Primary UI surfaces include:

- Maps, especially Longdo Map-based views
- Forms for data entry, review, approval, and correction
- Tables for dense operational data
- Charts and graphs for summaries, trends, and pollution metrics
- Status chips, action buttons, and workflow indicators

## Layout

- The app uses a full-width layout.
- The main page container is:

```jsx
<Container maxWidth={false} sx={{ width: '100%', py: { xs: 4, md: 6 } }}>
```

- Use `Paper` for framed content sections.
- Use `Grid` for responsive groups.
- Use `Stack` for vertical or horizontal spacing.
- Keep card radius at the theme default: `8px`.
- Use `border: 1` and `borderColor: 'divider'` for quiet surfaces.
- Avoid decorative gradients, large rounded cards, and marketing-style hero layouts.

## Responsive Requirements

All UI must be usable on mobile, tablet, and desktop screens. Do not design only for a wide desktop viewport.

Minimum expectations:

- Mobile: support narrow screens from `320px` width.
- Tablet: support medium layouts without cramped forms or broken grids.
- Desktop: use available width efficiently without making content unnecessarily stretched or hard to scan.

General responsive rules:

- Use MUI responsive values such as `{ xs: ..., sm: ..., md: ..., lg: ... }`.
- Use `Grid` to change column count by breakpoint.
- Use `Stack` with responsive `direction` for button groups, filters, and form actions.
- Avoid fixed widths unless the element requires a stable size.
- Prefer `width: '100%'`, `maxWidth`, `minWidth`, `overflow`, and responsive spacing instead of hard-coded pixel layouts.
- Text must not overflow its container. Long Thai labels, IDs, factory names, and status text must wrap or truncate intentionally.
- Buttons must not overlap. On small screens, button groups should wrap or stack vertically.

Forms:

- Form fields should stack in one column on mobile.
- Use two or more columns only from tablet or desktop breakpoints.
- Keep submit, confirm, reject, and cancel actions visible and reachable.
- Long labels and helper text must not break the layout.

Tables:

- Dense tables must remain readable on desktop.
- On mobile, tables should use horizontal scrolling, compact columns, or a card/list representation.
- Do not shrink columns until text becomes unreadable.
- Status chips inside tables must keep their color and label legibility.

Maps and charts:

- Maps, including Longdo Map views, must have stable `height` or `minHeight`.
- Charts must be responsive to container width.
- On mobile, map and chart controls must remain tappable and must not cover critical data.
- Loading, empty, and error states must fit inside the same responsive container.

Validation before finishing UI work:

- Check that the layout works at mobile, tablet, and desktop sizes.
- Check that text, chips, buttons, tables, forms, maps, and charts do not overlap.
- Run `npm run lint` and `npm run build` when code changes are made.

## Theme Tokens

Theme is currently defined in `src/main.jsx`.

### Primary Colors

Use primary for main actions, active navigation, important links, and focused states.

| Token | Hex |
| --- | --- |
| primary.50 | `#eef6ff` |
| primary.100 | `#d9ebff` |
| primary.200 | `#b8dcff` |
| primary.300 | `#8cc8ff` |
| primary.400 | `#5aa9f5` |
| primary.500 | `#2f80ed` |
| primary.600 / main | `#1f6feb` |
| primary.700 / dark | `#185abc` |
| primary.800 | `#174a94` |
| primary.900 | `#153f7a` |

### Secondary Colors

Use secondary for positive supporting actions, success accents, and confirmation contexts.

| Token | Hex |
| --- | --- |
| secondary.50 | `#ecfdf3` |
| secondary.100 | `#d1fae0` |
| secondary.200 | `#a7f3c1` |
| secondary.300 | `#6ee798` |
| secondary.400 | `#39d474` |
| secondary.500 | `#20b85a` |
| secondary.600 / main | `#16a34a` |
| secondary.700 / dark | `#15803d` |
| secondary.800 | `#166534` |
| secondary.900 | `#14532d` |

### Neutral Colors

Use neutrals for backgrounds, borders, text hierarchy, tables, forms, and dense operational screens.

| Token | Hex | Usage |
| --- | --- | --- |
| neutral.0 | `#ffffff` | Card surface |
| neutral.50 | `#f8fafc` | Page background |
| neutral.100 | `#f1f5f9` | Muted surfaces |
| neutral.200 | `#e2e8f0` | Borders and dividers |
| neutral.300 | `#cbd5e1` | Disabled borders |
| neutral.400 | `#94a3b8` | Placeholder text |
| neutral.500 | `#64748b` | Secondary text |
| neutral.600 | `#475569` | Supporting text |
| neutral.700 | `#334155` | Strong secondary text |
| neutral.800 | `#1e293b` | Headings on light backgrounds |
| neutral.900 | `#0f172a` | Primary text |

Global defaults:

- Page background: `#f8fafc`
- Paper background: `#ffffff`
- Primary text: `#0f172a`
- Secondary text: `#64748b`
- Divider: `#e2e8f0`

## Status Colors

Use status colors for chips, badges, table status cells, and workflow labels. Status colors should describe state, not button intent.

| Group | Status Text | Background | Border | Text |
| --- | --- | --- | --- | --- |
| Success | เชื่อมต่อแล้ว, ผ่าน, อนุมัติ, ยื่นแบบสำเร็จ, ส่งแล้ว | `#dcfce7` | `#86efac` | `#166534` |
| Pending Review | รอพิจารณาแบบ, รอพิจารณา, รอดำเนินการ | `#fef3c7` | `#fcd34d` | `#92400e` |
| Revised Review | แก้ไขแล้ว/รอพิจารณาแบบ | `#e0f2fe` | `#7dd3fc` | `#075985` |
| Waiting Connection | รอเชื่อมต่อ | `#ede9fe` | `#c4b5fd` | `#5b21b6` |
| Action Required | รอโรงงานแก้ไข, แก้ไข | `#ffedd5` | `#fdba74` | `#9a3412` |
| Rejected | ยกเลิก, ไม่ผ่าน, ไม่อนุมัติ, ไม่ส่ง | `#fee2e2` | `#fca5a5` | `#991b1b` |

Recommended status chip style:

```jsx
<Chip
  label="อนุมัติ"
  size="small"
  variant="outlined"
  sx={{
    bgcolor: 'background.paper',
    borderColor: '#86efac',
    color: '#166534',
    fontWeight: 600,
  }}
/>
```

## Action Type Buttons

Use action colors for button intent. These are separate from status colors.

| Type | Usage | Main | Hover | Subtle | Text |
| --- | --- | --- | --- | --- | --- |
| Information | ดูรายละเอียด, เปิดข้อมูล, ไปหน้ารายการที่เกี่ยวข้อง | `#2563eb` | `#1d4ed8` | `#dbeafe` | `#1e40af` |
| Confirm | ยืนยัน, อนุมัติ, ผ่าน, บันทึกผลที่เป็นบวก | `#16a34a` | `#15803d` | `#dcfce7` | `#166534` |
| Reject | ไม่อนุมัติ, ไม่ผ่าน, ไม่ส่งคืน, ปฏิเสธผลพิจารณา | `#dc2626` | `#b91c1c` | `#fee2e2` | `#991b1b` |
| Warning | เตือน, ส่งกลับแก้ไข, action ที่ต้องคิดก่อนกด | `#d97706` | `#b45309` | `#fef3c7` | `#92400e` |
| Submit | ยื่นแบบ, ส่งข้อมูล, ส่งให้ระบบปลายทาง | `#0f766e` | `#115e59` | `#ccfbf1` | `#134e4a` |
| Draft / Edit | บันทึกร่าง, แก้ไขข้อมูล, action ที่ยังไม่ final | `#64748b` | `#475569` | `#f1f5f9` | `#334155` |

Recommended button behavior:

- Use `variant="contained"` for the primary action in the current workflow.
- Use `variant="outlined"` for secondary but still important actions.
- Use `variant="text"` for low-emphasis or optional actions.
- Always use an icon when it clarifies the action.

Example:

```jsx
<Button
  variant="contained"
  startIcon={<CheckCircleIcon />}
  sx={{
    bgcolor: '#16a34a',
    color: '#ffffff',
    '&:hover': { bgcolor: '#15803d' },
  }}
>
  อนุมัติ
</Button>
```

## Typography

The current theme font stack is:

```js
Kanit, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

Guidelines:

- Use `Typography` from MUI.
- Use `h3` only for page-level headings.
- Use `h5` for section headings.
- Use `h6` or `subtitle1` for card headings.
- Use `body2` for helper text inside compact cards.
- Keep text color tied to `text.primary` and `text.secondary` unless representing a status or action.

## Baseline UI Patterns

Use these patterns as the default foundation for D-POMS screens unless a request explicitly asks for another layout or visual treatment.

### Page Header

- Use a white `Paper` surface for page headers.
- Use `border: 1` and `borderColor: 'divider'`.
- Use `h5` for the page title.
- Use `fontWeight: 600` for the title.
- Keep the header compact and operational. Avoid hero-style headers, gradients, decorative imagery, and large empty spacing.

Recommended pattern:

```jsx
<Paper
  elevation={0}
  sx={{
    px: { xs: 2, md: 3 },
    py: 2,
    border: 1,
    borderColor: 'divider',
    bgcolor: 'background.paper',
  }}
>
  <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
    ชื่อหน้า
  </Typography>
</Paper>
```

### Content Section

- Use `Paper` for major content sections.
- Use `border: 1`, `borderColor: 'divider'`, and `background.paper`.
- Use responsive padding: `p: { xs: 2, md: 3 }`.
- Use `h6` with `fontWeight: 600` for the primary section title.
- For full-height operational pages, make the section fill the remaining viewport height and keep scrolling inside the content area, table, or dialog instead of the browser window.

Recommended full-height pattern:

```jsx
<Stack spacing={2} sx={{ height: '100%', minHeight: 0 }}>
  <Paper>...</Paper>
  <Paper
    elevation={0}
    sx={{
      flex: 1,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      p: { xs: 2, md: 3 },
      border: 1,
      borderColor: 'divider',
    }}
  >
    <Stack spacing={2} sx={{ flex: 1, minHeight: 0 }}>
      ...
    </Stack>
  </Paper>
</Stack>
```

### Tables

- Use MUI `Table` with `size="small"` for dense operational lists.
- Use `stickyHeader` when the table scrolls inside a constrained container.
- Wrap tables in `TableContainer` with a quiet border and `borderRadius: 1`.
- For datasets that can exceed hundreds or thousands of rows, use pagination and keep table scrolling inside `TableContainer`.
- Table header cells should use `fontWeight: 600`.
- Use `whiteSpace: 'nowrap'` only for stable IDs or compact action columns.
- Give long Thai text columns reasonable `minWidth` values instead of squeezing text until unreadable.
- Use icon buttons with tooltips for compact row actions such as edit and delete.

Recommended pattern:

```jsx
<TableContainer
  sx={{
    flex: 1,
    minHeight: 0,
    border: 1,
    borderColor: 'divider',
    borderRadius: 1,
  }}
>
  <Table stickyHeader size="small" aria-label="ชื่อตาราง">
    <TableHead>
      <TableRow>
        <TableCell>หัวตาราง</TableCell>
        <TableCell align="right">Option</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>...</TableBody>
  </Table>
</TableContainer>
```

### Dialogs

- Use MUI `Dialog` for add, edit, approval, and permission workflows.
- Use `fullWidth` and choose `maxWidth` based on content density. Use `maxWidth="lg"` for permission forms or dense multi-section forms.
- Keep dialogs within the viewport with `maxHeight: calc(100dvh - ...)`.
- Put scrolling inside `DialogContent` with `dividers` when content is long.
- Use `DialogTitle` with `h5` and `fontWeight: 600`.
- Use compact section headings inside `DialogContent`: `body2` with `fontWeight: 600`.
- Use one `Paper` section for basic information, then place related repeated permission/menu sections as sibling sections instead of nesting major sections inside another card.
- Keep `DialogActions` visible at the bottom and allow buttons to wrap on small screens.

Recommended pattern:

```jsx
<Dialog
  open={open}
  onClose={onClose}
  fullWidth
  maxWidth="lg"
  slotProps={{
    paper: {
      component: 'form',
      sx: {
        borderRadius: 2,
        m: { xs: 1.5, sm: 3 },
        maxHeight: { xs: 'calc(100dvh - 24px)', sm: 'calc(100dvh - 48px)' },
      },
    },
  }}
>
  <DialogTitle sx={{ pb: 1 }}>
    <Typography variant="h5" component="span" sx={{ fontWeight: 600 }}>
      ชื่อ Dialog
    </Typography>
  </DialogTitle>
  <DialogContent dividers sx={{ p: { xs: 2, md: 3 } }}>
    <Stack spacing={3}>
      <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          ข้อมูลพื้นฐาน
        </Typography>
      </Paper>
      ...
    </Stack>
  </DialogContent>
  <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: 'wrap' }}>
    ...
  </DialogActions>
</Dialog>
```

## Component Patterns

### Section Surface

```jsx
<Paper
  elevation={0}
  sx={{
    p: 3,
    border: 1,
    borderColor: 'divider',
  }}
>
  ...
</Paper>
```

### Responsive Grid

```jsx
<Grid container spacing={2}>
  <Grid size={{ xs: 12, md: 6, lg: 4 }}>
    ...
  </Grid>
</Grid>
```

### Icon Block

```jsx
<Box
  sx={{
    width: 44,
    height: 44,
    display: 'grid',
    placeItems: 'center',
    borderRadius: 1,
    bgcolor: '#dbeafe',
    color: '#1e40af',
  }}
>
  <InfoIcon />
</Box>
```
