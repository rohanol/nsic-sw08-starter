# Frontend verification notes

The local Vite app was verified at `http://localhost:5173/` after the frontend refactor.

The initial state shows the AegisLanding mission-control header, anchor navigation, workflow status, upload/dropzone panel, dual engine selector, run action, empty model-output state, and audit history state. The demo payload interaction was also exercised successfully: it populates the preview, marks the workflow complete, shows the live results workspace, toggles between annotated output and risk heatmap, renders risk metrics, telemetry, candidate zones, and the analysis-tools-ready evidence placeholders.

The interface is responsive through the existing desktop/tablet/mobile CSS breakpoints. The browser screenshot confirms the dark telemetry console styling, cyan action hierarchy, green completed states, and responsive two-column input composition at the default viewport.

The demo payload is explicitly marked as non-mission data in the UI and is not sent to the backend.

The browser verification also switched the engine selector to ML successfully. The declared target dropdown and optional verified source URL field appeared, and the UI explained that the fields are sent with the upload and guarded by the Mars-only provenance check.
