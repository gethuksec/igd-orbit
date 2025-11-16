import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get Dashboard KPIs
   * If branchId is provided, all metrics are filtered to that branch.
   * Otherwise, metrics are calculated across all branches.
   */
  async getKPIs(startDate?: string, endDate?: string, branchId?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const start = startDate ? new Date(startDate) : today;
    const end = endDate ? new Date(endDate) : today;
    end.setHours(23, 59, 59, 999);

    const baseSalesWhere: any = {
      status: 'completed',
      createdAt: {
        gte: today,
      },
    };

    const baseServiceWhere: any = {
      status: { in: ['completed', 'delivered'] },
      createdAt: {
        gte: today,
      },
    };

    if (branchId) {
      baseSalesWhere.branchId = branchId;
      baseServiceWhere.branchId = branchId;
    }

    // Today's revenue (sales + service) - filtered by branch if provided
    const todaySales = await this.prisma.salesTransaction.aggregate({
      where: baseSalesWhere,
      _sum: {
        total: true,
      },
    });

    const todayService = await this.prisma.serviceOrder.aggregate({
      where: baseServiceWhere,
      _sum: {
        totalPrice: true,
      },
    });

    const todayRevenue =
      (todaySales._sum.total?.toNumber() || 0) +
      (todayService._sum.totalPrice?.toNumber() || 0);

    // Yesterday's revenue
    const yesterdaySalesWhere: any = {
      status: 'completed',
      createdAt: {
        gte: yesterday,
        lt: today,
      },
    };

    const yesterdayServiceWhere: any = {
      status: { in: ['completed', 'delivered'] },
      createdAt: {
        gte: yesterday,
        lt: today,
      },
    };

    if (branchId) {
      yesterdaySalesWhere.branchId = branchId;
      yesterdayServiceWhere.branchId = branchId;
    }

    const yesterdaySales = await this.prisma.salesTransaction.aggregate({
      where: yesterdaySalesWhere,
      _sum: {
        total: true,
      },
    });

    const yesterdayService = await this.prisma.serviceOrder.aggregate({
      where: yesterdayServiceWhere,
      _sum: {
        totalPrice: true,
      },
    });

    const yesterdayRevenue =
      (yesterdaySales._sum.total?.toNumber() || 0) +
      (yesterdayService._sum.totalPrice?.toNumber() || 0);

    // Total transactions (sales) in selected period
    const totalTransactionsWhere: any = {
      status: 'completed',
      createdAt: {
        gte: start,
        lte: end,
      },
    };

    if (branchId) {
      totalTransactionsWhere.branchId = branchId;
    }

    const totalTransactions = await this.prisma.salesTransaction.count({
      where: totalTransactionsWhere,
    });

    const yesterdayTransactionsWhere: any = {
      status: 'completed',
      createdAt: {
        gte: yesterday,
        lt: today,
      },
    };

    if (branchId) {
      yesterdayTransactionsWhere.branchId = branchId;
    }

    const yesterdayTransactions = await this.prisma.salesTransaction.count({
      where: yesterdayTransactionsWhere,
    });

    // Active services (optionally filtered by branch)
    const baseActiveServiceWhere: any = {
      status: { in: ['pending', 'in_progress', 'ready'] },
    };

    const basePendingServiceWhere: any = {
      status: 'pending',
    };

    const baseOverdueServiceWhere: any = {
      status: { in: ['pending', 'in_progress'] },
      slaDueDate: {
        lt: new Date(),
      },
    };

    if (branchId) {
      baseActiveServiceWhere.branchId = branchId;
      basePendingServiceWhere.branchId = branchId;
      baseOverdueServiceWhere.branchId = branchId;
    }

    const activeServices = await this.prisma.serviceOrder.count({
      where: baseActiveServiceWhere,
    });

    const pendingServices = await this.prisma.serviceOrder.count({
      where: basePendingServiceWhere,
    });

    const overdueServices = await this.prisma.serviceOrder.count({
      where: baseOverdueServiceWhere,
    });

    // Stock alerts - filter by branch if provided
    const stockWhere: any = {
      quantityAvailable: {
        gt: 0,
      },
    };

    if (branchId) {
      stockWhere.branchId = branchId;
    }

    const allStocks = await this.prisma.productStock.findMany({
      where: stockWhere,
      select: {
        quantityAvailable: true,
        reorderPoint: true,
      },
    });

    const lowStockItems = allStocks.filter((stock) => {
      const qty = stock.quantityAvailable.toNumber();
      const reorder = stock.reorderPoint?.toNumber() || 0;
      return qty > 0 && qty <= reorder;
    }).length;

    const outOfStockWhere: any = {
      quantityAvailable: {
        lte: 0,
      },
    };

    if (branchId) {
      outOfStockWhere.branchId = branchId;
    }

    const outOfStockItems = await this.prisma.productStock.count({
      where: outOfStockWhere,
    });

    return {
      todayRevenue,
      yesterdayRevenue,
      totalTransactions,
      yesterdayTransactions,
      activeServices,
      pendingServices,
      overdueServices,
      lowStockItems,
      outOfStockItems,
    };
  }

  /**
   * Get Revenue Trend
   */
  async getRevenueTrend(days: number = 30, branchId?: string) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const whereClause: any = {
      status: 'completed',
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (branchId) {
      whereClause.branchId = branchId;
    }

    // Get sales transactions grouped by date
    const salesTransactions = await this.prisma.salesTransaction.findMany({
      where: whereClause,
      select: {
        createdAt: true,
        total: true,
      },
    });

    // Get service orders grouped by date
    const serviceWhereClause: any = {
      status: { in: ['completed', 'delivered'] },
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (branchId) {
      serviceWhereClause.branchId = branchId;
    }

    const serviceOrders = await this.prisma.serviceOrder.findMany({
      where: serviceWhereClause,
      select: {
        createdAt: true,
        totalPrice: true,
      },
    });

    // Group by date
    const revenueMap = new Map<string, { sales: number; service: number }>();

    salesTransactions.forEach((txn) => {
      const dateKey = txn.createdAt.toISOString().split('T')[0];
      const existing = revenueMap.get(dateKey) || { sales: 0, service: 0 };
      existing.sales += txn.total.toNumber();
      revenueMap.set(dateKey, existing);
    });

    serviceOrders.forEach((order) => {
      const dateKey = order.createdAt.toISOString().split('T')[0];
      const existing = revenueMap.get(dateKey) || { sales: 0, service: 0 };
      existing.service += order.totalPrice?.toNumber() || 0;
      revenueMap.set(dateKey, existing);
    });

    // Convert to array and sort by date
    const result = Array.from(revenueMap.entries())
      .map(([date, data]) => ({
        date,
        sales: data.sales,
        service: data.service,
        total: data.sales + data.service,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return result;
  }

  /**
   * Get Sales by Category
   */
  async getSalesByCategory(
    startDate?: string,
    endDate?: string,
    limit: number = 5,
    branchId?: string,
  ) {
    const start = startDate ? new Date(startDate) : new Date();
    start.setDate(start.getDate() - 30);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const salesWhere: any = {
      status: 'completed',
      createdAt: {
        gte: start,
        lte: end,
      },
    };

    if (branchId) {
      salesWhere.branchId = branchId;
    }

    const transactions = await this.prisma.salesTransaction.findMany({
      where: salesWhere,
      include: {
        items: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
          },
        },
      },
    });

    // Aggregate by category
    const categoryMap = new Map<string, number>();

    transactions.forEach((txn) => {
      txn.items.forEach((item) => {
        const categoryName =
          item.product.category?.name || 'Uncategorized';
        const amount =
          item.unitPrice.toNumber() * item.quantity.toNumber();
        categoryMap.set(
          categoryName,
          (categoryMap.get(categoryName) || 0) + amount,
        );
      });
    });

    const total = Array.from(categoryMap.values()).reduce(
      (sum, val) => sum + val,
      0,
    );

    const result = Array.from(categoryMap.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: total > 0 ? (amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, limit);

    return result;
  }

  /**
   * Get Top Products
   */
  async getTopProducts(
    days: number = 30,
    limit: number = 10,
    branchId?: string,
  ) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const items = await this.prisma.salesTransactionItem.groupBy({
      by: ['productId'],
      where: {
        transaction: {
          status: 'completed',
          createdAt: {
            gte: startDate,
          },
          ...(branchId ? { branchId } : {}),
        },
      },
      _sum: {
        quantity: true,
        unitPrice: true,
      },
      _count: {
        productId: true,
      },
    });

    // Get product details
    const productIds = items.map((item) => item.productId);
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const productMap = new Map(products.map((p) => [p.id, p.name]));

    const result = items
      .map((item, index) => {
        const revenue =
          (item._sum.unitPrice?.toNumber() || 0) *
          (item._sum.quantity?.toNumber() || 0);
        return {
          rank: index + 1,
          productName: productMap.get(item.productId) || 'Unknown',
          quantitySold: item._sum.quantity?.toNumber() || 0,
          revenue,
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    return result;
  }

  /**
   * Get Branch Performance
   */
  async getBranchPerformance(startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : new Date();
    start.setDate(start.getDate() - 30);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const branches = await this.prisma.branch.findMany({
      include: {
        salesTransactions: {
          where: {
            status: 'completed',
            createdAt: {
              gte: start,
              lte: end,
            },
          },
        },
      },
    });

    const result = branches.map((branch) => {
      const transactions = branch.salesTransactions;
      const revenue = transactions.reduce(
        (sum, txn) => sum + txn.total.toNumber(),
        0,
      );
      const transactionCount = transactions.length;
      const averageTicketSize =
        transactionCount > 0 ? revenue / transactionCount : 0;

      return {
        branchName: branch.name,
        revenue,
        transactionCount,
        averageTicketSize,
      };
    });

    return result.sort((a, b) => b.revenue - a.revenue);
  }

  /**
   * Get Recent Transactions
   */
  async getRecentTransactions(limit: number = 10) {
    const transactions = await this.prisma.salesTransaction.findMany({
      where: {
        status: 'completed',
      },
      include: {
        customer: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return transactions.map((txn) => ({
      id: txn.id,
      time: txn.createdAt.toISOString(),
      customer: txn.customer?.name || 'Walk-in',
      amount: txn.total.toNumber(),
      status: txn.status,
    }));
  }

  /**
   * Get Pending Approvals
   */
  async getPendingApprovals() {
    const expenses = await this.prisma.expense.findMany({
      where: {
        status: 'pending',
      },
      select: {
        id: true,
        amount: true,
        requestedBy: true,
      },
      take: 10,
    });

    const transfers = await this.prisma.stockTransfer.findMany({
      where: {
        status: 'pending',
      },
      select: {
        id: true,
        requestedBy: true,
      },
      take: 10,
    });

    // Get user details for expenses
    const expenseUserIds = expenses.map((e) => e.requestedBy);
    const expenseUsers = await this.prisma.user.findMany({
      where: {
        id: { in: expenseUserIds },
      },
      select: {
        id: true,
        fullName: true,
      },
    });
    const expenseUserMap = new Map(
      expenseUsers.map((u) => [u.id, u.fullName || 'Unknown']),
    );

    // Get user details for transfers
    const transferUserIds = transfers.map((t) => t.requestedBy);
    const transferUsers = await this.prisma.user.findMany({
      where: {
        id: { in: transferUserIds },
      },
      select: {
        id: true,
        fullName: true,
      },
    });
    const transferUserMap = new Map(
      transferUsers.map((u) => [u.id, u.fullName || 'Unknown']),
    );

    const result: Array<{
      id: string;
      type: 'expense' | 'transfer' | 'return';
      requester: string;
      amount: number;
    }> = [];

    expenses.forEach((exp) => {
      result.push({
        id: exp.id,
        type: 'expense',
        requester: expenseUserMap.get(exp.requestedBy) || 'Unknown',
        amount: exp.amount.toNumber(),
      });
    });

    transfers.forEach((transfer) => {
      result.push({
        id: transfer.id,
        type: 'transfer',
        requester: transferUserMap.get(transfer.requestedBy) || 'Unknown',
        amount: 0, // Transfers don't have amounts
      });
    });

    return result.slice(0, 10);
  }

  /**
   * Get Sales Dashboard KPIs
   */
  async getSalesKPIs(startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : new Date();
    start.setDate(start.getDate() - 30);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const transactions = await this.prisma.salesTransaction.findMany({
      where: {
        status: 'completed',
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        payments: true,
      },
    });

    const totalSales = transactions.reduce(
      (sum, txn) => sum + txn.total.toNumber(),
      0,
    );
    const totalOrders = transactions.length;
    const averageOrderValue =
      totalOrders > 0 ? totalSales / totalOrders : 0;

    // Calculate conversion rate (would need visitor data, using placeholder)
    const conversionRate = 3.2; // Placeholder

    return {
      totalSales,
      totalOrders,
      averageOrderValue,
      conversionRate,
    };
  }

  /**
   * Get Hourly Sales Pattern
   */
  async getHourlySales(date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(targetDate);
    end.setHours(23, 59, 59, 999);

    const transactions = await this.prisma.salesTransaction.findMany({
      where: {
        status: 'completed',
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      select: {
        createdAt: true,
        total: true,
      },
    });

    const hourlyMap = new Map<number, number>();
    for (let i = 0; i < 24; i++) {
      hourlyMap.set(i, 0);
    }

    transactions.forEach((txn) => {
      const hour = txn.createdAt.getHours();
      const current = hourlyMap.get(hour) || 0;
      hourlyMap.set(hour, current + txn.total.toNumber());
    });

    return Array.from(hourlyMap.entries())
      .map(([hour, sales]) => ({
        hour: `${hour}:00`,
        sales,
      }))
      .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));
  }

  /**
   * Get Daily Sales Comparison
   */
  async getDailySales(days: number = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const lastMonthStart = new Date(startDate);
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    const lastMonthEnd = new Date(startDate);

    const currentPeriod = await this.prisma.salesTransaction.findMany({
      where: {
        status: 'completed',
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        createdAt: true,
        total: true,
      },
    });

    const lastPeriod = await this.prisma.salesTransaction.findMany({
      where: {
        status: 'completed',
        createdAt: {
          gte: lastMonthStart,
          lt: lastMonthEnd,
        },
      },
      select: {
        createdAt: true,
        total: true,
      },
    });

    const currentMap = new Map<string, number>();
    const lastMap = new Map<string, number>();

    currentPeriod.forEach((txn) => {
      const dateKey = txn.createdAt.toISOString().split('T')[0];
      currentMap.set(
        dateKey,
        (currentMap.get(dateKey) || 0) + txn.total.toNumber(),
      );
    });

    lastPeriod.forEach((txn) => {
      const dateKey = txn.createdAt.toISOString().split('T')[0];
      lastMap.set(
        dateKey,
        (lastMap.get(dateKey) || 0) + txn.total.toNumber(),
      );
    });

    const result: Array<{ date: string; sales: number; lastMonth: number }> =
      [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().split('T')[0];
      result.push({
        date: dateKey,
        sales: currentMap.get(dateKey) || 0,
        lastMonth: lastMap.get(dateKey) || 0,
      });
    }

    return result;
  }

  /**
   * Get Sales by Payment Method
   */
  async getSalesByPaymentMethod(startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : new Date();
    start.setDate(start.getDate() - 30);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const payments = await this.prisma.payment.findMany({
      where: {
        transaction: {
          status: 'completed',
          createdAt: {
            gte: start,
            lte: end,
          },
        },
      },
      select: {
        paymentMethod: true,
        amount: true,
      },
    });

    const methodMap = new Map<string, number>();
    payments.forEach((payment) => {
      const method = payment.paymentMethod;
      methodMap.set(
        method,
        (methodMap.get(method) || 0) + payment.amount.toNumber(),
      );
    });

    const total = Array.from(methodMap.values()).reduce(
      (sum, val) => sum + val,
      0,
    );

    const methodNames: Record<string, string> = {
      cash: 'Tunai',
      card: 'Kartu',
      transfer: 'Transfer',
      'e-wallet': 'E-wallet',
      credit: 'Kredit',
    };

    return Array.from(methodMap.entries())
      .map(([method, amount]) => ({
        name: methodNames[method] || method,
        value: total > 0 ? (amount / total) * 100 : 0,
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  /**
   * Get Sales by Customer Type
   */
  async getSalesByCustomerType(startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : new Date();
    start.setDate(start.getDate() - 30);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const transactions = await this.prisma.salesTransaction.findMany({
      where: {
        status: 'completed',
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        customer: {
          include: {
            tier: true,
          },
        },
      },
    });

    const typeMap = new Map<string, { count: number; value: number }>();
    transactions.forEach((txn) => {
      const type = txn.customer?.tier?.name || 'Walk-in';
      const existing = typeMap.get(type) || { count: 0, value: 0 };
      existing.count += 1;
      existing.value += txn.total.toNumber();
      typeMap.set(type, existing);
    });

    return Array.from(typeMap.entries()).map(([type, data]) => ({
      type,
      count: data.count,
      value: data.value,
    }));
  }

  /**
   * Get Top Customers
   */
  async getTopCustomers(limit: number = 10) {
    const transactions = await this.prisma.salesTransaction.groupBy({
      by: ['customerId'],
      where: {
        status: 'completed',
        customerId: { not: null },
      },
      _sum: {
        total: true,
      },
      _count: {
        customerId: true,
      },
    });

    const customerIds = transactions
      .map((t) => t.customerId)
      .filter((id): id is string => id !== null);
    const customers = await this.prisma.customer.findMany({
      where: {
        id: { in: customerIds },
      },
      include: {
        tier: true,
      },
    });

    const customerMap = new Map(
      customers.map((c) => [c.id, { name: c.name, tier: c.tier?.name || 'N/A' }]),
    );

    const result = transactions
      .map((txn) => {
        const customer = customerMap.get(txn.customerId || '');
        if (!customer) return null;
        return {
          name: customer.name,
          tier: customer.tier,
          orders: txn._count.customerId,
          totalSpent: txn._sum.total?.toNumber() || 0,
          lifetimeValue: txn._sum.total?.toNumber() || 0, // Simplified
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, limit);

    return result;
  }

  /**
   * Get Sales by Cashier
   */
  async getSalesByCashier(startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : new Date();
    start.setDate(start.getDate() - 30);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const transactions = await this.prisma.salesTransaction.groupBy({
      by: ['cashierId'],
      where: {
        status: 'completed',
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      _sum: {
        total: true,
      },
      _count: {
        id: true,
      },
    });

    const cashierIds = transactions.map((t) => t.cashierId);
    const cashiers = await this.prisma.user.findMany({
      where: {
        id: { in: cashierIds },
      },
      select: {
        id: true,
        fullName: true,
      },
    });

    const cashierMap = new Map(
      cashiers.map((c) => [c.id, c.fullName || 'Unknown']),
    );

    const result = transactions
      .map((txn) => {
        const totalSales = txn._sum.total?.toNumber() || 0;
        const transactionCount = txn._count.id;
        return {
          name: cashierMap.get(txn.cashierId) || 'Unknown',
          transactions: transactionCount,
          totalSales,
          averageTicket: transactionCount > 0 ? totalSales / transactionCount : 0,
          rank: 0, // Will be set after sorting
        };
      })
      .sort((a, b) => b.totalSales - a.totalSales)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    return result;
  }

  /**
   * Get Inventory KPIs
   */
  async getInventoryKPIs() {
    const totalSKUs = await this.prisma.product.count({
      where: {
        isActive: true,
        deletedAt: null,
      },
    });

    const stocks = await this.prisma.productStock.findMany({
      include: {
        product: true,
      },
    });

    const totalStockValue = stocks.reduce((sum, stock) => {
      const qty = stock.quantityAvailable.toNumber();
      const cost = stock.product.costPrice.toNumber();
      return sum + qty * cost;
    }, 0);

    const lowStockItems = stocks.filter((stock) => {
      const qty = stock.quantityAvailable.toNumber();
      const reorder = stock.reorderPoint?.toNumber() || 0;
      return qty > 0 && qty <= reorder;
    }).length;

    const outOfStockItems = stocks.filter(
      (stock) => stock.quantityAvailable.toNumber() <= 0,
    ).length;

    return {
      totalSKUs,
      totalStockValue,
      lowStockItems,
      outOfStockItems,
    };
  }

  /**
   * Get Stock Status by Branch
   */
  async getStockStatusByBranch() {
    const stocks = await this.prisma.productStock.findMany({
      include: {
        branch: true,
      },
    });

    const branchMap = new Map<
      string,
      { name: string; available: number; reserved: number; damaged: number }
    >();

    stocks.forEach((stock) => {
      const branchId = stock.branchId;
      const existing = branchMap.get(branchId) || {
        name: stock.branch.name,
        available: 0,
        reserved: 0,
        damaged: 0,
      };
      existing.available += stock.quantityAvailable.toNumber();
      existing.reserved += stock.quantityReserved.toNumber();
      existing.damaged += stock.quantityDamaged.toNumber();
      branchMap.set(branchId, existing);
    });

    return Array.from(branchMap.values());
  }

  /**
   * Get Stock Movement
   */
  async getStockMovement(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const movements = await this.prisma.stockMovement.findMany({
      where: {
        createdAt: {
          gte: startDate,
        },
      },
      select: {
        createdAt: true,
        movementType: true,
        quantityChange: true,
      },
    });

    const dateMap = new Map<string, { in: number; out: number }>();

    movements.forEach((movement) => {
      const dateKey = movement.createdAt.toISOString().split('T')[0];
      const existing = dateMap.get(dateKey) || { in: 0, out: 0 };
      const qty = Math.abs(movement.quantityChange.toNumber());
      if (movement.movementType === 'IN') {
        existing.in += qty;
      } else if (movement.movementType === 'OUT') {
        existing.out += qty;
      }
      dateMap.set(dateKey, existing);
    });

    const result: Array<{ date: string; in: number; out: number }> = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().split('T')[0];
      const data = dateMap.get(dateKey) || { in: 0, out: 0 };
      result.push({
        date: dateKey,
        in: data.in,
        out: data.out,
      });
    }

    return result;
  }

  /**
   * Get Top Moving Products
   */
  async getTopMovingProducts(days: number = 30, limit: number = 10) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const movements = await this.prisma.stockMovement.groupBy({
      by: ['productId', 'movementType'],
      where: {
        createdAt: {
          gte: startDate,
        },
      },
      _sum: {
        quantityChange: true,
      },
    });

    const productMap = new Map<
      string,
      { in: number; out: number; productName: string; category: string }
    >();

    movements.forEach((movement) => {
      const existing = productMap.get(movement.productId) || {
        in: 0,
        out: 0,
        productName: '',
        category: '',
      };
      const qty = Math.abs(movement._sum.quantityChange?.toNumber() || 0);
      if (movement.movementType === 'IN') {
        existing.in += qty;
      } else if (movement.movementType === 'OUT') {
        existing.out += qty;
      }
      productMap.set(movement.productId, existing);
    });

    const productIds = Array.from(productMap.keys());
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
      },
      include: {
        category: true,
      },
    });

    products.forEach((product) => {
      const data = productMap.get(product.id);
      if (data) {
        data.productName = product.name;
        data.category = product.category?.name || 'Uncategorized';
      }
    });

    return Array.from(productMap.values())
      .map((data) => ({
        product: data.productName,
        category: data.category,
        qtyIn: data.in,
        qtyOut: data.out,
        netChange: data.in - data.out,
        turnover: data.out > 0 ? data.in / data.out : 0,
      }))
      .sort((a, b) => b.qtyOut - a.qtyOut)
      .slice(0, limit);
  }

  /**
   * Get Low Stock Alerts
   */
  async getLowStockAlerts() {
    const stocks = await this.prisma.productStock.findMany({
      where: {
        quantityAvailable: {
          gt: 0,
        },
      },
      include: {
        product: true,
      },
    });

    const alerts = stocks
      .filter((stock) => {
        const qty = stock.quantityAvailable.toNumber();
        const reorder = stock.reorderPoint?.toNumber() || 0;
        return qty > 0 && qty <= reorder;
      })
      .map((stock) => ({
        product: stock.product.name,
        currentQty: stock.quantityAvailable.toNumber(),
        reorderPoint: stock.reorderPoint?.toNumber() || 0,
        lastOrderDate: stock.updatedAt.toISOString().split('T')[0],
        suggestedQty: (stock.reorderPoint?.toNumber() || 0) * 4, // 4x reorder point
      }));

    return alerts;
  }

  /**
   * Get Pending Transfers
   */
  async getPendingTransfers() {
    const transfers = await this.prisma.stockTransfer.findMany({
      where: {
        status: { in: ['pending', 'approved'] },
      },
      include: {
        fromBranch: true,
        toBranch: true,
        items: true,
      },
      take: 10,
    });

    return transfers.map((transfer) => ({
      id: transfer.transferNumber,
      from: transfer.fromBranch.name,
      to: transfer.toBranch.name,
      items: transfer.items.length,
      status: transfer.status,
    }));
  }

  /**
   * Get Slow Moving Items
   */
  async getSlowMovingItems(daysThreshold: number = 90) {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

    const stocks = await this.prisma.productStock.findMany({
      where: {
        quantityAvailable: {
          gt: 0,
        },
      },
      include: {
        product: true,
      },
    });

    // Get products with recent OUT movements
    const recentMovements = await this.prisma.stockMovement.findMany({
      where: {
        movementType: 'OUT',
        createdAt: {
          gte: thresholdDate,
        },
      },
      select: {
        productId: true,
      },
      distinct: ['productId'],
    });

    const recentProductIds = new Set(
      recentMovements.map((m) => m.productId),
    );

    const slowMoving = stocks
      .filter((stock) => !recentProductIds.has(stock.productId))
      .map((stock) => ({
        product: stock.product.name,
        daysNoMovement: daysThreshold,
        stockValue:
          stock.quantityAvailable.toNumber() *
          stock.product.costPrice.toNumber(),
      }));

    return slowMoving;
  }

  /**
   * Get Service KPIs
   */
  async getServiceKPIs() {
    const activeServices = await this.prisma.serviceOrder.count({
      where: {
        status: { in: ['pending', 'in_progress', 'ready'] },
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const completedToday = await this.prisma.serviceOrder.count({
      where: {
        status: { in: ['completed', 'delivered'] },
        completedAt: {
          gte: today,
        },
      },
    });

    // Calculate average TAT (simplified)
    const completedServices = await this.prisma.serviceOrder.findMany({
      where: {
        status: { in: ['completed', 'delivered'] },
        completedAt: { not: null },
      },
      select: {
        createdAt: true,
        completedAt: true,
      },
      take: 100,
    });

    const totalDays = completedServices.reduce((sum, service) => {
      if (service.completedAt && service.createdAt) {
        const days =
          (service.completedAt.getTime() - service.createdAt.getTime()) /
          (1000 * 60 * 60 * 24);
        return sum + days;
      }
      return sum;
    }, 0);

    const averageTAT =
      completedServices.length > 0 ? totalDays / completedServices.length : 0;

    // Customer rating (placeholder - would need rating system)
    const customerRating = 4.6;

    return {
      activeServices,
      completedToday,
      averageTAT,
      customerRating,
    };
  }

  /**
   * Get Service Pipeline
   */
  async getServicePipeline() {
    const statusCounts = await this.prisma.serviceOrder.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
    });

    const statusMap: Record<string, string> = {
      pending: 'Pending',
      diagnosed: 'Diagnosed',
      in_progress: 'In Progress',
      qc: 'QC',
      completed: 'Completed',
      delivered: 'Delivered',
    };

    return statusCounts.map((item) => ({
      stage: statusMap[item.status] || item.status,
      count: item._count.id,
    }));
  }

  /**
   * Get Service Types Distribution
   */
  async getServiceTypesDistribution(startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : new Date();
    start.setDate(start.getDate() - 30);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const services = await this.prisma.serviceOrder.findMany({
      where: {
        status: { in: ['completed', 'delivered'] },
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        serviceType: true,
      },
    });

    const typeMap = new Map<string, { count: number; revenue: number }>();
    services.forEach((service) => {
      const typeName = service.serviceType?.name || 'Other';
      const existing = typeMap.get(typeName) || { count: 0, revenue: 0 };
      existing.count += 1;
      existing.revenue += service.totalPrice?.toNumber() || 0;
      typeMap.set(typeName, existing);
    });

    return Array.from(typeMap.entries()).map(([type, data]) => ({
      type,
      count: data.count,
      revenue: data.revenue,
    }));
  }

  /**
   * Get Workload by Technician
   */
  async getWorkloadByTechnician() {
    const services = await this.prisma.serviceOrder.groupBy({
      by: ['assignedTechnicianId'],
      where: {
        status: { in: ['pending', 'in_progress', 'ready'] },
      },
      _count: {
        id: true,
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const technicianIds = services
      .map((s) => s.assignedTechnicianId)
      .filter((id): id is string => id !== null);

    const technicians = await this.prisma.user.findMany({
      where: {
        id: { in: technicianIds },
      },
      select: {
        id: true,
        fullName: true,
      },
    });

    const technicianMap = new Map(
      technicians.map((t) => [t.id, t.fullName || 'Unknown']),
    );

    const result = await Promise.all(
      services.map(async (service) => {
        const active = service._count.id;
        const completedToday = await this.prisma.serviceOrder.count({
          where: {
            assignedTechnicianId: service.assignedTechnicianId,
            status: { in: ['completed', 'delivered'] },
            completedAt: {
              gte: today,
            },
          },
        });
        const completedWeek = await this.prisma.serviceOrder.count({
          where: {
            assignedTechnicianId: service.assignedTechnicianId,
            status: { in: ['completed', 'delivered'] },
            completedAt: {
              gte: weekStart,
            },
          },
        });
        const capacity = Math.min(100, (active / 10) * 100); // Simplified

        return {
          name: technicianMap.get(service.assignedTechnicianId || '') || 'Unknown',
          active,
          completedToday,
          completedWeek,
          capacity,
        };
      }),
    );

    return result;
  }

  /**
   * Get Performance Metrics
   */
  async getPerformanceMetrics(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const services = await this.prisma.serviceOrder.groupBy({
      by: ['assignedTechnicianId'],
      where: {
        status: { in: ['completed', 'delivered'] },
        completedAt: {
          gte: startDate,
        },
      },
      _count: {
        id: true,
      },
    });

    const technicianIds = services
      .map((s) => s.assignedTechnicianId)
      .filter((id): id is string => id !== null);

    const technicians = await this.prisma.user.findMany({
      where: {
        id: { in: technicianIds },
      },
      select: {
        id: true,
        fullName: true,
      },
    });

    const technicianMap = new Map(
      technicians.map((t) => [t.id, t.fullName || 'Unknown']),
    );

    const result = await Promise.all(
      services.map(async (service) => {
        const completed = service._count.id;
        // Calculate average TAT
        const completedServices = await this.prisma.serviceOrder.findMany({
          where: {
            assignedTechnicianId: service.assignedTechnicianId,
            status: { in: ['completed', 'delivered'] },
            completedAt: {
              gte: startDate,
            },
          },
          select: {
            createdAt: true,
            completedAt: true,
          },
        });

        const totalDays = completedServices.reduce((sum, s) => {
          if (s.completedAt && s.createdAt) {
            return (
              sum +
              (s.completedAt.getTime() - s.createdAt.getTime()) /
                (1000 * 60 * 60 * 24)
            );
          }
          return sum;
        }, 0);

        const averageTAT =
          completedServices.length > 0 ? totalDays / completedServices.length : 0;

        // Rating placeholder
        const rating = 4.5;

        return {
          name: technicianMap.get(service.assignedTechnicianId || '') || 'Unknown',
          completed,
          averageTAT,
          rating,
          rank: 0, // Will be set after sorting
        };
      }),
    );

    return result
      .sort((a, b) => b.completed - a.completed)
      .map((item, index) => ({ ...item, rank: index + 1 }));
  }

  /**
   * Get Overdue Services
   */
  async getOverdueServices() {
    const services = await this.prisma.serviceOrder.findMany({
      where: {
        status: { in: ['pending', 'in_progress'] },
        slaDueDate: {
          lt: new Date(),
        },
      },
      include: {
        assignedTechnician: {
          select: {
            fullName: true,
          },
        },
      },
      take: 10,
    });

    return services.map((service) => {
      const daysOverdue = service.slaDueDate
        ? Math.floor(
            (new Date().getTime() - service.slaDueDate.getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : 0;

      return {
        serviceNumber: service.serviceNumber,
        customer: service.customerName,
        device: `${service.deviceBrand} ${service.deviceModel}`.trim(),
        daysOverdue,
        assignedTo: service.assignedTechnician?.fullName || 'Unassigned',
        priority: daysOverdue > 3 ? 'high' : daysOverdue > 1 ? 'medium' : 'low',
      };
    });
  }

  /**
   * Get Most Used Parts
   */
  async getMostUsedParts(days: number = 30, limit: number = 10) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const partsUsed = await this.prisma.servicePartsUsed.groupBy({
      by: ['productId'],
      where: {
        createdAt: {
          gte: startDate,
        },
      },
      _sum: {
        quantity: true,
      },
    });

    const productIds = partsUsed.map((p) => p.productId);
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
      },
    });

    const productMap = new Map(products.map((p) => [p.id, p.name]));

    const stocks = await this.prisma.productStock.findMany({
      where: {
        productId: { in: productIds },
      },
      select: {
        productId: true,
        quantityAvailable: true,
        reorderPoint: true,
      },
    });

    const stockMap = new Map(
      stocks.map((s) => [
        s.productId,
        {
          qty: s.quantityAvailable.toNumber(),
          reorder: s.reorderPoint?.toNumber() || 0,
        },
      ]),
    );

    return partsUsed
      .map((part) => {
        const qty = part._sum.quantity?.toNumber() || 0;
        const stock = stockMap.get(part.productId);
        let stockStatus = 'in-stock';
        if (stock) {
          if (stock.qty <= 0) {
            stockStatus = 'out-of-stock';
          } else if (stock.qty <= stock.reorder) {
            stockStatus = 'low';
          }
        }

        return {
          part: productMap.get(part.productId) || 'Unknown',
          qtyUsed: qty,
          stockStatus,
        };
      })
      .sort((a, b) => b.qtyUsed - a.qtyUsed)
      .slice(0, limit);
  }

  /**
   * Get SLA Compliance
   */
  async getSLACompliance() {
    const totalServices = await this.prisma.serviceOrder.count({
      where: {
        status: { in: ['completed', 'delivered'] },
        slaDueDate: { not: null },
      },
    });

    // Get all completed services with SLA dates
    const allCompleted = await this.prisma.serviceOrder.findMany({
      where: {
        status: { in: ['completed', 'delivered'] },
        slaDueDate: { not: null },
        completedAt: { not: null },
      },
      select: {
        completedAt: true,
        slaDueDate: true,
      },
    });

    const onTimeServices = allCompleted.filter((service) => {
      if (!service.completedAt || !service.slaDueDate) return false;
      return service.completedAt <= service.slaDueDate;
    }).length;

    const compliance =
      totalServices > 0 ? (onTimeServices / totalServices) * 100 : 0;

    return compliance;
  }
}

