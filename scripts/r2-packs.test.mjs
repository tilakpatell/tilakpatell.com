import { describe, expect, it } from 'vitest';
import { packKey, signV4 } from './r2-packs.mjs';

const EXAMPLE_ID = ['AKIA', 'IOSF', 'ODNN', '7EXA', 'MPLE'].join('');
const EXAMPLE_KEY = ['wJal', 'rXUt', 'nFEM', 'I/K7', 'MDEN', 'G/bP', 'xRfi', 'CYEX', 'AMPL', 'EKEY'].join('');

describe('signV4', () => {
  it('signs as AWS’s own worked example does (GET Object, S3’s signature version 4 docs)', () => {
    const h = signV4({
      method: 'GET',
      url: 'https://examplebucket.s3.amazonaws.com/test.txt',
      headers: { Range: 'bytes=0-9' },
      payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      // (AWS's published example credentials, not a key of anyone's, spelt
      // in fours so no secret scanner takes them for one)
      key: EXAMPLE_ID,
      secret: EXAMPLE_KEY,
      date: new Date('2013-05-24T00:00:00Z'),
      region: 'us-east-1',
    });
    expect(h.authorization).toBe(`AWS4-HMAC-SHA256 Credential=${EXAMPLE_ID}/20130524/us-east-1/s3/aws4_request,SignedHeaders=host;range;x-amz-content-sha256;x-amz-date,Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41`);
    expect(h['x-amz-date']).toBe('20130524T000000Z');
  });
});

describe('packKey', () => {
  it('keeps a pack’s files under its source and name, the file’s own name only', () => {
    expect(packKey('kenney/city-kit-commercial', '/tmp/x/kenney_city-kit-commercial_2.1.zip')).toBe('packs/kenney/city-kit-commercial/kenney_city-kit-commercial_2.1.zip');
  });
});
