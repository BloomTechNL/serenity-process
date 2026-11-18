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
