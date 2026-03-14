## 2026-03-14 - [DailyCalendarView A11y]
**Learning:** Found multiple icon-only buttons (like Add/Remove Favorite, Subscribe, Date Navigation) in `DailyCalendarView` lacking `aria-label`s. Using conditional `aria-label`s mapping exactly to the visually-hidden `title` state ensures screen readers convey the correct toggle context.
**Action:** Always verify icon-only interactive elements possess descriptive ARIA labels, especially those reflecting togglable states (like enrollment status).
