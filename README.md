# CutEditor

Client-side photo layout and export editor for browser-based photo workflows.

CutEditor turns a group of photos into a finished branded layout. A user selects a template, places and adjusts images, adds text or stickers, and exports the result. The editor is designed for photo-studio workflows where a consistent output and a short customer-facing path matter.

## Why it matters

Photo businesses often repeat the same layout and finishing work for every session. CutEditor moves that work into a focused browser tool that can run on a store PC, inside a larger photo-service application, or on a customer device.

- **Consistent output:** approved frame templates and overlays keep the final composition aligned with the brand.
- **Faster handoff:** batch image selection, automatic slot placement, and direct export keep the workflow in one screen.
- **Local processing:** the current client architecture composes the selected images in the browser instead of requiring a photo upload service.
- **Reusable integration:** the editor has a message-based save/import path for an enclosing Boothy host.

## Main workflow

1. Choose a 2-, 4-, 6-, or 9-photo layout.
2. Add several images and place them into the available slots.
3. Drag, scale, and adjust images on the canvas.
4. Add a frame overlay, text, and stickers; selected stickers can be recolored.
5. Export a PNG through the browser's native save path or the available fallback preview.

The editor supports desktop pointer input, keyboard actions, and touch-oriented canvas interactions. Korean text wrapping and legacy/current frame assets are handled as part of the editing workflow.

## Technical highlights

- **Frontend:** React 18, TypeScript, and Vite.
- **Canvas:** Konva and `react-konva`.
- **Output:** canvas-to-PNG export with browser capability and mobile fallback handling.
- **Host integration:** message-based import/save events for an embedded Boothy session.
- **Quality focus:** regression coverage for transforms, frame changes, text sizing and rotation, mobile export, sticker asset fallback, and layout behavior.

Developed by Lee Noah as part of his own photo-studio software ecosystem.

## Repository guide

- [Product requirements](./docs/PRD.md)
- [Architecture notes](./docs/ARCHITECTURE.md)
- [Component notes](./docs/COMPONENTS.md)
- [Rendering pipeline](./docs/RENDERING_PIPELINE.md)
- [State model](./docs/STATE_MODEL.md)
- [Template schema](./docs/TEMPLATE_SCHEMA.md)
- [Test plan](./docs/TEST_PLAN.md)
- [Regression tests](./tests/)

## Development setup

```bash
git clone https://github.com/lsy9344/CutEditor.git
cd CutEditor
npm install
npm run dev
```

The `predev` script generates the local font manifest before the Vite server starts.

### Build and lint

```bash
npm run build
npm run preview
npm run lint
```

The repository has no `npm test` script. Focused regression files are kept under `tests/`; use the project test plan and the individual test tooling when extending or validating them.

## Current status

The implemented workflow covers interactive editing, local composition, browser export fallbacks, and host integration. Run the editor locally with the commands above. Camera capture and store management are handled by the surrounding photo-studio applications.

## Ownership and license

Developed by Lee Noah. Project code is described as MIT licensed in the existing project documentation; this README update does not change that designation. Third-party dependencies, fonts, frames, and stickers retain their respective terms.

For questions, open an [issue](https://github.com/lsy9344/CutEditor/issues).
