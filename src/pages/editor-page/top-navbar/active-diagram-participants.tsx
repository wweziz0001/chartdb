import React, { useMemo } from 'react';
import { Avatar, AvatarFallback } from '@/components/avatar/avatar';
import { Badge } from '@/components/badge/badge';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/tooltip/tooltip';
import { useChartDB } from '@/hooks/use-chartdb';
import { cn } from '@/lib/utils';

const MAX_VISIBLE_PARTICIPANTS = 4;

const getParticipantLabel = (displayName: string, isCurrentUser: boolean) =>
    isCurrentUser ? `${displayName} (You)` : displayName;

export const ActiveDiagramParticipants: React.FC = () => {
    const { diagramSession } = useChartDB();

    const participants = useMemo(
        () => diagramSession?.collaboration.presence.participants ?? [],
        [diagramSession?.collaboration.presence.participants]
    );

    if (participants.length === 0) {
        return null;
    }

    const currentSessionId = diagramSession?.session.id;
    const visibleParticipants = participants.slice(0, MAX_VISIBLE_PARTICIPANTS);
    const overflowCount = participants.length - visibleParticipants.length;

    return (
        <div className="flex items-center gap-2">
            <div className="flex items-center">
                {visibleParticipants.map((participant, index) => {
                    const isCurrentUser =
                        participant.sessionId === currentSessionId;

                    return (
                        <Tooltip key={participant.sessionId}>
                            <TooltipTrigger asChild>
                                <div
                                    className={cn(
                                        'relative -ml-2 first:ml-0',
                                        index > 0 &&
                                            'transition-transform hover:z-10 hover:-translate-y-0.5'
                                    )}
                                >
                                    <Avatar
                                        className={cn(
                                            'size-8 border-2 border-background shadow-sm',
                                            isCurrentUser &&
                                                'ring-2 ring-primary/40'
                                        )}
                                    >
                                        <AvatarFallback
                                            className="text-[11px] font-semibold text-white"
                                            style={{
                                                backgroundColor:
                                                    participant.color,
                                            }}
                                        >
                                            {participant.initials}
                                        </AvatarFallback>
                                    </Avatar>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <div className="space-y-1">
                                    <p className="text-sm font-medium">
                                        {getParticipantLabel(
                                            participant.displayName,
                                            isCurrentUser
                                        )}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {participant.email ??
                                            (participant.mode === 'edit'
                                                ? 'Editing'
                                                : 'Viewing')}
                                    </p>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    );
                })}
            </div>

            {overflowCount > 0 ? (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Badge variant="secondary" className="h-8 px-2">
                            +{overflowCount}
                        </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                        <div className="space-y-1">
                            {participants
                                .slice(MAX_VISIBLE_PARTICIPANTS)
                                .map((participant) => {
                                    const isCurrentUser =
                                        participant.sessionId ===
                                        currentSessionId;

                                    return (
                                        <p
                                            key={participant.sessionId}
                                            className="text-sm"
                                        >
                                            {getParticipantLabel(
                                                participant.displayName,
                                                isCurrentUser
                                            )}
                                        </p>
                                    );
                                })}
                        </div>
                    </TooltipContent>
                </Tooltip>
            ) : null}

            <Badge
                variant="outline"
                className="hidden px-2 py-0 text-[10px] uppercase tracking-[0.16em] md:inline-flex"
            >
                {participants.length} live
            </Badge>
        </div>
    );
};
