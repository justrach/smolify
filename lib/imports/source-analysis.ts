export type SourceDefinition = {
  name: string;
  kind: string;
  line: number;
  endLine: number;
  exported: boolean;
  callable: boolean;
};

export type SourceImport = {
  symbol: string;
  imported: string;
  module: string;
  line: number;
  endLine: number;
};

export type SourceCall = {
  name: string;
  line: number;
  scopeName: string | null;
  scopeKind: string | null;
  scopeStartLine: number | null;
  scopeEndLine: number | null;
};

export type AnalyzedOccurrence = {
  symbol: string;
  line: number;
  kind: "declaration" | "import" | "reference";
  scopeName: string | null;
  scopeKind: string | null;
  scopeStartLine: number | null;
  scopeEndLine: number | null;
};

const CONTROL_WORDS = new Set([
  "await", "catch", "else", "filter", "finally", "for", "forEach", "function", "if",
  "import", "map", "new", "reduce", "require", "return", "super", "switch", "then",
  "throw", "typeof", "while",
]);

function lineNumberAt(value: string, offset: number) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (value.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

function importedNames(clause: string) {
  const names: Array<{ symbol: string; imported: string }> = [];
  const braces = clause.match(/\{([\s\S]*?)\}/)?.[1];
  if (braces) {
    for (const part of braces.split(",")) {
      const cleaned = part.trim().replace(/^type\s+/, "");
      if (!cleaned) continue;
      const [imported, local] = cleaned.split(/\s+as\s+/);
      if (/^[A-Za-z_$][\w$]*$/.test(imported)) {
        names.push({ imported, symbol: local?.trim() || imported });
      }
    }
  }
  const prefix = clause.split("{")[0].replace(/,\s*$/, "").trim();
  if (/^[A-Za-z_$][\w$]*$/.test(prefix)) names.push({ imported: "default", symbol: prefix });
  return names;
}

function sourceImports(content: string, path: string): SourceImport[] {
  const imports: SourceImport[] = [];
  if (/\.[cm]?[jt]sx?$/i.test(path)) {
    for (const match of content.matchAll(/\bimport\s+(?:type\s+)?([\s\S]*?)\s+from\s*["']([^"']+)["']/g)) {
      const line = lineNumberAt(content, match.index ?? 0);
      const endLine = line + (match[0].match(/\n/g)?.length ?? 0);
      for (const name of importedNames(match[1])) {
        imports.push({ ...name, module: match[2], line, endLine });
      }
    }
    for (const match of content.matchAll(/\bimport\s*["']([^"']+)["']/g)) {
      const line = lineNumberAt(content, match.index ?? 0);
      imports.push({ symbol: "*", imported: "*", module: match[1], line, endLine: line });
    }
  } else if (/\.py$/i.test(path)) {
    for (const match of content.matchAll(/^\s*from\s+([\w.]+)\s+import\s+([^\n#]+)/gm)) {
      const line = lineNumberAt(content, match.index ?? 0);
      for (const part of match[2].split(",")) {
        const [imported, local] = part.trim().split(/\s+as\s+/);
        if (/^[A-Za-z_][\w]*$/.test(imported)) {
          imports.push({ symbol: local || imported, imported, module: match[1], line, endLine: line });
        }
      }
    }
  }
  return imports;
}

export function maskSourceForStructure(content: string, path: string) {
  type State = "code" | "block-comment" | "single" | "double" | "template" | "regex" | "triple-single" | "triple-double";
  let state: State = "code";
  let escaped = false;
  let output = "";
  const hashComments = /\.(?:py|rb)$/i.test(path);
  const regexLanguage = /\.[cm]?[jt]sx?$/i.test(path);
  let previousCode = "";

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const next = content[index + 1];
    if (character === "\n") {
      output += "\n";
      if (!["block-comment", "template", "triple-single", "triple-double"].includes(state)) state = "code";
      escaped = false;
      previousCode = "";
      continue;
    }
    if (state === "block-comment") {
      if (character === "*" && next === "/") {
        output += "  ";
        index += 1;
        state = "code";
      } else output += " ";
      continue;
    }
    if (state !== "code") {
      output += " ";
      if (
        (state === "triple-single" && content.slice(index, index + 3) === "'''")
        || (state === "triple-double" && content.slice(index, index + 3) === '\"\"\"')
      ) {
        output += "  ";
        index += 2;
        state = "code";
        continue;
      }
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (
        (state === "single" && character === "'")
        || (state === "double" && character === '"')
        || (state === "template" && character === "`")
        || (state === "regex" && character === "/")
      ) state = "code";
      continue;
    }
    if (hashComments && character === "#") {
      const end = content.indexOf("\n", index);
      const length = (end === -1 ? content.length : end) - index;
      output += " ".repeat(length);
      index += length - 1;
    } else if (character === "/" && next === "*") {
      output += "  ";
      index += 1;
      state = "block-comment";
    } else if (character === "/" && next === "/") {
      const end = content.indexOf("\n", index);
      const length = (end === -1 ? content.length : end) - index;
      output += " ".repeat(length);
      index += length - 1;
    } else if (content.slice(index, index + 3) === "'''") {
      output += "   ";
      index += 2;
      state = "triple-single";
    } else if (content.slice(index, index + 3) === '\"\"\"') {
      output += "   ";
      index += 2;
      state = "triple-double";
    } else if (character === "'") {
      output += " ";
      state = "single";
    } else if (character === '"') {
      output += " ";
      state = "double";
    } else if (character === "`") {
      output += " ";
      state = "template";
    } else if (
      regexLanguage
      && character === "/"
      && /[=(:,!&|?{\[;]/.test(previousCode || "=")
    ) {
      output += " ";
      state = "regex";
    } else {
      output += character;
      if (!/\s/.test(character)) previousCode = character;
    }
  }
  return output;
}

function declarationAt(line: string, lineNumber: number): Omit<SourceDefinition, "endLine"> | null {
  const javascript = line.match(/^\s*(export\s+)?(?:default\s+)?(?:declare\s+)?(?:async\s+)?(function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/);
  if (javascript) {
    return {
      name: javascript[3], kind: javascript[2], line: lineNumber,
      exported: Boolean(javascript[1]), callable: javascript[2] === "function",
    };
  }
  const variable = line.match(/^\s*(export\s+)?(?:declare\s+)?(const|let|var)\s+([A-Za-z_$][\w$]*)/);
  if (variable) {
    return {
      name: variable[3], kind: variable[2], line: lineNumber,
      exported: Boolean(variable[1]), callable: /=>/.test(line),
    };
  }
  const python = line.match(/^\s*(?:async\s+)?(def|class)\s+([A-Za-z_][\w]*)/);
  if (python) return { name: python[2], kind: python[1], line: lineNumber, exported: false, callable: python[1] === "def" };
  const rust = line.match(/^\s*(pub(?:\([^)]*\))?\s+)?(?:async\s+)?(fn|struct|enum|trait|type|const|static)\s+([A-Za-z_][\w]*)/);
  if (rust) return { name: rust[3], kind: rust[2], line: lineNumber, exported: Boolean(rust[1]), callable: rust[2] === "fn" };
  const go = line.match(/^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z_][\w]*)/);
  if (go) return { name: go[1], kind: "function", line: lineNumber, exported: /^[A-Z]/.test(go[1]), callable: true };
  const nominal = line.match(/^\s*(?:(?:public|private|protected|internal|static|final|abstract|sealed|open|data)\s+)*(class|interface|enum|record|struct)\s+([A-Za-z_][\w]*)/);
  if (nominal) return { name: nominal[2], kind: nominal[1], line: lineNumber, exported: /\bpublic\b/.test(line), callable: false };
  const method = line.match(/^\s*(?:(?:public|private|protected|internal|static|final|abstract|override|virtual|async)\s+)*(?:[A-Za-z_$][\w$<>,.?\[\] ]+\s+)?([A-Za-z_$][\w$]*)\s*\([^;]*\)\s*(?::[^={]+)?\s*\{/);
  if (method && !CONTROL_WORDS.has(method[1])) {
    return { name: method[1], kind: "method", line: lineNumber, exported: /\bpublic\b/.test(line), callable: true };
  }
  return null;
}

function braceScopeEnd(lines: string[], startIndex: number) {
  let depth = 0;
  let sawBrace = false;
  for (let index = startIndex; index < lines.length; index += 1) {
    for (const character of lines[index]) {
      if (character === "{") {
        sawBrace = true;
        depth += 1;
      } else if (character === "}" && sawBrace) depth -= 1;
    }
    if (sawBrace && depth <= 0) return index + 1;
  }
  return Math.min(lines.length, startIndex + 200) || 1;
}

function indentationScopeEnd(lines: string[], startIndex: number) {
  const indentation = lines[startIndex].match(/^\s*/)?.[0].length ?? 0;
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (!lines[index].trim()) continue;
    const candidate = lines[index].match(/^\s*/)?.[0].length ?? 0;
    if (candidate <= indentation) return index;
  }
  return lines.length;
}

function enclosingScope(definitions: SourceDefinition[], line: number) {
  return definitions
    .filter((definition) => definition.callable && definition.line <= line && definition.endLine >= line)
    .sort((left, right) => right.line - left.line || left.endLine - right.endLine)[0] ?? null;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function analyzeSourceStructure(content: string, path: string, requestedSymbols: string[] = []) {
  const imports = sourceImports(content, path);
  const masked = maskSourceForStructure(content, path);
  const lines = masked.split(/\r?\n/);
  const pythonLike = /\.(?:py|rb)$/i.test(path);
  const definitions: SourceDefinition[] = lines
    .map((line, index) => declarationAt(line, index + 1))
    .filter((definition): definition is Omit<SourceDefinition, "endLine"> => Boolean(definition))
    .map((definition) => ({
      ...definition,
      endLine: pythonLike
        ? indentationScopeEnd(lines, definition.line - 1)
        : braceScopeEnd(lines, definition.line - 1),
    }));
  const calls: SourceCall[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    if (imports.some((entry) => entry.line <= lineNumber && entry.endLine >= lineNumber)) continue;
    const lineDefinition = definitions.find((definition) => definition.line === lineNumber);
    let skippedDeclaration = false;
    for (const match of lines[index].matchAll(/(?<![\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
      const name = match[1];
      if (CONTROL_WORDS.has(name)) continue;
      if (!skippedDeclaration && lineDefinition?.name === name) {
        skippedDeclaration = true;
        continue;
      }
      const scope = enclosingScope(definitions, lineNumber);
      calls.push({
        name,
        line: lineNumber,
        scopeName: scope?.name ?? null,
        scopeKind: scope?.kind ?? null,
        scopeStartLine: scope?.line ?? null,
        scopeEndLine: scope?.endLine ?? null,
      });
    }
  }

  const occurrences: AnalyzedOccurrence[] = [];
  for (const symbol of [...new Set(requestedSymbols)]) {
    const pattern = new RegExp(`(?<![\\w$])${escapeRegex(symbol)}(?![\\w$])`);
    let count = 0;
    for (let index = 0; index < lines.length && count < 16; index += 1) {
      if (!pattern.test(lines[index])) continue;
      const line = index + 1;
      const definition = definitions.find((candidate) => candidate.line === line && candidate.name === symbol);
      const imported = imports.find((candidate) => candidate.line <= line && candidate.endLine >= line && candidate.symbol === symbol);
      const scope = enclosingScope(definitions, line);
      occurrences.push({
        symbol,
        line,
        kind: definition ? "declaration" : imported ? "import" : "reference",
        scopeName: scope?.name ?? null,
        scopeKind: scope?.kind ?? null,
        scopeStartLine: scope?.line ?? null,
        scopeEndLine: scope?.endLine ?? null,
      });
      count += 1;
    }
  }
  return { definitions, imports, calls, occurrences };
}
