/**
 * Request/response helpers that keep the HTTP contract of the ASP.NET Core
 * backend: case-insensitive JSON property binding, numbers accepted as numbers
 * or numeric strings, and RFC 9110 problem-details bodies for bad input.
 */

export class ValidationError extends Error {
  constructor(field, message) {
    super(message);
    this.field = field;
  }
}

export function problem(status, title, errors) {
  const body = {
    type: status === 400
      ? 'https://tools.ietf.org/html/rfc9110#section-15.5.1'
      : `https://tools.ietf.org/html/rfc9110#section-15.5.${status - 399}`,
    title,
    status,
  };
  if (errors) body.errors = errors;
  return body;
}

export const validationProblem = (field, message) =>
  problem(400, 'One or more validation errors occurred.', { [field]: [message] });

const isBlankString = (v) => v == null || String(v).trim() === '';
export const isBlank = isBlankString;

const NUMERIC = /^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?\s*$/;

function toNumber(name, v) {
  if (v == null) return 0;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && NUMERIC.test(v)) return Number(v);
  throw new ValidationError(`$.${name}`, `The JSON value could not be converted to System.Decimal. Path: $.${name}`);
}

/** Typed, case-insensitive view of a JSON request body. */
export function bodyOf(req) {
  const src = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const fields = new Map(Object.entries(src).map(([k, v]) => [k.toLowerCase(), v]));
  const get = (name) => fields.get(name.toLowerCase());

  return {
    /** string | null */
    str(name) {
      const v = get(name);
      if (v == null) return null;
      if (typeof v !== 'string')
        throw new ValidationError(`$.${name}`, `The JSON value could not be converted to System.String. Path: $.${name}`);
      return v;
    },
    /** number (missing -> 0) */
    num(name) {
      return toNumber(name, get(name));
    },
    /** integer (missing -> 0) */
    long(name) {
      const n = toNumber(name, get(name));
      if (!Number.isInteger(n))
        throw new ValidationError(`$.${name}`, `The JSON value could not be converted to System.Int64. Path: $.${name}`);
      return n;
    },
    /** boolean (missing -> false) */
    bool(name) {
      const v = get(name);
      if (v == null) return false;
      if (typeof v !== 'boolean')
        throw new ValidationError(`$.${name}`, `The JSON value could not be converted to System.Boolean. Path: $.${name}`);
      return v;
    },
  };
}

/**
 * router.param handler that only lets integer ids through (like the
 * {id:long} route constraint); anything else falls through to a 404.
 */
export function longParam(req, res, next, value, name) {
  if (!/^-?\d{1,18}$/.test(value)) return next('route');
  req.params[name] = Number(value);
  next();
}
