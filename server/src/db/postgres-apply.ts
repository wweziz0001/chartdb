/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { buildPostgresMigrationPlan } from '../../../shared/schema-sync/postgres-sql.ts';
import type { CanonicalSchema } from '../../../shared/schema-sync/canonical.ts';
import type { PgConnectionConfig } from './postgres-client.ts';
import { withPostgresClient } from './postgres-client.ts';
import { HttpError } from '../utils/http.ts';

export interface ApplyApproval {
    allowDestructiveChanges: boolean;
    typedConfirmation?: string;
}

export const requiredConfirmationPhrase = 'APPLY DESTRUCTIVE CHANGES';

export const validateApplyRequest = ({
    baseline,
    target,
    approval,
}: {
    baseline: CanonicalSchema;
    target: CanonicalSchema;
    approval: ApplyApproval;
}) => {
    const plan = buildPostgresMigrationPlan(baseline, target);
    if (
        plan.diff.hasDestructiveChanges &&
        (!approval.allowDestructiveChanges ||
            approval.typedConfirmation !== requiredConfirmationPhrase)
    ) {
        throw new HttpError(
            400,
            'Destructive schema changes require explicit typed confirmation.',
            {
                requiredConfirmationPhrase,
                warnings: plan.warnings,
            }
        );
    }
    return plan;
};

export const applyPostgresMigrationPlan = async ({
    config,
    baseline,
    target,
    approval,
}: {
    config: PgConnectionConfig;
    baseline: CanonicalSchema;
    target: CanonicalSchema;
    approval: ApplyApproval;
}) => {
    const plan = validateApplyRequest({ baseline, target, approval });
    if (!plan.statements.length) {
        return {
            status: 'noop' as const,
            executedStatements: [],
            plan,
        };
    }

    const executedStatements: Array<{ id: string; summary: string }> = [];

    await withPostgresClient(config, async (client) => {
        await client.query('BEGIN;');
        try {
            for (const statement of plan.statements) {
                await client.query(statement.statement);
                executedStatements.push({
                    id: statement.id,
                    summary: statement.summary,
                });
            }
            await client.query('COMMIT;');
        } catch (error) {
            await client.query('ROLLBACK;');
            throw error;
        }
    });

    return {
        status: 'applied' as const,
        executedStatements,
        plan,
    };
};
