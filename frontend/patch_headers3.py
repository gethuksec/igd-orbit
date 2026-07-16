#!/usr/bin/env python3
"""Batch replace gradient page headers with PageHeader component.
Handles: h1 with/without icons, with/without action buttons, with/without back buttons.
"""
import os, re, glob

BASE = "/home/hermes/projects/igd-orbit/frontend/src/pages"
IMPORT_LINE = "import { PageHeader } from '@/components/shared';"

def add_pageheader_import(content):
    if 'PageHeader' in content:
        return content
    m = re.search(r"(import \{)([^}]*)(\} from ['\"]@/components/shared['\"])", content)
    if m:
        existing = m.group(2).strip()
        if not existing:
            replacement = "{ PageHeader } from '@/components/shared'"
        else:
            replacement = "{" + existing + ", PageHeader} from '@/components/shared'"
        content = content.replace(m.group(0), "import " + replacement)
        content = content.replace(',  }', ' }').replace(', }', ' }').replace('{, ', '{').replace('{,' , '{')
        return content
    lines = content.split('\n')
    last_import = -1
    for i, line in enumerate(lines):
        if line.startswith('import ') and 'from' in line:
            last_import = i
    if last_import >= 0:
        lines.insert(last_import + 1, IMPORT_LINE)
    return '\n'.join(lines)

def extract_header_info(content, start):
    """Extract title, subtitle and children from a gradient header block.
    Returns (title, subtitle, children_html, end_pos) or None.
    """
    # Find the closing </div> that ends the outer gradient div
    # The gradient div starts at 'start'
    # We need to find the matching </div> by counting nesting
    
    # Find the opening of the gradient div
    grad_open = content.find('<div', start)
    
    # Strategy: find the inner div structure
    # Pattern: gradient div > flex justify-between div > [content] > </div> > </div>
    # Where [content] = <div><h1>title</h1><p>subtitle</p></div> [optional actions]
    
    inner_section = content[start:]
    
    # Find the first inner div that wraps title+subtitle
    # Look for <div> followed by <h1...> and <p...>
    
    # Find position of h1
    h1_start = inner_section.find('<h1 ')
    if h1_start == -1:
        h1_start = inner_section.find('<h1>')
    if h1_start == -1:
        return None
    
    # Find title text
    h1_close = inner_section.find('</h1>', h1_start)
    if h1_close == -1:
        return None
    
    h1_content = inner_section[h1_start:h1_close + 5]
    title_match = re.search(r'>([^<]+)</h1>', h1_content)
    if not title_match:
        return None
    
    title = title_match.group(1).strip()
    
    # Find subtitle
    p_start = inner_section.find('<p ', h1_close)
    if p_start == -1:
        p_start = inner_section.find('<p>', h1_close)
    if p_start == -1:
        return title, '', '', 0  # no subtitle
    
    p_close = inner_section.find('</p>', p_start)
    if p_close == -1:
        return title, '', '', 0
    
    p_tag = inner_section[p_start:p_close + 4]
    p_match = re.search(r'>([^<]+)</p>', p_tag)
    subtitle = p_match.group(1).strip() if p_match else ''
    
    # Find the end of the outer gradient div
    # The structure is: <div class="gradient">\n<div class="flex">\n...\n</div>\n</div>
    # Find the second </div> from the end that closes everything
    
    # Find the first inner </div> (closes the inner wrapper div)
    first_close = inner_section.find('</div>', p_close)
    if first_close == -1:
        return None
    
    # Check if there's an actions section between first_close and second_close
    second_close = inner_section.find('</div>', first_close + 6)
    if second_close == -1:
        return None
    
    # The outer gradient div ends at second_close + 6
    end_pos = start + second_close + 6
    
    # Extract actions content (between first </div> and second </div>)
    actions_section = inner_section[first_close + 6:second_close].strip()
    
    # Check if there are actual action elements (buttons/links)
    has_actions = bool(re.search(r'<(?:button|Link|a)[>\s]', actions_section))
    
    children_html = actions_section if has_actions else ''
    
    return (title, subtitle, children_html, end_pos)

def main():
    tsx_files = sorted(glob.glob(f"{BASE}/**/*.tsx", recursive=True))
    patched = 0
    
    for fpath in tsx_files:
        rel = os.path.relpath(fpath, BASE)
        
        # Skip already-done files
        already_done = [
            'sales/SalesHistory.tsx', 'sales/SalesTransactionDetail.tsx',
            'sales/ReturnsList.tsx', 'sales/ReturnForm.tsx',
            'service-orders/ServiceOrderList.tsx', 'service-orders/MyServiceOrders.tsx',
            'service-returns/ServiceReturnsList.tsx',
            'inventory/StockList.tsx', 'inventory/StockTransferList.tsx',
            'inventory/StockOpnameList.tsx', 'inventory/StockMovementHistory.tsx',
            'inventory/LowStockAlerts.tsx',
        ]
        if rel in already_done:
            continue
        if rel.startswith('master-data/'):
            continue  # Already migrated
        
        # Skip directories outside A3 scope
        if rel.startswith(('public/', 'auth/', 'dashboard/', 'profile/', 'settings/')):
            continue
        
        with open(fpath, 'r') as f:
            content = f.read()
        
        original = content
        
        # Find gradient header
        marker = 'bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white'
        pos = content.find(marker)
        if pos == -1:
            continue
        
        result = extract_header_info(content, pos)
        if result is None:
            continue
        
        title, subtitle, children, end_pos = result
        if not title:
            continue
        
        # Build replacement
        if children:
            replacement = f'<PageHeader title="{title}" subtitle="{subtitle}">\n        {children}\n      </PageHeader>'
        else:
            replacement = f'<PageHeader title="{title}" subtitle="{subtitle}" />'
        
        # Replace from the <div className="bg-gradient... to its closing </div>
        old_block = content[pos:end_pos]
        content = content[:pos] + replacement + content[end_pos:]
        
        if content != original:
            content = add_pageheader_import(content)
            
            # Deduplicate import
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
            print(f"  ✓ {rel}")
            patched += 1
    
    print(f"\nPatched: {patched} files")

if __name__ == "__main__":
    main()
