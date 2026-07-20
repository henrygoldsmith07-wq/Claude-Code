# Le Studio — marketing site

A dependency-free static landing page advertising the Le Studio French
app (`apps/french-practice`). One HTML file plus icons and screenshots —
no build step.

## Deploy

Add a new Vercel project with **Root Directory: `apps/le-studio-site`**,
Framework Preset: **Other**, no build command, output directory `.` —
or serve the folder from any static host.

The screenshots are real app captures (390×844); regenerate them from the
app's regression tooling whenever the UI changes materially.
