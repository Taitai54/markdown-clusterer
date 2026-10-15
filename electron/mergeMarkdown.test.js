import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const { buildMergedMarkdown } = require('./mergeMarkdown');

describe('buildMergedMarkdown', () => {
  it('concatenates files in selection order and strips source frontmatter', () => {
    const markdown = buildMergedMarkdown([
      {
        name: 'b.md',
        path: 'C:\\notes\\b.md',
        content: '---\ntitle: Second\ntags: [keep-me]\n---\n\nBody B'
      },
      {
        name: 'a.md',
        path: 'C:\\notes\\a.md',
        content: '# Alpha\n\nBody A'
      }
    ], 'Combined notes');

    const second = markdown.indexOf('## Second');
    const alpha = markdown.indexOf('## Alpha');
    expect(second).toBeGreaterThan(-1);
    expect(alpha).toBeGreaterThan(second);
    expect(markdown).toContain('# Combined notes');
    expect(markdown).toContain('Body B');
    expect(markdown).toContain('Body A');
    expect(markdown).not.toContain('keep-me');
    expect(markdown).toContain('C:\\notes\\b.md');
    expect(markdown).toContain('C:\\notes\\a.md');
  });

  it('falls back to the filename when there is no title or heading', () => {
    const markdown = buildMergedMarkdown([
      { name: 'plain.txt', path: '/tmp/plain.txt', content: 'Just text' },
      { name: 'other.md', path: '/tmp/other.md', content: 'More text' }
    ], 'merged.md');

    expect(markdown).toContain('## plain');
    expect(markdown).toContain('## other');
    expect(markdown).toContain('title: merged.md');
  });

  it('rejects fewer than two files', () => {
    expect(() => buildMergedMarkdown([{ name: 'only.md', content: 'x' }], 'One')).toThrow(/at least two/i);
  });
});
