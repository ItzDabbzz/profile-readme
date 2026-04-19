import { describe, expect, it } from 'bun:test';
import { widgets } from '../src/widget';

describe('widgets', () => {
    it('returns undefined when no matching widgets exist', () => {
        expect(widgets('TIMESTAMP', 'plain markdown')).toBeUndefined();
    });

    it('parses widget config when JSON is valid', () => {
        const found = widgets<{ rows: number }>('GITHUB_REPOS', '<!--GITHUB_REPOS:{"rows":3}-->');

        expect(found).toBeDefined();
        expect(found).toHaveLength(1);
        expect(found?.[0].config.rows).toBe(3);
    });

    it('falls back to empty config when JSON is invalid', () => {
        const found = widgets('TIMESTAMP', '<!--TIMESTAMP:{oops}-->');

        expect(found).toBeDefined();
        expect(found?.[0].config).toEqual({});
    });

    it('keeps widget order when multiple matches exist', () => {
        const source = '<!--TIMESTAMP-->\n<!--TIMESTAMP:{"label":"Now"}-->';
        const found = widgets<{ label?: string }>('TIMESTAMP', source);

        expect(found).toBeDefined();
        expect(found).toHaveLength(2);
        expect(found?.[0].matched).toBe('<!--TIMESTAMP-->');
        expect(found?.[1].config.label).toBe('Now');
    });
});
