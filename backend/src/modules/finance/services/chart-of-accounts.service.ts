import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';

interface COAItem {
  code: string;
  name: string;
  accountType: string;
  parentCode?: string;
  isHeader: boolean;
  description?: string;
}

@Injectable()
export class ChartOfAccountsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Seed Chart of Accounts with complete structure
   */
  async seedChartOfAccounts() {
    const coaStructure: COAItem[] = [
      // ASSETS (1xxxx)
      { code: '10000', name: 'Current Assets', accountType: 'ASSET', isHeader: true },
      { code: '10100', name: 'Cash', accountType: 'ASSET', parentCode: '10000', isHeader: true },
      { code: '10101', name: 'Cash - Jember', accountType: 'ASSET', parentCode: '10100', isHeader: false },
      { code: '10102', name: 'Cash - Kalisat', accountType: 'ASSET', parentCode: '10100', isHeader: false },
      { code: '10200', name: 'Bank', accountType: 'ASSET', parentCode: '10000', isHeader: true },
      { code: '10201', name: 'Bank BCA', accountType: 'ASSET', parentCode: '10200', isHeader: false },
      { code: '10202', name: 'Bank Mandiri', accountType: 'ASSET', parentCode: '10200', isHeader: false },
      { code: '10300', name: 'Accounts Receivable', accountType: 'ASSET', parentCode: '10000', isHeader: false },
      { code: '10400', name: 'Inventory', accountType: 'ASSET', parentCode: '10000', isHeader: false },
      { code: '12000', name: 'Fixed Assets', accountType: 'ASSET', isHeader: true },
      { code: '12100', name: 'Equipment', accountType: 'ASSET', parentCode: '12000', isHeader: false },
      { code: '12200', name: 'Furniture', accountType: 'ASSET', parentCode: '12000', isHeader: false },

      // LIABILITIES (2xxxx)
      { code: '20000', name: 'Current Liabilities', accountType: 'LIABILITY', isHeader: true },
      { code: '20100', name: 'Accounts Payable', accountType: 'LIABILITY', parentCode: '20000', isHeader: false },
      { code: '20200', name: 'Accrued Expenses', accountType: 'LIABILITY', parentCode: '20000', isHeader: false },
      { code: '21000', name: 'Long-term Liabilities', accountType: 'LIABILITY', isHeader: true },

      // EQUITY (3xxxx)
      { code: '30000', name: "Owner's Equity", accountType: 'EQUITY', isHeader: false },
      { code: '31000', name: 'Retained Earnings', accountType: 'EQUITY', isHeader: false },

      // REVENUE (4xxxx)
      { code: '40000', name: 'Sales Revenue', accountType: 'REVENUE', isHeader: true },
      { code: '40100', name: 'Product Sales', accountType: 'REVENUE', parentCode: '40000', isHeader: false },
      { code: '40200', name: 'Service Revenue', accountType: 'REVENUE', parentCode: '40000', isHeader: false },
      { code: '41000', name: 'Other Income', accountType: 'REVENUE', isHeader: false },

      // EXPENSES (5xxxx)
      { code: '50000', name: 'Cost of Goods Sold', accountType: 'EXPENSE', isHeader: false },
      { code: '51000', name: 'Operating Expenses', accountType: 'EXPENSE', isHeader: true },
      { code: '51100', name: 'Salaries', accountType: 'EXPENSE', parentCode: '51000', isHeader: false },
      { code: '51200', name: 'Rent', accountType: 'EXPENSE', parentCode: '51000', isHeader: false },
      { code: '51300', name: 'Utilities', accountType: 'EXPENSE', parentCode: '51000', isHeader: false },
      { code: '51400', name: 'Marketing', accountType: 'EXPENSE', parentCode: '51000', isHeader: false },
      { code: '51500', name: 'Maintenance', accountType: 'EXPENSE', parentCode: '51000', isHeader: false },
      { code: '52000', name: 'Other Expenses', accountType: 'EXPENSE', isHeader: false },
    ];

    const results = [];

    for (const item of coaStructure) {
      const existing = await this.prisma.chartOfAccount.findUnique({
        where: { code: item.code },
      });

      if (!existing) {
        let parentId = null;
        if (item.parentCode) {
          const parent = await this.prisma.chartOfAccount.findUnique({
            where: { code: item.parentCode },
          });
          if (parent) {
            parentId = parent.id;
          }
        }

        await this.prisma.chartOfAccount.create({
          data: {
            code: item.code,
            name: item.name,
            accountType: item.accountType,
            parentId,
            isHeader: item.isHeader,
            description: item.description,
          },
        });
        results.push({ action: 'created', code: item.code, name: item.name });
      } else {
        results.push({ action: 'exists', code: item.code, name: item.name });
      }
    }

    return results;
  }

  /**
   * Get all active accounts
   */
  async findAll() {
    return this.prisma.chartOfAccount.findMany({
      where: { isActive: true },
      include: {
        parent: true,
        children: {
          where: { isActive: true },
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Get account by ID
   */
  async findById(id: string) {
    return this.prisma.chartOfAccount.findUnique({
      where: { id },
      include: {
        parent: true,
        children: {
          where: { isActive: true },
        },
      },
    });
  }

  /**
   * Get account by code
   */
  async findByCode(code: string) {
    return this.prisma.chartOfAccount.findUnique({
      where: { code },
    });
  }

  /**
   * Get accounts by type
   */
  async findByType(accountType: string) {
    return this.prisma.chartOfAccount.findMany({
      where: {
        accountType,
        isActive: true,
        isHeader: false, // Only return transaction accounts
      },
      orderBy: { code: 'asc' },
    });
  }
}

