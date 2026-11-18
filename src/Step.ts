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
 * An activity that refers to other actors in the process, built by {@link referringTo}.
 * Its roles become roles of the step, and of the process.
 */
export interface Referring<Role extends string> {
    /** The roles referred to, in the order their names are passed on. */
    readonly roles: readonly Role[];

    /** Builds the activity from the actors playing the roles. */
    activityFor(bindings: RoleBindings<Role>): Activity;
}

/** What a {@link step} performs: an activity, or one that refers to other actors. */
export type StepActivity = Activity | Referring<string>;

/** The roles referred to by the activities of a step. */
export type ReferredRolesOf<A> = A extends Referring<infer Role> ? Role : never;

/**
 * An activity that refers to other actors in the process. The names of the actors
 * playing `roles` are passed to `activity` in the same order, so its parameters
 * can be named freely. The roles become part of the process: `.with()` requires
 * an actor for them, and a nested process maps them like any other role.
 *
 * @example
 *  step('judge', referringTo('performer', 'singer', (p, s) => Compare(p).with(s)))
 */
export function referringTo<const Roles extends [ string, ...string[] ]>(
    ...args: [ ...roles: Roles, activity: (...names: { [K in keyof Roles]: string }) => Activity ]
): Referring<Roles[number]> {
    const roles = args.slice(0, -1) as unknown as Roles;
    const activity = args[args.length - 1] as (...names: string[]) => Activity;

    return {
        roles,
        activityFor: bindings => activity(...roles.map(role => bindings[role as Roles[number]].name)),
    };
}

/**
 * A step of a {@link Process}: the role that performs it, and its activities.
 * Use {@link referringTo} for an activity that refers to other actors.
 *
 * @example
 *  step('customer', raiseTicket())
 *
 * @example
 *  step('judge', referringTo('performer', performer => JudgeTheWorkOf(performer)))
 */
export const step = <Role extends string, const Activities extends StepActivity[]>(
    role: Role,
    ...activities: Activities
): Step<Role | ReferredRolesOf<Activities[number]>> => ({
    roles: [ ...new Set([ role, ...activities.flatMap(a => isReferring(a) ? a.roles : []) ]) ] as (Role | ReferredRolesOf<Activities[number]>)[],
    async perform(bindings, context) {
        await bindings[role].attemptsTo(
            Task.where(
                `#actor, as ${ role }, in: ${ context }`,
                ...activities.map(a => isReferring(a) ? a.activityFor(bindings) : a),
            ),
        );
    },
});

function isReferring(activity: StepActivity): activity is Referring<string> {
    return typeof (activity as Referring<string>).activityFor === 'function';
}
