import React, { useMemo } from 'react';
import { useReactFlow, useViewport } from '@xyflow/react';
import { useChartDB } from '@/hooks/use-chartdb';

interface LivePresenceCursorsProps {
    containerRef: React.RefObject<HTMLDivElement | null>;
}

export const LivePresenceCursors: React.FC<LivePresenceCursorsProps> = ({
    containerRef,
}) => {
    const { diagramSession } = useChartDB();
    const { flowToScreenPosition } = useReactFlow();
    useViewport();

    const currentSessionId = diagramSession?.session.id;
    const cursors = useMemo(
        () =>
            (diagramSession?.collaboration.presence.participants ?? []).filter(
                (participant) =>
                    participant.sessionId !== currentSessionId &&
                    participant.cursor
            ),
        [currentSessionId, diagramSession?.collaboration.presence.participants]
    );

    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect || cursors.length === 0) {
        return null;
    }

    return (
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
            {cursors.map((participant) => {
                if (!participant.cursor) {
                    return null;
                }

                const screenPosition = flowToScreenPosition(participant.cursor);
                const x = screenPosition.x - containerRect.left;
                const y = screenPosition.y - containerRect.top;

                return (
                    <div
                        key={participant.sessionId}
                        className="absolute left-0 top-0"
                        style={{
                            transform: `translate(${x}px, ${y}px)`,
                        }}
                    >
                        <svg
                            width="18"
                            height="24"
                            viewBox="0 0 18 24"
                            fill="none"
                            className="-translate-x-1 -translate-y-1 drop-shadow-sm"
                        >
                            <path
                                d="M2 2L15 12L9.5 13.5L11.5 21L8.5 22L6.5 14.5L2 18V2Z"
                                fill={participant.color}
                                stroke="white"
                                strokeWidth="1.5"
                                strokeLinejoin="round"
                            />
                        </svg>
                        <div
                            className="ml-3 rounded-full px-2 py-1 text-[11px] font-semibold text-white shadow-sm"
                            style={{
                                backgroundColor: participant.color,
                            }}
                        >
                            {participant.displayName}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
