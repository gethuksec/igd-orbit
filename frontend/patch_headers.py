#!/usr/bin/env python3
"""Simple batch replacement of gradient page headers in TSX files.
Replaces known gradient header patterns with PageHeader component.
"""
import os, re, glob

BASE = "/home/hermes/projects/igd-orbit/frontend/src/pages"
PATTERNS = [
    # 1: Standard header with justify-between, no actions
    (r'<div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">\s*<div className="flex items-center justify-between">\s*<div>\s*<h1 className="[^"]*text-[^"]*[^>]*>([^<]+)</h1>\s*<p className="[^"]*text-primary-100[^"]*">([^<]+)</p>\s*</div>\s*</div>\s*</div>',
     r'<PageHeader title="\1" subtitle="\2" />'),
    # 2: No justify-between, single div
    (r'<div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">\s*<div>\s*<h1 className="[^"]*mb-2[^"]*">([^<]+)</h1>\s*<p className="[^"]*text-primary-100[^"]*text-[^"]*">([^<]+)</p>\s*</div>\s*</div>',
     r'<PageHeader title="\1" subtitle="\2" />'),
    # 3: Header with single h1 (no subtitle p)
    (r'<div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">\s*<div className="flex items-center justify-between">\s*<div>\s*<h1 className="[^"]*text-[^"]*[^>]*>([^<]+)</h1>\s*</div>\s*</div>\s*</div>',
     r'<PageHeader title="\1" />'),
]

IMPORT_LINE = "import { PageHeader } from '@/components/shared';"

def is_tsx_with_gradient(fpath):
    """Quick check if file has gradient header."""
    try:
        with open(fpath, 'r') as f:
            content = f.read(5000)
        return 'bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6' in content
    except:
        return False

def add_import(content):
    """Add PageHeader import if needed."""
    if 'PageHeader' in content:
        return content
    # Check for existing shared import
    shared_match = re.search(r"import \{([^}]*)\} from ['\"]@/components/shared['\"]", content)
    if shared_match:
        existing = shared_match.group(1).strip()
        if 'PageHeader' not in existing:
            new_import = shared_match.group(0).replace(
                '{' + existing + '}',
                '{' + existing + ', PageHeader}'
            ).replace(',  ', ', ').replace(', }', ' }')
            content = content.replace(shared_match.group(0), new_import)
        return content
    
    # No existing shared import - add new line after last import
    lines = content.split('\n')
    last_import_idx = -1
    for i, line in enumerate(lines):
        if line.strip().startswith('import '):
            last_import_idx = i
    if last_import_idx >= 0:
        lines.insert(last_import_idx + 1, IMPORT_LINE)
    return '\n'.join(lines)

def main():
    tsx_files = glob.glob(f"{BASE}/**/*.tsx", recursive=True)
    patched = 0
    skipped = 0
    
    for fpath in tsx_files:
        # Skip already-refactored files (check for PageHeader in header area)
        if not is_tsx_with_gradient(fpath):
            skipped += 1
            continue
        
        with open(fpath, 'r') as f:
            content = f.read()
        
        original = content
        
        # Apply all patterns
        for pattern, replacement in PATTERNS:
            content = re.sub(pattern, replacement, content, count=1)
        
        if content != original:
            # Add import
            content = add_import(content)
            
            # Handle duplicate imports
            if content.count(IMPORT_LINE) > 1:
                lines = content.split('\n')
                seen_import = False
                new_lines = []
                for line in lines:
                    if IMPORT_LINE in line:
                        if seen_import:
                            continue
                        seen_import = True
                    new_lines.append(line)
                content = '\n'.join(new_lines)
            
            with open(fpath, 'w') as f:
                f.write(content)
            rel = os.path.relpath(fpath, BASE)
            print(f"  ✓ {rel}")
            patched += 1
        else:
            skipped += 1
    
    print(f"\nPatched: {patched}, Skipped: {skipped}")

if __name__ == "__main__":
    main()
