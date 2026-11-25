import { describe, it } from 'vitest';
import { RuleTester } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { restrictActorUsage } from '../../src/eslint/restrictActorUsage';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({ languageOptions: { parser: tsParser } });

const escape = (actor: string) => ({ messageId: 'escape', data: { actor } });
const member = (actor: string, name: string) => ({ messageId: 'member', data: { actor, member: name } });

ruleTester.run('restrict-actor-usage', restrictActorUsage, {
    valid: [
        `const chidi = actorCalled('Chidi'); await chidi.attemptsTo(Navigate.to('/'));`,
        `await actorCalled('Chidi').attemptsTo(Navigate.to('/'));`,
        `await actorInTheSpotlight().attemptsTo(Navigate.to('/'));`,
        `const chidi = actorCalled('Chidi'); await chidi?.attemptsTo(Navigate.to('/'));`,
        `const chidi = actorCalled('Chidi'); await (chidi as Actor).attemptsTo(Navigate.to('/'));`,

        // bound to roles of a process
        `const chidi = actorCalled('Chidi'); await When(escalation.with({ customer: chidi, agent: actorCalled('Priya') }));`,
        `const customer = actorCalled('Chidi'); await escalation.with({ customer })();`,

        // the name may be used anywhere
        `const chidi = actorCalled('Chidi'); await priya.attemptsTo(Greet(chidi.name));`,
        `const greeting = 'hi ' + actorCalled('Chidi').name;`,

        // aliases and reassignment are followed
        `const chidi = actorCalled('Chidi'); const customer = chidi; await customer.attemptsTo(x);`,
        `let actor; actor = actorCalled('Chidi'); await actor.attemptsTo(x);`,

        // putting an actor in the spotlight
        `actorCalled('Chidi');`,

        // actors given to a Cast are not tracked
        `engage(Cast.where(actor => actor.whoCan(BrowseTheWeb.using(page))));`,

        // variables declared as actors, filled in elsewhere
        `let cast: Cast; let vincent: Actor; let piet: Actor;
         beforeEach(() => { vincent = cast.actor('Vincent'); piet = stage.theActorCalled('Piet'); });
         it('x', async () => { await vincent.attemptsTo(Greet(piet.name)); await escalation.with({ customer: piet })(); });`,
        `let vincent: Actor | undefined; await vincent!.attemptsTo(x);`,

        // an actor set up in beforeEach, used in phases of the scenario
        `describe('support', () => {
            let chidi: Actor;
            beforeEach(() => { chidi = actorCalled('Chidi'); });
            it('raises a ticket', async () => {
                await Given(() => chidi.attemptsTo(signUp()));
                await When(() => chidi.attemptsTo(raiseTicket({ label: 'billing' })));
                await Then(() => chidi.attemptsTo(Ensure.that(ticket('billing'), property('status', equals('open')))));
            });
        });`,

        // other factories, when configured
        {
            code: `const chidi = actorCalled('Chidi'); chidi.whoCan(x);`,
            options: [ { actorFactories: [ 'somebody' ] } ],
        },
    ],
    invalid: [
        {
            code: `let chidi: Actor;
                beforeEach(() => { chidi = actorCalled('Chidi'); });
                it('x', async () => {
                    await Given(() => signUpAs(chidi));
                    await Then(() => chidi.answer(ticket()));
                });`,
            errors: [ escape('chidi'), member('chidi', 'answer') ],
        },
        {
            code: `let vincent: Actor; beforeEach(() => { vincent = cast.actor('Vincent'); }); vincent.whoCan(x);`,
            errors: [ member('vincent', 'whoCan') ],
        },
        {
            code: `let vincent: Actor; let piet: Actor; signUp(vincent); await piet.answer(q);`,
            errors: [ escape('vincent'), member('piet', 'answer') ],
        },
        {
            code: `let vincent: core.Actor | undefined; signUp(vincent);`,
            errors: [ escape('vincent') ],
        },
        {
            code: `let vincent: Actor = actorCalled('Vincent'); signUp(vincent);`,
            errors: [ escape('vincent') ],
        },
        {
            code: `let vincent: Performer; signUp(vincent);`,
            options: [ { actorTypes: [ 'Performer' ] } ],
            errors: [ escape('vincent') ],
        },
        {
            code: `const chidi = actorCalled('Chidi'); chidi.whoCan(BrowseTheWeb.using(page));`,
            errors: [ member('chidi', 'whoCan') ],
        },
        {
            code: `const chidi = actorCalled('Chidi'); const answer = await chidi.answer(Text.of(title));`,
            errors: [ member('chidi', 'answer') ],
        },
        {
            code: `await actorCalled('Chidi').abilityTo(BrowseTheWeb);`,
            errors: [ member(`actorCalled('Chidi')`, 'abilityTo') ],
        },
        {
            code: `const chidi = actorCalled('Chidi'); const attempt = chidi.attemptsTo;`,
            errors: [ member('chidi', 'attemptsTo') ],
        },
        {
            code: `const chidi = actorCalled('Chidi'); chidi['collect'](x);`,
            errors: [ member('chidi', 'collect') ],
        },
        {
            code: `const chidi = actorCalled('Chidi'); await priya.attemptsTo(Greet(chidi));`,
            errors: [ escape('chidi') ],
        },
        {
            code: `await signUp(actorCalled('Chidi'));`,
            errors: [ escape(`actorCalled('Chidi')`) ],
        },
        {
            code: `const chidi = actorCalled('Chidi'); const cast = { customer: chidi };`,
            errors: [ escape('chidi') ],
        },
        {
            code: `const chidi = actorCalled('Chidi'); escalation.with(chidi);`,
            errors: [ escape('chidi') ],
        },
        {
            code: `const chidi = actorCalled('Chidi'); const everyone = [ chidi ];`,
            errors: [ escape('chidi') ],
        },
        {
            code: `const chidi = actorCalled('Chidi'); signUp(chidi as Actor);`,
            errors: [ escape('chidi') ],
        },
        {
            code: `const chidi = actorCalled('Chidi'); const customer = chidi; signUp(customer);`,
            errors: [ escape('customer') ],
        },
        {
            code: `function theCustomer() { return actorCalled('Chidi'); }`,
            errors: [ escape(`actorCalled('Chidi')`) ],
        },
        {
            code: `const chidi = somebody('Chidi'); signUp(chidi);`,
            options: [ { actorFactories: [ 'somebody' ] } ],
            errors: [ escape('chidi') ],
        },
    ],
});
