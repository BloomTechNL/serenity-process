import { Activity, Actor, Task } from '@serenity-js/core';

/** Maps every role of a process to the actor who plays it. */
export type RoleBindings<Role extends string> = { readonly [R in Role]: Actor };

/**
 * One step of a {@link Process}. Either a {@link step} performed by a single role,
 * or a {@link subprocess} that involves several.
 */
export interface Step<Role extends string> {
    /** The roles involved in this step, in order of first appearance. */
    readonly roles: readonly Role[];

    /**
     * Performs the step.
     *
     * @param bindings  The actors playing each role
     * @param context   The description of the (nested) process this step belongs to
     */
    perform(bindings: RoleBindings<Role>, context: string): Promise<void>;
}

/** The roles of a step type. */
export type RolesOf<S> = S extends Step<infer Role> ? Role : never;

/**
 * A step of a {@link Process}: the role that performs it, and its activities.
 *
 * @example
 *  step('customer', raiseTicket())
 */
export const step = <Role extends string>(role: Role, ...activities: Activity[]): Step<Role> => ({
    roles: [ role ],
    async perform(bindings, context) {
        await bindings[role].attemptsTo(
            Task.where(`#actor, as ${ role }, in: ${ context }`, ...activities),
        );
    },
});
