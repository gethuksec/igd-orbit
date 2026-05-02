import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { GroupedPermissions } from '../../../services/roles.service';

interface PermissionTreeProps {
  permissions: GroupedPermissions; // Backend format: { [module]: { [submodule]: [{ id, action, description }] } }
  selectedPermissions: Set<string>; // Set of permission IDs
  onPermissionToggle: (permissionId: string) => void;
  searchTerm?: string;
}

interface PermissionItem {
  id: string;
  action: string;
  description: string | null;
}

export function PermissionTree({
  permissions,
  selectedPermissions,
  onPermissionToggle,
  searchTerm = '',
}: PermissionTreeProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [expandedSubmodules, setExpandedSubmodules] = useState<Set<string>>(new Set());

  // Filter permissions based on search term
  const filteredPermissions = useMemo(() => {
    if (!searchTerm.trim()) return permissions;

    const searchLower = searchTerm.toLowerCase();
    const filtered: GroupedPermissions = {};

    for (const [module, submodules] of Object.entries(permissions)) {
      const filteredSubmodules: Record<string, PermissionItem[]> = {};

      for (const [submodule, items] of Object.entries(submodules)) {
        const filteredItems = items.filter(
          (item) =>
            module.toLowerCase().includes(searchLower) ||
            submodule.toLowerCase().includes(searchLower) ||
            item.action.toLowerCase().includes(searchLower) ||
            (item.description && item.description.toLowerCase().includes(searchLower)),
        );

        if (filteredItems.length > 0) {
          filteredSubmodules[submodule] = filteredItems;
        }
      }

      if (Object.keys(filteredSubmodules).length > 0) {
        filtered[module] = filteredSubmodules;
      }
    }

    return filtered;
  }, [permissions, searchTerm]);

  const toggleModule = (module: string) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(module)) {
      newExpanded.delete(module);
    } else {
      newExpanded.add(module);
      // Auto-expand submodules if only one
      const submodules = Object.keys(filteredPermissions[module] || {});
      if (submodules.length === 1) {
        setExpandedSubmodules((prev) => new Set([...prev, `${module}.${submodules[0]}`]));
      }
    }
    setExpandedModules(newExpanded);
  };

  const toggleSubmodule = (key: string) => {
    const newExpanded = new Set(expandedSubmodules);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedSubmodules(newExpanded);
  };

  const isModuleExpanded = (module: string) => expandedModules.has(module);
  const isSubmoduleExpanded = (module: string, submodule: string) =>
    expandedSubmodules.has(`${module}.${submodule}`);

  const getModulePermissionCount = (module: string) => {
    let count = 0;
    const submodules = filteredPermissions[module] || {};
    for (const items of Object.values(submodules)) {
      count += items.filter((item) => selectedPermissions.has(item.id)).length;
    }
    return count;
  };

  const getModuleTotalCount = (module: string) => {
    const submodules = filteredPermissions[module] || {};
    return Object.values(submodules).reduce((sum, items) => sum + items.length, 0);
  };

  const getSubmodulePermissionCount = (module: string, submodule: string) => {
    const items = filteredPermissions[module]?.[submodule] || [];
    return items.filter((item) => selectedPermissions.has(item.id)).length;
  };

  const formatModuleName = (module: string) => {
    return module.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const formatSubmoduleName = (submodule: string) => {
    if (submodule === '*') return 'All Submodules';
    return submodule.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const formatActionName = (action: string) => {
    return action.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  if (Object.keys(filteredPermissions).length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No permissions found{searchTerm ? ` matching "${searchTerm}"` : ''}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {Object.entries(filteredPermissions).map(([module, submodules]) => {
        const moduleExpanded = isModuleExpanded(module);
        const moduleCount = getModulePermissionCount(module);
        const totalModulePermissions = getModuleTotalCount(module);

        return (
          <div key={module} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleModule(module)}
              className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                {moduleExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-600" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                )}
                <span className="font-semibold text-gray-900">{formatModuleName(module)}</span>
                <span className="text-sm text-gray-500">
                  ({moduleCount}/{totalModulePermissions})
                </span>
              </div>
            </button>

            {moduleExpanded && (
              <div className="bg-white">
                {Object.entries(submodules).map(([submodule, items]) => {
                  const submoduleKey = `${module}.${submodule}`;
                  const submoduleExpanded = isSubmoduleExpanded(module, submodule);
                  const submoduleCount = getSubmodulePermissionCount(module, submodule);

                  return (
                    <div key={submoduleKey} className="border-t border-gray-200">
                      <button
                        onClick={() => toggleSubmodule(submoduleKey)}
                        className="w-full px-6 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          {submoduleExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-600" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-600" />
                          )}
                          <span className="font-medium text-gray-800">{formatSubmoduleName(submodule)}</span>
                          <span className="text-xs text-gray-500">({submoduleCount}/{items.length})</span>
                        </div>
                      </button>

                      {submoduleExpanded && (
                        <div className="px-8 py-2 space-y-1">
                          {items.map((item) => {
                            const isSelected = selectedPermissions.has(item.id);
                            const permissionKey = `${module}.${submodule}.${item.action}`;
                            return (
                              <label
                                key={item.id}
                                className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded cursor-pointer group"
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => onPermissionToggle(item.id)}
                                  className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500 focus:ring-2"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-900">
                                    {formatActionName(item.action)}
                                  </div>
                                  <div className="text-xs text-gray-500 font-mono truncate">{permissionKey}</div>
                                  {item.description && (
                                    <div className="text-xs text-gray-400 mt-1">{item.description}</div>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
