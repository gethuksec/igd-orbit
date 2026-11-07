import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../shared/services/prisma.service';
import { slugifyBranchName, shortToken } from '../branches/branches.service';
import { CreateStockRequestDto } from './dto/create-stock-request.dto';
import { UpdateStockRequestStatusDto } from './dto/update-stock-request-status.dto';
import {
  INTAKE_WA_PATTERN,
  KECAMATAN_JEMBER,
  QuickAddIntakeCustomerDto,
} from './dto/intake-customer.dto';

/** Forward chain; REJECTED only from SUBMITTED, CANCELLED from any non-terminal. */
const NEXT_STEP: Record<string, string> = {
  SUBMITTED: 'APPROVED',
  APPROVED: 'WAITING_FOR_PO',
  WAITING_FOR_PO: 'CHECKOUT',
  CHECKOUT: 'KEEP_RESERVED',
  KEEP_RESERVED: 'IN_TRANSIT',
  IN_TRANSIT: 'RECEIVED',
};

const TERMINAL_STATUS = new Set(['RECEIVED', 'REJECTED', 'CANCELLED']);

/** Staff roles shown on the public intake dropdown (outlet-scoped). */
const INTAKE_STAFF_ROLES = ['ASA', 'CS', 'CSO'];

@Injectable()
export class StockRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Public intake ───

  private async requireBranchByToken(token: string) {
    if (!token) {
      throw new NotFoundException('Tautan request tidak valid.');
    }
    // Hybrid C: accept either the unguessable intakeToken or the friendly intakeSlug.
    const branch =
      (await this.prisma.branch.findUnique({
        where: { intakeSlug: token },
        select: { id: true, code: true, name: true, isActive: true },
      })) ||
      (await this.prisma.branch.findUnique({
        where: { intakeToken: token },
        select: { id: true, code: true, name: true, isActive: true },
      }));
    if (!branch || branch.isActive === false) {
      throw new NotFoundException('Tautan request tidak valid.');
    }
    return branch;
  }

  async getIntakeContext(token: string) {
    const branch = await this.requireBranchByToken(token);
    const [staff, categories] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          isActive: true,
          userBranches: {
            some: {
              branchId: branch.id,
              role: { code: { in: INTAKE_STAFF_ROLES }, isActive: true },
            },
          },
        },
        select: { id: true, fullName: true, username: true },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.category.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true },
        orderBy: { name: 'asc' },
        take: 200,
      }),
    ]);
    return {
      outlet: { id: branch.id, code: branch.code, name: branch.name },
      staff: staff.map((u: any) => ({ id: u.id, name: u.fullName || u.username || 'Tanpa nama' })),
      categories,
    };
  }

  async searchIntakeProducts(token: string, query?: string, limit = 15) {
    const branch = await this.requireBranchByToken(token);
    const q = (query || '').trim();
    const take = Math.min(Math.max(limit || 15, 1), 30);
    // Empty query (field focused, nothing typed): return top active products
    // so the intake form can show a default dropdown.
    const products = await this.prisma.product.findMany({
      where: q
        ? {
            isActive: true,
            deletedAt: null,
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { sku: { contains: q, mode: 'insensitive' } },
              { barcode: { contains: q, mode: 'insensitive' } },
            ],
          }
        : { isActive: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        categoryId: true,
        category: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
      take,
    });
    const withStock = await Promise.all(
      products.map(async (p: any) => {
        const agg = await this.prisma.productStock.aggregate({
          _sum: { quantityAvailable: true },
          where: { productId: p.id, branchId: branch.id },
        });
        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          category: p.category,
          available: Number(agg._sum.quantityAvailable || 0),
        };
      }),
    );
    return withStock;
  }

  /** Exact member-number check (no fuzzy search — customer PII stays unenumerable). */
  async verifyIntakeMember(token: string, code?: string) {
    await this.requireBranchByToken(token);
    const memberCode = (code || '').trim();
    if (!memberCode) {
      throw new BadRequestException('Nomor member wajib diisi.');
    }
    const member = await this.prisma.customer.findUnique({
      where: { customerCode: memberCode },
      select: { id: true, name: true, customerCode: true, isActive: true },
    });
    if (!member || member.isActive === false) {
      throw new NotFoundException('Member tidak ditemukan. Periksa nomor member.');
    }
    return { id: member.id, name: member.name, customerCode: member.customerCode };
  }

  /** Name/WA search across all active customers (PII-light: id/name/phone/subdistrict only). */
  async searchIntakeCustomers(token: string, query?: string, limit = 15) {
    await this.requireBranchByToken(token);
    const q = (query || '').trim();
    if (!q) return [];
    const take = Math.min(Math.max(limit || 15, 1), 15);
    return this.prisma.customer.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, phone: true, subdistrict: true },
      orderBy: { name: 'asc' },
      take,
    });
  }

  /** Public quick-add: creates a retail Customer master row, returns the picker row. */
  async quickAddIntakeCustomer(token: string, dto: QuickAddIntakeCustomerDto) {
    await this.requireBranchByToken(token);
    const name = dto.name?.trim() || '';
    const phone = dto.phone?.trim() || '';
    const subdistrict = dto.subdistrict?.trim() || '';
    if (!name) {
      throw new BadRequestException('Nama wajib diisi.');
    }
    if (phone && !INTAKE_WA_PATTERN.test(phone)) {
      throw new BadRequestException('No. WA tidak valid. Format: 08… atau +62…');
    }
    if (!(KECAMATAN_JEMBER as readonly string[]).includes(subdistrict)) {
      throw new BadRequestException('Kecamatan tidak valid.');
    }
    const customerCode = await this.generateIntakeCustomerCode();
    return this.prisma.customer.create({
      data: { customerCode, customerType: 'retail', name, phone: phone || null, subdistrict },
      select: { id: true, name: true, phone: true, subdistrict: true },
    });
  }

  private async generateIntakeCustomerCode(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = `CUST-${randomBytes(4).toString('hex').toUpperCase()}`;
      const existing = await this.prisma.customer.findUnique({
        where: { customerCode: code },
        select: { id: true },
      });
      if (!existing) return code;
    }
    throw new BadRequestException('Gagal membuat kode customer, coba lagi.');
  }

  async createIntake(token: string, dto: CreateStockRequestDto) {
    const branch = await this.requireBranchByToken(token);
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Minimal 1 barang.');
    }
    if (dto.items.length > 50) {
      throw new BadRequestException('Maksimal 50 barang per request.');
    }
    // Customer resolution: customerId preferred (picker); legacy customerType/memberRef kept for compat.
    let memberId: string | null = null;
    let memberRef: string | null = null;
    let customerType: string;
    if (dto.customerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: dto.customerId },
        select: { id: true, name: true, isActive: true },
      });
      if (!customer || customer.isActive === false) {
        throw new BadRequestException('Customer tidak ditemukan.');
      }
      memberId = customer.id;
      memberRef = customer.name;
      customerType = 'MEMBER';
    } else {
      customerType = (dto.customerType || '').toUpperCase();
      if (customerType !== 'USER' && customerType !== 'MEMBER') {
        throw new BadRequestException('customerType must be USER or MEMBER.');
      }
      // Member resolution on exact code match (non-blocking — ref text always stored).
      memberRef = dto.memberRef?.trim() || null;
      if (customerType === 'MEMBER') {
        if (!memberRef) {
          throw new BadRequestException('Referensi member wajib diisi untuk tipe Member.');
        }
        const member = await this.prisma.customer.findUnique({
          where: { customerCode: memberRef },
          select: { id: true, isActive: true },
        });
        if (member && member.isActive !== false) memberId = member.id;
      }
    }

    // Best-effort staff resolution (non-blocking — name is always stored).
    let staffUserId: string | null = null;
    try {
      const match = await this.prisma.user.findFirst({
        where: {
          isActive: true,
          fullName: { equals: dto.staffName.trim(), mode: 'insensitive' },
          userBranches: {
            some: {
              branchId: branch.id,
              role: { code: { in: INTAKE_STAFF_ROLES }, isActive: true },
            },
          },
        },
        select: { id: true },
      });
      staffUserId = match?.id ?? null;
    } catch {
      staffUserId = null;
    }

    const rows: any[] = [];
    for (let i = 0; i < dto.items.length; i++) {
      const item = dto.items[i];
      const n = i + 1;
      const listing = (item.listing || '').toUpperCase();
      if (listing !== 'EXIST' && listing !== 'NEW') {
        throw new BadRequestException(`Barang #${n}: listing harus EXIST atau NEW.`);
      }
      const barcode = item.barcode?.trim() || null;
      if (!barcode) {
        throw new BadRequestException(`Barang #${n}: barcode wajib diisi.`);
      }
      let productId: string | null = null;
      let productName: string;
      let categoryId: string | null = null;
      let categoryName: string;
      if (listing === 'EXIST') {
        if (!item.productId) {
          throw new BadRequestException(`Barang #${n}: pilih produk dari master.`);
        }
        const product: any = await this.prisma.product.findUnique({
          where: { id: item.productId },
          include: { category: { select: { id: true, name: true } } },
        });
        if (!product || product.isActive === false || product.deletedAt) {
          throw new BadRequestException(`Barang #${n}: produk tidak ditemukan di master.`);
        }
        productId = product.id;
        productName = item.productName?.trim() || product.name;
        if (item.categoryId) {
          const cat = await this.prisma.category.findUnique({
            where: { id: item.categoryId },
            select: { id: true, name: true },
          });
          if (!cat) throw new BadRequestException(`Barang #${n}: kategori tidak valid.`);
          categoryId = cat.id;
          categoryName = item.categoryName?.trim() || cat.name;
        } else {
          categoryId = product.categoryId ?? null;
          categoryName = item.categoryName?.trim() || product.category?.name || '';
        }
      } else {
        productName = item.productName?.trim() || '';
        if (!productName) {
          throw new BadRequestException(`Barang #${n}: nama produk baru wajib diisi.`);
        }
        categoryName = item.categoryName?.trim() || '';
        // Category is optional for new products — resolve the id only when given.
        if (item.categoryId || categoryName) {
          if (item.categoryId) {
            const cat = await this.prisma.category.findUnique({
              where: { id: item.categoryId },
              select: { id: true, name: true },
            });
            if (!cat) throw new BadRequestException(`Barang #${n}: kategori tidak valid.`);
            categoryId = cat.id;
            categoryName = categoryName || cat.name;
          } else {
            const cat = await this.prisma.category.findFirst({
              where: { name: { equals: categoryName, mode: 'insensitive' }, isActive: true },
              select: { id: true },
            });
            if (cat) categoryId = cat.id;
          }
        }
      }
      rows.push({
        barcode,
        listing,
        productId,
        productName,
        categoryId,
        categoryName,
        quantity: item.quantity,
        note: item.note?.trim() || null,
        sortOrder: i,
      });
    }

    const requestNumber = await this.generateRequestNumber();
    const created: any = await this.prisma.stockRequest.create({
      data: {
        requestNumber,
        branchId: branch.id,
        staffName: dto.staffName.trim(),
        staffUserId,
        customerType,
        memberId,
        memberRef,
        status: 'SUBMITTED',
        items: { create: rows },
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    return {
      ...created,
      outlet: { id: branch.id, code: branch.code, name: branch.name },
    };
  }

  private async generateRequestNumber(): Promise<string> {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    for (let attempt = 0; attempt < 8; attempt++) {
      const random = Math.floor(Math.random() * 1000000)
        .toString()
        .padStart(6, '0');
      const candidate = `REQ-${dateStr}-${random}`;
      const existing = await this.prisma.stockRequest.findUnique({
        where: { requestNumber: candidate },
        select: { id: true },
      });
      if (!existing) return candidate;
    }
    // Fallback: timestamp suffix guarantees uniqueness.
    return `REQ-${dateStr}-${Date.now().toString().slice(-6)}`;
  }

  // ─── SODO review (guarded) ───

  async getStats() {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [waiting, inProgress, received] = await Promise.all([
      this.prisma.stockRequest.count({ where: { status: 'SUBMITTED' } }),
      this.prisma.stockRequest.count({
        where: {
          status: {
            in: ['APPROVED', 'WAITING_FOR_PO', 'CHECKOUT', 'KEEP_RESERVED', 'IN_TRANSIT'],
          },
        },
      }),
      this.prisma.stockRequest.count({
        where: { status: 'RECEIVED', createdAt: { gte: monthStart } },
      }),
    ]);
    return { waiting, inProgress, receivedThisMonth: received };
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    branchId?: string;
  }) {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const where: any = {};
    if (query.status) where.status = query.status.toUpperCase();
    if (query.branchId) where.branchId = query.branchId;
    const search = (query.search || '').trim();
    if (search) {
      where.OR = [
        { requestNumber: { contains: search, mode: 'insensitive' } },
        { staffName: { contains: search, mode: 'insensitive' } },
        { poNumber: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [total, docs] = await Promise.all([
      this.prisma.stockRequest.count({ where }),
      this.prisma.stockRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { items: true } } },
      }),
    ]);
    const branchIds = [...new Set(docs.map((d: any) => d.branchId))];
    const branches = branchIds.length
      ? await this.prisma.branch.findMany({
          where: { id: { in: branchIds } },
          select: { id: true, code: true, name: true },
        })
      : [];
    const byId = new Map(branches.map((b: any) => [b.id, b]));
    return {
      data: docs.map((d: any) => {
        const { _count, ...rest } = d;
        const outlet = byId.get(d.branchId) || null;
        return { ...rest, itemCount: _count?.items ?? 0, outlet };
      }),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    const doc: any = await this.prisma.stockRequest.findUnique({
      where: { id },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!doc) throw new NotFoundException('Request tidak ditemukan.');
    const outlet = await this.prisma.branch.findUnique({
      where: { id: doc.branchId },
      select: { id: true, code: true, name: true },
    });
    return { ...doc, outlet };
  }

  async approve(id: string, decidedBy?: string) {
    return this.updateStatus(id, { status: 'APPROVED' } as UpdateStockRequestStatusDto, decidedBy);
  }

  async updateStatus(id: string, dto: UpdateStockRequestStatusDto, decidedBy?: string) {
    const req: any = await this.prisma.stockRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Request tidak ditemukan.');
    const current = req.status;
    const target = (dto.status || '').toUpperCase();
    if (TERMINAL_STATUS.has(current)) {
      throw new BadRequestException(`Request sudah ${current}, tidak bisa diubah.`);
    }
    const reason = dto.reason?.trim() || '';
    if (target === 'REJECTED') {
      if (current !== 'SUBMITTED') {
        throw new BadRequestException('Hanya request Submitted yang bisa ditolak.');
      }
      if (!reason) {
        throw new BadRequestException('Alasan penolakan wajib diisi.');
      }
    } else if (target === 'CANCELLED') {
      if (!reason) {
        throw new BadRequestException('Alasan pembatalan wajib diisi.');
      }
    } else {
      if (NEXT_STEP[current] !== target) {
        throw new BadRequestException(`Transisi ${current} → ${target} tidak diizinkan.`);
      }
      if (target === 'CHECKOUT' && !(req.poNumber || dto.poNumber?.trim())) {
        throw new BadRequestException('Nomor PO wajib diisi sebelum Checkout.');
      }
    }
    const poNumber = dto.poNumber?.trim() || undefined;
    const updated: any = await this.prisma.stockRequest.update({
      where: { id },
      data: {
        status: target,
        ...(poNumber ? { poNumber } : {}),
        ...(target === 'REJECTED' || target === 'CANCELLED' ? { cancelReason: reason } : {}),
        ...(decidedBy ? { decidedBy } : {}),
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    return updated;
  }

  async rotateIntakeToken(branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, code: true, name: true, intakeSlug: true },
    });
    if (!branch) throw new NotFoundException('Outlet tidak ditemukan.');
    const intakeToken = randomBytes(24).toString('hex');
    // Slug is stable across rotations; backfill it when missing on legacy outlets.
    const data: any = { intakeToken };
    let intakeSlug = branch.intakeSlug;
    if (!intakeSlug) {
      for (let attempt = 0; attempt < 10; attempt++) {
        const candidate = `${slugifyBranchName(branch.name)}-${shortToken()}`;
        const clash = await this.prisma.branch.findUnique({
          where: { intakeSlug: candidate },
          select: { id: true },
        });
        if (!clash) {
          intakeSlug = candidate;
          break;
        }
      }
      if (!intakeSlug) throw new BadRequestException('Gagal membuat slug outlet, coba lagi.');
      data.intakeSlug = intakeSlug;
    }
    await this.prisma.branch.update({
      where: { id: branchId },
      data,
    });
    return {
      branchId: branch.id,
      branchCode: branch.code,
      branchName: branch.name,
      intakeToken,
      intakeSlug,
      intakePath: intakeSlug ? `/r/${intakeSlug}` : null,
    };
  }

  /** Active outlet intake links for the SODO review page (tokens stay server-side until here). */
  async listIntakeLinks() {
    const branches = await this.prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, intakeToken: true, intakeSlug: true },
      orderBy: { code: 'asc' },
    });
    return branches.map((b) => ({
      branchId: b.id,
      branchCode: b.code,
      branchName: b.name,
      intakeToken: b.intakeToken,
      intakeSlug: b.intakeSlug,
      intakePath: b.intakeSlug ? `/r/${b.intakeSlug}` : null,
    }));
  }
}
