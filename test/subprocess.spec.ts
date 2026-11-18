import { beforeEach, describe, expect, it } from 'vitest';
import { actorCalled, Cast, engage, Interaction } from '@serenity-js/core';
import { Process, step, subprocess } from '../src';

const log: string[] = [];
const record = (text: string) => Interaction.where(`#actor records ${ text }`, async actor => {
    log.push(`${ actor.name }:${ text }`);
});
const fail = () => Interaction.where('#actor fails', async () => { throw new Error('boom'); });

describe('subprocess', () => {
    beforeEach(() => {
        log.length = 0;
        engage(Cast.where(actor => actor));
    });

    const purchase = Process.where('#buyer pays #seller',
        step('buyer', record('pay')),
        step('seller', record('ship')),
    );

    it('maps child roles to parent roles and runs in order', async () => {
        const checkout = Process.where('#customer checks out, #agent follows up',
            step('customer', record('browse')),
            subprocess(purchase, { buyer: 'customer', seller: 'agent' }),
            step('agent', record('invoice')),
        );

        expect(checkout.roles()).toEqual([ 'customer', 'agent' ]);
        await checkout.with({ customer: actorCalled('Chidi'), agent: actorCalled('Priya') })();
        expect(log).toEqual([ 'Chidi:browse', 'Chidi:pay', 'Priya:ship', 'Priya:invoice' ]);
    });

    it('passes unmapped roles through by name', async () => {
        const outer = Process.where('x', subprocess(purchase, { buyer: 'customer' }));
        expect(outer.roles()).toEqual([ 'customer', 'seller' ]);
        await outer.with({ customer: actorCalled('Ann'), seller: actorCalled('Sam') })();
        expect(log).toEqual([ 'Ann:pay', 'Sam:ship' ]);

        const identity = Process.where('x', subprocess(purchase));
        expect(identity.roles()).toEqual([ 'buyer', 'seller' ]);
    });

    it('allows several child roles to map to one parent role', async () => {
        const outer = Process.where('x', subprocess(purchase, { buyer: 'solo', seller: 'solo' }));
        expect(outer.roles()).toEqual([ 'solo' ]);
        await outer.with({ solo: actorCalled('Ann') })();
        expect(log).toEqual([ 'Ann:pay', 'Ann:ship' ]);
    });

    it('requires an actor for nested roles', () => {
        const outer = Process.where('x', subprocess(purchase, { buyer: 'customer', seller: 'agent' }));
        expect(() => outer.with({ customer: actorCalled('Ann') } as any)).toThrow(/Nobody plays agent/);
    });

    it('stops the whole process when a nested step fails', async () => {
        const bad = Process.where('bad', step('a', fail()));
        const outer = Process.where('x', subprocess(bad), step('a', record('never')));
        await expect(outer.with({ a: actorCalled('Ann') })()).rejects.toThrow('boom');
        expect(log).toEqual([]);
    });

    it('nests several levels deep', async () => {
        const mid = Process.where('mid', subprocess(purchase, { buyer: 'm1', seller: 'm2' }));
        const top = Process.where('top', subprocess(mid, { m1: 'x', m2: 'y' }));
        await top.with({ x: actorCalled('Xa'), y: actorCalled('Yb') })();
        expect(log).toEqual([ 'Xa:pay', 'Yb:ship' ]);
    });

    it('describes nested steps with the path of processes', () => {
        const outer = Process.where('#customer shops', subprocess(purchase, { buyer: 'customer', seller: 'agent' }));
        const texts: string[] = [];
        const spy = (role: string) => ({ roles: [ role ], perform: async (_: any, ctx: string) => { texts.push(ctx); } });
        const wrapper = Process.where('#a outer', subprocess(Process.where('#a inner', spy('a') as any)));
        return wrapper.with({ a: actorCalled('Ann') })().then(() => {
            expect(texts).toEqual([ 'Ann outer > Ann inner' ]);
            expect(outer.toString()).toBe('#customer shops');
        });
    });

    it('infers the parent roles at compile time', () => {
        const outer = Process.where('x', subprocess(purchase, { buyer: 'customer' }));
        const ann = actorCalled('Ann');
        const neverCalled = () => {
            // @ts-expect-error 'seller' is still required, 'buyer' was renamed to 'customer'
            outer.with({ customer: ann });
            // @ts-expect-error 'buyer' no longer exists in the parent
            outer.with({ buyer: ann, seller: ann });
        };
        expect(neverCalled).toBeTypeOf('function');
    });
});
