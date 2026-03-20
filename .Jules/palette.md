## 2026-03-14 - [DailyCalendarView A11y]
**Learning:** Found multiple icon-only buttons (like Add/Remove Favorite, Subscribe, Date Navigation) in `DailyCalendarView` lacking `aria-label`s. Using conditional `aria-label`s mapping exactly to the visually-hidden `title` state ensures screen readers convey the correct toggle context.
**Action:** Always verify icon-only interactive elements possess descriptive ARIA labels, especially those reflecting togglable states (like enrollment status).
## 2024-03-15 - Dynamic ARIA Labels vs aria-pressed
**Learning:** When using `aria-pressed` for a toggle button, the `aria-label` should generally remain static (e.g., "Preferito" or "Iscritto"). Dynamically changing the `aria-label` (e.g., from "Aggiungi ai preferiti" to "Rimuovi dai preferiti") while also toggling `aria-pressed` can confuse screen reader users by providing redundant or conflicting state information.
**Action:** When adding accessible toggle buttons, ensure the `aria-label` describes the entity/action neutrally, and rely solely on `aria-pressed` to convey the current state to assistive technologies.
## 2026-03-20 - App-wide missing Escape and ARIA roles on custom overlays
**Learning:** Custom popovers and modals across the application (like `UserDropdownMenu`) generally lack keyboard accessibility enhancements (such as pressing `Escape` to close) and semantic ARIA roles (`role="menu"`, `aria-haspopup`, `role="menuitem"`). This makes the overlays less usable for keyboard-only and screen reader users.
**Action:** Always verify custom overlay components for `Escape` key handling and proper ARIA semantic roles. Prioritize updating remaining overlays (like `CheckinQRCodeDialog`) in future UX improvements.
