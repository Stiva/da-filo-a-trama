## 2026-03-14 - [DailyCalendarView A11y]
**Learning:** Found multiple icon-only buttons (like Add/Remove Favorite, Subscribe, Date Navigation) in `DailyCalendarView` lacking `aria-label`s. Using conditional `aria-label`s mapping exactly to the visually-hidden `title` state ensures screen readers convey the correct toggle context.
**Action:** Always verify icon-only interactive elements possess descriptive ARIA labels, especially those reflecting togglable states (like enrollment status).
## 2024-03-15 - Dynamic ARIA Labels vs aria-pressed
**Learning:** When using `aria-pressed` for a toggle button, the `aria-label` should generally remain static (e.g., "Preferito" or "Iscritto"). Dynamically changing the `aria-label` (e.g., from "Aggiungi ai preferiti" to "Rimuovi dai preferiti") while also toggling `aria-pressed` can confuse screen reader users by providing redundant or conflicting state information.
**Action:** When adding accessible toggle buttons, ensure the `aria-label` describes the entity/action neutrally, and rely solely on `aria-pressed` to convey the current state to assistive technologies.
## 2026-03-26 - Overlay Accessibility
**Learning:** Custom overlay components (modals, dropdowns) frequently lack semantic ARIA roles (`role='menu'`, `role='dialog'`, `aria-haspopup`) and keyboard accessibility (specifically `Escape` key handlers).
**Action:** When creating or modifying custom overlay components, always ensure semantic roles and keyboard close handlers are implemented.
