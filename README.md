# serenity-process

A **Process** is like a [Serenity/JS](https://serenity-js.org) `Task`, but performed by
**several actors**, each playing a role.

```ts
import { Process, step } from 'serenity-process';

const escalation = Process.where('#customer raises an urgent ticket that #agent resolves',
    step('customer', raiseTicket({ priority: 'urgent' })),
    step('agent', resolveTicket()),
);

await When(escalation.with({ customer: chidi, agent: priya }));
```

Report output reads: `Chidi, as customer, in: Chidi raises an urgent ticket that Priya resolves`.

## Behaviour

- Steps run **in order**, one after another; the process **stops at the first failing step**.
- A role may appear in **more than one step**.
- Actors are bound only when running (`.with(...)`), so a process can be **reused** with other actors.
- `.with()` throws a `LogicError` if a role has no actor (and TypeScript checks the role names).
- `#role` in the description is replaced by the playing actor's name.
- `.with()` returns `() => Promise<void>`, so it can be passed straight to `Given`, `When` or `Then`.
- `process.roles()` lists the roles in order of first appearance.

## Referring to other actors

`referringTo(...roles, activity)` builds an activity that refers to other actors. The names of the
actors playing those roles are passed to `activity` in the same order, so the parameters can be
named freely:

```ts
import { Process, referringTo, step } from 'serenity-process';

const contest = Process.where('#jury judges #singer and #dancer',
    step('singer', sing()),
    step('dancer', dance()),
    step('jury', referringTo('singer', 'dancer', (s, d) => Compare(s).with(d))),
);

await When(contest.with({ singer: piet, dancer: klaas, jury: han }));   // Compare('Piet').with('Klaas')
```

- Referred roles are roles of the process: TypeScript and `.with()` require an actor for them.
- TypeScript checks that the function takes as many names as there are roles.
- It can be mixed with plain activities in one step, and runs with the actors bound at run time.
- In a nested process, referred roles are mapped by `subprocess` like any other role.

## Nested processes

A step can itself be a process. `subprocess(child, mapping)` binds the child's roles to roles of the
enclosing process:

```ts
import { Process, step, subprocess } from 'serenity-process';

const purchase = Process.where('#buyer pays #seller',
    step('buyer', pay()),
    step('seller', ship()),
);

const checkout = Process.where('#customer checks out, #agent follows up',
    step('customer', browse()),
    subprocess(purchase, { buyer: 'customer', seller: 'agent' }),
    step('agent', sendInvoice()),
);

await When(checkout.with({ customer: chidi, agent: priya }));
```

- Child roles not listed in the mapping keep their name; with no mapping at all the roles pass straight through.
- Several child roles may map to the same parent role (one actor plays both).
- The parent's roles (and what `.with()` requires) are inferred by TypeScript, nested ones included.
- Nesting can go as deep as you like; the first failing step stops everything.
- Report descriptions show the path: `Priya, as seller, in: Chidi checks out, Priya follows up > Chidi pays Priya`.

## Install

```bash
npm install serenity-process
```

Requires `@serenity-js/core` ^3 as a peer dependency.

## Development

```bash
npm install
npm test
npm run build
```

MIT licensed.
