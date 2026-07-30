import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { PERMISSION_CATALOG } from '@/config/permission-catalog';

import type { PermissionNode } from '@/types/permission';

interface PermissionAccordionProps {
  value: string[];
  onChange: (keys: string[]) => void;
}

export function countChecked(node: PermissionNode, checkedSet: Set<string>): number {
  let n = 0;
  if (node.key && checkedSet.has(node.key)) n++;
  for (const c of node.children || []) n += countChecked(c, checkedSet);
  return n;
}

function countTotal(node: PermissionNode): number {
  let n = 0;
  if (node.key) n++;
  for (const c of node.children || []) n += countTotal(c);
  return n;
}

/**
 * Bottom-up visibility check: a branch is visible if any descendant leaf's key exists in checkedSet.
 */
export function isBranchVisible(node: PermissionNode, checkedSet: Set<string>): boolean {
  if (node.key && checkedSet.has(node.key)) return true;
  if (node.children) return node.children.some((c) => isBranchVisible(c, checkedSet));
  return false;
}

export default function PermissionAccordion({ value, onChange }: PermissionAccordionProps) {
  const checkedSet = new Set(value);

  return (
    <div className="space-y-3">
      {PERMISSION_CATALOG.map((menu: PermissionNode, i: number) => (
        <Section
          key={menu.label + i}
          node={menu}
          checkedSet={checkedSet}
          value={value}
          onChange={onChange}
          depth={0}
        />
      ))}
    </div>
  );
}

function Section({
  node, checkedSet, value, onChange, depth,
}: {
  node: PermissionNode;
  checkedSet: Set<string>;
  value: string[];
  onChange: (keys: string[]) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2);

  // Leaf with a key → render checkbox
  if (node.key && (!node.children || node.children.length === 0)) {
    const checked = checkedSet.has(node.key);
    return (
      <div className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-gray-50 group">
        <Checkbox
          id={`perm-${node.key}`}
          checked={checked}
          onCheckedChange={() => {
            const next = new Set(value);
            if (next.has(node.key!)) next.delete(node.key!);
            else next.add(node.key!);
            onChange([...next].sort());
          }}
          className="data-[state=checked]:bg-primary-600"
        />
        <Label
          htmlFor={`perm-${node.key}`}
          className="text-sm cursor-pointer flex-1 group-hover:text-primary-700 transition-colors"
        >
          {node.label}
        </Label>
      </div>
    );
  }

  // Branch → collapsible section
  if (node.children && node.children.length > 0) {
    const checked = countChecked(node, checkedSet);
    const total = countTotal(node);
    const hasAny = checked > 0;

    return (
      <div className={depth === 0 ? 'border border-gray-200 rounded-lg overflow-hidden' : ''}>
        {/* Clickable header */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors ${
            depth === 0
              ? 'bg-gray-50 hover:bg-gray-100 font-semibold text-gray-800'
              : 'hover:bg-gray-50 font-medium text-gray-700'
          } ${hasAny ? 'text-primary-800' : ''}`}
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 shrink-0 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" />
          )}
          <span className="flex-1 text-sm">{node.label}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            hasAny
              ? 'bg-primary-100 text-primary-700'
              : 'bg-gray-100 text-gray-500'
          }`}>
            {checked}/{total}
          </span>
        </button>

        {/* Children */}
        {expanded && (
          <div className={depth === 0 ? 'p-3 space-y-1' : 'ml-4 space-y-0.5 mt-0.5'}>
            {node.children.map((child, i) => (
              <Section
                key={child.label + (child.key || '') + i}
                node={child}
                checkedSet={checkedSet}
                value={value}
                onChange={onChange}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}
