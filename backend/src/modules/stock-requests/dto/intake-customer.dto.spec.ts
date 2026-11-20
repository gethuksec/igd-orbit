import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateStockRequestDto } from './create-stock-request.dto';
import { QuickAddIntakeCustomerDto } from './intake-customer.dto';

const validItem = {
  barcode: 'LCDIP11',
  listing: 'EXIST',
  productId: '123e4567-e89b-42d3-a456-426614174000',
  quantity: 2,
};

describe('Intake customer DTOs', () => {
  describe('QuickAddIntakeCustomerDto', () => {
    it('accepts a valid payload', async () => {
      const dto = plainToInstance(QuickAddIntakeCustomerDto, {
        name: 'Budi',
        phone: '08123456789',
        subdistrict: 'Patrang',
      });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('accepts +62 WA format', async () => {
      const dto = plainToInstance(QuickAddIntakeCustomerDto, {
        name: 'Budi',
        phone: '+628123456789',
        subdistrict: 'Kaliwates',
      });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('rejects bad WA format', async () => {
      const dto = plainToInstance(QuickAddIntakeCustomerDto, {
        name: 'Budi',
        phone: '12345',
        subdistrict: 'Patrang',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'phone')).toBe(true);
    });

    it('rejects unknown subdistrict', async () => {
      const dto = plainToInstance(QuickAddIntakeCustomerDto, {
        name: 'Budi',
        phone: '08123456789',
        subdistrict: 'Menteng',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'subdistrict')).toBe(true);
    });

    it('rejects blank name', async () => {
      const dto = plainToInstance(QuickAddIntakeCustomerDto, {
        name: '',
        phone: '08123456789',
        subdistrict: 'Patrang',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'name')).toBe(true);
    });
  });

  describe('CreateStockRequestDto (customerId compat)', () => {
    it('accepts customerId-only payload (no customerType)', async () => {
      const dto = plainToInstance(CreateStockRequestDto, {
        staffName: 'Aldi',
        requestType: 'LIMIT',
        customerId: '123e4567-e89b-42d3-a456-426614174000',
        items: [validItem],
      });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('rejects non-UUID customerId', async () => {
      const dto = plainToInstance(CreateStockRequestDto, {
        staffName: 'Aldi',
        requestType: 'LIMIT',
        customerId: 'not-a-uuid',
        items: [validItem],
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'customerId')).toBe(true);
    });

    it('still accepts legacy customerType payload', async () => {
      const dto = plainToInstance(CreateStockRequestDto, {
        staffName: 'Aldi',
        requestType: 'EXIT',
        customerType: 'USER',
        items: [validItem],
      });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('accepts free-text customerName without picker', async () => {
      const dto = plainToInstance(CreateStockRequestDto, {
        staffName: 'Aldi',
        requestType: 'EXIT',
        customerName: 'Budi',
        items: [validItem],
      });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('rejects missing requestType', async () => {
      const dto = plainToInstance(CreateStockRequestDto, {
        staffName: 'Aldi',
        customerId: '123e4567-e89b-42d3-a456-426614174000',
        items: [validItem],
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'requestType')).toBe(true);
    });

    it('rejects invalid requestType', async () => {
      const dto = plainToInstance(CreateStockRequestDto, {
        staffName: 'Aldi',
        requestType: 'URGENT',
        customerType: 'USER',
        items: [validItem],
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'requestType')).toBe(true);
    });

    it('rejects invalid legacy customerType', async () => {
      const dto = plainToInstance(CreateStockRequestDto, {
        staffName: 'Aldi',
        requestType: 'LIMIT',
        customerType: 'VIP',
        items: [validItem],
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'customerType')).toBe(true);
    });
  });
});
