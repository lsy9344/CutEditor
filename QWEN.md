# CutEditor Project Context

## Please use Korean for all talk.

## Project Overview
CutEditor is a web-based image composition tool that allows users to create multi-panel layouts (2/4/6/9 panels) with image placement, frame overlays, text composition, and high-resolution export capabilities. The project aims to convert an existing PySide2 (OpenCV/PIL) based desktop application into a browser-accessible web service.

### Key Features
- **Layout Templates**: 2/4/6/9 panel layouts in horizontal/vertical orientations
- **Image Manipulation**: Drag movement, zoom, scale adjustment
- **Frame Overlays**: PNG overlays composited on top of the canvas
- **Text Tools**: Font, size, slant, alignment options
- **High-Resolution Export**: 600 DPI quality image generation
- **Fully Client-Side**: All processing happens locally without server storage

### Technology Stack
- **Frontend**: React + Vite
- **Rendering**: Konva.js (canvas object/transform management)
- **Image Processing**: Canvas API, WebGL acceleration
- **Fonts**: Google Fonts (Noto Sans KR, etc.)
- **Deployment**: Static hosting (Vercel/Netlify/Cloudflare Pages)

## Project Structure
```
CutEditor/
├── docs/                    # Documentation files
│   ├── ARCHITECTURE.md     # Architecture design
│   ├── COMPONENTS.md       # Component structure
│   ├── STATE_MODEL.md      # State management model
│   └── ...
├── public/                 # Static assets
│   └── frame/             # Frame overlay images
├── src/                   # Source code
│   ├── canvas/            # Canvas rendering components
│   ├── components/        # Shared UI components
│   ├── export/            # Export functionality
│   ├── state/             # State management
│   ├── templates/         # Layout templates
│   ├── types/             # TypeScript types
│   ├── ui/                # UI components (sidebars, footer)
│   ├── utils/             # Utility functions
│   ├── workers/           # Web workers for high-res export
│   ├── App.tsx           # Main application component
│   └── main.tsx          # Application entry point
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── vite.config.ts        # Vite build configuration
```

## Development Environment

### Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix
```

### Qwen CLI + MCP 설정

```bash
# 1) 가상환경 생성 및 활성화 (프로젝트 루트)
python -m venv .venv && source .venv/bin/activate

# 2) Qwen-Agent를 MCP 옵션 포함으로 설치
pip install -U "qwen-agent[gui,rag,code_interpreter,mcp]"

# 3) Node/npm 버전 점검 (npx 사용)
node -v && npm -v

# 4) sequential-thinking MCP 서버 헬프 실행 확인 (실행되며 대기하면 Ctrl+C)
npx -y @modelcontextprotocol/server-sequential-thinking --help

# 5) Qwen 설정: .qwen/setting.json에 MCP 서버가 등록되어 있어야 함
cat .qwen/setting.json
```

`.qwen/setting.json` 예시:

```json
{
  "mcpServers": {
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"],
      "env": { "NODE_ENV": "production" },
      "cwd": "./",
      "timeout": 30000,
      "trust": false
    }
  }
}
```

이후 Qwen 에이전트/클라이언트에서 MCP 툴로 `sequential-thinking`을 사용할 수 있습니다.

### Key Dependencies
- **react**/**react-dom**: Core React library
- **konva**/**react-konva**: Canvas rendering library
- **typescript**: Type checking
- **vite**: Build tool
- **eslint**: Code linting

## Architecture

### Core Modules
- **templates/**: JSON templates for 2/4/6/9 layouts in horizontal/vertical orientations
- **canvas/**: Canvas layer management, slot dragging/scaling, guides, snapping
- **export/**: 600 DPI rendering pipeline (worker + tiling)
- **ui/**: Panel components (template/properties), wizard flow (select→edit→export)
- **state/**: Global state management with TypeScript types

### Data Flow
User input → state update → canvas object reflection → (on export) render worker invocation → Blob download

### State Model
The application uses a simple React state management approach with the following key types:

```typescript
type EditorState = {
  template: Template | null;
  selection: string | null; // Selected object id
  selectedSlot: string | null; // Selected slot id
  zoom: number; // 0.1 ~ 4.0
  selectedFrame: FrameType | null; // Selected frame
  userImages: UserImage[]; // Uploaded images
  frameColor: string; // Frame color
};
```

## UI Components

### Layout Structure
- **SidebarLeft**: Template/option selection
- **CanvasStage**: Slot/guide/overlay rendering
- **SidebarRight**: Selected object properties (text/image mode)
- **WizardFooter**: Previous/next/export navigation

### Canvas Stage
The canvas stage is built with Konva.js and includes:
- Image loading and transformation
- Frame overlay with color customization
- Slot-based image placement
- Drag and drop functionality
- Zoom controls
- Selection management

## Development Conventions

### Coding Standards
- TypeScript for type safety
- ESLint for code quality
- React functional components with hooks
- CSS variables for consistent styling (Linear.app design system)

### Component Development
- Use existing components from `src/components/components.css`
- Follow the established design system
- Maintain consistent styling with CSS variables

### Testing
Currently, there are no automated tests in the project. Manual testing is recommended for new features.

## Build and Deployment

### Build Process
The project uses Vite for building:
1. TypeScript compilation
2. Asset optimization
3. Bundle creation

### Deployment
The application is designed for static hosting on platforms like:
- Vercel
- Netlify
- Cloudflare Pages

No backend is required as all processing happens client-side.

## Future Enhancements
- **History (Undo/Redo)**
- **Group duplication/alignment**
- **Quality correction (brightness/contrast/color temperature)**
- **Template manager (browser local storage)**