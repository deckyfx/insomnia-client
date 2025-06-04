// CHANGELOG: [2025-06-04] - Created modular template argument parsing utilities

/**
 * Parses template arguments, handling quoted and unquoted values
 * @param content - The template content between {% and %}
 * @returns Array of parsed arguments
 * @example
 * ```typescript
 * parseTemplateArguments("response 'body', 'req_123', 'path'")
 * // Returns: ["response", "body", "req_123", "path"]
 * ```
 */
export function parseTemplateArguments(content: string): string[] {
  const args: string[] = [];
  let current = "";
  let inQuotes = false;
  let quoteChar = "";
  let i = 0;

  while (i < content.length) {
    const char = content[i];

    if (!inQuotes) {
      // Not in quotes
      if (char === '"' || char === "'") {
        // Start of quoted string
        inQuotes = true;
        quoteChar = char;
      } else if (char === " " || char === ",") {
        // Delimiter - add current arg if not empty
        if (current.trim()) {
          args.push(current.trim());
          current = "";
        }
      } else {
        // Regular character
        current += char;
      }
    } else {
      // In quotes
      if (char === quoteChar) {
        // End of quoted string
        inQuotes = false;
        quoteChar = "";
      } else {
        // Character within quotes
        current += char;
      }
    }

    i++;
  }

  // Add the last argument if not empty
  if (current.trim()) {
    args.push(current.trim());
  }

  return args;
}

/**
 * Extracts and parses all templates from a string
 * @param input - The input string that may contain templates
 * @returns Array of template matches with their positions and content
 * @example
 * ```typescript
 * extractTemplates("Hello {% faker 'randomName' %} from {% response 'body', 'req_1' %}")
 * // Returns: [
 * //   { fullMatch: "{% faker 'randomName' %}", content: "faker 'randomName'", start: 6, end: 29 },
 * //   { fullMatch: "{% response 'body', 'req_1' %}", content: "response 'body', 'req_1'", start: 35, end: 66 }
 * // ]
 * ```
 */
export function extractTemplates(input: string): Array<{
  fullMatch: string;
  content: string;
  start: number;
  end: number;
}> {
  const templates: Array<{
    fullMatch: string;
    content: string;
    start: number;
    end: number;
  }> = [];
  
  // Regular expression to match any template between {% and %}
  const templateRegex = /\{\%\s*([^%]+)\s*\%\}/g;
  let match;

  while ((match = templateRegex.exec(input)) !== null) {
    const [fullMatch, templateContent] = match;
    
    if (templateContent) {
      templates.push({
        fullMatch,
        content: templateContent.trim(),
        start: match.index,
        end: match.index + fullMatch.length
      });
    }
  }

  return templates;
}