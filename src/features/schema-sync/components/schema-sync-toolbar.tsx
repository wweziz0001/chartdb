import React, { useMemo, useState } from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    DatabaseZap,
    RefreshCw,
    ShieldCheck,
    Unplug,
} from 'lucide-react';
import { Badge } from '@/components/badge/badge';
import { Button } from '@/components/button/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/dialog/dialog';
import { Input } from '@/components/input/input';
import { Checkbox } from '@/components/checkbox/checkbox';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/tabs/tabs';
import { Textarea } from '@/components/textarea/textarea';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/card/card';
import { useSchemaSync } from '../context/use-schema-sync';
import type { PostgresConnectionInput } from '../../../../shared/schema-sync/validation';
import { DESTRUCTIVE_CONFIRMATION_PHRASE } from '../utils/constants';

const defaultConnection: PostgresConnectionInput = {
    name: '',
    host: 'localhost',
    port: 5432,
    database: '',
    username: '',
    password: '',
    ssl: { enabled: false, rejectUnauthorized: true },
    schemaNames: ['public'],
};

export const SchemaSyncToolbar: React.FC = () => {
    const {
        connections,
        selectedConnectionId,
        baselineSchema,
        preview,
        lastApplyResult,
        loading,
        saveConnection,
        deleteConnection,
        testConnection,
        selectConnection,
        importLiveSchema,
        previewChanges,
        applyChanges,
        refreshFromDatabase,
    } = useSchemaSync();

    const [connectionDialogOpen, setConnectionDialogOpen] = useState(false);
    const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
    const [applyDialogOpen, setApplyDialogOpen] = useState(false);
    const [connectionForm, setConnectionForm] =
        useState<PostgresConnectionInput>(defaultConnection);
    const [schemaInput, setSchemaInput] = useState('public');
    const [typedConfirmation, setTypedConfirmation] = useState('');
    const [allowDestructiveChanges, setAllowDestructiveChanges] =
        useState(false);

    const destructiveWarnings =
        preview?.diff.warnings.filter((warning) => warning.destructive) ?? [];
    const selectedConnection = connections.find(
        (connection) => connection.id === selectedConnectionId
    );

    const baselineSummary = useMemo(() => {
        if (!baselineSchema) {
            return 'No live schema imported yet';
        }
        return `${baselineSchema.tables.length} objects across ${baselineSchema.schemas.join(', ')}`;
    }, [baselineSchema]);

    const handleConnectionFieldChange = <
        K extends keyof PostgresConnectionInput,
    >(
        field: K,
        value: PostgresConnectionInput[K]
    ) => {
        setConnectionForm((current) => ({ ...current, [field]: value }));
    };

    const handleSaveConnection = async () => {
        const connection = {
            ...connectionForm,
            schemaNames: schemaInput
                .split(',')
                .map((schemaName) => schemaName.trim())
                .filter(Boolean),
        };
        const saved = await saveConnection(connection);
        await selectConnection(saved.id);
        setConnectionDialogOpen(false);
    };

    const handleImport = async () => {
        await importLiveSchema({
            schemaNames: schemaInput
                .split(',')
                .map((schemaName) => schemaName.trim())
                .filter(Boolean),
        });
    };

    const handlePreview = async () => {
        const result = await previewChanges();
        if (result) {
            setPreviewDialogOpen(true);
        }
    };

    const handleApply = async () => {
        const result = await applyChanges({
            allowDestructiveChanges,
            typedConfirmation,
        });
        if (result) {
            setApplyDialogOpen(false);
            setPreviewDialogOpen(true);
        }
    };

    return (
        <>
            <div className="flex flex-wrap items-center justify-end gap-2 py-2">
                <Badge variant={baselineSchema ? 'default' : 'secondary'}>
                    {baselineSummary}
                </Badge>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConnectionDialogOpen(true)}
                >
                    <DatabaseZap className="mr-2 size-4" />
                    Connect Database
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={!selectedConnectionId || loading}
                    onClick={handleImport}
                >
                    <RefreshCw className="mr-2 size-4" />
                    Import Live Schema
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={!baselineSchema || loading}
                    onClick={handlePreview}
                >
                    <ShieldCheck className="mr-2 size-4" />
                    Preview Changes
                </Button>
                <Button
                    size="sm"
                    disabled={!preview || loading}
                    onClick={() => setApplyDialogOpen(true)}
                >
                    Apply Changes
                </Button>
            </div>

            <Dialog
                open={connectionDialogOpen}
                onOpenChange={setConnectionDialogOpen}
            >
                <DialogContent className="max-w-4xl" showClose>
                    <DialogHeader>
                        <DialogTitle>Manage PostgreSQL connections</DialogTitle>
                        <DialogDescription>
                            Credentials stay server-side. The browser only
                            stores the selected connection id and imported
                            baseline metadata.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
                        <div className="grid gap-3">
                            <div className="grid gap-2 md:grid-cols-2">
                                <Input
                                    placeholder="Connection name"
                                    value={connectionForm.name}
                                    onChange={(event) =>
                                        handleConnectionFieldChange(
                                            'name',
                                            event.target.value
                                        )
                                    }
                                />
                                <Input
                                    placeholder="Host"
                                    value={connectionForm.host}
                                    onChange={(event) =>
                                        handleConnectionFieldChange(
                                            'host',
                                            event.target.value
                                        )
                                    }
                                />
                                <Input
                                    placeholder="Port"
                                    type="number"
                                    value={connectionForm.port}
                                    onChange={(event) =>
                                        handleConnectionFieldChange(
                                            'port',
                                            Number(event.target.value)
                                        )
                                    }
                                />
                                <Input
                                    placeholder="Database"
                                    value={connectionForm.database}
                                    onChange={(event) =>
                                        handleConnectionFieldChange(
                                            'database',
                                            event.target.value
                                        )
                                    }
                                />
                                <Input
                                    placeholder="Username"
                                    value={connectionForm.username}
                                    onChange={(event) =>
                                        handleConnectionFieldChange(
                                            'username',
                                            event.target.value
                                        )
                                    }
                                />
                                <Input
                                    placeholder="Password"
                                    type="password"
                                    value={connectionForm.password}
                                    onChange={(event) =>
                                        handleConnectionFieldChange(
                                            'password',
                                            event.target.value
                                        )
                                    }
                                />
                            </div>
                            <Input
                                placeholder="Schemas (comma separated)"
                                value={schemaInput}
                                onChange={(event) =>
                                    setSchemaInput(event.target.value)
                                }
                            />
                            <label className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Checkbox
                                    checked={
                                        connectionForm.ssl?.enabled ?? false
                                    }
                                    onCheckedChange={(checked) =>
                                        handleConnectionFieldChange('ssl', {
                                            enabled: Boolean(checked),
                                            rejectUnauthorized:
                                                connectionForm.ssl
                                                    ?.rejectUnauthorized ??
                                                true,
                                        })
                                    }
                                />
                                Enable TLS / SSL
                            </label>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() =>
                                        testConnection({
                                            ...connectionForm,
                                            schemaNames: schemaInput
                                                .split(',')
                                                .map((schemaName) =>
                                                    schemaName.trim()
                                                )
                                                .filter(Boolean),
                                        })
                                    }
                                    disabled={loading}
                                >
                                    Test Connection
                                </Button>
                                <Button
                                    onClick={handleSaveConnection}
                                    disabled={loading}
                                >
                                    Save Connection
                                </Button>
                            </div>
                        </div>
                        <div className="grid gap-3">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Saved connections</CardTitle>
                                    <CardDescription>
                                        Select the active server-side connection
                                        for live import and apply.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-3">
                                    {connections.length === 0 ? (
                                        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                                            No saved connections yet.
                                        </div>
                                    ) : (
                                        connections.map((connection) => (
                                            <div
                                                key={connection.id}
                                                className="rounded-lg border p-3"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <div className="font-medium">
                                                            {connection.name}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {
                                                                connection.username
                                                            }
                                                            @{connection.host}:
                                                            {connection.port}/
                                                            {
                                                                connection.database
                                                            }
                                                        </div>
                                                    </div>
                                                    <Badge
                                                        variant={
                                                            selectedConnectionId ===
                                                            connection.id
                                                                ? 'default'
                                                                : 'secondary'
                                                        }
                                                    >
                                                        {selectedConnectionId ===
                                                        connection.id
                                                            ? 'Selected'
                                                            : 'Saved'}
                                                    </Badge>
                                                </div>
                                                <div className="mt-3 flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() =>
                                                            selectConnection(
                                                                connection.id
                                                            )
                                                        }
                                                    >
                                                        Select
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            deleteConnection(
                                                                connection.id
                                                            )
                                                        }
                                                    >
                                                        <Unplug className="mr-2 size-4" />
                                                        Remove
                                                    </Button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog
                open={previewDialogOpen}
                onOpenChange={setPreviewDialogOpen}
            >
                <DialogContent className="max-w-5xl" showClose>
                    <DialogHeader>
                        <DialogTitle>Schema change preview</DialogTitle>
                        <DialogDescription>
                            Compare the imported live baseline against your
                            current canvas before executing any migration SQL.
                        </DialogDescription>
                    </DialogHeader>
                    {preview ? (
                        <Tabs defaultValue="summary" className="w-full">
                            <TabsList>
                                <TabsTrigger value="summary">
                                    Summary
                                </TabsTrigger>
                                <TabsTrigger value="diff">
                                    Detailed Diff
                                </TabsTrigger>
                                <TabsTrigger value="sql">
                                    Generated SQL
                                </TabsTrigger>
                                <TabsTrigger value="warnings">
                                    Risk Warnings
                                </TabsTrigger>
                            </TabsList>
                            <TabsContent
                                value="summary"
                                className="grid gap-3 md:grid-cols-2"
                            >
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Summary</CardTitle>
                                        <CardDescription>
                                            Human-readable migration plan.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="grid gap-2 text-sm">
                                        {preview.diff.changes.length === 0 ? (
                                            <div>
                                                No schema changes detected.
                                            </div>
                                        ) : (
                                            preview.diff.changes.map(
                                                (change, index) => (
                                                    <div
                                                        key={`${change.kind}-${index}`}
                                                        className="rounded-md border p-3"
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="font-medium">
                                                                {change.summary}
                                                            </div>
                                                            <Badge
                                                                variant={
                                                                    change.destructive
                                                                        ? 'destructive'
                                                                        : 'secondary'
                                                                }
                                                            >
                                                                {change.risk}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                )
                                            )
                                        )}
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader>
                                        <CardTitle>
                                            Execution readiness
                                        </CardTitle>
                                        <CardDescription>
                                            Safety gates for apply.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="grid gap-3 text-sm">
                                        <div>
                                            Connection:{' '}
                                            <strong>
                                                {selectedConnection?.name ??
                                                    'Not selected'}
                                            </strong>
                                        </div>
                                        <div>
                                            Destructive changes:{' '}
                                            <strong>
                                                {
                                                    preview.diff.summary
                                                        .destructiveChangeCount
                                                }
                                            </strong>
                                        </div>
                                        <div>
                                            Tables created:{' '}
                                            <strong>
                                                {
                                                    preview.diff.summary
                                                        .createTableCount
                                                }
                                            </strong>
                                        </div>
                                        <div>
                                            Tables dropped:{' '}
                                            <strong>
                                                {
                                                    preview.diff.summary
                                                        .dropTableCount
                                                }
                                            </strong>
                                        </div>
                                        <div>
                                            Columns added:{' '}
                                            <strong>
                                                {
                                                    preview.diff.summary
                                                        .addColumnCount
                                                }
                                            </strong>
                                        </div>
                                        <div>
                                            Columns dropped:{' '}
                                            <strong>
                                                {
                                                    preview.diff.summary
                                                        .dropColumnCount
                                                }
                                            </strong>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                            <TabsContent value="diff">
                                <div className="grid max-h-[60vh] gap-2 overflow-auto rounded-lg border p-3 text-sm">
                                    {preview.diff.changes.map(
                                        (change, index) => (
                                            <div
                                                key={`${change.kind}-${index}`}
                                                className="rounded-md border p-3"
                                            >
                                                <div className="font-medium">
                                                    {change.kind}
                                                </div>
                                                <div>{change.table}</div>
                                                <div className="text-muted-foreground">
                                                    {change.summary}
                                                </div>
                                            </div>
                                        )
                                    )}
                                </div>
                            </TabsContent>
                            <TabsContent value="sql">
                                <Textarea
                                    value={preview.sql}
                                    readOnly
                                    className="min-h-[420px] font-mono text-xs"
                                />
                            </TabsContent>
                            <TabsContent value="warnings">
                                <div className="grid gap-3">
                                    {preview.diff.warnings.length === 0 ? (
                                        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                                            No high-risk warnings detected.
                                        </div>
                                    ) : (
                                        preview.diff.warnings.map(
                                            (warning, index) => (
                                                <div
                                                    key={`${warning.code}-${index}`}
                                                    className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm"
                                                >
                                                    <div className="flex items-center gap-2 font-medium">
                                                        <AlertTriangle className="size-4 text-amber-500" />
                                                        {warning.message}
                                                    </div>
                                                    <div className="mt-1 text-muted-foreground">
                                                        Target: {warning.target}
                                                    </div>
                                                </div>
                                            )
                                        )
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>
                    ) : (
                        <div className="py-8 text-sm text-muted-foreground">
                            Generate a preview first.
                        </div>
                    )}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => refreshFromDatabase()}
                            disabled={loading || !selectedConnectionId}
                        >
                            Refresh From Database
                        </Button>
                        <Button
                            onClick={() => setApplyDialogOpen(true)}
                            disabled={!preview || loading}
                        >
                            Apply Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
                <DialogContent className="max-w-3xl" showClose>
                    <DialogHeader>
                        <DialogTitle>Apply approved schema changes</DialogTitle>
                        <DialogDescription>
                            ChartDB only applies SQL generated from the
                            baseline-to-target diff. Arbitrary SQL execution is
                            intentionally blocked in v1.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Safety checklist</CardTitle>
                                <CardDescription>
                                    Review risks, confirm backup posture, then
                                    execute the migration.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-3 text-sm">
                                <div className="flex items-start gap-2 rounded-md border p-3">
                                    <CheckCircle2 className="mt-0.5 size-4 text-emerald-500" />
                                    <div>
                                        The backend re-validates the diff and
                                        blocks destructive operations unless
                                        explicitly approved.
                                    </div>
                                </div>
                                <div className="flex items-start gap-2 rounded-md border p-3">
                                    <AlertTriangle className="mt-0.5 size-4 text-amber-500" />
                                    <div>
                                        Automatic rollback is not guaranteed for
                                        every DDL change. Ensure you have a
                                        database backup or snapshot strategy
                                        before proceeding.
                                    </div>
                                </div>
                                {destructiveWarnings.length > 0 ? (
                                    <div className="rounded-md border border-red-500/40 bg-red-500/5 p-3">
                                        <div className="font-medium text-red-500">
                                            Destructive operations detected
                                        </div>
                                        <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                                            {destructiveWarnings.map(
                                                (warning, index) => (
                                                    <li
                                                        key={`${warning.target}-${index}`}
                                                    >
                                                        {warning.message}
                                                    </li>
                                                )
                                            )}
                                        </ul>
                                    </div>
                                ) : null}
                                <label className="flex items-center gap-2 text-sm">
                                    <Checkbox
                                        checked={allowDestructiveChanges}
                                        onCheckedChange={(checked) =>
                                            setAllowDestructiveChanges(
                                                Boolean(checked)
                                            )
                                        }
                                    />
                                    I understand the risks and approve any
                                    destructive migration step in this plan.
                                </label>
                                {preview?.diff.hasDestructiveChanges ? (
                                    <div className="grid gap-2">
                                        <div className="text-xs uppercase tracking-wide text-muted-foreground">
                                            Type the confirmation phrase to
                                            continue
                                        </div>
                                        <div className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs">
                                            {DESTRUCTIVE_CONFIRMATION_PHRASE}
                                        </div>
                                        <Input
                                            value={typedConfirmation}
                                            onChange={(event) =>
                                                setTypedConfirmation(
                                                    event.target.value
                                                )
                                            }
                                            placeholder="Type the confirmation phrase exactly"
                                        />
                                    </div>
                                ) : null}
                            </CardContent>
                        </Card>
                        {lastApplyResult ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Last apply result</CardTitle>
                                </CardHeader>
                                <CardContent className="grid gap-2 text-sm">
                                    <div>
                                        Status:{' '}
                                        <strong>
                                            {lastApplyResult.status}
                                        </strong>
                                    </div>
                                    <div>
                                        Executed steps:{' '}
                                        <strong>
                                            {
                                                lastApplyResult
                                                    .executedStatements.length
                                            }
                                        </strong>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : null}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setApplyDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleApply}
                            disabled={
                                !preview ||
                                loading ||
                                (preview.diff.hasDestructiveChanges &&
                                    (!allowDestructiveChanges ||
                                        typedConfirmation !==
                                            DESTRUCTIVE_CONFIRMATION_PHRASE))
                            }
                        >
                            Execute Migration
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};
