import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { CustomerTiersService } from "./customer-tiers.service";
import { JwtAuthGuard, RolesGuard } from "../../shared/guards";
import { Roles } from "../../shared/decorators";
import { CreateCustomerTierDto, UpdateCustomerTierDto } from "./dto";

/**
 * CustomerTiers Controller
 * Handles customer tier management endpoints
 */
@Controller("customer-tiers")
@UseGuards(JwtAuthGuard)
export class CustomerTiersController {
  constructor(
    private readonly customerTiersService: CustomerTiersService,
  ) {}

  /**
   * List customer tiers
   * GET /api/v1/customer-tiers
   * Permissions: SUPERADMIN
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles("SUPERADMIN")
  async findAll(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
    @Query("filter[isActive]") isActive?: string,
    @Query("status") status?: string,
  ) {
    try {
      const pageNum = page ? parseInt(page) : 1;
      const limitNum = limit ? parseInt(limit) : 20;
      const isActiveBool =
        isActive === "true"
          ? true
          : isActive === "false"
            ? false
            : undefined;

      return await this.customerTiersService.findAllPaginated(
        pageNum,
        limitNum,
        search,
        isActiveBool,
        status,
      );
    } catch (error) {
      console.error("Error in customerTiers.findAll:", error);
      throw error;
    }
  }

  /**
   * Get customer tier by ID
   * GET /api/v1/customer-tiers/:id
   * Permissions: SUPERADMIN
   */
  @Get(":id")
  @UseGuards(RolesGuard)
  @Roles("SUPERADMIN")
  async findById(@Param("id") id: string) {
    return this.customerTiersService.findById(id);
  }

  /**
   * Create customer tier
   * POST /api/v1/customer-tiers
   * Permissions: SUPERADMIN
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles("SUPERADMIN")
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createCustomerTierDto: CreateCustomerTierDto) {
    return this.customerTiersService.create(createCustomerTierDto);
  }

  /**
   * Update customer tier
   * PUT /api/v1/customer-tiers/:id
   * Permissions: SUPERADMIN
   */
  @Put(":id")
  @UseGuards(RolesGuard)
  @Roles("SUPERADMIN")
  async update(
    @Param("id") id: string,
    @Body() updateCustomerTierDto: UpdateCustomerTierDto,
  ) {
    return this.customerTiersService.update(id, updateCustomerTierDto);
  }

  /**
   * Delete customer tier
   * DELETE /api/v1/customer-tiers/:id
   * Permissions: SUPERADMIN
   */
  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles("SUPERADMIN")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("id") id: string) {
    await this.customerTiersService.delete(id);
  }
}
