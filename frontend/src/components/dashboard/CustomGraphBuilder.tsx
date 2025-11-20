import { useState } from 'react';
import {
  BarChart3,
  LineChart,
  PieChart,
  AreaChart,
  X,
  Plus,
  Trash2,
  Edit2,
} from 'lucide-react';
import {
  LineChart as RechartsLineChart,
  Line,
  BarChart,
  Bar,
  AreaChart as RechartsAreaChart,
  Area,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { api } from '../../services/api';

interface CustomGraph {
  id: string;
  title: string;
  chartType: 'line' | 'bar' | 'pie' | 'area';
  tableName: string;
  dataFields: string[]; // Array of fields to display
  groupBy?: string;
  filter?: Record<string, any>;
  colors?: string[];
}

interface CustomGraphBuilderProps {
  onGraphCreated?: (graph: CustomGraph) => void;
  onGraphDeleted?: (graphId: string) => void;
}

// Available tables and their fields
const AVAILABLE_TABLES = [
  {
    name: 'sales_transactions',
    label: 'Sales Transactions',
    fields: [
      { name: 'id', label: 'ID', type: 'string' },
      { name: 'transaction_number', label: 'Transaction Number', type: 'string' },
      { name: 'total', label: 'Total', type: 'number' },
      { name: 'subtotal', label: 'Subtotal', type: 'number' },
      { name: 'discount_amount', label: 'Discount Amount', type: 'number' },
      { name: 'tax_amount', label: 'Tax Amount', type: 'number' },
      { name: 'status', label: 'Status', type: 'string' },
      { name: 'created_at', label: 'Created At', type: 'date' },
      { name: 'branch_id', label: 'Branch ID', type: 'string' },
    ],
  },
  {
    name: 'service_orders',
    label: 'Service Orders',
    fields: [
      { name: 'id', label: 'ID', type: 'string' },
      { name: 'service_number', label: 'Service Number', type: 'string' },
      { name: 'total_price', label: 'Total Price', type: 'number' },
      { name: 'labor_cost', label: 'Labor Cost', type: 'number' },
      { name: 'parts_cost', label: 'Parts Cost', type: 'number' },
      { name: 'status', label: 'Status', type: 'string' },
      { name: 'device_type', label: 'Device Type', type: 'string' },
      { name: 'created_at', label: 'Created At', type: 'date' },
    ],
  },
  {
    name: 'products',
    label: 'Products',
    fields: [
      { name: 'id', label: 'ID', type: 'string' },
      { name: 'name', label: 'Name', type: 'string' },
      { name: 'selling_price', label: 'Selling Price', type: 'number' },
      { name: 'cost_price', label: 'Cost Price', type: 'number' },
      { name: 'created_at', label: 'Created At', type: 'date' },
    ],
  },
  {
    name: 'customers',
    label: 'Customers',
    fields: [
      { name: 'id', label: 'ID', type: 'string' },
      { name: 'name', label: 'Name', type: 'string' },
      { name: 'customer_type', label: 'Customer Type', type: 'string' },
      { name: 'created_at', label: 'Created At', type: 'date' },
    ],
  },
];

const DEFAULT_COLORS = ['#dc2626', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

export function CustomGraphBuilder({
  onGraphCreated,
  onGraphDeleted,
}: CustomGraphBuilderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [graphs, setGraphs] = useState<CustomGraph[]>([]);
  const [formData, setFormData] = useState<Partial<CustomGraph>>({
    title: '',
    chartType: 'line',
    tableName: '',
    dataFields: [],
    groupBy: '',
    colors: DEFAULT_COLORS,
  });
  const [graphDataMap, setGraphDataMap] = useState<Record<string, any[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadingGraphId, setLoadingGraphId] = useState<string | null>(null);

  const selectedTable = AVAILABLE_TABLES.find((t) => t.name === formData.tableName);

  const handleCreateGraph = async () => {
    if (!formData.title || !formData.tableName || !formData.dataFields || formData.dataFields.length === 0) {
      alert('Please fill in all required fields and select at least one data field');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/dashboard/custom-graph', {
        title: formData.title,
        chartType: formData.chartType,
        tableName: formData.tableName,
        dataFields: formData.dataFields,
        groupBy: formData.groupBy || undefined,
      });

      const newGraph: CustomGraph = {
        id: response.data.id || Date.now().toString(),
        ...formData,
        dataFields: formData.dataFields || [],
      } as CustomGraph;

      const updatedGraphs = [...graphs, newGraph];
      setGraphs(updatedGraphs);
      setFormData({
        title: '',
        chartType: 'line',
        tableName: '',
        dataFields: [],
        groupBy: '',
        colors: DEFAULT_COLORS,
      });
      setIsOpen(false);
      onGraphCreated?.(newGraph);
      // Fetch data after a short delay to allow state to update
      setTimeout(() => {
        fetchGraphData(newGraph);
      }, 100);
    } catch (error: any) {
      console.error('Error creating graph:', error);
      alert('Error creating graph: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGraphData = async (graph: CustomGraph) => {
    setLoadingGraphId(graph.id);
    try {
      const response = await api.get('/dashboard/custom-graph/data', {
        params: {
          tableName: graph.tableName,
          dataFields: graph.dataFields.join(','),
          groupBy: graph.groupBy || undefined,
        },
      });
      setGraphDataMap((prev) => ({
        ...prev,
        [graph.id]: response.data || [],
      }));
    } catch (error: any) {
      console.error('Error fetching graph data:', error);
      setGraphDataMap((prev) => ({
        ...prev,
        [graph.id]: [],
      }));
    } finally {
      setLoadingGraphId(null);
    }
  };

  const toggleDataField = (fieldName: string) => {
    const currentFields = formData.dataFields || [];
    if (currentFields.includes(fieldName)) {
      setFormData({
        ...formData,
        dataFields: currentFields.filter((f) => f !== fieldName),
      });
    } else {
      setFormData({
        ...formData,
        dataFields: [...currentFields, fieldName],
      });
    }
  };

  const renderChart = (graph: CustomGraph, data: any[]) => {
    if (!data || data.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-500">
          No data available
        </div>
      );
    }

    const numberFields = graph.dataFields.filter((field) => {
      const fieldDef = selectedTable?.fields.find((f) => f.name === field);
      return fieldDef?.type === 'number';
    });

    const stringFields = graph.dataFields.filter((field) => {
      const fieldDef = selectedTable?.fields.find((f) => f.name === field);
      return fieldDef?.type === 'string' || fieldDef?.type === 'date';
    });

    // Determine X-axis (first string/date field or groupBy)
    const xAxisField = graph.groupBy || stringFields[0] || 'label';

    switch (graph.chartType) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <RechartsLineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxisField} />
              <YAxis />
              <Tooltip />
              <Legend />
              {numberFields.map((field, index) => (
                <Line
                  key={field}
                  type="monotone"
                  dataKey={field}
                  stroke={graph.colors?.[index % (graph.colors?.length || 1)] || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                  strokeWidth={2}
                  name={selectedTable?.fields.find((f) => f.name === field)?.label || field}
                />
              ))}
            </RechartsLineChart>
          </ResponsiveContainer>
        );
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxisField} />
              <YAxis />
              <Tooltip />
              <Legend />
              {numberFields.map((field, index) => (
                <Bar
                  key={field}
                  dataKey={field}
                  fill={graph.colors?.[index % (graph.colors?.length || 1)] || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                  name={selectedTable?.fields.find((f) => f.name === field)?.label || field}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <RechartsAreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxisField} />
              <YAxis />
              <Tooltip />
              <Legend />
              {numberFields.map((field, index) => (
                <Area
                  key={field}
                  type="monotone"
                  dataKey={field}
                  stroke={graph.colors?.[index % (graph.colors?.length || 1)] || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                  fill={graph.colors?.[index % (graph.colors?.length || 1)] || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                  fillOpacity={0.6}
                  name={selectedTable?.fields.find((f) => f.name === field)?.label || field}
                />
              ))}
            </RechartsAreaChart>
          </ResponsiveContainer>
        );
      case 'pie':
        // For pie chart, use first number field
        const pieDataField = numberFields[0] || graph.dataFields[0];
        return (
          <ResponsiveContainer width="100%" height={300}>
            <RechartsPieChart>
              <Pie
                data={data}
                dataKey={pieDataField}
                nameKey={xAxisField}
                cx="50%"
                cy="50%"
                outerRadius={80}
                label
              >
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={graph.colors?.[index % (graph.colors?.length || 1)] || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </RechartsPieChart>
          </ResponsiveContainer>
        );
      default:
        return <div>Unsupported chart type</div>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Add Graph Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-indonesia-red-700">Custom Graphs</h2>
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indonesia-red-600 text-white rounded-lg hover:bg-indonesia-red-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Custom Graph
        </button>
      </div>

      {/* Graph Cards */}
      {graphs.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No custom graphs yet. Create your first graph above!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {graphs.map((graph) => (
              <div key={graph.id} className="bg-white rounded-lg shadow-md p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-indonesia-red-700">{graph.title}</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (!graphDataMap[graph.id]) {
                          fetchGraphData(graph);
                        }
                      }}
                      className="p-2 text-gray-600 hover:text-indonesia-red-600"
                      title="Load Data"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteGraph(graph.id)}
                      className="p-2 text-red-600 hover:text-red-700"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {loadingGraphId === graph.id ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indonesia-red-600"></div>
                  </div>
                ) : (
                  renderChart(graph, graphDataMap[graph.id] || [])
                )}
              </div>
            ))}
        </div>
      )}

      {/* Create Graph Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-indonesia-red-700">Create Custom Graph</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Graph Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indonesia-red-500"
                  placeholder="e.g., Sales by Month"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Chart Type *
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['line', 'bar', 'pie', 'area'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setFormData({ ...formData, chartType: type })}
                      className={`p-3 border-2 rounded-lg flex flex-col items-center gap-2 ${
                        formData.chartType === type
                          ? 'border-indonesia-red-600 bg-indonesia-red-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {type === 'line' && <LineChart className="w-5 h-5" />}
                      {type === 'bar' && <BarChart3 className="w-5 h-5" />}
                      {type === 'pie' && <PieChart className="w-5 h-5" />}
                      {type === 'area' && <AreaChart className="w-5 h-5" />}
                      <span className="text-xs capitalize">{type}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data Source (Table) *
                </label>
                <select
                  value={formData.tableName}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tableName: e.target.value,
                      dataFields: [],
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indonesia-red-500"
                >
                  <option value="">Select a table...</option>
                  {AVAILABLE_TABLES.map((table) => (
                    <option key={table.name} value={table.name}>
                      {table.label}
                    </option>
                  ))}
                </select>
              </div>

              {selectedTable && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Data Fields * (Choose one or more fields to display)
                    </label>
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3">
                      {selectedTable.fields.map((field) => (
                        <label
                          key={field.name}
                          className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={formData.dataFields?.includes(field.name) || false}
                            onChange={() => toggleDataField(field.name)}
                            className="w-4 h-4 text-indonesia-red-600 border-gray-300 rounded focus:ring-indonesia-red-500"
                          />
                          <span className="text-sm">
                            {field.label} <span className="text-gray-500">({field.type})</span>
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Selected: {formData.dataFields?.length || 0} field(s)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Group By (Optional)
                    </label>
                    <select
                      value={formData.groupBy || ''}
                      onChange={(e) => setFormData({ ...formData, groupBy: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indonesia-red-500"
                    >
                      <option value="">No grouping</option>
                      {selectedTable.fields
                        .filter((f) => f.type === 'string' || f.type === 'date')
                        .map((field) => (
                          <option key={field.name} value={field.name}>
                            {field.label}
                          </option>
                        ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Group data by this field (e.g., by date, by category)
                    </p>
                  </div>
                </>
              )}

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateGraph}
                  disabled={isLoading || !formData.dataFields || formData.dataFields.length === 0}
                  className="px-4 py-2 bg-indonesia-red-600 text-white rounded-lg hover:bg-indonesia-red-700 disabled:opacity-50"
                >
                  {isLoading ? 'Creating...' : 'Create Graph'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  async function handleDeleteGraph(graphId: string) {
    if (!confirm('Are you sure you want to delete this graph?')) return;

    try {
      await api.delete(`/dashboard/custom-graph/${graphId}`);
      setGraphs(graphs.filter((g) => g.id !== graphId));
      onGraphDeleted?.(graphId);
    } catch (error: any) {
      console.error('Error deleting graph:', error);
      alert('Error deleting graph: ' + (error.response?.data?.message || error.message));
    }
  }
}
