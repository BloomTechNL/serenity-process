import { Process } from './Process';
import { RoleBindings, Step } from './Step';

/** Maps (some of) the roles of a nested process to roles of the enclosing process. */
export type RoleMapping<ChildRole extends string> = { readonly [R in ChildRole]?: string };

/** The roles a nested process contributes to its parent: mapped ones renamed, the rest unchanged. */
export type MappedRoles<ChildRole extends string, Mapping extends RoleMapping<ChildRole>> = {
    [R in ChildRole]: R extends keyof Mapping ? Extract<Mapping[R], string> : R
}[ChildRole];

/**
 * A step of a {@link Process} that is itself a process.
 *
 * Roles of the nested process are played by the actors of the roles they are
 * mapped to in the enclosing process. Roles not mentioned in `mapping` keep
 * their name, so a nested process whose roles match its parent's needs no mapping.
 * Several child roles may map to the same parent role.
 *
 * @example
 *  const purchase = Process.where('#buyer pays #seller', step('buyer', pay()), step('seller', ship()));
 *
 *  const checkout = Process.where('#customer checks out and #agent follows up',
 *      subprocess(purchase, { buyer: 'customer', seller: 'agent' }),
 *      step('agent', sendInvoice()),
 *  );
 */
export function subprocess<
    ChildRole extends string,
    const Mapping extends RoleMapping<ChildRole> = {},
>(
    child: Process<ChildRole>,
    mapping?: Mapping,
): Step<MappedRoles<ChildRole, Mapping>> {
    const parentRole = (role: ChildRole): string => (mapping as RoleMapping<ChildRole> | undefined)?.[role] ?? role;

    return {
        roles: [ ...new Set(child.roles().map(parentRole)) ] as MappedRoles<ChildRole, Mapping>[],
        async perform(bindings, context) {
            const childBindings = Object.fromEntries(
                child.roles().map(role => [ role, (bindings as Record<string, unknown>)[parentRole(role)] ]),
            ) as RoleBindings<ChildRole>;

            await child.run(childBindings, context);
        },
    };
}
