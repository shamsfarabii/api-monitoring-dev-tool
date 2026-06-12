import type { Field } from "../format/fields";

export function renderPlain(fields: Field[]): string {
  const parts: string[] = [];

  for (const field of fields) {
    if (field.kind === "inline") {
      parts.push(`${field.label}: ${field.value}`);
    } else {
      const indented = field.body
        .split("\n")
        .map((line) => `\t${line}`)
        .join("\n");
      parts.push(`${field.label}:\n${indented}`);
    }
  }

  return parts.join("\n");
}
