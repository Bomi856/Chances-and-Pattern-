/**
 * Preprocesses user-pasted code so flattened preprocessor directives like
 * `#ifdef GL_ESprecision highp float;#endif` compile cleanly without failing
 * due to stripped newlines from mobile/chat copy-paste.
 */
export function preprocessGlslDirectives(source: string): string {
  return source
    .replace(/#ifdef\s+GL_ES(?!\s*\n)/g, '#ifdef GL_ES\n')
    .replace(/#ifndef\s+([A-Za-z0-9_]+)(?!\s*\n)/g, '#ifndef $1\n')
    .replace(/([;{])\s*#endif/g, '$1\n#endif')
    .replace(/#endif(?!\s*\n|$)/g, '#endif\n');
}

/**
 * Cleans up flattened single-line p5.js / GLSL snippets pasted from mobile
 * or messaging apps into readable multi-line source code.
 */
export function normalizeFlattenedCode(source: string): string {
  let out = preprocessGlslDirectives(source);

  // If the user pasted code with few newlines (> 350 chars per line), restore structure
  const lines = out.split('\n');
  const maxLen = Math.max(...lines.map((l) => l.length));
  if (lines.length <= 4 && maxLen > 300) {
    out = out
      .replace(/;\s*(?=(?:const|let|var|function|uniform|varying|attribute|void|float|vec[234]|mat[234]|return|for|if)\b)/g, ';\n')
      .replace(/\{\s*/g, '{\n  ')
      .replace(/;\s*\}/g, ';\n}')
      .replace(/\}\s*(?=(?:function|void|float|vec[234]|const|let|var)\b)/g, '}\n\n')
      .replace(/\/\/([^\n`]*?)(?=(?:const|let|var|function|uniform|varying|attribute|void)\b)/g, '// $1\n');
  }

  return out.trim();
}
