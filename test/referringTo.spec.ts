import { beforeEach, describe, expect, it } from 'vitest';
import { actorCalled, Cast, engage, Interaction } from '@serenity-js/core';
import { Process, referringTo, step, subprocess } from '../src';

const log: string[] = [];
const record = (text: string) => Interaction.where(`#actor records ${ text }`, async actor => {
    log.push(`${ actor.name }:${ text }`);
});
const judges = (...performers: string[]) => Interaction.where(`#actor judges ${ performers.join(' and ') }`, async actor => {
    log.push(`${ actor.name } judges ${ performers.join(' and ') }`);
});

describe('referringTo', () => {
    beforeEach(() => {
        log.length = 0;
        engage(Cast.where(actor => actor));
    });

    it('passes the name of the actor playing the referred role', async () => {
        const audition = Process.where('#judge judges #performer',
            step('performer', record('sings')),
            step('judge', referringTo('performer', p => judges(p))),
        );
        await audition.with({ performer: actorCalled('Piet'), judge: actorCalled('Han') })();
        expect(log).toEqual([ 'Piet:sings', 'Han judges Piet' ]);
    });

    it('passes several names in the order of the roles, whatever the parameters are called', async () => {
        const contest = Process.where('x',
            step('singer', record('sings')),
            step('dancer', record('dances')),
            step('jury', referringTo('dancer', 'singer', (first, second) => judges(first, second))),
        );
        await contest.with({ singer: actorCalled('Piet'), dancer: actorCalled('Klaas'), jury: actorCalled('Han') })();
        expect(log).toEqual([ 'Piet:sings', 'Klaas:dances', 'Han judges Klaas and Piet' ]);
    });

    it('mixes with plain activities, in order', async () => {
        const p = Process.where('x',
            step('a', record('first'), referringTo('b', b => record(`to ${ b }`)), record('last')),
            step('b', record('done')),
        );
        await p.with({ a: actorCalled('Ann'), b: actorCalled('Bob') })();
        expect(log).toEqual([ 'Ann:first', 'Ann:to Bob', 'Ann:last', 'Bob:done' ]);
    });

    it('allows several referringTo in one step, each with its own roles', async () => {
        const p = Process.where('x',
            step('jury',
                referringTo('singer', s => judges(s)),
                record('applauds'),
                referringTo('dancer', 'singer', 'jury', (d, s, j) => record(`${ j } ranks ${ d } above ${ s }`)),
            ),
        );
        expect(p.roles()).toEqual([ 'jury', 'singer', 'dancer' ]);
        await p.with({ jury: actorCalled('Han'), singer: actorCalled('Piet'), dancer: actorCalled('Klaas') })();
        expect(log).toEqual([ 'Han judges Piet', 'Han:applauds', 'Han:Han ranks Klaas above Piet' ]);
    });

    it('uses the actors bound at run time', async () => {
        const p = Process.where('x', step('a', record('x')), step('b', referringTo('a', a => judges(a))));
        await p.with({ a: actorCalled('Ann'), b: actorCalled('Bob') })();
        await p.with({ a: actorCalled('Cas'), b: actorCalled('Dee') })();
        expect(log).toEqual([ 'Ann:x', 'Bob judges Ann', 'Cas:x', 'Dee judges Cas' ]);
    });

    it('makes referred roles part of the process', () => {
        const p = Process.where('x', step('judge', referringTo('performer', p => judges(p))));
        expect(p.roles()).toEqual([ 'judge', 'performer' ]);
        expect(() => p.with({ judge: actorCalled('Han') } as any)).toThrow(/Nobody plays performer/);

        const neverCalled = () => {
            // @ts-expect-error 'performer' is referred to, so it must be played
            p.with({ judge: actorCalled('Han') });
        };
        expect(neverCalled).toBeTypeOf('function');
    });

    it('can refer to a role that performs no step', async () => {
        const p = Process.where('x', step('judge', referringTo('absent', a => judges(a))));
        await p.with({ judge: actorCalled('Han'), absent: actorCalled('Piet') })();
        expect(log).toEqual([ 'Han judges Piet' ]);
    });

    it('maps referred roles in a subprocess', async () => {
        const audition = Process.where('#judge judges #performer',
            step('performer', record('sings')),
            step('judge', referringTo('performer', p => judges(p))),
        );
        const show = Process.where('show', subprocess(audition, { performer: 'contestant', judge: 'jury' }));
        expect(show.roles()).toEqual([ 'contestant', 'jury' ]);
        await show.with({ contestant: actorCalled('Piet'), jury: actorCalled('Han') })();
        expect(log).toEqual([ 'Piet:sings', 'Han judges Piet' ]);
    });

    it('type-checks the number of names', () => {
        const neverCalled = () => {
            // @ts-expect-error one role referred to, so only one name is passed
            referringTo('a', (a: string, b: string) => judges(a, b));
        };
        expect(neverCalled).toBeTypeOf('function');
    });
});
