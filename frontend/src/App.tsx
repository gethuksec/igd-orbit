import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'sonner';
import POSPage from './pages/sales/pos/POSPage';
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
import ReturnsList from './pages/sales/ReturnsList';
// Service Orders
import ServiceOrderList from './pages/service-orders/ServiceOrderList';
import ServiceOrderForm from './pages/service-orders/ServiceOrderForm';
import ServiceOrderDetail from './pages/service-orders/ServiceOrderDetail';
// Inventory
import StockList from './pages/inventory/StockList';
import StockTransfer from './pages/inventory/StockTransfer';
// Placeholder
import PlaceholderPage from './pages/placeholder/PlaceholderPage';
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
// Landing Pages
import WarehouseLanding from './pages/warehouse/WarehouseLanding';
import SalesLanding from './pages/sales/SalesLanding';
import ServiceLanding from './pages/services/ServiceLanding';
import FinanceLanding from './pages/finance/FinanceLanding';
import PurchasingLanding from './pages/purchasing/PurchasingLanding';
import EmployeeLanding from './pages/employees/EmployeeLanding';
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
            {/* POS Route */}
            <Route
              path="/sales/pos"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <POSPage />
                  </DashboardLayout>
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
              path="/sales/returns"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ReturnsList />
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
                    <StockTransfer />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory/opname"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PlaceholderPage title="Stock Opname" description="Stock opname dan audit stok" />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory/adjustment"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PlaceholderPage title="Stock Adjustment" description="Penyesuaian stok" />
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
                    <PlaceholderPage title="Chart of Accounts" description="Kelola chart of accounts" />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/journal"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PlaceholderPage title="Jurnal Umum" description="Kelola jurnal akuntansi" />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/expenses"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PlaceholderPage title="Pengeluaran" description="Kelola pengeluaran dan biaya" />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/petty-cash"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PlaceholderPage title="Petty Cash" description="Kelola kas kecil" />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/ar"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PlaceholderPage title="Accounts Receivable" description="Kelola piutang usaha" />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/reports"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PlaceholderPage title="Laporan Keuangan" description="Laporan keuangan dan analisis" />
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
                    <PlaceholderPage title="Manajemen Karyawan" description="Kelola data karyawan" />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/attendance"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PlaceholderPage title="Absensi" description="Kelola absensi karyawan" />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/leave"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PlaceholderPage title="Cuti" description="Kelola cuti dan izin karyawan" />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/payroll"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PlaceholderPage title="Payroll" description="Kelola penggajian" />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/kpi"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PlaceholderPage title="KPI" description="Kelola KPI karyawan" />
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
                    <PlaceholderPage title="Supplier" description="Kelola supplier untuk purchasing" />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchasing/po"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PlaceholderPage title="Purchase Order" description="Kelola purchase order" />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchasing/goods-receipt"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PlaceholderPage title="Goods Receipt" description="Kelola penerimaan barang" />
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
                    <PlaceholderPage title="Manajemen User" description="Kelola user dan akun" />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/roles"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PlaceholderPage title="Manajemen Role" description="Kelola role dan permission" />
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
