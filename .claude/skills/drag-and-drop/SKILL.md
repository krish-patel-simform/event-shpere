---
name: drag-and-drop
description: Drag-and-drop with dnd-kit for the EventSphere personal agenda and organizer session management: sortable lists, keyboard and screen-reader support, optimistic reorder with rollback, and persisting positions atomically in one transaction. Use when building or fixing the agenda builder, session reordering, or any sortable/draggable UI.
---

# Drag and drop (dnd-kit)

Serves: AGD-3, AGD-4, AGD-1, AGD-2, AGD-5, ORG-2.
Related: `api-integration` (optimistic updates), `database-drizzle` (position column + transactions), `component-development`, `ui-implementation`, `testing`.

> This skill uses the stable `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` packages. dnd-kit also ships a newer `@dnd-kit/react` API; check the installed packages' docs and keep one approach. Say so if unsure.

## Purpose
A reorderable agenda that works with mouse, touch **and keyboard**, feels instant, and never ends with inconsistent positions in the database.

## MUST
- Client component (`"use client"`), lazy-loaded from the agenda page if heavy.
- `DndContext` with `sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))`, `collisionDetection={closestCenter}`, `onDragEnd`; `SortableContext items={ids} strategy={verticalListSortingStrategy}`; items use `useSortable({ id })` with `transform/transition` from `CSS.Transform.toString`.
- **Drag handle** as a real `<button>` with `{...attributes} {...listeners}` and an accessible name ("Reorder <session title>"), visible focus; the row itself stays selectable/clickable. Keyboard: Space/Enter to lift, arrows to move, Space/Enter to drop, Esc to cancel (KeyboardSensor). Provide **`accessibility.announcements`** and `screenReaderInstructions` on `DndContext` (custom text: "Moved *Keynote* to position 2 of 5"), plus a live region fallback.
- **Non-drag alternative**: "Move up / Move down" buttons (or a menu) for users who cannot drag: required for AGD-4 keyboard accessibility and easy to test.
- Stable ids = agenda item ids (never index). Use `arrayMove(items, oldIndex, newIndex)` from `@dnd-kit/sortable`.
- **Optimistic reorder with rollback**: on drop, update the RTK Query cache immediately (`updateQueryData`), call `PUT /api/me/agenda/order` with the full ordered id list, `undo()` + toast on failure (`api-integration`). Disable further drags while the request is pending, or queue the latest order only.
- **Persist atomically**: the service validates that the submitted ids are **exactly** the actor's current agenda item ids (no extras/missing/duplicates), then in **one transaction** rewrites `position = index` for all of them. No partial state. Response returns the new ordered list.
- Schedule awareness: show time conflicts (overlapping sessions) as a warning badge computed by a pure helper `findOverlaps(sessions)`; reordering is about the user's own priority order, not session time, so conflicts warn but don't block (decide per AGD-3 explain step).
- Organizer session management (ORG-2): same pattern for ordering sessions within an event if needed (`/api/organizer/events/[id]/sessions/order`, ownership checked).
- Drag overlay (`DragOverlay`) for a smooth visual; `touch-action: none` on the handle; reduced motion respected (`prefers-reduced-motion`).

## MUST NOT
- No HTML5 drag-and-drop API or other DnD libs mixed in.
- No persisting after every intermediate `onDragOver`; only on `onDragEnd`.
- No index-based keys; no reordering state held only in the client with no server persistence.
- No server reorder that loops with one update per request, or that trusts client-sent position numbers (send ids, server assigns positions).
- No drag handle that is a `div` without role/keyboard support.

## Procedure
1. API: `GET /api/me/agenda` (ordered), `POST` add, `DELETE` remove, `PUT /order`. 2. Service: add appends at `max(position)+1`; remove then compacts; reorder in transaction. 3. RTK endpoints with optimistic updates. 4. Sortable list + handle + announcements + move buttons. 5. Tests: unit (`arrayMove`, `findOverlaps`, service validation), integration (positions persisted atomically, foreign ids rejected), E2E keyboard reorder.

## Example: reorder service (AGD-3)
```ts
async reorder(actor: Actor, orderedIds: string[]) {
  return deps.withTransaction(async (tx) => {
    const current = await deps.agendaRepo.listIds(actor.id, tx);
    if (!sameSet(current, orderedIds)) throw new ValidationError("Order must contain exactly your agenda items");
    await deps.agendaRepo.setPositions(actor.id, orderedIds, tx);   // one UPDATE ... FROM (VALUES ...) or batched in the tx
    return toAgendaDtos(await deps.agendaRepo.list(actor.id, tx));
  });
}
```

## Common mistakes
- Making the whole row the drag listener target, which breaks scrolling on touch and links inside the row.
- Not providing announcements → screen-reader users get no feedback.
- Rolling back the cache on error but leaving the pending UI flag stuck.
- Losing order after refetch because the server list isn't `ORDER BY position`.
- Duplicate agenda entries through a double-click (unique `(user_id, session_id)` guards).

## Final checklist
- [ ] Mouse, touch and keyboard all reorder; move up/down buttons exist.
- [ ] Announcements/instructions for screen readers.
- [ ] Optimistic update + rollback + error toast.
- [ ] Server validates exact id set, rewrites positions in one transaction, orders by position.
- [ ] Tests: helper units, atomic persistence, keyboard E2E.
