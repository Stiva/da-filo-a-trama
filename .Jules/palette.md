## 2026-03-14 - [DailyCalendarView A11y]
**Learning:** Found multiple icon-only buttons (like Add/Remove Favorite, Subscribe, Date Navigation) in `DailyCalendarView` lacking `aria-label`s. Using conditional `aria-label`s mapping exactly to the visually-hidden `title` state ensures screen readers convey the correct toggle context.
**Action:** Always verify icon-only interactive elements possess descriptive ARIA labels, especially those reflecting togglable states (like enrollment status).
## 2024-03-15 - Dynamic ARIA Labels vs aria-pressed
**Learning:** When using `aria-pressed` for a toggle button, the `aria-label` should generally remain static (e.g., "Preferito" or "Iscritto"). Dynamically changing the `aria-label` (e.g., from "Aggiungi ai preferiti" to "Rimuovi dai preferiti") while also toggling `aria-pressed` can confuse screen reader users by providing redundant or conflicting state information.
**Action:** When adding accessible toggle buttons, ensure the `aria-label` describes the entity/action neutrally, and rely solely on `aria-pressed` to convey the current state to assistive technologies.
## 2026-03-22 - [UserDropdownMenu Escape & ARIA Menu A11y]
**Learning:** Dropdown menus (like the UserDropdownMenu component) lacked an 'Escape' key listener to close the dropdown for keyboard users, and were missing semantic ARIA attributes such as `aria-haspopup="menu"`, `role="menu"`, and `role="menuitem"`. These are essential for screen readers to announce the menu correctly and for keyboard navigability. This pattern was also explicitly pointed out as a memory reminder.
**Action:** When implementing or modifying custom overlay components (modals, dropdowns, popovers), always add an Escape key event listener to close them, and verify semantic ARIA roles are present.
