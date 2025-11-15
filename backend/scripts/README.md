# Scripts Directory

This directory contains scripts organized by phase and prompt.

## Directory Structure

```
scripts/
├── phase4/              # Phase 4: Finance & Accounting
│   ├── sql/            # SQL scripts for Phase 4
│   └── README.md       # Phase 4 script documentation
└── README.md           # This file
```

## Naming Convention

All scripts follow this naming pattern:
- **Format:** `phase{X}_YYYYMMDD_{description}.{ext}`
- **Example:** `phase4_20250127_test-finance.ps1`

Where:
- `phase{X}` = Phase number (e.g., phase4)
- `YYYYMMDD` = Date when script was created (e.g., 20250127)
- `{description}` = Brief description of what the script does
- `{ext}` = File extension (.ps1, .js, .ts, .sql)

## Script Types

- **PowerShell (.ps1)** - Windows automation and testing scripts
- **JavaScript (.js)** - Node.js scripts for database operations
- **TypeScript (.ts)** - TypeScript versions of scripts
- **SQL (.sql)** - Database scripts (stored in `sql/` subdirectories)

## Usage

Navigate to the specific phase directory and run scripts from there:

```powershell
# Example: Run Phase 4 Finance test
cd scripts/phase4
powershell -ExecutionPolicy Bypass -File phase4_20250127_test-finance.ps1
```

```bash
# Example: Run Phase 4 role assignment
cd scripts/phase4
node phase4_20250127_assign-cfo-role.js
```

## Adding New Scripts

When adding scripts for a new phase:
1. Create directory: `scripts/phase{X}/`
2. Create SQL subdirectory if needed: `scripts/phase{X}/sql/`
3. Name files with phase prefix and timestamp
4. Add README.md in the phase directory documenting all scripts

