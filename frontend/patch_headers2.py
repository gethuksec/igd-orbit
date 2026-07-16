#!/usr/bin/env python3
"""Patch simple list-page headers (h1 + p, no back button) to use PageHeader."""
import os, re, glob

BASE = "/home/hermes/projects/igd-orbit/frontend/src/pages"
IMPORT_LINE = "import { PageHeader } from '@/components/shared';"

# Match simple list headers: gradient div > flex justify-between > div > h1 + p, no gap-4
PATTERN = re.compile(
    r'<div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">'
    r'\s*<div className="flex items-center justify-between">'
    r'\s*<div>'
    r'\s*<h1 className="[^"]*mb-2[^"]*">([^<]+)</h1>'
    r'\s*<p className="[^"]*text-primary-100[^"]*">([^<]+)</p>'
    r'\s*</div>'
    r'\s*</div>'
    r'\s*</div>',
    re.DOTALL
)

# Also match headers with icons inside h1
PATTERN_ICON = re.compile(
    r'<div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">'
    r'\s*<div className="flex items-center justify-between">'
    r'\s*<div>'
    r'\s*<h1 className="[^"]*mb-2[^"]*[^>]*>'
    r'(?:<[^>]+>\s*)*?'  # Skip inner icon/span
    r'([^<{]+?)</h1>'    # Capture text before any icon
    r'\s*<p className="[^"]*text-primary-100[^"]*">([^<]+)</p>'
    r'\s*</div>'
    r'\s*</div>'
    r'\s*</div>',
    re.DOTALL
)

def add_import(content):
    if 'PageHeader' in content:
        return content
    # Look for existing shared import
    m = re.search(r"(import \{)([^}]*)(\} from ['\"]@/components/shared['\"])", content)
    if m:
        existing = m.group(2).strip()
        if not existing:
            replacement = f"{{ PageHeader }} from '@/components/shared'"
        else:
            replacement = f"{{{existing}, PageHeader}} from '@/components/shared'"
        content = content.replace(m.group(0), f"import {replacement}")
        content = content.replace(',  }', ' }').replace(', }', ' }')
        return content
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if line.startswith('import ') and 'from' in line:
            last_import = i
    lines.insert(last_import + 1, IMPORT_LINE)
    return '\n'.join(lines)

def main():
    tsx_files = sorted(glob.glob(f"{BASE}/**/*.tsx", recursive=True))
    patched = 0
    
    for fpath in tsx_files:
        rel = os.path.relpath(fpath, BASE)
        
        # Skip already-refactored files
        if '/inventory/' in fpath and rel not in [
            'inventory/StockAdjustment.tsx', 'inventory/StockOpnameCount.tsx',
            'inventory/StockOpnameDetail.tsx', 'inventory/StockOpnameForm.tsx',
            'inventory/StockTransfer.tsx', 'inventory/StockTransferDetail.tsx'
        ]:
            continue
        if '/sales/' in fpath:
            continue
        if '/service-orders/' in fpath or '/service-returns/' in fpath:
            continue
        
        with open(fpath, 'r') as f:
            content = f.read()
        
        original = content
        
        # Try both patterns
        m = PATTERN.search(content)
        if not m:
            m = PATTERN_ICON.search(content)
        if not m:
            continue
        
        title = m.group(1).strip()
        subtitle = m.group(2).strip()
        
        # Check if there's a new button/link after the </div>...</div> but before next component
        end_pos = m.end()
        next_content = content[end_pos:end_pos+200]
        
        # Look for action link/button that should become PageHeader children
        action_match = re.search(r'(<(?:Link|button)[^>]*>.*?</(?:Link|button)>\s*)', next_content)
        
        if action_match:
            action_html = action_match.group(1).strip()
            replacement = f'<PageHeader title="{title}" subtitle="{subtitle}">\n        {action_html}\n      </PageHeader>'
        else:
            replacement = f'<PageHeader title="{title}" subtitle="{subtitle}" />'
        
        content = PATTERN.sub(replacement, content, count=1)
        if content == original:
            content = PATTERN_ICON.sub(replacement, content, count=1)
        
        if content != original:
            content = add_import(content)
            # Remove duplicate import
            if content.count(IMPORT_LINE) > 1:
                lines = content.split('\n')
                seen = False
                new_lines = []
                for line in lines:
                    if IMPORT_LINE in line:
                        if seen:
                            continue
                        seen = True
                    new_lines.append(line)
                content = '\n'.join(new_lines)
            
            with open(fpath, 'w') as f:
                f.write(content)
            print(f"  ✓ {rel}  [{title}]")
            patched += 1
    
    print(f"\nPatched: {patched}")

if __name__ == "__main__":
    main()
