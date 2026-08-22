import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    compareSemver,
    markdownToHtml,
    parseChangelogEntry,
    renderInlineRaw,
} from '../whatsNewCore';

describe('whatsNew', () => {
    it('parseChangelogEntry extracts section for version and stops at next header', () => {
        const md =
            '# Changelog\n\n## [1.0.0] — 2026-01-01\n\n### Added\n\n- Foo line\n\n## [0.9.0] — 2025-01-01\n\n- Old';
        const section = parseChangelogEntry(md, '1.0.0');
        assert.ok(section?.includes('Foo line'));
        assert.ok(!section?.includes('Old'));
    });

    it('parseChangelogEntry returns null when version missing', () => {
        assert.strictEqual(parseChangelogEntry('## [1.0.0]\n\nHi', '2.0.0'), null);
    });

    it('compareSemver orders major.minor.patch', () => {
        assert.ok(compareSemver('2.0.0', '1.9.9') > 0);
        assert.strictEqual(compareSemver('1.0.0', '1.0.0'), 0);
    });

    it('markdownToHtml renders list and bold', () => {
        const html = markdownToHtml('### Added\n\n- **Bold** word\n');
        assert.ok(html.includes('<strong>Bold</strong>'));
    });

    it('renderInlineRaw emits safe https link with escaped label', () => {
        const html = renderInlineRaw(
            '[sfmc-dataloader](https://www.npmjs.com/package/sfmc-dataloader)'
        );
        assert.ok(html.includes('<a href="https://www.npmjs.com/package/sfmc-dataloader"'));
        assert.ok(html.includes('target="_blank"'));
        assert.ok(html.includes('rel="noopener noreferrer"'));
        assert.ok(html.includes('>sfmc-dataloader</a>'));
    });

    it('markdownToHtml renders changelog-style npm link in list item', () => {
        const html = markdownToHtml(
            '- Bundles [sfmc-dataloader](https://www.npmjs.com/package/sfmc-dataloader) in the VSIX.\n'
        );
        assert.ok(html.includes('<a href="https://www.npmjs.com/package/sfmc-dataloader"'));
    });

    it('renderInlineRaw supports bold inside link label', () => {
        const html = renderInlineRaw('[**pkg**](https://example.com/)');
        assert.ok(html.includes('<a href="https://example.com/"'));
        assert.ok(html.includes('<strong>pkg</strong>'));
    });

    it('markdownToHtml leaves unsafe-scheme links as literal text', () => {
        const html = markdownToHtml('- [click](javascript:alert(1))\n');
        assert.ok(!html.includes('<a '), 'must not create an anchor for javascript: URLs');
        assert.ok(html.includes('[click]'), 'unsafe link should remain literal text');
    });

    it('markdownToHtml nests indented bullets into sub-lists', () => {
        const html = markdownToHtml('- top\n  - child\n  - child2\n- top2\n');
        // two <ul> opened (one nested), both closed
        assert.strictEqual((html.match(/<ul>/g) ?? []).length, 2);
        assert.strictEqual((html.match(/<\/ul>/g) ?? []).length, 2);
        assert.ok(html.includes('<li>top</li>'));
        assert.ok(html.includes('<li>child</li>'));
        assert.ok(html.includes('<li>top2</li>'));
    });

    it('markdownToHtml handles two-level nesting and dedent', () => {
        const html = markdownToHtml('- a\n  - b\n    - c\n- d\n');
        assert.strictEqual((html.match(/<ul>/g) ?? []).length, 3);
        assert.strictEqual((html.match(/<\/ul>/g) ?? []).length, 3);
    });
});
