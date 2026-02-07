import type { ConfigUiHintImpact, ConfigUiHints } from "../types.ts";

export type JsonSchema = {
  type?: string | string[];
  title?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema | JsonSchema[];
  additionalProperties?: JsonSchema | boolean;
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  nullable?: boolean;
};

export function schemaType(schema: JsonSchema): string | undefined {
  if (!schema) {
    return undefined;
  }
  if (Array.isArray(schema.type)) {
    const filtered = schema.type.filter((t) => t !== "null");
    return filtered[0] ?? schema.type[0];
  }
  return schema.type;
}

export function defaultValue(schema?: JsonSchema): unknown {
  if (!schema) {
    return "";
  }
  if (schema.default !== undefined) {
    return schema.default;
  }
  const type = schemaType(schema);
  switch (type) {
    case "object":
      return {};
    case "array":
      return [];
    case "boolean":
      return false;
    case "number":
    case "integer":
      return 0;
    case "string":
      return "";
    default:
      return "";
  }
}

export function pathKey(path: Array<string | number>): string {
  return path.filter((segment) => typeof segment === "string").join(".");
}

export function hintForPath(path: Array<string | number>, hints: ConfigUiHints) {
  const key = pathKey(path);
  const direct = hints[key];
  if (direct) {
    return direct;
  }
  const segments = key.split(".");
  for (const [hintKey, hint] of Object.entries(hints)) {
    if (!hintKey.includes("*")) {
      continue;
    }
    const hintSegments = hintKey.split(".");
    if (hintSegments.length !== segments.length) {
      continue;
    }
    let match = true;
    for (let i = 0; i < segments.length; i += 1) {
      if (hintSegments[i] !== "*" && hintSegments[i] !== segments[i]) {
        match = false;
        break;
      }
    }
    if (match) {
      return hint;
    }
  }
  return undefined;
}

export function humanize(raw: string) {
  return raw
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .replace(/^./, (m) => m.toUpperCase());
}

export function isSensitivePath(path: Array<string | number>): boolean {
  const key = pathKey(path).toLowerCase();
  return (
    key.includes("token") ||
    key.includes("password") ||
    key.includes("secret") ||
    key.includes("apikey") ||
    key.endsWith("key")
  );
}

type ImpactCheck = NonNullable<ConfigUiHintImpact["when"]>;

export type ResolvedConfigImpact = {
  relation: NonNullable<ConfigUiHintImpact["relation"]>;
  message: string;
  docsPath?: string;
  targetPath?: string;
  fixValue?: unknown;
  fixLabel?: string;
};

function splitPath(path: string): string[] {
  return path
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function getValueAtPath(value: unknown, path: string[]): unknown {
  let cursor = value;
  for (const segment of path) {
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

function resolveWildcardPath(path: string, sourcePath: Array<string | number>): string[] {
  const sourceSegments = sourcePath.filter(
    (segment): segment is string => typeof segment === "string",
  );
  return splitPath(path).map((segment, index) => {
    if (segment !== "*") {
      return segment;
    }
    return sourceSegments[index] ?? segment;
  });
}

function isEqual(lhs: unknown, rhs: unknown): boolean {
  if (Object.is(lhs, rhs)) {
    return true;
  }
  if (
    lhs == null ||
    rhs == null ||
    typeof lhs === "function" ||
    typeof rhs === "function" ||
    typeof lhs === "symbol" ||
    typeof rhs === "symbol"
  ) {
    return false;
  }
  try {
    return JSON.stringify(lhs) === JSON.stringify(rhs);
  } catch {
    return false;
  }
}

function evaluateCheck(value: unknown, check: ImpactCheck, expected?: unknown): boolean {
  switch (check) {
    case "truthy":
      return Boolean(value);
    case "falsy":
      return !value;
    case "defined":
      return value !== undefined && value !== null && value !== "";
    case "notDefined":
      return value === undefined || value === null || value === "";
    case "equals":
      return isEqual(value, expected);
    case "notEquals":
      return !isEqual(value, expected);
    case "includes":
      if (typeof value === "string") {
        return typeof expected === "string" && value.includes(expected);
      }
      if (Array.isArray(value)) {
        return value.some((entry) => isEqual(entry, expected));
      }
      return false;
    default:
      return false;
  }
}

function relationForImpact(
  impact: ConfigUiHintImpact,
): NonNullable<ConfigUiHintImpact["relation"]> {
  return impact.relation ?? "requires";
}

function sourceCheckForImpact(impact: ConfigUiHintImpact): ImpactCheck {
  if (impact.when) {
    return impact.when;
  }
  if (impact.whenValue !== undefined) {
    return "equals";
  }
  return "truthy";
}

function targetCheckForImpact(impact: ConfigUiHintImpact): ImpactCheck {
  if (impact.targetWhen) {
    return impact.targetWhen;
  }
  if (impact.targetValue !== undefined) {
    return "equals";
  }
  return "truthy";
}

export function resolveConfigImpacts(params: {
  path: Array<string | number>;
  hints: ConfigUiHints;
  rootValue: unknown;
}): ResolvedConfigImpact[] {
  const { path, hints, rootValue } = params;
  const hint = hintForPath(path, hints);
  const impacts = hint?.impacts ?? [];
  if (impacts.length === 0) {
    return [];
  }
  const sourceValue = getValueAtPath(
    rootValue,
    path.filter((segment): segment is string => typeof segment === "string"),
  );
  const resolved: ResolvedConfigImpact[] = [];

  for (const impact of impacts) {
    const relation = relationForImpact(impact);
    const sourceCheck = sourceCheckForImpact(impact);
    if (!evaluateCheck(sourceValue, sourceCheck, impact.whenValue)) {
      continue;
    }

    const targetPathSegments = impact.targetPath
      ? resolveWildcardPath(impact.targetPath, path)
      : null;
    if (targetPathSegments?.includes("*")) {
      continue;
    }
    const targetValue = targetPathSegments
      ? getValueAtPath(rootValue, targetPathSegments)
      : undefined;
    const targetCheck = targetCheckForImpact(impact);
    const targetMatches = targetPathSegments
      ? evaluateCheck(targetValue, targetCheck, impact.targetValue)
      : false;

    const active =
      relation === "risk"
        ? true
        : relation === "conflicts"
          ? Boolean(targetPathSegments) && targetMatches
          : !targetPathSegments || !targetMatches;

    if (!active) {
      continue;
    }

    resolved.push({
      relation,
      message: impact.message,
      ...(impact.docsPath ? { docsPath: impact.docsPath } : {}),
      ...(targetPathSegments ? { targetPath: targetPathSegments.join(".") } : {}),
      ...(impact.fixValue !== undefined ? { fixValue: impact.fixValue } : {}),
      ...(impact.fixLabel ? { fixLabel: impact.fixLabel } : {}),
    });
  }

  return resolved;
}

export function toDocsUrl(path?: string): string | null {
  const raw = path?.trim();
  if (!raw) {
    return null;
  }
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }
  if (!raw.startsWith("/")) {
    return `https://docs.openclaw.ai/${raw}`;
  }
  return `https://docs.openclaw.ai${raw}`;
}
