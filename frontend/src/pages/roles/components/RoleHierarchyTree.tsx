import { useQuery } from '@tanstack/react-query';
import { rolesService } from '../../../services/roles.service';
import { Shield, ChevronRight, ChevronDown, Users } from 'lucide-react';
import { useState } from 'react';

interface Role {
  id: string;
  code: string;
  name: string;
  level: number;
  isActive: boolean;
  parentRoleId?: string | null;
  userCount?: number;
}

interface RoleHierarchyTreeProps {
  selectedRoleId?: string;
  onRoleSelect?: (roleId: string) => void;
}

export function RoleHierarchyTree({ selectedRoleId, onRoleSelect }: RoleHierarchyTreeProps) {
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());

  const { data: rolesData, isLoading } = useQuery({
    queryKey: ['roles-hierarchy'],
    queryFn: () => rolesService.getAll({ limit: 1000 }),
  });

  const roles = rolesData?.data || [];

  // Build hierarchy tree
  const buildHierarchy = (parentId: string | null = null): Role[] => {
    return roles
      .filter((role: Role) => role.parentRoleId === parentId)
      .sort((a: Role, b: Role) => {
        // Sort by level first, then by name
        if (a.level !== b.level) return a.level - b.level;
        return a.name.localeCompare(b.name);
      });
  };

  const toggleExpand = (roleId: string) => {
    setExpandedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) {
        next.delete(roleId);
      } else {
        next.add(roleId);
      }
      return next;
    });
  };

  const renderRole = (role: Role, depth: number = 0) => {
    const children = buildHierarchy(role.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedRoles.has(role.id);
    const isSelected = selectedRoleId === role.id;

    return (
      <div key={role.id} className="select-none">
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
            isSelected
              ? 'bg-primary-100 text-primary-700 font-semibold'
              : 'hover:bg-gray-100 text-gray-700'
          } ${!role.isActive ? 'opacity-50' : ''}`}
          style={{ paddingLeft: `${depth * 24 + 12}px` }}
          onClick={() => onRoleSelect?.(role.id)}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(role.id);
              }}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
            </button>
          ) : (
            <div className="w-6" /> // Spacer for alignment
          )}
          <Shield className="w-4 h-4 text-primary-600" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{role.name}</span>
              <span className="text-xs text-gray-500 font-mono">({role.code})</span>
              <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">
                Tier {role.level}
              </span>
            </div>
            {role.userCount !== undefined && role.userCount > 0 && (
              <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                <Users className="w-3 h-3" />
                <span>{role.userCount} user{role.userCount !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
          {!role.isActive && (
            <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded">Inactive</span>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div className="ml-6 border-l-2 border-gray-200">
            {children.map((child) => renderRole(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const rootRoles = buildHierarchy(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading hierarchy...</div>
      </div>
    );
  }

  if (rootRoles.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Shield className="w-12 h-12 mx-auto mb-3 text-gray-400" />
        <p>No roles found</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {rootRoles.map((role) => renderRole(role))}
    </div>
  );
}

