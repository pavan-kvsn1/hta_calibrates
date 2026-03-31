# IDE Setup

## Overview

This guide covers VS Code setup and configuration for optimal HTA Calibration development.

---

## VS Code Extensions

### Required Extensions

```json
// .vscode/extensions.json
{
  "recommendations": [
    // Language Support
    "prisma.prisma",
    "bradlc.vscode-tailwindcss",

    // Formatting & Linting
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",

    // Infrastructure
    "ms-azuretools.vscode-docker",
    "ms-kubernetes-tools.vscode-kubernetes-tools",
    "hashicorp.terraform",

    // Productivity
    "christian-kohler.path-intellisense",
    "formulahendry.auto-rename-tag",
    "streetsidesoftware.code-spell-checker"
  ]
}
```

### Extension Details

| Extension | Purpose | Features |
|-----------|---------|----------|
| Prisma | Schema support | Syntax highlighting, formatting, autocomplete |
| Tailwind CSS IntelliSense | CSS utilities | Class autocomplete, hover preview |
| Prettier | Code formatting | Auto-format on save |
| ESLint | Code linting | Error highlighting, auto-fix |
| Docker | Container support | Dockerfile syntax, container management |
| Kubernetes | K8s support | YAML validation, cluster explorer |
| Terraform | IaC support | HCL syntax, validation |

---

## VS Code Settings

### Workspace Settings

```json
// .vscode/settings.json
{
  // Editor
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  },
  "editor.tabSize": 2,
  "editor.rulers": [100],

  // TypeScript
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.updateImportsOnFileMove.enabled": "always",

  // Prisma
  "[prisma]": {
    "editor.defaultFormatter": "Prisma.prisma"
  },

  // Tailwind
  "tailwindCSS.includeLanguages": {
    "typescript": "javascript",
    "typescriptreact": "javascript"
  },
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ],

  // Files
  "files.exclude": {
    "**/node_modules": true,
    "**/.next": true,
    "**/coverage": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/.next": true
  },

  // ESLint
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],

  // Emmet
  "emmet.includeLanguages": {
    "typescriptreact": "html"
  }
}
```

---

## Debug Configurations

### Launch Configurations

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: Debug Server",
      "type": "node-terminal",
      "request": "launch",
      "command": "npm run dev",
      "cwd": "${workspaceFolder}",
      "serverReadyAction": {
        "pattern": "started server on .+, url: (https?://.+)",
        "uriFormat": "%s",
        "action": "debugWithChrome"
      }
    },
    {
      "name": "Next.js: Debug Client",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000"
    },
    {
      "name": "Jest: Debug All Tests",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "test", "--", "--runInBand"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    },
    {
      "name": "Jest: Debug Current File",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npm",
      "runtimeArgs": [
        "run", "test", "--",
        "--runInBand",
        "--testPathPattern=${relativeFile}"
      ],
      "console": "integratedTerminal"
    },
    {
      "name": "Attach to Node",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "skipFiles": ["<node_internals>/**"]
    }
  ],
  "compounds": [
    {
      "name": "Next.js: Full Stack",
      "configurations": [
        "Next.js: Debug Server",
        "Next.js: Debug Client"
      ]
    }
  ]
}
```

---

## Tasks

### Task Configuration

```json
// .vscode/tasks.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "dev",
      "type": "npm",
      "script": "dev",
      "isBackground": true,
      "problemMatcher": {
        "owner": "typescript",
        "fileLocation": "relative",
        "pattern": {
          "regexp": "^(.*):(\\d+):(\\d+): (error|warning) (.*)$",
          "file": 1,
          "line": 2,
          "column": 3,
          "severity": 4,
          "message": 5
        },
        "background": {
          "activeOnStart": true,
          "beginsPattern": "Compiling",
          "endsPattern": "Compiled"
        }
      }
    },
    {
      "label": "build",
      "type": "npm",
      "script": "build",
      "group": "build",
      "problemMatcher": ["$tsc"]
    },
    {
      "label": "lint",
      "type": "npm",
      "script": "lint",
      "problemMatcher": ["$eslint-stylish"]
    },
    {
      "label": "test",
      "type": "npm",
      "script": "test",
      "group": "test",
      "problemMatcher": []
    },
    {
      "label": "prisma:studio",
      "type": "shell",
      "command": "npx prisma studio",
      "isBackground": true,
      "problemMatcher": []
    },
    {
      "label": "prisma:generate",
      "type": "shell",
      "command": "npx prisma generate",
      "problemMatcher": []
    },
    {
      "label": "docker:build",
      "type": "shell",
      "command": "docker build -t hta-app .",
      "problemMatcher": []
    }
  ]
}
```

---

## Snippets

### React/TypeScript Snippets

```json
// .vscode/typescriptreact.json
{
  "React Functional Component": {
    "prefix": "rfc",
    "body": [
      "interface ${1:${TM_FILENAME_BASE}}Props {",
      "  $2",
      "}",
      "",
      "export function ${1:${TM_FILENAME_BASE}}({ $3 }: ${1:${TM_FILENAME_BASE}}Props) {",
      "  return (",
      "    <div>",
      "      $0",
      "    </div>",
      "  )",
      "}"
    ],
    "description": "React Functional Component with TypeScript"
  },
  "React Client Component": {
    "prefix": "rcc",
    "body": [
      "'use client'",
      "",
      "interface ${1:${TM_FILENAME_BASE}}Props {",
      "  $2",
      "}",
      "",
      "export function ${1:${TM_FILENAME_BASE}}({ $3 }: ${1:${TM_FILENAME_BASE}}Props) {",
      "  return (",
      "    <div>",
      "      $0",
      "    </div>",
      "  )",
      "}"
    ],
    "description": "React Client Component"
  },
  "React Server Component": {
    "prefix": "rsc",
    "body": [
      "interface ${1:${TM_FILENAME_BASE}}Props {",
      "  $2",
      "}",
      "",
      "export default async function ${1:${TM_FILENAME_BASE}}({ $3 }: ${1:${TM_FILENAME_BASE}}Props) {",
      "  return (",
      "    <div>",
      "      $0",
      "    </div>",
      "  )",
      "}"
    ],
    "description": "React Server Component"
  },
  "useState Hook": {
    "prefix": "us",
    "body": [
      "const [${1:state}, set${1/(.*)/${1:/capitalize}/}] = useState<${2:type}>(${3:initialValue})"
    ],
    "description": "useState Hook"
  },
  "useEffect Hook": {
    "prefix": "ue",
    "body": [
      "useEffect(() => {",
      "  $0",
      "}, [${1:dependencies}])"
    ],
    "description": "useEffect Hook"
  }
}
```

### API Route Snippets

```json
// .vscode/typescript.json
{
  "API Route Handler": {
    "prefix": "apiroute",
    "body": [
      "import { NextRequest, NextResponse } from 'next/server'",
      "import { auth } from '@/lib/auth'",
      "import { prisma } from '@/lib/prisma'",
      "",
      "export async function ${1|GET,POST,PUT,DELETE|}(request: NextRequest) {",
      "  const session = await auth()",
      "  if (!session) {",
      "    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })",
      "  }",
      "",
      "  try {",
      "    $0",
      "    return NextResponse.json({ success: true })",
      "  } catch (error) {",
      "    console.error('API Error:', error)",
      "    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })",
      "  }",
      "}"
    ],
    "description": "Next.js API Route Handler"
  },
  "Server Action": {
    "prefix": "serveraction",
    "body": [
      "'use server'",
      "",
      "import { auth } from '@/lib/auth'",
      "import { prisma } from '@/lib/prisma'",
      "import { revalidatePath } from 'next/cache'",
      "",
      "export async function ${1:actionName}(${2:params}) {",
      "  const session = await auth()",
      "  if (!session) throw new Error('Unauthorized')",
      "",
      "  try {",
      "    $0",
      "    revalidatePath('/${3:path}')",
      "    return { success: true }",
      "  } catch (error) {",
      "    console.error('Action Error:', error)",
      "    return { success: false, error: 'Something went wrong' }",
      "  }",
      "}"
    ],
    "description": "Next.js Server Action"
  }
}
```

---

## Keyboard Shortcuts

### Recommended Custom Keybindings

```json
// keybindings.json
[
  // Quick file navigation
  {
    "key": "cmd+p",
    "command": "workbench.action.quickOpen"
  },
  // Toggle terminal
  {
    "key": "cmd+`",
    "command": "workbench.action.terminal.toggleTerminal"
  },
  // Go to definition
  {
    "key": "f12",
    "command": "editor.action.revealDefinition"
  },
  // Find all references
  {
    "key": "shift+f12",
    "command": "editor.action.goToReferences"
  },
  // Rename symbol
  {
    "key": "f2",
    "command": "editor.action.rename"
  },
  // Format document
  {
    "key": "shift+alt+f",
    "command": "editor.action.formatDocument"
  },
  // Quick fix
  {
    "key": "cmd+.",
    "command": "editor.action.quickFix"
  }
]
```

---

## Workspace Organization

### Multi-Root Workspace

For working with related projects:

```json
// hta-calibration.code-workspace
{
  "folders": [
    {
      "name": "HTA Calibration",
      "path": "hta-calibration"
    },
    {
      "name": "OpenSign Local",
      "path": "opensign-local"
    },
    {
      "name": "Documentation",
      "path": "hta-calibration/docs"
    }
  ],
  "settings": {
    "editor.formatOnSave": true
  }
}
```

---

## Productivity Tips

### 1. Quick File Navigation

- `Cmd/Ctrl + P`: Quick open file
- `Cmd/Ctrl + Shift + P`: Command palette
- `Cmd/Ctrl + T`: Go to symbol in workspace

### 2. Code Navigation

- `F12`: Go to definition
- `Alt + F12`: Peek definition
- `Shift + F12`: Find all references
- `Cmd/Ctrl + Shift + O`: Go to symbol in file

### 3. Multi-Cursor Editing

- `Alt + Click`: Add cursor
- `Cmd/Ctrl + D`: Select next occurrence
- `Cmd/Ctrl + Shift + L`: Select all occurrences

### 4. Terminal Integration

- `` Ctrl + ` ``: Toggle terminal
- `Cmd/Ctrl + Shift + 5`: Split terminal
- `Cmd/Ctrl + Shift + [`/`]`: Switch terminal

### 5. Git Integration

- `Cmd/Ctrl + Shift + G`: Open source control
- `Cmd/Ctrl + Enter`: Commit (in source control)

---

## Troubleshooting

### TypeScript Errors Not Showing

```bash
# Restart TypeScript server
Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"
```

### Prettier Not Formatting

1. Check `.prettierrc` exists
2. Check settings: `"editor.defaultFormatter": "esbenp.prettier-vscode"`
3. Check file is not ignored in `.prettierignore`

### ESLint Not Working

```bash
# Check ESLint output
View → Output → Select "ESLint" from dropdown
```

### Tailwind IntelliSense Not Working

1. Ensure `tailwind.config.ts` exists
2. Restart VS Code
3. Check extension is installed

---

## Key Files

| File | Purpose |
|------|---------|
| `.vscode/settings.json` | Workspace settings |
| `.vscode/launch.json` | Debug configurations |
| `.vscode/tasks.json` | Task definitions |
| `.vscode/extensions.json` | Recommended extensions |
| `*.code-workspace` | Multi-root workspace |
