import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/tooltip/tooltip';
import { useChartDB } from '@/hooks/use-chartdb';
import { ActiveDiagramParticipants } from './active-diagram-participants';

vi.mock('@/hooks/use-chartdb', () => ({
    useChartDB: vi.fn(),
}));

const mockedUseChartDB = vi.mocked(useChartDB);

describe('active diagram participants', () => {
    beforeEach(() => {
        mockedUseChartDB.mockReset();
    });

    it('renders live participant chips with overflow handling', () => {
        mockedUseChartDB.mockReturnValue({
            diagramSession: {
                session: {
                    id: 'session-1',
                },
                collaboration: {
                    presence: {
                        participants: [
                            {
                                sessionId: 'session-1',
                                displayName: 'Alice Adams',
                                initials: 'AA',
                                email: 'alice@example.com',
                                color: '#2563eb',
                            },
                            {
                                sessionId: 'session-2',
                                displayName: 'Bryn Baker',
                                initials: 'BB',
                                email: 'bryn@example.com',
                                color: '#f97316',
                            },
                            {
                                sessionId: 'session-3',
                                displayName: 'Chris Cole',
                                initials: 'CC',
                                email: 'chris@example.com',
                                color: '#14b8a6',
                            },
                            {
                                sessionId: 'session-4',
                                displayName: 'Dana Dunn',
                                initials: 'DD',
                                email: 'dana@example.com',
                                color: '#ec4899',
                            },
                            {
                                sessionId: 'session-5',
                                displayName: 'Eli Ellis',
                                initials: 'EE',
                                email: 'eli@example.com',
                                color: '#8b5cf6',
                            },
                        ],
                    },
                },
            },
        } as never);

        render(
            <TooltipProvider>
                <ActiveDiagramParticipants />
            </TooltipProvider>
        );

        expect(screen.getByText('AA')).toBeInTheDocument();
        expect(screen.getByText('BB')).toBeInTheDocument();
        expect(screen.getByText('CC')).toBeInTheDocument();
        expect(screen.getByText('DD')).toBeInTheDocument();
        expect(screen.getByText('+1')).toBeInTheDocument();
        expect(screen.getByText('5 live')).toBeInTheDocument();
    });

    it('renders nothing when there is no active presence', () => {
        mockedUseChartDB.mockReturnValue({
            diagramSession: {
                session: {
                    id: 'session-1',
                },
                collaboration: {
                    presence: {
                        participants: [],
                    },
                },
            },
        } as never);

        const { container } = render(
            <TooltipProvider>
                <ActiveDiagramParticipants />
            </TooltipProvider>
        );

        expect(container).toBeEmptyDOMElement();
    });
});
