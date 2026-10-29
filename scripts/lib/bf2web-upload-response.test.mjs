import { createServer } from 'node:http';
import { expect, it } from 'vitest';
import { attemptUpload, completeUploadResponse } from './bf2web-upload-response.mjs';

const copied = '<?xml version="1.0"?><CopyObjectResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><LastModified>2026-10-29T00:00:00Z</LastModified><ETag>&quot;original-content&quot;</ETag></CopyObjectResult>';
const failed = '<Error><Code>SlowDown</Code><Message>Please retry</Message></Error>';
async function withServer(handle, run) {
  const server = createServer(handle);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}/`); }
  finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
}

it('consumes successful copy and ordinary PUT bodies', async () => {
  for (const [body, copy] of [[copied, true], ['', false], ['put response', false]]) {
    const response = new Response(body);
    await completeUploadResponse(response, { copy });
    expect(response.bodyUsed).toBe(true);
  }
  const prefixed = new Response('<s3:CopyObjectResult xmlns:s3="urn:s3"><s3:ETag>original</s3:ETag></s3:CopyObjectResult>');
  await completeUploadResponse(prefixed, { copy: true });
});

it('rejects HTTP failures and ambiguous successful copy responses after consuming them', async () => {
  const refused = new Response(failed, { status: 503 });
  await expect(completeUploadResponse(refused, { copy: true })).rejects.toThrow('HTTP 503');
  expect(refused.bodyUsed).toBe(true);
  for (const body of ['', 'not XML', '<CopyObjectResult/>', '<CopyObjectResult><ETag></ETag></CopyObjectResult>', '<CopyObjectResult><ETag>partial']) {
    const response = new Response(body);
    await expect(completeUploadResponse(response, { copy: true })).rejects.toThrow('complete result');
    expect(response.bodyUsed).toBe(true);
  }
});

it('waits for the entire actual HTTP 200 body and rejects an embedded copy error', async () => {
  let finish;
  await withServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/xml' });
    response.write('<Error>');
    finish = () => response.end('<Code>SlowDown</Code></Error>');
  }, async (url) => {
    const response = await fetch(url);
    let settled = false;
    const result = completeUploadResponse(response, { copy: true });
    result.then(() => { settled = true; }, () => { settled = true; });
    await new Promise((resolve) => setImmediate(resolve));
    expect(settled).toBe(false);
    finish();
    await expect(result).rejects.toThrow('CopyObject error: SlowDown');
    expect(response.bodyUsed).toBe(true);
  });
});

it('retries actual HTTP 200 copy errors using the existing attempt limit and delays', async () => {
  let requests = 0;
  const delays = [], responses = [];
  await withServer((_request, response) => response.end(++requests < 3 ? failed : copied), async (url) => {
    await attemptUpload('copy fixture', async () => {
      const response = await fetch(url); responses.push(response);
      await completeUploadResponse(response, { copy: true });
    }, { sleep: async (ms) => { delays.push(ms); } });
  });
  expect(requests).toBe(3);
  expect(delays).toEqual([1000, 4000]);
  expect(responses.every((response) => response.bodyUsed)).toBe(true);
});

it('retries a socket closed after success headers instead of accepting the partial copy', async () => {
  let requests = 0;
  const delays = [];
  await withServer((_request, response) => {
    if (++requests === 1) {
      response.writeHead(200, { 'content-type': 'application/xml' });
      response.write('<CopyObjectResult><ETag>truncated');
      setTimeout(() => response.destroy(), 20);
    } else response.end(copied);
  }, async (url) => {
    await attemptUpload('copy fixture', async () => {
      await completeUploadResponse(await fetch(url), { copy: true });
    }, { sleep: async (ms) => { delays.push(ms); } });
  });
  expect(requests).toBe(2);
  expect(delays).toEqual([1000]);
});

it('exhausted copy failures reject so the caller cannot continue to publish the manifest', async () => {
  let requests = 0, continued = false;
  const delays = [];
  const operation = async () => {
    await attemptUpload('copy fixture', async () => {
      requests++;
      await completeUploadResponse(new Response(failed), { copy: true });
    }, { sleep: async (ms) => { delays.push(ms); } });
    continued = true;
  };
  await expect(operation()).rejects.toThrow('copy fixture: CopyObject error: SlowDown');
  expect(requests).toBe(3);
  expect(delays).toEqual([1000, 4000]);
  expect(continued).toBe(false);
});

it('retains the transport cause code after the final retry without logging request headers', async () => {
  const failure = new Error('fetch failed', { cause: Object.assign(new Error('connection reset'), { code: 'ECONNRESET' }) });
  await expect(attemptUpload('put fixture', async () => { throw failure; }, { sleep: async () => {} }))
    .rejects.toThrow('put fixture: fetch failed [ECONNRESET]');
});
