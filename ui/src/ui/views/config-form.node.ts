import { html, nothing, type TemplateResult } from "lit";
import type { ConfigUiHints } from "../types.ts";
import {
  defaultValue,
  hintForPath,
  humanize,
  isSensitivePath,
  pathKey,
  resolveConfigImpacts,
  schemaType,
  toDocsUrl,
  type JsonSchema,
} from "./config-form.shared.ts";

const META_KEYS = new Set(["title", "description", "default", "nullable"]);

function isAnySchema(schema: JsonSchema): boolean {
  const keys = Object.keys(schema ?? {}).filter((key) => !META_KEYS.has(key));
  return keys.length === 0;
}

function jsonValue(value: unknown): string {
  if (value === undefined) {
    return "";
  }
  try {
    return JSON.stringify(value, null, 2) ?? "";
  } catch {
    return "";
  }
}

// SVG Icons as template literals
const icons = {
  chevronDown: html`
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  `,
  plus: html`
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  `,
  minus: html`
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  `,
  trash: html`
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
  `,
  edit: html`
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
  `,
};

type MapFieldGuidance = {
  addLabel: string;
  keyPlaceholder: string;
  keyHelp?: string;
};

function singularizeLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) {
    return "item";
  }
  if (trimmed.endsWith("ies") && trimmed.length > 3) {
    return `${trimmed.slice(0, -3)}y`;
  }
  if (trimmed.endsWith("s") && trimmed.length > 1) {
    return trimmed.slice(0, -1);
  }
  return trimmed;
}

function inferArrayItemTypeLabel(schema: JsonSchema): string {
  const type = schemaType(schema);
  if (type === "string") {
    return "text";
  }
  if (type === "number" || type === "integer") {
    return "number";
  }
  if (type === "boolean") {
    return "true/false";
  }
  if (type === "object") {
    return "object";
  }
  if (type === "array") {
    return "list";
  }
  if (schema.enum?.length) {
    return "one of the listed options";
  }
  return "value";
}

function inferMapFieldGuidance(
  path: Array<string | number>,
  fallbackLabel: string,
): MapFieldGuidance {
  const segments = path.filter((segment): segment is string => typeof segment === "string");
  const leaf = segments[segments.length - 1]?.toLowerCase() ?? "";
  const secondLast = segments[segments.length - 2]?.toLowerCase() ?? "";
  const channelId = segments[1]?.toLowerCase();

  if (leaf === "accounts") {
    return {
      addLabel: "Add Account",
      keyPlaceholder: "main",
      keyHelp: "Use a stable account ID key (for example: main, work, or backup).",
    };
  }
  if (leaf === "guilds") {
    return {
      addLabel: "Add Guild",
      keyPlaceholder: "123456789012345678",
      keyHelp: "Use Discord guild IDs (or configured slugs).",
    };
  }
  if (leaf === "channels" && (channelId === "discord" || secondLast === "guilds")) {
    return {
      addLabel: "Add Channel",
      keyPlaceholder: "123456789012345678",
      keyHelp: "Use Discord channel IDs.",
    };
  }
  if (leaf === "channels" && channelId === "slack") {
    return {
      addLabel: "Add Channel",
      keyPlaceholder: "C1234567890",
      keyHelp: "Use Slack channel IDs (or canonical channel keys from your config).",
    };
  }
  if (leaf === "groups" && channelId === "googlechat") {
    return {
      addLabel: "Add Space",
      keyPlaceholder: "spaces/AAAA1234",
      keyHelp: "Use Google Chat space IDs.",
    };
  }
  if (leaf === "groups") {
    return {
      addLabel: "Add Group",
      keyPlaceholder: "group-id",
      keyHelp: "Use a group/chat ID key recognized by this channel.",
    };
  }
  if (leaf === "dms") {
    return {
      addLabel: "Add DM",
      keyPlaceholder: "user-id",
      keyHelp: "Use the sender/user ID for per-DM overrides.",
    };
  }
  if (leaf === "entries") {
    return {
      addLabel: "Add Entry",
      keyPlaceholder: "plugin-id",
      keyHelp: "Use a unique entry key (for example a plugin or provider ID).",
    };
  }
  const singular = singularizeLabel(fallbackLabel);
  return {
    addLabel: `Add ${humanize(singular)}`,
    keyPlaceholder: "custom-key",
  };
}

function impactToneClass(relation: "requires" | "conflicts" | "recommends" | "risk"): string {
  if (relation === "requires" || relation === "conflicts") {
    return "danger";
  }
  if (relation === "risk") {
    return "warn";
  }
  return "info";
}

function renderFieldAssist(params: {
  path: Array<string | number>;
  hints: ConfigUiHints;
  help?: string;
  rootValue: unknown;
  disabled: boolean;
  onPatch: (path: Array<string | number>, value: unknown) => void;
}): TemplateResult | typeof nothing {
  const { path, hints, help, rootValue, disabled, onPatch } = params;
  const hint = hintForPath(path, hints);
  const docsUrl = toDocsUrl(hint?.docsPath);
  const impacts = resolveConfigImpacts({ path, hints, rootValue });
  if (!help && !docsUrl && impacts.length === 0) {
    return nothing;
  }
  return html`
    <div class="cfg-field__assist">
      ${help ? html`<div class="cfg-field__help">${help}</div>` : nothing}
      ${
        docsUrl
          ? html`
              <a
                class="cfg-field__docs"
                href=${docsUrl}
                target="_blank"
                rel="noreferrer"
                title="Open docs in a new tab"
              >
                Docs
              </a>
            `
          : nothing
      }
      ${
        impacts.length > 0
          ? html`
              <div class="cfg-impact-list">
                ${impacts.map((impact) => {
                  const docsHref = toDocsUrl(impact.docsPath);
                  return html`
                    <div class="cfg-impact cfg-impact--${impactToneClass(impact.relation)}">
                      <span>${impact.message}</span>
                      <div class="cfg-impact__actions">
                        ${
                          docsHref
                            ? html`
                                <a
                                  class="cfg-impact__link"
                                  href=${docsHref}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Guide
                                </a>
                              `
                            : nothing
                        }
                        ${
                          impact.targetPath && impact.fixValue !== undefined
                            ? html`
                                <button
                                  type="button"
                                  class="btn quiet btn--sm"
                                  ?disabled=${disabled}
                                  @click=${() => onPatch(impact.targetPath!.split("."), impact.fixValue)}
                                >
                                  ${impact.fixLabel ?? "Apply fix"}
                                </button>
                              `
                            : nothing
                        }
                      </div>
                    </div>
                  `;
                })}
              </div>
            `
          : nothing
      }
    </div>
  `;
}

export function renderNode(params: {
  schema: JsonSchema;
  value: unknown;
  rootValue: unknown;
  path: Array<string | number>;
  hints: ConfigUiHints;
  unsupported: Set<string>;
  disabled: boolean;
  showLabel?: boolean;
  onPatch: (path: Array<string | number>, value: unknown) => void;
}): TemplateResult | typeof nothing {
  const { schema, value, rootValue, path, hints, unsupported, disabled, onPatch } = params;
  const showLabel = params.showLabel ?? true;
  const type = schemaType(schema);
  const hint = hintForPath(path, hints);
  const label = hint?.label ?? schema.title ?? humanize(String(path.at(-1)));
  const help = hint?.help ?? schema.description;
  const key = pathKey(path);

  if (unsupported.has(key)) {
    return html`<div class="cfg-field cfg-field--error">
      <div class="cfg-field__label">${label}</div>
      <div class="cfg-field__error">Unsupported schema node. Use Raw mode.</div>
    </div>`;
  }

  // Handle anyOf/oneOf unions
  if (schema.anyOf || schema.oneOf) {
    const variants = schema.anyOf ?? schema.oneOf ?? [];
    const nonNull = variants.filter(
      (v) => !(v.type === "null" || (Array.isArray(v.type) && v.type.includes("null"))),
    );

    if (nonNull.length === 1) {
      return renderNode({ ...params, schema: nonNull[0] });
    }

    // Check if it's a set of literal values (enum-like)
    const extractLiteral = (v: JsonSchema): unknown => {
      if (v.const !== undefined) {
        return v.const;
      }
      if (v.enum && v.enum.length === 1) {
        return v.enum[0];
      }
      return undefined;
    };
    const literals = nonNull.map(extractLiteral);
    const allLiterals = literals.every((v) => v !== undefined);

    if (allLiterals && literals.length > 0 && literals.length <= 5) {
      // Use segmented control for small sets
      const resolvedValue = value ?? schema.default;
      const assist = renderFieldAssist({
        path,
        hints,
        help,
        rootValue,
        disabled,
        onPatch,
      });
      return html`
        <div class="cfg-field">
          ${showLabel ? html`<label class="cfg-field__label">${label}</label>` : nothing}
          ${assist}
          <div class="cfg-segmented">
            ${literals.map(
              (lit) => html`
              <button
                type="button"
                class="cfg-segmented__btn ${
                  // oxlint-disable typescript/no-base-to-string
                  lit === resolvedValue || String(lit) === String(resolvedValue) ? "active" : ""
                }"
                ?disabled=${disabled}
                @click=${() => onPatch(path, lit)}
              >
                ${
                  // oxlint-disable typescript/no-base-to-string
                  String(lit)
                }
              </button>
            `,
            )}
          </div>
        </div>
      `;
    }

    if (allLiterals && literals.length > 5) {
      // Use dropdown for larger sets
      return renderSelect({ ...params, options: literals, value: value ?? schema.default });
    }

    // Handle mixed primitive types
    const primitiveTypes = new Set(nonNull.map((variant) => schemaType(variant)).filter(Boolean));
    const normalizedTypes = new Set(
      [...primitiveTypes].map((v) => (v === "integer" ? "number" : v)),
    );

    if ([...normalizedTypes].every((v) => ["string", "number", "boolean"].includes(v as string))) {
      const hasString = normalizedTypes.has("string");
      const hasNumber = normalizedTypes.has("number");
      const hasBoolean = normalizedTypes.has("boolean");

      if (hasBoolean && normalizedTypes.size === 1) {
        return renderNode({
          ...params,
          schema: { ...schema, type: "boolean", anyOf: undefined, oneOf: undefined },
        });
      }

      if (hasString || hasNumber) {
        return renderTextInput({
          ...params,
          inputType: hasNumber && !hasString ? "number" : "text",
        });
      }
    }
  }

  // Enum - use segmented for small, dropdown for large
  if (schema.enum) {
    const options = schema.enum;
    if (options.length <= 5) {
      const resolvedValue = value ?? schema.default;
      const assist = renderFieldAssist({
        path,
        hints,
        help,
        rootValue,
        disabled,
        onPatch,
      });
      return html`
        <div class="cfg-field">
          ${showLabel ? html`<label class="cfg-field__label">${label}</label>` : nothing}
          ${assist}
          <div class="cfg-segmented">
            ${options.map(
              (opt) => html`
              <button
                type="button"
                class="cfg-segmented__btn ${opt === resolvedValue || String(opt) === String(resolvedValue) ? "active" : ""}"
                ?disabled=${disabled}
                @click=${() => onPatch(path, opt)}
              >
                ${String(opt)}
              </button>
            `,
            )}
          </div>
        </div>
      `;
    }
    return renderSelect({ ...params, options, value: value ?? schema.default });
  }

  // Object type - collapsible section
  if (type === "object") {
    return renderObject(params);
  }

  // Array type
  if (type === "array") {
    return renderArray(params);
  }

  // Boolean - toggle row
  if (type === "boolean") {
    const displayValue =
      typeof value === "boolean"
        ? value
        : typeof schema.default === "boolean"
          ? schema.default
          : false;
    const assist = renderFieldAssist({
      path,
      hints,
      help,
      rootValue,
      disabled,
      onPatch,
    });
    return html`
      <div class="cfg-field">
        <label class="cfg-toggle-row ${disabled ? "disabled" : ""}">
          <div class="cfg-toggle-row__content">
            <span class="cfg-toggle-row__label">${label}</span>
          </div>
          <div class="cfg-toggle">
            <input
              type="checkbox"
              .checked=${displayValue}
              ?disabled=${disabled}
              @change=${(e: Event) => onPatch(path, (e.target as HTMLInputElement).checked)}
            />
            <span class="cfg-toggle__track"></span>
          </div>
        </label>
        ${assist}
      </div>
    `;
  }

  // Number/Integer
  if (type === "number" || type === "integer") {
    return renderNumberInput(params);
  }

  // String
  if (type === "string") {
    return renderTextInput({ ...params, inputType: "text" });
  }

  // Fallback
  return html`
    <div class="cfg-field cfg-field--error">
      <div class="cfg-field__label">${label}</div>
      <div class="cfg-field__error">Unsupported type: ${type}. Use Raw mode.</div>
    </div>
  `;
}

function renderTextInput(params: {
  schema: JsonSchema;
  value: unknown;
  rootValue: unknown;
  path: Array<string | number>;
  hints: ConfigUiHints;
  disabled: boolean;
  showLabel?: boolean;
  inputType: "text" | "number";
  onPatch: (path: Array<string | number>, value: unknown) => void;
}): TemplateResult {
  const { schema, value, rootValue, path, hints, disabled, onPatch, inputType } = params;
  const showLabel = params.showLabel ?? true;
  const hint = hintForPath(path, hints);
  const label = hint?.label ?? schema.title ?? humanize(String(path.at(-1)));
  const help = hint?.help ?? schema.description;
  const assist = renderFieldAssist({ path, hints, help, rootValue, disabled, onPatch });
  const isSensitive = hint?.sensitive ?? isSensitivePath(path);
  const placeholder =
    hint?.placeholder ??
    // oxlint-disable typescript/no-base-to-string
    (isSensitive
      ? "••••"
      : schema.default !== undefined
        ? `Default: ${String(schema.default)}`
        : "");
  const displayValue = value ?? "";

  return html`
    <div class="cfg-field">
      ${showLabel ? html`<label class="cfg-field__label">${label}</label>` : nothing}
      ${assist}
      <div class="cfg-input-wrap">
        <input
          type=${isSensitive ? "password" : inputType}
          class="cfg-input"
          placeholder=${placeholder}
          .value=${displayValue == null ? "" : String(displayValue)}
          ?disabled=${disabled}
          @input=${(e: Event) => {
            const raw = (e.target as HTMLInputElement).value;
            if (inputType === "number") {
              if (raw.trim() === "") {
                onPatch(path, undefined);
                return;
              }
              const parsed = Number(raw);
              onPatch(path, Number.isNaN(parsed) ? raw : parsed);
              return;
            }
            onPatch(path, raw);
          }}
          @change=${(e: Event) => {
            if (inputType === "number") {
              return;
            }
            const raw = (e.target as HTMLInputElement).value;
            onPatch(path, raw.trim());
          }}
        />
        ${
          schema.default !== undefined
            ? html`
          <button
            type="button"
            class="cfg-input__reset"
            title="Reset to default"
            ?disabled=${disabled}
            @click=${() => onPatch(path, schema.default)}
          >↺</button>
        `
            : nothing
        }
      </div>
    </div>
  `;
}

function renderNumberInput(params: {
  schema: JsonSchema;
  value: unknown;
  rootValue: unknown;
  path: Array<string | number>;
  hints: ConfigUiHints;
  disabled: boolean;
  showLabel?: boolean;
  onPatch: (path: Array<string | number>, value: unknown) => void;
}): TemplateResult {
  const { schema, value, rootValue, path, hints, disabled, onPatch } = params;
  const showLabel = params.showLabel ?? true;
  const hint = hintForPath(path, hints);
  const label = hint?.label ?? schema.title ?? humanize(String(path.at(-1)));
  const help = hint?.help ?? schema.description;
  const assist = renderFieldAssist({ path, hints, help, rootValue, disabled, onPatch });
  const displayValue = value ?? schema.default ?? "";
  const numValue = typeof displayValue === "number" ? displayValue : 0;

  return html`
    <div class="cfg-field">
      ${showLabel ? html`<label class="cfg-field__label">${label}</label>` : nothing}
      ${assist}
      <div class="cfg-number">
        <button
          type="button"
          class="cfg-number__btn"
          ?disabled=${disabled}
          @click=${() => onPatch(path, numValue - 1)}
        >−</button>
        <input
          type="number"
          class="cfg-number__input"
          .value=${displayValue == null ? "" : String(displayValue)}
          ?disabled=${disabled}
          @input=${(e: Event) => {
            const raw = (e.target as HTMLInputElement).value;
            const parsed = raw === "" ? undefined : Number(raw);
            onPatch(path, parsed);
          }}
        />
        <button
          type="button"
          class="cfg-number__btn"
          ?disabled=${disabled}
          @click=${() => onPatch(path, numValue + 1)}
        >+</button>
      </div>
    </div>
  `;
}

function renderSelect(params: {
  schema: JsonSchema;
  value: unknown;
  rootValue: unknown;
  path: Array<string | number>;
  hints: ConfigUiHints;
  disabled: boolean;
  showLabel?: boolean;
  options: unknown[];
  onPatch: (path: Array<string | number>, value: unknown) => void;
}): TemplateResult {
  const { schema, value, rootValue, path, hints, disabled, options, onPatch } = params;
  const showLabel = params.showLabel ?? true;
  const hint = hintForPath(path, hints);
  const label = hint?.label ?? schema.title ?? humanize(String(path.at(-1)));
  const help = hint?.help ?? schema.description;
  const assist = renderFieldAssist({ path, hints, help, rootValue, disabled, onPatch });
  const resolvedValue = value ?? schema.default;
  const currentIndex = options.findIndex(
    (opt) => opt === resolvedValue || String(opt) === String(resolvedValue),
  );
  const unset = "__unset__";

  return html`
    <div class="cfg-field">
      ${showLabel ? html`<label class="cfg-field__label">${label}</label>` : nothing}
      ${assist}
      <select
        class="cfg-select"
        ?disabled=${disabled}
        .value=${currentIndex >= 0 ? String(currentIndex) : unset}
        @change=${(e: Event) => {
          const val = (e.target as HTMLSelectElement).value;
          onPatch(path, val === unset ? undefined : options[Number(val)]);
        }}
      >
        <option value=${unset}>Select...</option>
        ${options.map(
          (opt, idx) => html`
          <option value=${String(idx)}>${String(opt)}</option>
        `,
        )}
      </select>
    </div>
  `;
}

type ObjectEntry = [string, JsonSchema];

function renderObjectFields(params: {
  entries: ObjectEntry[];
  obj: Record<string, unknown>;
  rootValue: unknown;
  path: Array<string | number>;
  hints: ConfigUiHints;
  unsupported: Set<string>;
  disabled: boolean;
  onPatch: (path: Array<string | number>, value: unknown) => void;
}): TemplateResult {
  const { entries, obj, rootValue, path, hints, unsupported, disabled, onPatch } = params;
  const groups: Array<{ label: string; advanced: boolean; entries: ObjectEntry[] }> = [];
  const indexByKey = new Map<string, number>();

  for (const entry of entries) {
    const [propKey] = entry;
    const propHint = hintForPath([...path, propKey], hints);
    const rawGroup = propHint?.group?.trim();
    const groupLabel =
      rawGroup && rawGroup.length > 0 ? rawGroup : propHint?.advanced ? "Advanced" : "General";
    const advanced = propHint?.advanced === true || groupLabel.toLowerCase() === "advanced";
    const groupKey = `${advanced ? "1" : "0"}:${groupLabel.toLowerCase()}`;
    const existingIndex = indexByKey.get(groupKey);
    if (existingIndex != null) {
      groups[existingIndex]?.entries.push(entry);
      continue;
    }
    indexByKey.set(groupKey, groups.length);
    groups.push({
      label: groupLabel,
      advanced,
      entries: [entry],
    });
  }

  const useGroupedPresentation =
    groups.length > 1 || groups.some((group) => group.advanced || group.label !== "General");

  if (!useGroupedPresentation) {
    const fallbackEntries = groups[0]?.entries ?? entries;
    return html`${fallbackEntries.map(([propKey, node]) =>
      renderNode({
        schema: node,
        value: obj[propKey],
        rootValue,
        path: [...path, propKey],
        hints,
        unsupported,
        disabled,
        onPatch,
      }),
    )}`;
  }

  return html`
    ${groups.map((group) => {
      const body = html`
        <div class="cfg-group__body">
          ${group.entries.map(([propKey, node]) =>
            renderNode({
              schema: node,
              value: obj[propKey],
              rootValue,
              path: [...path, propKey],
              hints,
              unsupported,
              disabled,
              onPatch,
            }),
          )}
        </div>
      `;

      if (group.advanced) {
        return html`
          <details class="cfg-group cfg-group--advanced">
            <summary>${group.label}</summary>
            ${body}
          </details>
        `;
      }

      return html`
        <section class="cfg-group">
          ${group.label !== "General" ? html`<h4 class="cfg-group__title">${group.label}</h4>` : nothing}
          ${body}
        </section>
      `;
    })}
  `;
}

function renderObject(params: {
  schema: JsonSchema;
  value: unknown;
  rootValue: unknown;
  path: Array<string | number>;
  hints: ConfigUiHints;
  unsupported: Set<string>;
  disabled: boolean;
  showLabel?: boolean;
  onPatch: (path: Array<string | number>, value: unknown) => void;
}): TemplateResult {
  const { schema, value, rootValue, path, hints, unsupported, disabled, onPatch } = params;
  const hint = hintForPath(path, hints);
  const label = hint?.label ?? schema.title ?? humanize(String(path.at(-1)));
  const help = hint?.help ?? schema.description;

  const fallback = value ?? schema.default;
  const obj =
    fallback && typeof fallback === "object" && !Array.isArray(fallback)
      ? (fallback as Record<string, unknown>)
      : {};
  const props = schema.properties ?? {};
  const entries = Object.entries(props);

  // Sort by hint order
  const sorted = entries.toSorted((a, b) => {
    const orderA = hintForPath([...path, a[0]], hints)?.order ?? 0;
    const orderB = hintForPath([...path, b[0]], hints)?.order ?? 0;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a[0].localeCompare(b[0]);
  });

  const reserved = new Set(Object.keys(props));
  const additional = schema.additionalProperties;
  const allowExtra = Boolean(additional) && typeof additional === "object";

  // For top-level, don't wrap in collapsible
  if (path.length === 1) {
    return html`
      <div class="cfg-fields">
        ${renderObjectFields({
          entries: sorted,
          obj,
          rootValue,
          path,
          hints,
          unsupported,
          disabled,
          onPatch,
        })}
        ${
          allowExtra
            ? renderMapField({
                schema: additional,
                value: obj,
                rootValue,
                path,
                hints,
                unsupported,
                disabled,
                reservedKeys: reserved,
                onPatch,
              })
            : nothing
        }
      </div>
    `;
  }

  // Nested objects get collapsible treatment
  const defaultOpen = path.length <= 2 && hint?.advanced !== true;
  return html`
    <details class="cfg-object" ?open=${defaultOpen}>
      <summary class="cfg-object__header">
        <span class="cfg-object__title">${label}</span>
        <span class="cfg-object__chevron">${icons.chevronDown}</span>
      </summary>
      ${help ? html`<div class="cfg-object__help">${help}</div>` : nothing}
      <div class="cfg-object__content">
        ${renderObjectFields({
          entries: sorted,
          obj,
          rootValue,
          path,
          hints,
          unsupported,
          disabled,
          onPatch,
        })}
        ${
          allowExtra
            ? renderMapField({
                schema: additional,
                value: obj,
                rootValue,
                path,
                hints,
                unsupported,
                disabled,
                reservedKeys: reserved,
                onPatch,
              })
            : nothing
        }
      </div>
    </details>
  `;
}

function renderArray(params: {
  schema: JsonSchema;
  value: unknown;
  rootValue: unknown;
  path: Array<string | number>;
  hints: ConfigUiHints;
  unsupported: Set<string>;
  disabled: boolean;
  showLabel?: boolean;
  onPatch: (path: Array<string | number>, value: unknown) => void;
}): TemplateResult {
  const { schema, value, rootValue, path, hints, unsupported, disabled, onPatch } = params;
  const showLabel = params.showLabel ?? true;
  const hint = hintForPath(path, hints);
  const label = hint?.label ?? schema.title ?? humanize(String(path.at(-1)));
  const help = hint?.help ?? schema.description;
  const assist = renderFieldAssist({ path, hints, help, rootValue, disabled, onPatch });

  const itemsSchema = Array.isArray(schema.items) ? schema.items[0] : schema.items;
  if (!itemsSchema) {
    return html`
      <div class="cfg-field cfg-field--error">
        <div class="cfg-field__label">${label}</div>
        <div class="cfg-field__error">Unsupported array schema. Use Raw mode.</div>
      </div>
    `;
  }

  const arr = Array.isArray(value) ? value : Array.isArray(schema.default) ? schema.default : [];
  const singularLabel = singularizeLabel(label);
  const addLabel = `Add ${humanize(singularLabel)}`;
  const itemTypeLabel = inferArrayItemTypeLabel(itemsSchema);

  return html`
    <div class="cfg-array">
      <div class="cfg-array__header">
        ${showLabel ? html`<span class="cfg-array__label">${label}</span>` : nothing}
        <span class="cfg-array__count">${arr.length} item${arr.length !== 1 ? "s" : ""}</span>
        <button
          type="button"
          class="cfg-array__add"
          ?disabled=${disabled}
          @click=${() => {
            const next = [...arr, defaultValue(itemsSchema)];
            onPatch(path, next);
          }}
        >
          <span class="cfg-array__add-icon">${icons.plus}</span>
          ${addLabel}
        </button>
      </div>
      ${assist}
      <div class="cfg-array__meta">Each ${singularLabel.toLowerCase()} expects ${itemTypeLabel}.</div>

      ${
        arr.length === 0
          ? html`
              <div class="cfg-array__empty">No ${label.toLowerCase()} configured yet.</div>
            `
          : html`
        <div class="cfg-array__items">
          ${arr.map(
            (item, idx) => html`
            <div class="cfg-array__item">
              <div class="cfg-array__item-header">
                <span class="cfg-array__item-index">#${idx + 1} ${singularLabel.toLowerCase()}</span>
                <button
                  type="button"
                  class="cfg-array__item-remove"
                  title="Remove item"
                  ?disabled=${disabled}
                  @click=${() => {
                    const next = [...arr];
                    next.splice(idx, 1);
                    onPatch(path, next);
                  }}
                >
                  ${icons.trash}
                </button>
              </div>
              <div class="cfg-array__item-content">
                ${renderNode({
                  schema: itemsSchema,
                  value: item,
                  rootValue,
                  path: [...path, idx],
                  hints,
                  unsupported,
                  disabled,
                  showLabel: false,
                  onPatch,
                })}
              </div>
            </div>
          `,
          )}
        </div>
      `
      }
    </div>
  `;
}

function renderMapField(params: {
  schema: JsonSchema;
  value: Record<string, unknown>;
  rootValue: unknown;
  path: Array<string | number>;
  hints: ConfigUiHints;
  unsupported: Set<string>;
  disabled: boolean;
  reservedKeys: Set<string>;
  onPatch: (path: Array<string | number>, value: unknown) => void;
}): TemplateResult {
  const { schema, value, rootValue, path, hints, unsupported, disabled, reservedKeys, onPatch } =
    params;
  const hint = hintForPath(path, hints);
  const label = hint?.label ?? "Custom entries";
  const help = hint?.help;
  const assist = renderFieldAssist({ path, hints, help, rootValue, disabled, onPatch });
  const anySchema = isAnySchema(schema);
  const entries = Object.entries(value ?? {}).filter(([key]) => !reservedKeys.has(key));
  const guidance = inferMapFieldGuidance(path, label);
  const mapValueType = inferArrayItemTypeLabel(schema);

  return html`
    <div class="cfg-map">
      <div class="cfg-map__header">
        <span class="cfg-map__label">${label}</span>
        <button
          type="button"
          class="cfg-map__add"
          ?disabled=${disabled}
          @click=${() => {
            const next = { ...value };
            let index = 1;
            let key = `custom-${index}`;
            while (key in next) {
              index += 1;
              key = `custom-${index}`;
            }
            next[key] = anySchema ? {} : defaultValue(schema);
            onPatch(path, next);
          }}
        >
          <span class="cfg-map__add-icon">${icons.plus}</span>
          ${guidance.addLabel}
        </button>
      </div>
      ${assist}
      ${
        guidance.keyHelp
          ? html`<div class="cfg-map__meta">${guidance.keyHelp}</div>`
          : html`<div class="cfg-map__meta">Value type: ${mapValueType}.</div>`
      }

      ${
        entries.length === 0
          ? html`
              <div class="cfg-map__empty">No ${label.toLowerCase()} configured yet.</div>
            `
          : html`
        <div class="cfg-map__items">
          ${entries.map(([key, entryValue]) => {
            const valuePath = [...path, key];
            const fallback = jsonValue(entryValue);
            return html`
              <div class="cfg-map__item">
                <div class="cfg-map__item-key">
                  <input
                    type="text"
                    class="cfg-input cfg-input--sm"
                    placeholder=${guidance.keyPlaceholder}
                    .value=${key}
                    ?disabled=${disabled}
                    @change=${(e: Event) => {
                      const nextKey = (e.target as HTMLInputElement).value.trim();
                      if (!nextKey || nextKey === key) {
                        return;
                      }
                      const next = { ...value };
                      if (nextKey in next) {
                        return;
                      }
                      next[nextKey] = next[key];
                      delete next[key];
                      onPatch(path, next);
                    }}
                  />
                </div>
                <div class="cfg-map__item-value">
                  ${
                    anySchema
                      ? html`
                        <textarea
                          class="cfg-textarea cfg-textarea--sm"
                          placeholder="JSON value"
                          rows="2"
                          .value=${fallback}
                          ?disabled=${disabled}
                          @change=${(e: Event) => {
                            const target = e.target as HTMLTextAreaElement;
                            const raw = target.value.trim();
                            if (!raw) {
                              onPatch(valuePath, undefined);
                              return;
                            }
                            try {
                              onPatch(valuePath, JSON.parse(raw));
                            } catch {
                              target.value = fallback;
                            }
                          }}
                        ></textarea>
                      `
                      : renderNode({
                          schema,
                          value: entryValue,
                          rootValue,
                          path: valuePath,
                          hints,
                          unsupported,
                          disabled,
                          showLabel: false,
                          onPatch,
                        })
                  }
                </div>
                <button
                  type="button"
                  class="cfg-map__item-remove"
                  title="Remove entry"
                  ?disabled=${disabled}
                  @click=${() => {
                    const next = { ...value };
                    delete next[key];
                    onPatch(path, next);
                  }}
                >
                  ${icons.trash}
                </button>
              </div>
            `;
          })}
        </div>
      `
      }
    </div>
  `;
}
