#!/usr/bin/env python3
"""Fix all files that have `<div className="<PageHeader` pattern.
The batch script left a `<div className="` prefix before PageHeader.
"""
import os, glob, re

BASE = "/home/hermes/projects/igd-orbit/frontend/src/pages"
tsx_files = sorted(glob.glob(f"{BASE}/**/*.tsx", recursive=True))
fixed = 0

for fpath in tsx_files:
    with open(fpath, 'r') as f:
        content = f.read()
    
    original = content
    
    # Remove the `<div className="` prefix before `<PageHeader`
    # Pattern: <div className="<PageHeader ...> ...</PageHeader>\n</div>
    # The closing </div> was the original gradient div's closing tag
    
    # Fix 1: opening tag
    content = content.replace('<div className="<PageHeader', '<PageHeader')
    
    # Fix 2: extra closing </div> after </PageHeader>
    # The original had: </PageHeader>\n</div>
    # We need just: </PageHeader>
    # Find </PageHeader> followed by optional whitespace and </div>
    content = re.sub(r'(</PageHeader>)\s*\n?\s*</div>', r'\1', content)
    
    if content != original:
        with open(fpath, 'w') as f:
            f.write(content)
        rel = os.path.relpath(fpath, BASE)
        print(f"  ✓ {rel}")
        fixed += 1

print(f"\nFixed: {fixed} files")
