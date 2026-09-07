import { Test } from '@nestjs/testing';
import { PrismaService } from '../../shared/services';
import { StockRequestsModule } from './stock-requests.module';
import { StockRequestsService } from './stock-requests.service';
import { StockRequestsController } from './stock-requests.controller';

/**
 * DI wiring guard: compiles the REAL module with only PrismaService mocked.
 * Catches missing providers (e.g. PrismaService not listed in providers),
 * which unit specs with hand-wired providers cannot see.
 */
describe('StockRequestsModule wiring', () => {
  it('compiles with a mocked PrismaService', async () => {
    const module = await Test.createTestingModule({
      imports: [StockRequestsModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    expect(module.get(StockRequestsService)).toBeDefined();
    expect(module.get(StockRequestsController)).toBeDefined();
    await module.close();
  });
});
