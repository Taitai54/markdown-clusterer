const YAML = require('js-yaml');

const FM_REGEX = /^---\r?\n([\s\S]*?)\r?\n---/;

function cleanTitle(title) {
  const cleaned = String(title || '').replace(/[\r\n]+/g, ' ').trim();
  return cleaned || 'Untitled';
}

function sectionFromFile(file) {
  const content = typeof file.content === 'string' ? file.content : '';
  const match = content.match(FM_REGEX);
  let body = content.trim();
  let title = '';

  if (match) {
    try {
      const fm = YAML.load(match[1]) || {};
      if (typeof fm.title === 'string') title = fm.title.trim();
    } catch (e) {
      // Keep the raw body if frontmatter is not valid YAML.
    }
    body = content.substring(match[0].length).trim();
  }

  if (!title && body) {
    const firstLine = body.split(/\r?\n/)[0] || '';
    const headingMatch = firstLine.match(/^#+\s*(.+)$/);
    if (headingMatch) title = headingMatch[1].trim();
  }

  if (!title) {
    const name = file.name || 'Untitled';
    title = name.replace(/\.(md|markdown|txt)$/i, '');
  }

  return { title: cleanTitle(title), body };
}

function buildMergedMarkdown(files, title) {
  if (!Array.isArray(files) || files.length < 2) {
    throw new Error('Select at least two files to merge');
  }

  const sections = files.map(sectionFromFile);
  const docTitle = cleanTitle(title || 'Merged document');
  const sources = files.map(file => file.path).filter(path => typeof path === 'string' && path);
  const frontmatter = YAML.dump({ title: docTitle, sources });
  const body = sections.map(section => `## ${section.title}\n\n${section.body}`.trim()).join('\n\n');

  return `---\n${frontmatter}---\n\n# ${docTitle}\n\n${body}\n`;
}

module.exports = { buildMergedMarkdown, sectionFromFile };
