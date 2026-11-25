import type { Rule, Scope } from 'eslint';

/** The AST as the rule sees it, including the TypeScript-only nodes ESTree doesn't describe. */
interface Node {
    type: string;
    parent: Node;
    [key: string]: any;
}

/** Functions whose result is an actor. */
const DEFAULT_ACTOR_FACTORIES = [ 'actorCalled', 'actorInTheSpotlight' ];

/** Types of variables that hold an actor. */
const DEFAULT_ACTOR_TYPES = [ 'Actor' ];

/** Wrappers that don't change the value: `actor as Actor`, `actor!`, `actor satisfies Actor`. */
const TRANSPARENT = new Set([ 'TSAsExpression', 'TSNonNullExpression', 'TSSatisfiesExpression', 'TSTypeAssertion' ]);

interface Options {
    actorFactories?: string[];
    actorTypes?: string[];
}

/**
 * In spec files, an actor may only:
 *  - perform activities with `actor.attemptsTo(...)`,
 *  - be bound to a role of a process with `process.with({ role: actor })`.
 *
 * Any other method or property of an actor is off limits, and so is passing an actor
 * to another function. The name of an actor (`actor.name`) may be used freely.
 *
 * Actors are recognised as the results of `actorCalled(...)` and `actorInTheSpotlight()`
 * (see the `actorFactories` option), the variables they are assigned to, and variables
 * declared with type `Actor` (see the `actorTypes` option), like `let vincent: Actor;`.
 */
export const restrictActorUsage: Rule.RuleModule = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Only allow actors to be used with `attemptsTo` or bound to a role in `Process.with`',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    actorFactories: { type: 'array', items: { type: 'string' }, uniqueItems: true },
                    actorTypes: { type: 'array', items: { type: 'string' }, uniqueItems: true },
                },
                additionalProperties: false,
            },
        ],
        messages: {
            member: 'Actor {{actor}} may only be used with `attemptsTo`, not `{{member}}`.',
            escape: 'Actor {{actor}} may only be used with `attemptsTo` or bound to a role in a process\' `.with()`. Pass `{{actor}}.name` instead.',
        },
    },

    create(context) {
        const options: Options = context.options[0] ?? {};
        const factories = new Set(options.actorFactories ?? DEFAULT_ACTOR_FACTORIES);
        const types = new Set(options.actorTypes ?? DEFAULT_ACTOR_TYPES);
        const sourceCode = context.sourceCode;
        const tracked = new Set<Scope.Variable>();

        const isFactoryCall = (node: Node): boolean =>
            node.type === 'CallExpression'
            && node.callee.type === 'Identifier'
            && factories.has(node.callee.name);

        /** `Actor`, `core.Actor`, `Actor | undefined`, ... */
        const isActorType = (type: Node | undefined): boolean => {
            switch (type?.type) {
                case 'TSTypeReference': {
                    const name = type.typeName.type === 'TSQualifiedName' ? type.typeName.right : type.typeName;
                    return name.type === 'Identifier' && types.has(name.name);
                }
                case 'TSUnionType':
                    return type.types.some(isActorType);
                default:
                    return false;
            }
        };

        /** Checks every read of a variable that holds an actor. */
        function track(variable: Scope.Variable | undefined): void {
            if (! variable || tracked.has(variable)) {
                return;
            }
            tracked.add(variable);

            for (const reference of variable.references) {
                if (reference.isRead()) {
                    check(reference.identifier as unknown as Node, variable.name);
                }
            }
        }

        function variableNamed(node: Node, name: string): Scope.Variable | undefined {
            for (let scope: Scope.Scope | null = sourceCode.getScope(node as Rule.Node); scope; scope = scope.upper) {
                const variable = scope.set.get(name);
                if (variable) {
                    return variable;
                }
            }
            return undefined;
        }

        /** Checks how the actor-valued expression `node` is used. */
        function check(node: Node, actor: string): void {
            let outer = node;
            while (TRANSPARENT.has(outer.parent.type)) {
                outer = outer.parent;
            }
            const parent = outer.parent;

            switch (parent.type) {
                case 'MemberExpression': {
                    if (parent.object !== outer) {
                        break;      // used as a computed key: `x[actor]`
                    }
                    const member = memberName(parent);
                    if (member === 'name') {
                        return;
                    }
                    if (member === 'attemptsTo' && parent.parent.type === 'CallExpression' && parent.parent.callee === parent) {
                        return;
                    }
                    context.report({ node: parent as Rule.Node, messageId: 'member', data: { actor, member: member ?? '[…]' } });
                    return;
                }

                case 'Property':
                    if (parent.value === outer && isBindingOfProcess(parent)) {
                        return;
                    }
                    break;

                case 'VariableDeclarator':
                    if (parent.init === outer && parent.id.type === 'Identifier') {
                        sourceCode.getDeclaredVariables(parent as Rule.Node).forEach(track);
                        return;
                    }
                    break;

                case 'AssignmentExpression':
                    if (parent.right === outer && parent.operator === '=' && parent.left.type === 'Identifier') {
                        track(variableNamed(parent, parent.left.name));
                        return;
                    }
                    break;

                case 'ExpressionStatement':
                    return;     // `actorCalled('Alice');` only puts Alice in the spotlight
            }

            context.report({ node: outer as Rule.Node, messageId: 'escape', data: { actor } });
        }

        return {
            VariableDeclarator(node) {
                const id = node.id as unknown as Node;
                if (id.type === 'Identifier' && isActorType(id.typeAnnotation?.typeAnnotation)) {
                    sourceCode.getDeclaredVariables(node).forEach(track);
                }
            },
            CallExpression(node) {
                if (isFactoryCall(node as unknown as Node)) {
                    check(node as unknown as Node, sourceCode.getText(node));
                }
            },
        };
    },
};

function memberName(node: Node): string | undefined {
    if (! node.computed && node.property.type === 'Identifier') {
        return node.property.name;
    }
    if (node.property.type === 'Literal' && typeof node.property.value === 'string') {
        return node.property.value;
    }
    return undefined;
}

/** `property` is a role binding in `process.with({ role: actor })`. */
function isBindingOfProcess(property: Node): boolean {
    const object = property.parent;
    if (object.type !== 'ObjectExpression') {
        return false;
    }
    const call = object.parent;
    return call.type === 'CallExpression'
        && call.arguments[0] === object
        && call.callee.type === 'MemberExpression'
        && memberName(call.callee) === 'with';
}
