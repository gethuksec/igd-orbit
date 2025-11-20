import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { PermissionGroup } from '../../../services/roles.service';

interface PermissionTreeProps {
  permissionGroups: PermissionGroup[];
  selectedPermissions: Set<string>;
  onPermissionToggle: (permissionId: string) => void;
}

export function PermissionTree({
  permissionGroups,
  selectedPermissions,
  onPermissionToggle,
}: PermissionTreeProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [expandedSubmodules, setExpandedSubmodules] = useState<Set<string>>(new Set());

  const toggleModule = (module: string) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(module)) {
      newExpanded.delete(module);
    } else {
      newExpanded.add(module);
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
    permissionGroups
      .find((g) => g.module === module)
      ?.submodules.forEach((sub) => {
        sub.permissions.forEach((perm) => {
          if (selectedPermissions.has(perm.id)) count++;
        });
      });
    return count;
  };

  const getSubmodulePermissionCount = (module: string, submodule: string) => {
    const group = permissionGroups.find((g) => g.module === module);
    const sub = group?.submodules.find((s) => s.submodule === submodule);
    return sub?.permissions.filter((p) => selectedPermissions.has(p.id)).length || 0;
  };

  return (
    <div className="space-y-2">
      {permissionGroups.map((group) => {
        const moduleExpanded = isModuleExpanded(group.module);
        const moduleCount = getModulePermissionCount(group.module);
        const totalModulePermissions = group.submodules.reduce(
          (sum, sub) => sum + sub.permissions.length,
          0,
        );

        return (
          <div key={group.module} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleModule(group.module)}
              className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                {moduleExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-600" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                )}
                <span className="font-semibold text-gray-900 capitalize">{group.module}</span>
                <span className="text-sm text-gray-500">
                  ({moduleCount}/{totalModulePermissions} selected)
                </span>
              </div>
            </button>

            {moduleExpanded && (
              <div className="bg-white">
                {group.submodules.map((submodule) => {
                  const submoduleKey = `${group.module}.${submodule.submodule}`;
                  const submoduleExpanded = isSubmoduleExpanded(group.module, submodule.submodule);
                  const submoduleCount = getSubmodulePermissionCount(group.module, submodule.submodule);

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
                          <span className="font-medium text-gray-800 capitalize">
                            {submodule.submodule.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs text-gray-500">
                            ({submoduleCount}/{submodule.permissions.length} selected)
                          </span>
                        </div>
                      </button>

                      {submoduleExpanded && (
                        <div className="px-8 py-2 space-y-1">
                          {submodule.permissions.map((permission) => {
                            const isSelected = selectedPermissions.has(permission.id);
                            return (
                              <label
                                key={permission.id}
                                className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => onPermissionToggle(permission.id)}
                                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                                />
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-gray-900">
                                    {permission.name}
                                  </div>
                                  <div className="text-xs text-gray-500 font-mono">
                                    {permission.code}
                                  </div>
                                  {permission.description && (
                                    <div className="text-xs text-gray-400 mt-1">
                                      {permission.description}
                                    </div>
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

