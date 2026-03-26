import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Badge } from '@/components/badge/badge';
import { Checkbox } from '@/components/checkbox/checkbox';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/card/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/select/select';
import { useLocalConfig } from '@/hooks/use-local-config';
import { useConfig } from '@/hooks/use-config';
import { useAuth } from '@/features/auth/hooks/use-auth';

export const SettingsPage: React.FC = () => {
    const {
        setShowCardinality,
        setShowDBViews,
        setShowFieldAttributes,
        setShowMiniMapOnCanvas,
        setTheme,
        showCardinality,
        showDBViews,
        showFieldAttributes,
        showMiniMapOnCanvas,
        theme,
    } = useLocalConfig();
    const { config } = useConfig();
    const { enabled, mode, serverReachable } = useAuth();

    return (
        <div className="space-y-6">
            <Helmet>
                <title>ChartDB - Settings</title>
            </Helmet>

            <section className="rounded-[28px] border border-stone-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(245,245,244,0.92))] p-6 shadow-sm dark:border-stone-800/80 dark:bg-[linear-gradient(135deg,rgba(28,25,23,0.94),rgba(12,10,9,0.9))]">
                <div className="flex flex-col gap-3">
                    <Badge
                        variant="outline"
                        className="w-fit border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
                    >
                        Workspace settings
                    </Badge>
                    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                        Settings
                    </h1>
                    <p className="max-w-3xl text-sm leading-6 text-stone-600 dark:text-stone-300 sm:text-base">
                        Configure the saved workspace defaults and the local UI
                        preferences that shape how ChartDB behaves after you log
                        in.
                    </p>
                </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.25fr,1fr]">
                <Card className="border-stone-200/80 bg-white/80 shadow-sm dark:border-stone-800/80 dark:bg-stone-900/80">
                    <CardHeader>
                        <CardTitle>Appearance and canvas preferences</CardTitle>
                        <CardDescription>
                            These settings are stored locally in the browser and
                            affect the current ChartDB user experience.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="space-y-2">
                            <div className="text-sm font-medium">Theme</div>
                            <Select
                                onValueChange={(value) =>
                                    setTheme(
                                        value as 'light' | 'dark' | 'system'
                                    )
                                }
                                value={theme}
                            >
                                <SelectTrigger className="h-11 rounded-xl border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-950/70">
                                    <SelectValue placeholder="Choose theme" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="system">
                                        System
                                    </SelectItem>
                                    <SelectItem value="light">Light</SelectItem>
                                    <SelectItem value="dark">Dark</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="flex items-start gap-3 rounded-2xl border border-stone-200 p-4 dark:border-stone-700">
                                <Checkbox
                                    checked={showCardinality}
                                    onCheckedChange={(checked) =>
                                        setShowCardinality(Boolean(checked))
                                    }
                                />
                                <div className="space-y-1 text-sm">
                                    <div className="font-medium">
                                        Show cardinality
                                    </div>
                                    <div className="text-stone-500">
                                        Keep relationship cardinality markers
                                        visible in diagrams.
                                    </div>
                                </div>
                            </label>
                            <label className="flex items-start gap-3 rounded-2xl border border-stone-200 p-4 dark:border-stone-700">
                                <Checkbox
                                    checked={showFieldAttributes}
                                    onCheckedChange={(checked) =>
                                        setShowFieldAttributes(Boolean(checked))
                                    }
                                />
                                <div className="space-y-1 text-sm">
                                    <div className="font-medium">
                                        Show field attributes
                                    </div>
                                    <div className="text-stone-500">
                                        Display nullability, PK, and other field
                                        metadata in the canvas.
                                    </div>
                                </div>
                            </label>
                            <label className="flex items-start gap-3 rounded-2xl border border-stone-200 p-4 dark:border-stone-700">
                                <Checkbox
                                    checked={showMiniMapOnCanvas}
                                    onCheckedChange={(checked) =>
                                        setShowMiniMapOnCanvas(Boolean(checked))
                                    }
                                />
                                <div className="space-y-1 text-sm">
                                    <div className="font-medium">
                                        Show minimap
                                    </div>
                                    <div className="text-stone-500">
                                        Keep the canvas minimap enabled by
                                        default.
                                    </div>
                                </div>
                            </label>
                            <label className="flex items-start gap-3 rounded-2xl border border-stone-200 p-4 dark:border-stone-700">
                                <Checkbox
                                    checked={showDBViews}
                                    onCheckedChange={(checked) =>
                                        setShowDBViews(Boolean(checked))
                                    }
                                />
                                <div className="space-y-1 text-sm">
                                    <div className="font-medium">
                                        Show database views
                                    </div>
                                    <div className="text-stone-500">
                                        Include database views when the current
                                        source supports them.
                                    </div>
                                </div>
                            </label>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-stone-200/80 bg-white/80 shadow-sm dark:border-stone-800/80 dark:bg-stone-900/80">
                    <CardHeader>
                        <CardTitle>Deployment and saved config</CardTitle>
                        <CardDescription>
                            Current values resolved from the authenticated
                            session and persistent ChartDB config store.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm text-stone-600 dark:text-stone-300">
                        <div className="flex items-center justify-between rounded-2xl bg-stone-100 px-4 py-3 dark:bg-stone-800/80">
                            <span>Authentication mode</span>
                            <span className="font-semibold uppercase text-stone-950 dark:text-stone-50">
                                {enabled ? mode : 'disabled'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl bg-stone-100 px-4 py-3 dark:bg-stone-800/80">
                            <span>Server reachability</span>
                            <span className="font-semibold text-stone-950 dark:text-stone-50">
                                {serverReachable ? 'Online' : 'Offline'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl bg-stone-100 px-4 py-3 dark:bg-stone-800/80">
                            <span>Default diagram id</span>
                            <span className="max-w-[220px] truncate font-semibold text-stone-950 dark:text-stone-50">
                                {config?.defaultDiagramId || 'Not set'}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </section>
        </div>
    );
};
