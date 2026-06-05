import logger from "./logger.js";

export async function withRetry(fn, { attempts = 3, baseDelayMs = 1000, label = 'operation' } = {}) {
  let lastError;
 
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === attempts) break;
 
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      logger.warn(`[retry] ${label} failed (attempt ${attempt}/${attempts}), retrying in ${delay}ms`, {
        error: err.message,
      });
      await sleep(delay);
    }
  }
 
  throw new Error(`[retry] ${label} failed after ${attempts} attempts: ${lastError.message}`);
}
 
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));