import { Activity, Actor, LogicError, Task } from '@serenity-js/core';

/**
 * One step of a {@link Process}: the activities that whoever plays `role`
 * performs at this point.
 */
export interface Step<Role extends string> {
    readonly role: Role;
    readonly activities: Activity[];
}

/**
 * A step of a {@link Process}: the role that performs it, and its activities.
 *
 * @example
 *  step('customer', raiseTicket())
 */
export const step = <Role extends string>(name: Role, ...activities: Activity[]): Step<Role> =>
    ({ role: name, activities });

/** Maps every role of a process to the actor who plays it. */
export type RoleBindings<Role extends string> = { readonly [R in Role]: Actor };

/**
 * Like a `Task`, but performed by several actors, each playing a role.
 *
 * The steps run in the order given, one after another, and the process stops at
 * the first step that fails. A role may appear in more than one step. The actors
 * are only chosen when the process is run, with {@link Process.with}, so the same
 * process can be reused with other actors.
 *
 * In the description, `#role` is replaced by the name of the actor playing it.
 *
 * @example
 *  const escalation = Process.where('#customer raises an urgent ticket that #agent resolves',
 *      step('customer', raiseTicket({ priority: 'urgent' })),
 *      step('agent', resolveTicket()),
 *  );
 *
 *  await When(escalation.with({ customer: chidi, agent: priya }));
 */
export class Process<Role extends string> {

    static where<Steps extends [ Step<string>, ...Step<string>[] ]>(
        description: string,
        ...steps: Steps
    ): Process<Steps[number]['role']> {
        return new Process(description, steps);
    }

    private constructor(
        private readonly description: string,
        private readonly steps: readonly Step<Role>[],
    ) {
    }

    /** The roles in this process, in order of first appearance. */
    roles(): Role[] {
        return [ ...new Set(this.steps.map(s => s.role)) ];
    }

    /**
     * Binds an actor to every role. Returns a function that runs the process,
     * so it can be passed straight to `Given`, `When` or `Then`.
     */
    with(bindings: RoleBindings<Role>): () => Promise<void> {
        const missing = this.roles().filter(name => ! bindings[name]);

        if (missing.length > 0) {
            throw new LogicError(`Nobody plays ${ missing.join(', ') } in "${ this.description }"`);
        }

        const description = this.describedFor(bindings);

        return async () => {
            for (const s of this.steps) {
                await bindings[s.role].attemptsTo(
                    Task.where(`#actor, as ${ s.role }, in: ${ description }`, ...s.activities),
                );
            }
        };
    }

    /** The description with every `#role` replaced by the name of its actor. */
    describedFor(bindings: RoleBindings<Role>): string {
        return this.roles()
            // longest first, so #agent doesn't eat the start of #agentLead
            .sort((a, b) => b.length - a.length)
            .reduce(
                (text, name) => text.replace(
                    new RegExp(`#${ escapeRegExp(name) }(?![\\w])`, 'g'),
                    () => bindings[name].name,   // function form: actor names may contain `$`
                ),
                this.description,
            );
    }

    toString(): string {
        return this.description;
    }
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
