// S3 CopyObject may report an error inside HTTP 200. Read the complete body
// before accepting a copy, also releasing Node fetch's connection for reuse.
// https://docs.aws.amazon.com/AmazonS3/latest/API/API_CopyObject.html
export async function completeUploadResponse(response, { copy = false } = {}) {
  const body = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status} ${body.slice(0, 200)}`);
  if (!copy) return;
  if (/<(?:[\w.-]+:)?Error(?:\s|>)/.test(body)) {
    const code = /<(?:[\w.-]+:)?Code>\s*([\w.-]+)\s*<\//.exec(body)?.[1] ?? 'unknown';
    throw new Error(`CopyObject error: ${code}`);
  }
  const result = /^\s*(?:<\?xml[^?]*\?>\s*)?<((?:[\w.-]+:)?CopyObjectResult)(?:\s[^<>]*)?>([\s\S]*)<\/\1\s*>\s*$/.exec(body);
  if (!result || !/<((?:[\w.-]+:)?ETag)(?:\s[^<>]*)?>\s*[^<\s][^<]*<\/\1\s*>/.test(result[2])) {
    throw new Error('CopyObject did not return a complete result with an ETag');
  }
}

// Preserve the uploader's three attempts and its one/four second delays.
export async function attemptUpload(what, fn, { sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  for (let n = 1; ; n++) {
    try {
      return await fn();
    } catch (error) {
      if (n === 3) {
        const code = error.cause?.code ?? error.code;
        const detail = typeof code === 'string' && /^[A-Z0-9_]{1,80}$/.test(code) ? ` [${code}]` : '';
        throw new Error(`${what}: ${error.message}${detail}`);
      }
      await sleep(1000 * 4 ** (n - 1));
    }
  }
}
