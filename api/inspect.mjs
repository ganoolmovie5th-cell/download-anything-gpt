import { guard, failure } from '../lib/api.mjs';
import { inspectUrl } from '../lib/inspect.mjs';
export default async function handler(req, res) {
  try { res.status(200).json(await inspectUrl(guard(req, res))); }
  catch (error) { failure(res, error); }
}
