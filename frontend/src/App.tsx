import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'sonner';
import POSTransaksi from './pages/pos/POSTransaksi';
import POSLayout from './layouts/POSLayout';
import LandingPage from './pages/public/LandingPage';
import ServiceTracking from './pages/public/ServiceTracking';
import Login from './pages/auth/Login';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import {
  ExecutiveDashboard,
  SalesDashboard,
  InventoryDashboard,
  ServiceDashboard,
} from './pages/dashboard';
import { InstallPrompt } from './components/InstallPrompt';
import { OfflineIndicator } from './components/OfflineIndicator';
import { initAnalytics } from './utils/analytics';
// Master Data
import ProductList from './pages/products/ProductList';
import ProductForm from './pages/products/ProductForm';
import ProductDetail from './pages/products/ProductDetail';
import CustomerList from './pages/customers/CustomerList';
import CustomerForm from './pages/customers/CustomerForm';
import CustomerDetail from './pages/customers/CustomerDetail';
// Sales
import SalesHistory from './pages/sales/SalesHistory';
import SalesTransactionDetail from './pages/sales/SalesTransactionDetail';
import ReturnsList from './pages/sales/ReturnsList';
import ReturnForm from './pages/sales/ReturnForm';
import SalesReceiptPrint from './pages/sales/SalesReceiptPrint';
// Service Orders
import ServiceOrderList from './pages/service-orders/ServiceOrderList';
import ServiceOrderForm from './pages/service-orders/ServiceOrderForm';
import ServiceOrderDetail from './pages/service-orders/ServiceOrderDetail';
import ServiceOrderPrint from './pages/service-orders/ServiceOrderPrint';
import MyServiceOrders from './pages/service-orders/MyServiceOrders';
// Service Returns
import ServiceReturnsList from './pages/service-returns/ServiceReturnsList';
import ServiceReturnForm from './pages/service-returns/ServiceReturnForm';
import ServiceReturnDetail from './pages/service-returns/ServiceReturnDetail';
// Inventory
import StockList from './pages/inventory/StockList';
import StockTransfer from './pages/inventory/StockTransfer';
import StockTransferList from './pages/inventory/StockTransferList';
import StockTransferDetail from './pages/inventory/StockTransferDetail';
import StockOpnameList from './pages/inventory/StockOpnameList';
import StockOpnameDetail from './pages/inventory/StockOpnameDetail';
import StockOpnameCount from './pages/inventory/StockOpnameCount';
import StockOpnameForm from './pages/inventory/StockOpnameForm';
import StockAdjustment from './pages/inventory/StockAdjustment';
import StockMovementHistory from './pages/inventory/StockMovementHistory';
import LowStockAlerts from './pages/inventory/LowStockAlerts';
// Unauthorized
import Unauthorized from './pages/Unauthorized';
import Profile from './pages/profile/Profile';
import Settings from './pages/settings/Settings';
// Master Data - Suppliers, Categories, Brands
import SupplierList from './pages/suppliers/SupplierList';
import SupplierForm from './pages/suppliers/SupplierForm';
import SupplierDetail from './pages/suppliers/SupplierDetail';
import CategoryList from './pages/categories/CategoryList';
import CategoryForm from './pages/categories/CategoryForm';
import CategoryDetail from './pages/categories/CategoryDetail';
import BrandList from './pages/brands/BrandList';
import BrandForm from './pages/brands/BrandForm';
import BrandDetail from './pages/brands/BrandDetail';
// Master Data - New Entities
import ColorList from './pages/colors/ColorList';
import ColorForm from './pages/colors/ColorForm';
import ColorDetail from './pages/colors/ColorDetail';
import UnitList from './pages/units/UnitList';
import UnitForm from './pages/units/UnitForm';
import UnitDetail from './pages/units/UnitDetail';
import SizeList from './pages/sizes/SizeList';
import SizeForm from './pages/sizes/SizeForm';
import SizeDetail from './pages/sizes/SizeDetail';
import ExpeditionList from './pages/expeditions/ExpeditionList';
import ExpeditionForm from './pages/expeditions/ExpeditionForm';
import ExpeditionDetail from './pages/expeditions/ExpeditionDetail';
import PaymentTermList from './pages/payment-terms/PaymentTermList';
import PaymentTermForm from './pages/payment-terms/PaymentTermForm';
import PaymentTermDetail from './pages/payment-terms/PaymentTermDetail';
import SalesTypeList from './pages/sales-types/SalesTypeList';
import SalesTypeForm from './pages/sales-types/SalesTypeForm';
import SalesTypeDetail from './pages/sales-types/SalesTypeDetail';
// Master Data - Service Types
import CustomerTierList from "./pages/master-data/customer-tiers/CustomerTierList";
import ServiceTypeList from './pages/service-types/ServiceTypeList';
import ServiceTypeForm from './pages/service-types/ServiceTypeForm';
import ServiceTypeDetail from './pages/service-types/ServiceTypeDetail';
// Branches
import BranchList from './pages/branches/BranchList';
import BranchForm from './pages/branches/BranchForm';
import BranchDetail from './pages/branches/BranchDetail';
// Landing Pages
import WarehouseLanding from './pages/warehouse/WarehouseLanding';
import WarehouseList from './pages/warehouse/WarehouseList';
import SalesLanding from './pages/sales/SalesLanding';
import ServiceLanding from './pages/services/ServiceLanding';
import SmartRepairPage from './pages/services/SmartRepairPage';
import ServiceCheckpointList from './pages/service-checkpoints/ServiceCheckpointList';
import FinanceLanding from './pages/finance/FinanceLanding';
import COAList from './pages/finance/coa/COAList';
import COADetail from './pages/finance/coa/COADetail';
import JournalEntriesList from './pages/finance/journal/JournalEntriesList';
import JournalEntryDetail from './pages/finance/journal/JournalEntryDetail';
import JournalEntryForm from './pages/finance/journal/JournalEntryForm';
import ExpensesList from './pages/finance/expenses/ExpensesList';
import ExpenseDetail from './pages/finance/expenses/ExpenseDetail';
import ExpenseForm from './pages/finance/expenses/ExpenseForm';
import PettyCashList from './pages/finance/petty-cash/PettyCashList';
import PettyCashDetail from './pages/finance/petty-cash/PettyCashDetail';
import PettyCashFundForm from './pages/finance/petty-cash/PettyCashFundForm';
import ARList from './pages/finance/ar/ARList';
import ARDetail from './pages/finance/ar/ARDetail';
import FinancialReports from './pages/finance/reports/FinancialReports';
import PurchasingLanding from './pages/purchasing/PurchasingLanding';
import PurchaseOrderList from './pages/purchasing/PurchaseOrderList';
import PurchaseOrderDetail from './pages/purchasing/PurchaseOrderDetail';
import PurchaseOrderForm from './pages/purchasing/PurchaseOrderForm';
import GoodsReceiptList from './pages/purchasing/GoodsReceiptList';
import GoodsReceiptDetail from './pages/purchasing/GoodsReceiptDetail';
import GoodsReceiptForm from './pages/purchasing/GoodsReceiptForm';
import EmployeeLanding from './pages/employees/EmployeeLanding';
// HR
import AttendanceList from './pages/hr/attendance/AttendanceList';
import AttendanceDetail from './pages/hr/attendance/AttendanceDetail';
import ClockInOut from './pages/hr/attendance/ClockInOut';
import EmployeeList from './pages/hr/employees/EmployeeList';
import EmployeeDetail from './pages/hr/employees/EmployeeDetail';
import EmployeeEditForm from './pages/hr/employees/EmployeeEditForm';
import DepartmentList from './pages/hr/departments/DepartmentList';
import LeaveList from './pages/hr/leave/LeaveList';
import LeaveDetail from './pages/hr/leave/LeaveDetail';
import LeaveRequestForm from './pages/hr/leave/LeaveRequestForm';
import PayrollList from './pages/hr/payroll/PayrollList';
import PayrollDetail from './pages/hr/payroll/PayrollDetail';
import PayrollCalculationForm from './pages/hr/payroll/PayrollCalculationForm';
import PayslipView from './pages/hr/payroll/PayslipView';
import KPIRecordsList from './pages/hr/kpi/KPIRecordsList';
import KPIDetail from './pages/hr/kpi/KPIDetail';
import KPIRecordForm from './pages/hr/kpi/KPIRecordForm';
// User & Role Management
import UserList from './pages/users/UserList';
import UserDetail from './pages/users/UserDetail';
import UserForm from './pages/users/UserForm';
import RoleList from './pages/roles/RoleList';
import RoleDetail from './pages/roles/RoleDetail';
import RoleForm from './pages/roles/RoleForm';
import PasswordRequests from './pages/auth/PasswordRequests';
import './App.css';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  useEffect(() => {
    // Initialize Google Analytics if measurement ID is provided
    const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    if (gaId) {
      initAnalytics(gaId);
    }
  }, []);

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <OfflineIndicator />
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/track" element={<ServiceTracking />} />
            <Route path="/track/:serviceNumber" element={<ServiceTracking />} />
            
            {/* Protected Routes with DashboardLayout */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ExecutiveDashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/executive"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ExecutiveDashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/sales"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <SalesDashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/inventory"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <InventoryDashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/service"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ServiceDashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            
            {/* Sales Landing */}
            <Route
              path="/sales"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <SalesLanding />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            {/* POS Route — full page, no sidebar */}
            <Route
              path="/pos"
              element={
                <ProtectedRoute>
                  <POSLayout>
                    <POSTransaksi />
                  </POSLayout>
                </ProtectedRoute>
              }
            />
            
            {/* Master Data - Products */}
            <Route
              path="/products"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ProductList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/products/new"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ProductForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/products/:id"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ProductDetail />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/products/:id/edit"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ProductForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            
            {/* Master Data - Customers */}
            <Route
              path="/customers"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <CustomerList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers/new"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <CustomerForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers/:id"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <CustomerDetail />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers/:id/edit"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <CustomerForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            
            {/* Master Data - Suppliers */}
            <Route
              path="/suppliers"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <SupplierList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/suppliers/new"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <SupplierForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/suppliers/:id"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <SupplierDetail />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/suppliers/:id/edit"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <SupplierForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            
            {/* Master Data - Categories */}
            <Route
              path="/categories"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <CategoryList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/categories/new"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <CategoryForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/categories/:id"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <CategoryDetail />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/categories/:id/edit"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <CategoryForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            
            {/* Master Data - Brands */}
            <Route
              path="/brands"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <BrandList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/brands/new"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <BrandForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/brands/:id"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <BrandDetail />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/brands/:id/edit"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <BrandForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            
            {/* Master Data - Colors */}
            <Route path="/colors" element={<ProtectedRoute><DashboardLayout><ColorList /></DashboardLayout></ProtectedRoute>} />
            <Route path="/colors/new" element={<ProtectedRoute><DashboardLayout><ColorForm /></DashboardLayout></ProtectedRoute>} />
            <Route path="/colors/:id" element={<ProtectedRoute><DashboardLayout><ColorDetail /></DashboardLayout></ProtectedRoute>} />
            <Route path="/colors/:id/edit" element={<ProtectedRoute><DashboardLayout><ColorForm /></DashboardLayout></ProtectedRoute>} />

            {/* Master Data - Units */}
            <Route path="/units" element={<ProtectedRoute><DashboardLayout><UnitList /></DashboardLayout></ProtectedRoute>} />
            <Route path="/units/new" element={<ProtectedRoute><DashboardLayout><UnitForm /></DashboardLayout></ProtectedRoute>} />
            <Route path="/units/:id" element={<ProtectedRoute><DashboardLayout><UnitDetail /></DashboardLayout></ProtectedRoute>} />
            <Route path="/units/:id/edit" element={<ProtectedRoute><DashboardLayout><UnitForm /></DashboardLayout></ProtectedRoute>} />

            {/* Master Data - Sizes */}
            <Route path="/sizes" element={<ProtectedRoute><DashboardLayout><SizeList /></DashboardLayout></ProtectedRoute>} />
            <Route path="/sizes/new" element={<ProtectedRoute><DashboardLayout><SizeForm /></DashboardLayout></ProtectedRoute>} />
            <Route path="/sizes/:id" element={<ProtectedRoute><DashboardLayout><SizeDetail /></DashboardLayout></ProtectedRoute>} />
            <Route path="/sizes/:id/edit" element={<ProtectedRoute><DashboardLayout><SizeForm /></DashboardLayout></ProtectedRoute>} />

            {/* Master Data - Expeditions */}
            <Route path="/expeditions" element={<ProtectedRoute><DashboardLayout><ExpeditionList /></DashboardLayout></ProtectedRoute>} />
            <Route path="/expeditions/new" element={<ProtectedRoute><DashboardLayout><ExpeditionForm /></DashboardLayout></ProtectedRoute>} />
            <Route path="/expeditions/:id" element={<ProtectedRoute><DashboardLayout><ExpeditionDetail /></DashboardLayout></ProtectedRoute>} />
            <Route path="/expeditions/:id/edit" element={<ProtectedRoute><DashboardLayout><ExpeditionForm /></DashboardLayout></ProtectedRoute>} />

            {/* Master Data - Sales Types */}
            <Route path="/sales-types" element={<ProtectedRoute><DashboardLayout><SalesTypeList /></DashboardLayout></ProtectedRoute>} />
            <Route path="/sales-types/new" element={<ProtectedRoute><DashboardLayout><SalesTypeForm /></DashboardLayout></ProtectedRoute>} />
            <Route path="/sales-types/:id" element={<ProtectedRoute><DashboardLayout><SalesTypeDetail /></DashboardLayout></ProtectedRoute>} />
            <Route path="/sales-types/:id/edit" element={<ProtectedRoute><DashboardLayout><SalesTypeForm /></DashboardLayout></ProtectedRoute>} />

            {/* Master Data - Payment Terms */}
            <Route path="/payment-terms" element={<ProtectedRoute><DashboardLayout><PaymentTermList /></DashboardLayout></ProtectedRoute>} />
            <Route path="/payment-terms/new" element={<ProtectedRoute><DashboardLayout><PaymentTermForm /></DashboardLayout></ProtectedRoute>} />
            <Route path="/payment-terms/:id" element={<ProtectedRoute><DashboardLayout><PaymentTermDetail /></DashboardLayout></ProtectedRoute>} />
            <Route path="/payment-terms/:id/edit" element={<ProtectedRoute><DashboardLayout><PaymentTermForm /></DashboardLayout></ProtectedRoute>} />

            {/* Master Data - Customer Tiers */}
            <Route
              path="/customer-tiers"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <CustomerTierList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            {/* Master Data - Service Types */}
            <Route
              path="/service-types"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ServiceTypeList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/service-types/new"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ServiceTypeForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/service-types/:id"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ServiceTypeDetail />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/service-types/:id/edit"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ServiceTypeForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            
            {/* Branches */}
            <Route
              path="/branches"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <BranchList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/branches/new"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <BranchForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/branches/:id"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <BranchDetail />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/branches/:id/edit"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <BranchForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            
            {/* Sales */}
            <Route
              path="/sales/history"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <SalesHistory />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sales/transactions/:id"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <SalesTransactionDetail />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sales/transactions/:id/print"
              element={<SalesReceiptPrint />}
            />
            <Route
              path="/sales/returns"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ReturnsList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sales/returns/new"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ReturnForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            
            {/* Services Landing */}
            <Route
              path="/services"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ServiceLanding />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            {/* Smart Repair (E-FE) — full-page like POS, no sidebar */}
            <Route
              path="/services/smart-repair"
              element={
                <ProtectedRoute>
                  <POSLayout>
                    <SmartRepairPage />
                  </POSLayout>
                </ProtectedRoute>
              }
            />
            {/* Kelengkapan CRUD (E-FE) */}
            <Route
              path="/service-checkpoints"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ServiceCheckpointList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            {/* Service Orders */}
            <Route
              path="/service-orders"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ServiceOrderList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/service-orders/my"
              element={
              <ProtectedRoute>
                <DashboardLayout>
                  <MyServiceOrders />
                </DashboardLayout>
              </ProtectedRoute>
            }
            />
            <Route
              path="/service-orders/new"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ServiceOrderForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/service-orders/:id"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ServiceOrderDetail />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/service-orders/:id/edit"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ServiceOrderForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/service-orders/:id/print"
              element={<ServiceOrderPrint />}
            />
            
            {/* Service Returns */}
            <Route
              path="/service-returns"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ServiceReturnsList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/service-returns/new"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ServiceReturnForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/service-returns/:id"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ServiceReturnDetail />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            
            {/* Warehouse Landing */}
            <Route
              path="/warehouse"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <WarehouseLanding />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            {/* Warehouse Management (D2) */}
            <Route
              path="/warehouses"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <WarehouseList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            {/* Inventory */}
            <Route
              path="/inventory/stock"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <StockList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory/transfer"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <StockTransferList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory/transfer/new"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <StockTransfer />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory/transfer/:id"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <StockTransferDetail />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory/opname"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <StockOpnameList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory/opname/new"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <StockOpnameForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory/opname/:id"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <StockOpnameDetail />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory/opname/:id/count"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <StockOpnameCount />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory/adjustment"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <StockAdjustment />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory/movements"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <StockMovementHistory />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory/alerts"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <LowStockAlerts />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            
            {/* Finance Landing */}
            <Route
              path="/finance"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <FinanceLanding />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            {/* Finance */}
            <Route
              path="/finance/coa"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <COAList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/coa/:id"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <COADetail />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/journal"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <JournalEntriesList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/journal/new"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <JournalEntryForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/journal/:id"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <JournalEntryDetail />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/journal/:id/edit"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <JournalEntryForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/expenses"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ExpensesList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/expenses/new"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ExpenseForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/expenses/:id"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ExpenseDetail />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/expenses/:id/edit"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ExpenseForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/petty-cash"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PettyCashList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/petty-cash/new"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PettyCashFundForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/petty-cash/:id"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PettyCashDetail />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/ar"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ARList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/ar/:customerId"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ARDetail />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/reports"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <FinancialReports />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            
            {/* Employees Landing */}
            <Route
              path="/employees"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <EmployeeLanding />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            {/* HR */}
            <Route
              path="/hr/employees"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <EmployeeList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/employees/:id"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <EmployeeDetail />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/employees/:id/edit"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <EmployeeEditForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/departments"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <DepartmentList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/attendance"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <AttendanceList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/attendance/clock"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ClockInOut />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/attendance/:id"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <AttendanceDetail />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/leave"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <LeaveList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/leave/new"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <LeaveRequestForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/leave/:id"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <LeaveDetail />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/payroll"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PayrollList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/payroll/calculate"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PayrollCalculationForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/payroll/:id"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PayrollDetail />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/payroll/:id/payslip"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PayslipView />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/kpi"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <KPIRecordsList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/kpi/new"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <KPIRecordForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/kpi/:id"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <KPIDetail />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            
            {/* Purchasing Landing */}
            <Route
              path="/purchasing"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PurchasingLanding />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            {/* Purchasing */}
            <Route
              path="/purchasing/suppliers"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <SupplierList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchasing/suppliers/new"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <SupplierForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchasing/suppliers/:id"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <SupplierDetail />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchasing/suppliers/:id/edit"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <SupplierForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            {/* Purchase Orders */}
            <Route
              path="/purchasing/po"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PurchaseOrderList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchasing/po/new"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PurchaseOrderForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchasing/po/:id"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PurchaseOrderDetail />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchasing/po/:id/edit"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PurchaseOrderForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            {/* Goods Receipts */}
            <Route
              path="/purchasing/goods-receipt"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <GoodsReceiptList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchasing/goods-receipt/new"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <GoodsReceiptForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchasing/goods-receipt/new/:poId"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <GoodsReceiptForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchasing/goods-receipt/:id"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <GoodsReceiptDetail />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            {/* Legacy routes for backward compatibility */}
            <Route
              path="/purchasing/gr"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <GoodsReceiptList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchasing/gr/new"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <GoodsReceiptForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchasing/gr/new/:poId"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <GoodsReceiptForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchasing/gr/:id"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <GoodsReceiptDetail />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            
            {/* Users & Roles */}
            <Route
              path="/users"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <UserList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/users/new"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <UserForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/users/:id"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <UserDetail />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/users/:id/edit"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <UserForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/roles"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <RoleList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/roles/new"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <RoleForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/roles/:id"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <RoleDetail />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/roles/:id/edit"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <RoleForm />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            {/* Password Requests */}
            <Route
              path="/password-requests"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PasswordRequests />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            {/* Unauthorized Page */}
            <Route
              path="/unauthorized"
              element={
                <DashboardLayout>
                  <Unauthorized />
                </DashboardLayout>
              }
            />
            
            {/* Profile & Settings */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Profile />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Settings />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            
            {/* 404 - redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <InstallPrompt />
        </BrowserRouter>
        <Toaster position="top-right" />
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
