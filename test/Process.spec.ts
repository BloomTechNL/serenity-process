import { beforeEach, describe, expect, it } from 'vitest';
import { actorCalled, Cast, engage, Interaction } from '@serenity-js/core';
import { Process, step } from '../src';

const log: string[] = [];
const record = (text: string) => Interaction.where(`#actor records ${ text }`, async actor => {
    log.push(`${ actor.name }:${ text }`);
});
const fail = () => Interaction.where('#actor fails', async () => { throw new Error('boom'); });

describe('Process', () => {
    beforeEach(() => {
        log.length = 0;
        engage(Cast.where(actor => actor));
    });

    it('runs steps in order, each by the actor playing the role', async () => {
        const p = Process.where('#a hands to #b',
            step('a', record('one')),
            step('b', record('two')),
            step('a', record('three')),
        );
        await p.with({ a: actorCalled('Ann'), b: actorCalled('Bob') })();
        expect(log).toEqual([ 'Ann:one', 'Bob:two', 'Ann:three' ]);
    });

    it('lists roles in order of first appearance', () => {
        const p = Process.where('x', step('b', record('1')), step('a', record('2')), step('b', record('3')));
        expect(p.roles()).toEqual([ 'b', 'a' ]);
    });

    it('stops at the first failing step', async () => {
        const p = Process.where('x', step('a', fail()), step('b', record('never')));
        await expect(p.with({ a: actorCalled('Ann'), b: actorCalled('Bob') })()).rejects.toThrow('boom');
        expect(log).toEqual([]);
    });

    it('throws when a role has no actor', () => {
        const p = Process.where('#a and #b', step('a', record('1')), step('b', record('2')));
        expect(() => p.with({ a: actorCalled('Ann') } as any)).toThrow(/Nobody plays b/);
    });

    it('replaces #role with actor names, longest role first', () => {
        const p = Process.where('#agent asks #agentLead', step('agent', record('1')), step('agentLead', record('2')));
        expect(p.describedFor({ agent: actorCalled('Priya'), agentLead: actorCalled('Lee') }))
            .toBe('Priya asks Lee');
    });

    it('handles `$` in actor names', () => {
        const p = Process.where('#a pays', step('a', record('1')));
        expect(p.describedFor({ a: actorCalled('Cash$&Co') })).toBe('Cash$&Co pays');
    });

    it('can be reused with other actors', async () => {
        const p = Process.where('#a', step('a', record('x')));
        await p.with({ a: actorCalled('Ann') })();
        await p.with({ a: actorCalled('Bob') })();
        expect(log).toEqual([ 'Ann:x', 'Bob:x' ]);
    });
});
