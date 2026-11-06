import { FileTokenService } from './file-token.service';

describe('FileTokenService (IGDERP-254)', () => {
  const OLD_ENV = process.env;
  let tokens: FileTokenService;

  beforeEach(() => {
    process.env = { ...OLD_ENV, FILE_TOKEN_SECRET: 'spec-secret' };
    tokens = new FileTokenService();
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('signs and verifies a matching token', () => {
    const token = tokens.sign('purchase', 'att-1');
    expect(() => tokens.verify('purchase', 'att-1', token)).not.toThrow();
  });

  it('contentUrl embeds a verifiable token', () => {
    const url = tokens.contentUrl('service-photo', 'ph-9');
    expect(url.startsWith('/api/v1/files/service-photo/ph-9?token=')).toBe(true);
    const token = url.split('token=')[1];
    expect(() => tokens.verify('service-photo', 'ph-9', token)).not.toThrow();
  });

  it('rejects tampered, mismatched, and expired tokens', () => {
    const token = tokens.sign('purchase', 'att-1');
    const tampered = token.slice(0, -1) + (token.endsWith('0') ? '1' : '0');
    expect(() => tokens.verify('purchase', 'att-1', tampered)).toThrow('Invalid file token');
    expect(() => tokens.verify('purchase', 'other-id', token)).toThrow('Invalid file token');
    expect(() => tokens.verify('service-photo', 'att-1', token)).toThrow('Invalid file token');
    expect(() => tokens.verify('purchase', 'att-1', 'garbage')).toThrow('Invalid file token');
    const expired = tokens.sign('purchase', 'att-1', -1000);
    expect(() => tokens.verify('purchase', 'att-1', expired)).toThrow('File link expired');
  });
});
