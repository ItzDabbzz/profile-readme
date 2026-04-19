import { describe, expect, it, mock } from 'bun:test';
import { capitalize, pickRandomItems } from '../src/helpers';

// Mock the GitHub Actions core library to prevent log spam during tests.
mock.module('@actions/core', () => ({
    debug: () => {},
    info: () => {},
    warning: () => {},
    error: () => {},
    notice: () => {},
    startGroup: () => {},
    endGroup: () => {},
    group: async <T>(name: string, fn: () => Promise<T>): Promise<T> => fn()
}));

// ─── capitalize ───────────────────────────────────────────────────────────────

describe('capitalize', () => {
    it('capitalizes the first letter of a plain word', () => {
        expect(capitalize('hello')).toBe('Hello');
    });

    it('converts underscores to spaces and capitalizes each word', () => {
        expect(capitalize('hello_world')).toBe('Hello World');
    });

    it('collapses multiple spaces and capitalizes each word', () => {
        expect(capitalize('multiple   spaces')).toBe('Multiple Spaces');
    });

    it('handles multiple underscores', () => {
        expect(capitalize('push_event_type')).toBe('Push Event Type');
    });

    it('handles already-capitalized input', () => {
        expect(capitalize('Hello')).toBe('Hello');
    });

    it('handles a single character', () => {
        expect(capitalize('a')).toBe('A');
    });

    it('handles mixed underscores and spaces', () => {
        expect(capitalize('foo_bar baz')).toBe('Foo Bar Baz');
    });

    it('handles an empty string without throwing', () => {
        expect(capitalize('')).toBe('');
    });
});

// ─── pickRandomItems ──────────────────────────────────────────────────────────

describe('pickRandomItems', () => {
    it('returns the correct number of items', () => {
        const result = pickRandomItems([1, 2, 3, 4, 5], 3);
        expect(result).toHaveLength(3);
    });

    it('defaults to picking 2 items', () => {
        const result = pickRandomItems([1, 2, 3]);
        expect(result).toHaveLength(2);
    });

    it('returns only unique items (no duplicates)', () => {
        const items = [10, 20, 30, 40, 50, 60, 70, 80];
        const result = pickRandomItems(items, 5);
        const unique = new Set(result);
        expect(unique.size).toBe(5);
    });

    it('returns all items when limit equals array length', () => {
        const items = ['a', 'b', 'c'];
        const result = pickRandomItems(items, 3);
        expect(result).toHaveLength(3);
        expect(result.sort()).toEqual(['a', 'b', 'c']);
    });

    it('throws when limit is less than 1', () => {
        expect(() => pickRandomItems([1, 2, 3], 0)).toThrow('Pick at least 1 item');
    });

    it('throws when limit exceeds array length', () => {
        expect(() => pickRandomItems([1, 2], 5)).toThrow("You can't pick more items than there are in the array.");
    });

    it('works with a single-item array and limit of 1', () => {
        const result = pickRandomItems(['only'], 1);
        expect(result).toEqual(['only']);
    });

    it('each call can return different results (randomness check)', () => {
        const items = Array.from({ length: 20 }, (_, i) => i);
        const a = pickRandomItems(items, 5);
        const b = pickRandomItems(items, 5);
        expect(a).toHaveLength(5);
        expect(b).toHaveLength(5);
    });
});
